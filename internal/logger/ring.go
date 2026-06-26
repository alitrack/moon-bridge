package logger

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Ring struct {
	mu      sync.Mutex
	limit   int
	entries []LogEntry
	subs    map[chan LogEntry]struct{}
}

func NewRing(limit int) *Ring {
	if limit <= 0 {
		panic("logger ring limit must be positive")
	}
	return &Ring{
		limit: limit,
		subs:  map[chan LogEntry]struct{}{},
	}
}

func (r *Ring) Consume(entries []LogEntry) []LogEntry {
	r.Append(entries)
	return entries
}

func (r *Ring) Append(entries []LogEntry) {
	if len(entries) == 0 {
		return
	}
	copied := make([]LogEntry, len(entries))
	for i, entry := range entries {
		copied[i] = cloneLogEntry(entry)
		if copied[i].Timestamp.IsZero() {
			copied[i].Timestamp = time.Now()
		}
		if len(copied[i].Raw) == 0 {
			copied[i].Raw = []byte(formatRawLogEntry(copied[i]))
		}
	}

	r.mu.Lock()
	r.entries = append(r.entries, copied...)
	if overflow := len(r.entries) - r.limit; overflow > 0 {
		r.entries = append([]LogEntry(nil), r.entries[overflow:]...)
	}
	subs := make([]chan LogEntry, 0, len(r.subs))
	for ch := range r.subs {
		subs = append(subs, ch)
	}
	r.mu.Unlock()

	for _, entry := range copied {
		for _, ch := range subs {
			select {
			case ch <- cloneLogEntry(entry):
			default:
			}
		}
	}
}

func (r *Ring) Recent(limit int) []LogEntry {
	r.mu.Lock()
	defer r.mu.Unlock()
	if limit <= 0 || limit > len(r.entries) {
		limit = len(r.entries)
	}
	start := len(r.entries) - limit
	out := make([]LogEntry, 0, limit)
	for _, entry := range r.entries[start:] {
		out = append(out, cloneLogEntry(entry))
	}
	return out
}

func (r *Ring) Subscribe(ctx context.Context) <-chan LogEntry {
	ch := make(chan LogEntry, 256)
	r.mu.Lock()
	r.subs[ch] = struct{}{}
	r.mu.Unlock()

	go func() {
		<-ctx.Done()
		r.mu.Lock()
		delete(r.subs, ch)
		close(ch)
		r.mu.Unlock()
	}()
	return ch
}

func cloneLogEntry(entry LogEntry) LogEntry {
	entry.Attrs = append([]slog.Attr(nil), entry.Attrs...)
	entry.Raw = append([]byte(nil), entry.Raw...)
	return entry
}

func formatRawLogEntry(entry LogEntry) string {
	parts := []string{
		"time=" + entry.Timestamp.UTC().Format(time.RFC3339Nano),
		"level=" + entry.Level.String(),
		"msg=" + strconv.Quote(entry.Message),
	}
	for _, attr := range entry.Attrs {
		parts = append(parts, attr.Key+"="+formatAttrValue(attr.Value))
	}
	return strings.Join(parts, " ") + "\n"
}

func formatAttrValue(value slog.Value) string {
	switch value.Kind() {
	case slog.KindString:
		return strconv.Quote(value.String())
	case slog.KindInt64:
		return strconv.FormatInt(value.Int64(), 10)
	case slog.KindUint64:
		return strconv.FormatUint(value.Uint64(), 10)
	case slog.KindFloat64:
		return strconv.FormatFloat(value.Float64(), 'f', -1, 64)
	case slog.KindBool:
		return strconv.FormatBool(value.Bool())
	case slog.KindDuration:
		return strconv.Quote(value.Duration().String())
	case slog.KindTime:
		return strconv.Quote(value.Time().UTC().Format(time.RFC3339Nano))
	default:
		return strconv.Quote(fmt.Sprint(value.Any()))
	}
}
