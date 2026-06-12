package api

import (
	"encoding/json"
	"net/http"
)

// modeRequest is the expected JSON body for POST /v1/admin/mode.
type modeRequest struct {
	Provider string `json:"provider"`
}

// modeResponse is the JSON response for POST /v1/admin/mode.
type modeResponse struct {
	Mode     string `json:"mode"`
	Previous string `json:"previous,omitempty"`
}

func (r *Router) handlePostMode(w http.ResponseWriter, req *http.Request) {
	if r.runtime == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"error": "runtime not available"})
		return
	}

	var body modeRequest
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid JSON body: " + err.Error()})
		return
	}

	previous := r.runtime.ProviderMode()
	r.runtime.SetProviderMode(body.Provider)

	resp := modeResponse{
		Mode:     body.Provider,
		Previous: previous,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
