package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
)

var httpClient = &http.Client{
	// No global timeout — individual requests set their own via context.
	Transport: &http.Transport{
		MaxIdleConnsPerHost: 4,
		IdleConnTimeout:     90 * time.Second,
	},
}

// streamFromPresignedURL opens a streaming GET to a presigned R2 URL.
// The caller must close the returned ReadCloser when done.
// Returns the body reader and the Content-Length (-1 if unknown).
func streamFromPresignedURL(ctx context.Context, presignedURL string) (io.ReadCloser, int64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, presignedURL, nil)
	if err != nil {
		return nil, -1, fmt.Errorf("build GET request: %w", err)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, -1, fmt.Errorf("GET presigned URL: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, -1, fmt.Errorf("presigned GET returned HTTP %d", resp.StatusCode)
	}
	return resp.Body, resp.ContentLength, nil
}

// uploadToPresignedURL PUTs data to a presigned R2 URL using stdlib only.
func uploadToPresignedURL(ctx context.Context, presignedURL string, data []byte) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, presignedURL, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("build PUT request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.ContentLength = int64(len(data))

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("PUT presigned URL: %w", err)
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body) // drain so the connection can be reused

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("presigned PUT returned HTTP %d", resp.StatusCode)
	}
	return nil
}
