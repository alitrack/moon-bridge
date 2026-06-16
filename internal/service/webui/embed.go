package webui

import (
	"embed"
	"io/fs"
	"mime"
	"net/http"
	"path"
	"strings"
)

//go:embed dist
var embedded embed.FS

// Embedded returns the production console handler backed by embedded assets.
func Embedded() http.Handler {
	dist, err := fs.Sub(embedded, "dist")
	if err != nil {
		panic(err)
	}
	return NewHandler(dist)
}

// NewHandler serves a console SPA rooted at /console/.
func NewHandler(content fs.FS) http.Handler {
	return &handler{content: content}
}

type handler struct {
	content fs.FS
}

func (h *handler) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	name := strings.TrimPrefix(request.URL.Path, "/console/")
	name = strings.TrimPrefix(name, "/")
	if name == "" {
		h.serveFile(writer, request, "index.html")
		return
	}

	name = path.Clean(name)
	if name == "." || strings.HasPrefix(name, "../") || !fs.ValidPath(name) {
		http.NotFound(writer, request)
		return
	}

	if info, err := fs.Stat(h.content, name); err == nil && !info.IsDir() {
		h.serveFile(writer, request, name)
		return
	}

	h.serveFile(writer, request, "index.html")
}

func (h *handler) serveFile(writer http.ResponseWriter, request *http.Request, name string) {
	data, err := fs.ReadFile(h.content, name)
	if err != nil {
		http.NotFound(writer, request)
		return
	}
	if contentType := mime.TypeByExtension(path.Ext(name)); contentType != "" {
		writer.Header().Set("Content-Type", contentType)
	} else {
		writer.Header().Set("Content-Type", http.DetectContentType(data))
	}
	if request.Method == http.MethodHead {
		return
	}
	_, _ = writer.Write(data)
}
