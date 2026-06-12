// Package metrics implements metrics persistence using the foundation/db Store.
package metrics

import (
	"context"
	"fmt"
	"time"

	"moonbridge/internal/db"
)

// Record represents a single request metric row.
type Record struct {
	ID                      int64         `json:"id"`
	Timestamp               time.Time     `json:"timestamp"`
	Model                   string        `json:"model"`
	ActualModel             string        `json:"actual_model"`
	ProviderKey             string        `json:"provider_key,omitempty"`
	InputTokens             int64         `json:"input_tokens"`
	OutputTokens            int64         `json:"output_tokens"`
	CacheCreation           int64         `json:"cache_creation"`
	CacheRead               int64         `json:"cache_read"`
	Protocol                string        `json:"protocol"`
	UsageSource             string        `json:"usage_source"`
	RawInputTokens          int64         `json:"raw_input_tokens"`
	RawOutputTokens         int64         `json:"raw_output_tokens"`
	RawCacheCreation        int64         `json:"raw_cache_creation"`
	RawCacheRead            int64         `json:"raw_cache_read"`
	NormalizedInputTokens   int64         `json:"normalized_input_tokens"`
	NormalizedOutputTokens  int64         `json:"normalized_output_tokens"`
	NormalizedCacheCreation int64         `json:"normalized_cache_creation"`
	NormalizedCacheRead     int64         `json:"normalized_cache_read"`
	RawUsageJSON            string        `json:"raw_usage_json,omitempty"`
	Cost                    float64       `json:"cost"`
	ResponseTime            time.Duration `json:"response_time"`
	Status                  string        `json:"status"`
	ErrorMessage            string        `json:"error_message,omitempty"`
}

// QueryOptions controls filtering and ordering for Record queries.
type QueryOptions struct {
	Limit    int
	Offset   int
	Since    time.Time
	Until    time.Time
	Model    string
	Status   string
	OrderAsc bool
}

// Store provides metrics CRUD operations backed by a foundation/db.Store.
type Store struct {
	s db.Store
}

// NewStore creates a metrics Store backed by the given database Store.
func NewStore(s db.Store) *Store {
	return &Store{s: s}
}

// MetricsTable returns the TableSpec for the metrics extension.
func MetricsTable() db.TableSpec {
	return db.TableSpec{
		Name: "request_metrics",
		Schema: `CREATE TABLE IF NOT EXISTS {{table}} (
			id              INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp       TEXT    NOT NULL,
			model           TEXT    NOT NULL DEFAULT '',
			provider_key    TEXT    NOT NULL DEFAULT '',
			actual_model    TEXT    NOT NULL DEFAULT '',
			input_tokens    INTEGER NOT NULL DEFAULT 0,
			output_tokens   INTEGER NOT NULL DEFAULT 0,
			cache_creation  INTEGER NOT NULL DEFAULT 0,
			cache_read      INTEGER NOT NULL DEFAULT 0,
			protocol        TEXT    NOT NULL DEFAULT '',
			usage_source    TEXT    NOT NULL DEFAULT '',
			raw_input_tokens INTEGER NOT NULL DEFAULT 0,
			raw_output_tokens INTEGER NOT NULL DEFAULT 0,
			raw_cache_creation INTEGER NOT NULL DEFAULT 0,
			raw_cache_read INTEGER NOT NULL DEFAULT 0,
			normalized_input_tokens INTEGER NOT NULL DEFAULT 0,
			normalized_output_tokens INTEGER NOT NULL DEFAULT 0,
			normalized_cache_creation INTEGER NOT NULL DEFAULT 0,
			normalized_cache_read INTEGER NOT NULL DEFAULT 0,
			raw_usage_json TEXT    NOT NULL DEFAULT '',
			cost            REAL    NOT NULL DEFAULT 0.0,
			response_time_ms INTEGER NOT NULL DEFAULT 0,
			status          TEXT    NOT NULL DEFAULT 'success',
			error_message   TEXT    NOT NULL DEFAULT ''
		)`,
		Indexes: []db.IndexSpec{
			{Name: "timestamp", SQL: `CREATE INDEX IF NOT EXISTS {{index}} ON {{table}}(timestamp)`},
			{Name: "model", SQL: `CREATE INDEX IF NOT EXISTS {{index}} ON {{table}}(model)`},
			{Name: "status", SQL: `CREATE INDEX IF NOT EXISTS {{index}} ON {{table}}(status)`},
		},
	}
}

// Record inserts a request metric row.
func (s *Store) Record(r Record) error {
	if s == nil || s.s == nil {
		return nil
	}
	table, err := s.s.Table("request_metrics")
	if err != nil {
		return err
	}
	ms := r.ResponseTime.Milliseconds()
	ts := r.Timestamp.UTC().Format(time.RFC3339Nano)
	query := fmt.Sprintf(`INSERT INTO %s
		(timestamp, model, actual_model, provider_key, input_tokens, output_tokens,
		 cache_creation, cache_read, protocol, usage_source,
		 raw_input_tokens, raw_output_tokens, raw_cache_creation, raw_cache_read,
		 normalized_input_tokens, normalized_output_tokens, normalized_cache_creation, normalized_cache_read,
		 raw_usage_json, cost, response_time_ms, status, error_message)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, table)
	_, err = s.s.ExecContext(context.Background(), query,
		ts, r.Model, r.ActualModel, r.ProviderKey,
		r.InputTokens, r.OutputTokens, r.CacheCreation, r.CacheRead,
		r.Protocol, r.UsageSource,
		r.RawInputTokens, r.RawOutputTokens, r.RawCacheCreation, r.RawCacheRead,
		r.NormalizedInputTokens, r.NormalizedOutputTokens, r.NormalizedCacheCreation, r.NormalizedCacheRead,
		r.RawUsageJSON,
		r.Cost, ms, r.Status, r.ErrorMessage,
	)
	return err
}

// Query retrieves request metrics matching the given options.
func (s *Store) Query(opts QueryOptions) ([]Record, error) {
	if s == nil || s.s == nil {
		return nil, nil
	}
	table, err := s.s.Table("request_metrics")
	if err != nil {
		return nil, err
	}
	if opts.Limit <= 0 {
		opts.Limit = 100
	}

	var whereClauses []string
	var args []any

	if !opts.Since.IsZero() {
		whereClauses = append(whereClauses, "timestamp >= ?")
		args = append(args, opts.Since.UTC().Format(time.RFC3339Nano))
	}
	if !opts.Until.IsZero() {
		whereClauses = append(whereClauses, "timestamp < ?")
		args = append(args, opts.Until.UTC().Format(time.RFC3339Nano))
	}
	if opts.Model != "" {
		whereClauses = append(whereClauses, "model = ?")
		args = append(args, opts.Model)
	}
	if opts.Status != "" {
		whereClauses = append(whereClauses, "status = ?")
		args = append(args, opts.Status)
	}

	order := "DESC"
	if opts.OrderAsc {
		order = "ASC"
	}

	query := fmt.Sprintf("SELECT id, timestamp, model, actual_model, provider_key, input_tokens, output_tokens, "+
		"cache_creation, cache_read, protocol, usage_source, "+
		"raw_input_tokens, raw_output_tokens, raw_cache_creation, raw_cache_read, "+
		"normalized_input_tokens, normalized_output_tokens, normalized_cache_creation, normalized_cache_read, "+
		"raw_usage_json, cost, response_time_ms, status, error_message "+
		"FROM %s", table)
	if len(whereClauses) > 0 {
		query += " WHERE " + joinClauses(whereClauses)
	}
	query += " ORDER BY id " + order + " LIMIT ? OFFSET ?"
	args = append(args, opts.Limit, opts.Offset)

	rows, err := s.s.QueryContext(context.Background(), query, args...)
	if err != nil {
		return nil, fmt.Errorf("query metrics: %w", err)
	}
	defer rows.Close()

	var records []Record
	for rows.Next() {
		var r Record
		var ts string
		var ms int64
		err := rows.Scan(
			&r.ID, &ts, &r.Model, &r.ActualModel, &r.ProviderKey,
			&r.InputTokens, &r.OutputTokens, &r.CacheCreation, &r.CacheRead,
			&r.Protocol, &r.UsageSource,
			&r.RawInputTokens, &r.RawOutputTokens, &r.RawCacheCreation, &r.RawCacheRead,
			&r.NormalizedInputTokens, &r.NormalizedOutputTokens, &r.NormalizedCacheCreation, &r.NormalizedCacheRead,
			&r.RawUsageJSON,
			&r.Cost, &ms, &r.Status, &r.ErrorMessage,
		)
		if err != nil {
			return nil, fmt.Errorf("scan metrics row: %w", err)
		}
		r.Timestamp, _ = time.Parse(time.RFC3339Nano, ts)
		r.ResponseTime = time.Duration(ms) * time.Millisecond
		records = append(records, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate metrics rows: %w", err)
	}
	return records, nil
}

// Summary holds aggregated metrics for a time range.
type Summary struct {
	PeriodStart      string             `json:"period_start"`
	PeriodEnd        string             `json:"period_end"`
	TotalRequests    int64              `json:"total_requests"`
	TotalInputTokens int64              `json:"total_input_tokens"`
	TotalOutputTokens int64             `json:"total_output_tokens"`
	TotalCost        float64            `json:"total_cost"`
	TotalDurationMs  int64              `json:"total_duration_ms"`
	ByModel          []ModelSummary     `json:"by_model"`
	ByProvider       []ProviderSummary  `json:"by_provider"`
}

// ModelSummary holds per-model aggregate metrics.
type ModelSummary struct {
	Model        string  `json:"model"`
	ActualModel  string  `json:"actual_model,omitempty"`
	Requests     int64   `json:"requests"`
	InputTokens  int64   `json:"input_tokens"`
	OutputTokens int64   `json:"output_tokens"`
	Cost         float64 `json:"cost"`
	AvgLatencyMs float64 `json:"avg_latency_ms"`
	ErrorCount   int64   `json:"error_count"`
}

// ProviderSummary holds per-provider aggregate metrics.
type ProviderSummary struct {
	ProviderKey  string  `json:"provider_key"`
	Requests     int64   `json:"requests"`
	InputTokens  int64   `json:"input_tokens"`
	OutputTokens int64   `json:"output_tokens"`
	Cost         float64 `json:"cost"`
}

// SummaryOptions controls time range for summary queries.
type SummaryOptions struct {
	Since time.Time
	Until time.Time
}

// Summary runs an aggregate query and returns a Summary.
func (s *Store) Summary(opts SummaryOptions) (*Summary, error) {
	if s == nil || s.s == nil {
		return nil, nil
	}
	table, err := s.s.Table("request_metrics")
	if err != nil {
		return nil, err
	}

	since := opts.Since
	until := opts.Until
	if since.IsZero() {
		since = time.Now().Truncate(24 * time.Hour)
	}
	if until.IsZero() {
		until = time.Now()
	}

	sinceStr := since.UTC().Format(time.RFC3339Nano)
	untilStr := until.UTC().Format(time.RFC3339Nano)

	// Overall totals (only success requests for token/cost counting).
	totalQuery := fmt.Sprintf(
		`SELECT COUNT(*), COALESCE(SUM(input_tokens),0), COALESCE(SUM(output_tokens),0),
		        COALESCE(SUM(cost),0), COALESCE(SUM(response_time_ms),0)
		 FROM %s WHERE timestamp >= ? AND timestamp < ? AND status = 'success'`,
		table,
	)
	var totalReqs, totalIn, totalOut, totalDur int64
	var totalCost float64
	if err := s.s.QueryRowContext(context.Background(), totalQuery, sinceStr, untilStr).
		Scan(&totalReqs, &totalIn, &totalOut, &totalCost, &totalDur); err != nil {
		return nil, fmt.Errorf("summary totals: %w", err)
	}

	// Per-model breakdown.
	modelQuery := fmt.Sprintf(
		`SELECT model, actual_model, COUNT(*), COALESCE(SUM(input_tokens),0), COALESCE(SUM(output_tokens),0),
		        COALESCE(SUM(cost),0), COALESCE(AVG(response_time_ms),0),
		        SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END)
		 FROM %s WHERE timestamp >= ? AND timestamp < ?
		 GROUP BY model, actual_model ORDER BY SUM(cost) DESC LIMIT 20`,
		table,
	)
	modelRows, err := s.s.QueryContext(context.Background(), modelQuery, sinceStr, untilStr)
	if err != nil {
		return nil, fmt.Errorf("summary by model: %w", err)
	}
	defer modelRows.Close()
	var byModel []ModelSummary
	for modelRows.Next() {
		var m ModelSummary
		if err := modelRows.Scan(&m.Model, &m.ActualModel, &m.Requests, &m.InputTokens,
			&m.OutputTokens, &m.Cost, &m.AvgLatencyMs, &m.ErrorCount); err != nil {
			return nil, fmt.Errorf("scan model summary: %w", err)
		}
		byModel = append(byModel, m)
	}

	// Per-provider breakdown.
	providerQuery := fmt.Sprintf(
		`SELECT provider_key, COUNT(*), COALESCE(SUM(input_tokens),0), COALESCE(SUM(output_tokens),0),
		        COALESCE(SUM(cost),0)
		 FROM %s WHERE timestamp >= ? AND timestamp < ? AND status = 'success'
		 GROUP BY provider_key ORDER BY SUM(cost) DESC`,
		table,
	)
	provRows, err := s.s.QueryContext(context.Background(), providerQuery, sinceStr, untilStr)
	if err != nil {
		return nil, fmt.Errorf("summary by provider: %w", err)
	}
	defer provRows.Close()
	var byProvider []ProviderSummary
	for provRows.Next() {
		var p ProviderSummary
		if err := provRows.Scan(&p.ProviderKey, &p.Requests, &p.InputTokens,
			&p.OutputTokens, &p.Cost); err != nil {
			return nil, fmt.Errorf("scan provider summary: %w", err)
		}
		byProvider = append(byProvider, p)
	}

	return &Summary{
		PeriodStart:      since.UTC().Format(time.RFC3339),
		PeriodEnd:        until.UTC().Format(time.RFC3339),
		TotalRequests:    totalReqs,
		TotalInputTokens: totalIn,
		TotalOutputTokens: totalOut,
		TotalCost:        totalCost,
		TotalDurationMs:  totalDur,
		ByModel:          byModel,
		ByProvider:       byProvider,
	}, nil
}

func joinClauses(clauses []string) string {
	result := ""
	for i, c := range clauses {
		if i > 0 {
			result += " AND "
		}
		result += c
	}
	return result
}
