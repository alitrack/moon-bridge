package server

import (
	"encoding/json"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"moonbridge/internal/protocol/openai"
)

// CacheStats tracks cache hit/miss metrics from upstream LLM responses.
// All counters are atomic and safe for concurrent use.
type CacheStats struct {
	startedAt time.Time

	// Per-model breakdown.
	mu     sync.RWMutex
	models map[string]*modelCacheStats
}

type modelCacheStats struct {
	Requests     int64 `json:"requests"`
	InputTokens  int64 `json:"input_tokens"`
	CacheHit     int64 `json:"cache_hit_tokens"`
	CacheMiss    int64 `json:"cache_miss_tokens"`
	CacheWrite   int64 `json:"cache_write_tokens"`
	OutputTokens int64 `json:"output_tokens"`
}

// CacheStatsSnapshot is a point-in-time copy of cache statistics.
type CacheStatsSnapshot struct {
	Period         string                      `json:"period"`
	UptimeSeconds  int64                       `json:"uptime_seconds"`
	TotalRequests  int64                       `json:"total_requests"`
	CacheHitTokens int64                       `json:"cache_hit_tokens"`
	CacheMissTokens int64                      `json:"cache_miss_tokens"`
	CacheWriteTokens int64                     `json:"cache_write_tokens"`
	InputTokens    int64                       `json:"total_input_tokens"`
	OutputTokens   int64                       `json:"total_output_tokens"`
	HitRate        float64                     `json:"hit_rate"`
	ByModel        map[string]modelCacheStats `json:"by_model"`
}

// CacheUsage contains token breakdown from a single upstream response.
type CacheUsage struct {
	InputTokens       int64
	OutputTokens      int64
	CacheReadTokens   int64 // cache hit tokens
	CacheWriteTokens  int64 // cache creation/miss tokens
}

// NewCacheStats creates a new cache stats tracker.
func NewCacheStats() *CacheStats {
	return &CacheStats{
		startedAt: time.Now(),
		models:    make(map[string]*modelCacheStats),
	}
}

// Record records cache usage from a single response for a model.
func (cs *CacheStats) Record(model string, usage CacheUsage) {
	if cs == nil {
		return
	}

	cs.mu.Lock()
	ms, ok := cs.models[model]
	if !ok {
		ms = &modelCacheStats{}
		cs.models[model] = ms
	}
	cs.mu.Unlock()

	atomic.AddInt64(&ms.Requests, 1)
	atomic.AddInt64(&ms.InputTokens, usage.InputTokens)
	atomic.AddInt64(&ms.OutputTokens, usage.OutputTokens)
	atomic.AddInt64(&ms.CacheHit, usage.CacheReadTokens)
	atomic.AddInt64(&ms.CacheMiss, usage.InputTokens-usage.CacheReadTokens-usage.CacheWriteTokens)
	atomic.AddInt64(&ms.CacheWrite, usage.CacheWriteTokens)
}

// Snapshot returns a point-in-time copy of all stats.
func (cs *CacheStats) Snapshot() CacheStatsSnapshot {
	if cs == nil {
		return CacheStatsSnapshot{Period: "since_restart"}
	}

	cs.mu.RLock()
	defer cs.mu.RUnlock()

	snap := CacheStatsSnapshot{
		Period:        "since_restart",
		UptimeSeconds: int64(time.Since(cs.startedAt).Seconds()),
		ByModel:       make(map[string]modelCacheStats, len(cs.models)),
	}

	for k, v := range cs.models {
		ms := modelCacheStats{
			Requests:     atomic.LoadInt64(&v.Requests),
			InputTokens:  atomic.LoadInt64(&v.InputTokens),
			CacheHit:     atomic.LoadInt64(&v.CacheHit),
			CacheMiss:    atomic.LoadInt64(&v.CacheMiss),
			CacheWrite:   atomic.LoadInt64(&v.CacheWrite),
			OutputTokens: atomic.LoadInt64(&v.OutputTokens),
		}
		snap.ByModel[k] = ms

		snap.TotalRequests += ms.Requests
		snap.InputTokens += ms.InputTokens
		snap.CacheHitTokens += ms.CacheHit
		snap.CacheMissTokens += ms.CacheMiss
		snap.CacheWriteTokens += ms.CacheWrite
		snap.OutputTokens += ms.OutputTokens
	}

	totalInput := snap.CacheHitTokens + snap.CacheMissTokens + snap.CacheWriteTokens
	if totalInput > 0 {
		snap.HitRate = float64(snap.CacheHitTokens) / float64(totalInput)
	}

	return snap
}

// ServeHTTP implements http.Handler for GET /api/v1/cache/stats.
func (cs *CacheStats) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeOpenAIError(w, http.StatusMethodNotAllowed, openai.ErrorResponse{Error: openai.ErrorObject{
			Message: "Only GET is supported",
			Type:    "invalid_request_error",
			Code:    "method_not_allowed",
		}})
		return
	}

	snap := cs.Snapshot()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(snap)
}
