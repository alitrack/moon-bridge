package deepseekv4

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"moonbridge/internal/format"

	_ "modernc.org/sqlite"
)

// Defaults for persistent reasoning cache.
const (
	defaultReasoningCacheMaxAgeSeconds = 30 * 24 * 3600 // 30 days
	defaultReasoningCacheMaxRows       = 100_000
	defaultReasoningCacheDBName        = "reasoning_cache.sqlite3"
)

// SQLiteState provides optional persistent storage for thinking/reasoning
// blocks. It wraps the in-memory State and falls back to SQLite queries
// when the in-memory cache misses.
//
// Thread-safe: all public methods are guarded by sync.Mutex.
type SQLiteState struct {
	mu      sync.Mutex
	db      *sql.DB
	inner   *State // in-memory fallback (always on)
	maxAge  time.Duration
	maxRows int
	dbPath  string
}

// SQLiteStateFromPath opens (or creates) a SQLite database at dbPath,
// runs the schema migration, and returns a SQLiteState backed by the
// given in-memory State.
func SQLiteStateFromPath(dbPath string, maxAgeSec, maxRows int, inner *State) (*SQLiteState, error) {
	if dbPath == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("resolve home dir: %w", err)
		}
		dbPath = filepath.Join(home, ".moonbridge", defaultReasoningCacheDBName)
	}

	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create dir %s: %w", dir, err)
	}

	db, err := sql.Open("sqlite", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	db.SetMaxOpenConns(1) // SQLite is single-writer

	if age := time.Duration(maxAgeSec) * time.Second; age <= 0 {
		maxAgeSec = defaultReasoningCacheMaxAgeSeconds
	}
	if maxRows <= 0 {
		maxRows = defaultReasoningCacheMaxRows
	}

	ss := &SQLiteState{
		db:      db,
		inner:   inner,
		maxAge:  time.Duration(maxAgeSec) * time.Second,
		maxRows: maxRows,
		dbPath:  dbPath,
	}

	if err := ss.migrate(); err != nil {
		db.Close()
		return nil, err
	}

	// Prune on startup.
	ss.prune()

	return ss, nil
}

func (s *SQLiteState) migrate() error {
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS thinking_cache (
			key TEXT PRIMARY KEY,
			thinking_text TEXT NOT NULL,
			signature TEXT NOT NULL DEFAULT '',
			created_at INTEGER NOT NULL,
			last_access INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_thinking_cache_last_access
			ON thinking_cache(last_access);
		CREATE INDEX IF NOT EXISTS idx_thinking_cache_created_at
			ON thinking_cache(created_at);
	`)
	return err
}

// Persist writes a thinking block to both the in-memory state and SQLite.
func (s *SQLiteState) Persist(key, thinkingText, signature string) {
	if s == nil {
		return
	}
	now := time.Now().Unix()
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, err := s.db.Exec(
		`INSERT OR REPLACE INTO thinking_cache (key, thinking_text, signature, created_at, last_access)
		 VALUES (?, ?, ?, ?, ?)`,
		key, thinkingText, signature, now, now,
	); err != nil {
		// Non-fatal: in-memory still works.
		return
	}
}

// Load retrieves a thinking block from SQLite. Returns "", "", false on miss.
func (s *SQLiteState) Load(key string) (thinkingText, signature string, ok bool) {
	if s == nil {
		return "", "", false
	}
	now := time.Now().Unix()
	s.mu.Lock()
	defer s.mu.Unlock()

	var text, sig string
	err := s.db.QueryRow(
		`SELECT thinking_text, signature FROM thinking_cache WHERE key = ?`, key,
	).Scan(&text, &sig)
	if err != nil {
		return "", "", false
	}

	// Bump last_access.
	s.db.Exec(`UPDATE thinking_cache SET last_access = ? WHERE key = ?`, now, key)

	return text, sig, true
}

// WriteToolCall persists thinking for a tool call ID.
func (s *SQLiteState) WriteToolCall(toolCallID string, block format.CoreContentBlock) {
	key := "tool_call:" + toolCallID
	s.Persist(key, block.ReasoningText, block.ReasoningSignature)
}

// ReadToolCall reads thinking for a tool call ID from SQLite.
func (s *SQLiteState) ReadToolCall(toolCallID string) (format.CoreContentBlock, bool) {
	text, sig, ok := s.Load("tool_call:" + toolCallID)
	if !ok {
		return format.CoreContentBlock{}, false
	}
	return format.CoreContentBlock{
		Type:               "reasoning",
		ReasoningText:      text,
		ReasoningSignature: sig,
	}, true
}

// WriteAssistantText persists thinking for an assistant text block (keyed by text hash).
func (s *SQLiteState) WriteAssistantText(textKey, thinkingText, signature string) {
	key := "text:" + textKey
	s.Persist(key, thinkingText, signature)
}

// ReadAssistantText reads thinking for an assistant text block from SQLite.
func (s *SQLiteState) ReadAssistantText(textKey string) (format.CoreContentBlock, bool) {
	text, sig, ok := s.Load("text:" + textKey)
	if !ok {
		return format.CoreContentBlock{}, false
	}
	return format.CoreContentBlock{
		Type:               "reasoning",
		ReasoningText:      text,
		ReasoningSignature: sig,
	}, true
}

// prune removes expired and excess rows. Must be called under s.mu.
func (s *SQLiteState) prune() {
	cutoff := time.Now().Add(-s.maxAge).Unix()

	// TTL cleanup.
	s.db.Exec(`DELETE FROM thinking_cache WHERE created_at < ?`, cutoff)

	// Row limit: delete oldest if over maxRows.
	var count int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM thinking_cache`).Scan(&count); err != nil {
		return
	}
	if count > s.maxRows {
		excess := count - s.maxRows
		s.db.Exec(
			`DELETE FROM thinking_cache WHERE key IN (
				SELECT key FROM thinking_cache ORDER BY last_access ASC LIMIT ?
			)`, excess,
		)
	}
}

// PrunePublic triggers a prune cycle. Safe to call periodically.
func (s *SQLiteState) PrunePublic() {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.prune()
}

// Close cleanly shuts down the SQLite connection.
func (s *SQLiteState) Close() error {
	if s == nil {
		return nil
	}
	return s.db.Close()
}
