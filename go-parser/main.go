package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	http.HandleFunc("/health", handleHealth)
	http.HandleFunc("/parse", handleParse)

	log.Printf("go-parser listening on :%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprint(w, `{"ok":true}`)
}

func handleParse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Recover from unexpected panics so a bad demo file can't bring down the server
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("[parse] recovered from panic: %v", rec)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnprocessableEntity)
			json.NewEncoder(w).Encode(map[string]string{"error": fmt.Sprintf("parser panic: %v", rec)})
		}
	}()

	// Accept either multipart form upload or raw body
	var buf []byte
	var err error

	ct := r.Header.Get("Content-Type")
	if len(ct) > 9 && ct[:9] == "multipart" {
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

	result, parseErr := parseDemo(buf)
	if parseErr != nil {
		log.Printf("[parse] error: %v", parseErr)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		json.NewEncoder(w).Encode(map[string]string{"error": parseErr.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(result); err != nil {
		log.Printf("[parse] encode error: %v", err)
	}
}
