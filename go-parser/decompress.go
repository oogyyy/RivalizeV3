package main

import (
	"fmt"
	"io"
	"os/exec"
	"strings"
)

// decompressStream wraps r in a streaming zstd decompressor.
// The caller must close the returned ReadCloser when done.
// Uses the system zstd binary (installed via apk in the Dockerfile).
//
// zstd exits non-zero for CS2 demos that are missing the final endmark,
// but all bytes are already written by then. We close the pipe without
// propagating the error so the parser sees a clean EOF, matching the
// behaviour of the Node.js maybeDecompress helper.
func decompressStream(r io.Reader) (io.ReadCloser, error) {
	if _, err := exec.LookPath("zstd"); err != nil {
		return nil, fmt.Errorf("zstd binary not found: %w", err)
	}

	cmd := exec.Command("zstd", "-d", "--stdout", "--force")
	cmd.Stdin = r
	cmd.Stderr = io.Discard // suppress "Missing endmark" warnings

	pr, pw := io.Pipe()
	cmd.Stdout = pw

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start zstd: %w", err)
	}

	go func() {
		// Wait for zstd to finish (or fail on truncated demo).
		// Always close the write-end so the read-end sees EOF.
		cmd.Wait() //nolint:errcheck — truncated-demo exit code is expected
		pw.Close()
	}()

	return pr, nil
}

func isCompressed(r2Key string) bool {
	return strings.HasSuffix(strings.ToLower(r2Key), ".zst")
}
