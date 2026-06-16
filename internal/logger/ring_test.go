package logger

import (
	"bytes"
	"context"
	"log/slog"
	"testing"
	"time"
)

func TestRingRecentKeepsLastEntriesInOriginalOrder(t *testing.T) {
	ring := NewRing(2)
	ring.Append([]LogEntry{
		{Message: "first"},
		{Message: "second"},
		{Message: "third"},
	})

	recent := ring.Recent(10)
	if len(recent) != 2 {
		t.Fatalf("Recent returned %d entries, want 2", len(recent))
	}
	if recent[0].Message != "second" || recent[1].Message != "third" {
		t.Fatalf("Recent messages = %q/%q, want second/third", recent[0].Message, recent[1].Message)
	}
}

func TestRingSubscribeReceivesEntriesInOrder(t *testing.T) {
	ring := NewRing(4)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	ch := ring.Subscribe(ctx)

	ring.Append([]LogEntry{{Message: "one"}, {Message: "two"}})

	first := receiveLogEntry(t, ch)
	second := receiveLogEntry(t, ch)
	if first.Message != "one" || second.Message != "two" {
		t.Fatalf("subscriber messages = %q/%q, want one/two", first.Message, second.Message)
	}
}

func TestConsumeHandlerFanOutPreservesPluginAndRingConsumers(t *testing.T) {
	var buf bytes.Buffer
	if err := Init(Config{Level: LevelInfo, Format: "json", Output: &buf}); err != nil {
		t.Fatalf("Init() error = %v", err)
	}
	ring := NewRing(8)
	var pluginSeen []LogEntry

	SetConsumeFunc(func(entries []LogEntry) []LogEntry {
		pluginSeen = append(pluginSeen, entries...)
		return entries
	})
	AddConsumeFunc(ring.Consume)

	slog.Info("fanout message", "k", "v")

	if len(pluginSeen) != 1 {
		t.Fatalf("plugin consumer received %d entries, want 1", len(pluginSeen))
	}
	recent := ring.Recent(1)
	if len(recent) != 1 {
		t.Fatalf("ring recent length = %d, want 1", len(recent))
	}
	if recent[0].Message != "fanout message" {
		t.Fatalf("ring message = %q, want fanout message", recent[0].Message)
	}
	if len(recent[0].Raw) == 0 {
		t.Fatal("ring Raw is empty")
	}
}

func receiveLogEntry(t *testing.T, ch <-chan LogEntry) LogEntry {
	t.Helper()
	select {
	case entry := <-ch:
		return entry
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for log entry")
		return LogEntry{}
	}
}
