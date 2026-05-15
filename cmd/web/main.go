package main

import (
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var hashedAsset = regexp.MustCompile(`-[A-Z0-9]{8,}\.(js|css|map|woff2?|png|svg|jpg)$`)

func main() {
	addr := envOr("ADDR", ":8081")
	distDir := envOr("DIST_DIR", "./dist")
	apiBackend := os.Getenv("API_BACKEND_URL")

	mux := http.NewServeMux()

	if apiBackend != "" {
		u, err := url.Parse(apiBackend)
		if err != nil {
			slog.Error("invalid API_BACKEND_URL", "err", err)
			os.Exit(1)
		}
		// Strip /api before forwarding so the API server sees its own paths
		// (it has /v1/..., /healthz, etc — not /api/v1/...).
		proxy := httputil.NewSingleHostReverseProxy(u)
		mux.Handle("/api/", http.StripPrefix("/api", proxy))
		slog.Info("dev proxy", "prefix", "/api/", "to", apiBackend)
	}

	files := http.FileServer(http.Dir(distDir))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		clean := filepath.Clean(strings.TrimPrefix(r.URL.Path, "/"))
		path := filepath.Join(distDir, clean)

		info, err := os.Stat(path)
		if err == nil && !info.IsDir() {
			if hashedAsset.MatchString(r.URL.Path) {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			} else {
				w.Header().Set("Cache-Control", "no-store")
			}
			files.ServeHTTP(w, r)
			return
		}

		w.Header().Set("Cache-Control", "no-store")
		http.ServeFile(w, r, filepath.Join(distDir, "index.html"))
	})

	slog.Info("web starting", "addr", addr, "dist", distDir)
	srv := &http.Server{Addr: addr, Handler: mux}
	if err := srv.ListenAndServe(); err != nil {
		slog.Error("server failed", "err", err)
		os.Exit(1)
	}
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
