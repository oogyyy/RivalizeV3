package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"
)

func main() {
	// Write logs to stdout so Railway doesn't classify them as errors
	// (Go's default log target is stderr, which Railway marks as error-level).
	log.SetOutput(os.Stdout)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/parse", handleParse)

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
		// ReadHeaderTimeout guards against Slowloris attacks.
		// ReadTimeout + WriteTimeout cover the full parse lifecycle:
		//   download 500 MB + parse (up to 15 min) + upload result
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Minute,
		WriteTimeout:      30 * time.Minute,
		IdleTimeout:       30 * time.Second,
	}

	log.Printf("[go-parser] listening on :%s", port)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprint(w, `{"ok":true}`)
}

// ParseJobRequest is the JSON body for the new R2-based parse endpoint.
type ParseJobRequest struct {
	DemoID              string `json:"demo_id"`
	R2Key               string `json:"r2_key"`               // original R2 key — used to detect .zst
	DemoDownloadURL     string `json:"demo_download_url"`      // presigned R2 GET URL
	ParsedJSONUploadURL string `json:"parsed_json_upload_url"` // presigned R2 PUT URL
	ParsedJSONPublicURL string `json:"parsed_json_public_url"` // permanent public URL
}

// ParseJobResponse is returned on success.
type ParseJobResponse struct {
	OK            bool   `json:"ok"`
	DemoID        string `json:"demo_id"`
	ParsedJSONURL string `json:"parsed_json_url"`
}

func handleParse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Reject requests missing the shared secret (set PARSER_SECRET on both services).
	// An empty PARSER_SECRET disables auth (dev/test only).
	if secret := os.Getenv("PARSER_SECRET"); secret != "" {
		if r.Header.Get("X-Parser-Secret") != secret {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
	}

	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("[parse] recovered from panic: %v", rec)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnprocessableEntity)
			json.NewEncoder(w).Encode(map[string]string{"error": fmt.Sprintf("parser panic: %v", rec)})
		}
	}()

	ct := r.Header.Get("Content-Type")

	if strings.HasPrefix(ct, "application/json") {
		handleParseJob(w, r)
		return
	}

	// Legacy: multipart or raw body upload (kept for backward compatibility).
	handleParseLegacy(w, r)
}

// handleParseJob processes the new JSON-based parse request.
// The caller supplies presigned R2 URLs; this handler only uses stdlib net/http.
func handleParseJob(w http.ResponseWriter, r *http.Request) {
	var req ParseJobRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	if req.DemoID == "" || req.R2Key == "" || req.DemoDownloadURL == "" || req.ParsedJSONUploadURL == "" || req.ParsedJSONPublicURL == "" {
		http.Error(w, "missing required fields: demo_id, r2_key, demo_download_url, parsed_json_upload_url, parsed_json_public_url", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	start := time.Now()
	log.Printf("[go-parser] [demoId=%s] Starting parse job", req.DemoID)

	// 1. Stream demo from R2 presigned URL directly into the parser.
	demoStream, streamSize, err := streamFromPresignedURL(ctx, req.DemoDownloadURL)
	if err != nil {
		log.Printf("[go-parser] [demoId=%s] R2 download failed: %v", req.DemoID, err)
		writeJSONError(w, http.StatusBadGateway, "R2 download failed: "+err.Error())
		return
	}
	defer demoStream.Close()
	log.Printf("[go-parser] [demoId=%s] Streaming demo (%s) into parser (compressed=%v)", req.DemoID, humanBytes(streamSize), isCompressed(req.R2Key))

	// 2. Decompress on-the-fly if needed, then parse from the stream.
	// Streaming decompression means no large buffers — zstd pipes directly
	// into demoinfocs, keeping peak memory to just the parse structures.
	var demoReader io.Reader = demoStream
	if isCompressed(req.R2Key) {
		decompressed, err := decompressStream(demoStream)
		if err != nil {
			log.Printf("[go-parser] [demoId=%s] Decompression setup failed: %v", req.DemoID, err)
			writeJSONError(w, http.StatusUnprocessableEntity, "decompression failed: "+err.Error())
			return
		}
		defer decompressed.Close()
		demoReader = decompressed
	}

	result, parseErr := parseDemo(demoReader)
	if parseErr != nil {
		log.Printf("[go-parser] [demoId=%s] Parse failed: %v", req.DemoID, parseErr)
		writeJSONError(w, http.StatusUnprocessableEntity, "parse failed: "+parseErr.Error())
		return
	}
	log.Printf("[go-parser] [demoId=%s] Parsed %d players, %d rounds in %.1fs",
		req.DemoID, len(result.Players), len(result.Rounds), time.Since(start).Seconds())

	// Force GC after parsing to reclaim the demoinfocs structures.
	runtime.GC()

	// 3. Marshal parsed JSON.
	parsedJSON, err := json.Marshal(result)
	if err != nil {
		log.Printf("[go-parser] [demoId=%s] JSON marshal failed: %v", req.DemoID, err)
		writeJSONError(w, http.StatusInternalServerError, "marshal failed: "+err.Error())
		return
	}
	log.Printf("[go-parser] [demoId=%s] Marshaled result (%s)", req.DemoID, humanBytes(int64(len(parsedJSON))))

	// 4. Upload parsed JSON to R2 via presigned PUT URL.
	if err := uploadToPresignedURL(ctx, req.ParsedJSONUploadURL, parsedJSON); err != nil {
		log.Printf("[go-parser] [demoId=%s] R2 upload failed: %v", req.DemoID, err)
		writeJSONError(w, http.StatusBadGateway, "R2 upload failed: "+err.Error())
		return
	}
	log.Printf("[go-parser] [demoId=%s] Uploaded parsed JSON to R2", req.DemoID)

	// Release JSON bytes before Supabase call.
	parsedJSON = nil
	runtime.GC()

	// 5. Lightweight Supabase update: status='parsed', parsed_json_url.
	if err := updateDemoParsed(ctx, req.DemoID, req.ParsedJSONPublicURL); err != nil {
		// Log and return error — worker will retry the whole job.
		log.Printf("[go-parser] [demoId=%s] Supabase update failed: %v", req.DemoID, err)
		writeJSONError(w, http.StatusBadGateway, "Supabase update failed: "+err.Error())
		return
	}
	log.Printf("[go-parser] [demoId=%s] Updated Supabase status=parsed (total %.1fs)",
		req.DemoID, time.Since(start).Seconds())

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ParseJobResponse{
		OK:            true,
		DemoID:        req.DemoID,
		ParsedJSONURL: req.ParsedJSONPublicURL,
	})
}

// handleParseLegacy accepts raw or multipart demo file bodies.
// Kept for backward compatibility during the transition period.
func handleParseLegacy(w http.ResponseWriter, r *http.Request) {
	var (
		buf []byte
		err error
	)

	ct := r.Header.Get("Content-Type")
	if strings.HasPrefix(ct, "multipart") {
		if err = r.ParseMultipartForm(512 << 20); err != nil {
			http.Error(w, "failed to parse multipart: "+err.Error(), http.StatusBadRequest)
			return
		}
		f, _, ferr := r.FormFile("demo")
		if ferr != nil {
			http.Error(w, "missing 'demo' field: "+ferr.Error(), http.StatusBadRequest)
			return
		}
		defer f.Close()
		buf, err = io.ReadAll(f)
	} else {
		buf, err = io.ReadAll(r.Body)
	}
	if err != nil {
		http.Error(w, "failed to read body: "+err.Error(), http.StatusBadRequest)
		return
	}
	if len(buf) < 8 {
		http.Error(w, "file too small to be a valid demo", http.StatusBadRequest)
		return
	}

	result, parseErr := parseDemoBuf(buf)
	buf = nil
	if parseErr != nil {
		log.Printf("[parse] legacy error: %v", parseErr)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		json.NewEncoder(w).Encode(map[string]string{"error": parseErr.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(result); err != nil {
		log.Printf("[parse] legacy encode error: %v", err)
	}
}

func writeJSONError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func humanBytes(n int64) string {
	switch {
	case n >= 1<<30:
		return fmt.Sprintf("%.1f GB", float64(n)/float64(1<<30))
	case n >= 1<<20:
		return fmt.Sprintf("%.1f MB", float64(n)/float64(1<<20))
	case n >= 1<<10:
		return fmt.Sprintf("%.1f KB", float64(n)/float64(1<<10))
	default:
		return fmt.Sprintf("%d B", n)
	}
}
