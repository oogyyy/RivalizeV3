package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// updateDemoParsed sets status='parsed', parsed_at, and parsed_json_url on the
// demos row using the Supabase REST API with the service_role key.
// This is the only Supabase call the Go parser makes — it is intentionally tiny.
func updateDemoParsed(ctx context.Context, demoID, parsedJSONURL string) error {
	supabaseURL := os.Getenv("SUPABASE_URL")
	serviceRoleKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")
	if supabaseURL == "" || serviceRoleKey == "" {
		return fmt.Errorf("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
	}

	endpoint := supabaseURL + "/rest/v1/demos?id=eq." + demoID

	body := map[string]interface{}{
		"status":                "parsed",
		"parsed_at":             time.Now().UTC().Format(time.RFC3339Nano),
		"parsed_json_url":       parsedJSONURL,
		"processing_started_at": nil, // reset so worker can claim it for the apply step
		"error_message":         nil,
	}

	bodyJSON, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal update body: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, endpoint, bytes.NewReader(bodyJSON))
	if err != nil {
		return fmt.Errorf("build PATCH request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", serviceRoleKey)
	req.Header.Set("Authorization", "Bearer "+serviceRoleKey)
	req.Header.Set("Prefer", "return=minimal")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("Supabase PATCH: %w", err)
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("Supabase PATCH returned HTTP %d for demo %s", resp.StatusCode, demoID)
	}
	return nil
}
