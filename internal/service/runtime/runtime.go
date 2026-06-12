// Package runtime provides a snapshot-based runtime that holds the active
// configuration, provider manager, and pricing data. The snapshot is
// updated atomically via an atomic.Pointer, allowing safe concurrent reads
// without locking.
package runtime

import (
	"fmt"
	"sync"
	"sync/atomic"

	"moonbridge/internal/config"
	"moonbridge/internal/service/provider"
	"moonbridge/internal/service/stats"
)

// ConfigSnapshot is an immutable snapshot of the runtime state.
type ConfigSnapshot struct {
	// Config is the resolved runtime configuration.
	Config config.Config

	// ProviderMgr is the fully initialized provider manager.
	ProviderMgr *provider.ProviderManager

	// Pricing maps model identifiers to their pricing details.
	Pricing map[string]stats.ModelPricing
}

// Runtime holds the active ConfigSnapshot and provides atomic access
// and reload capability.
type Runtime struct {
	snapshot atomic.Pointer[ConfigSnapshot]
	mu       sync.Mutex // guards Reload; not needed for Current()

	// providerMode allows runtime override of all provider routing.
	// Empty string means no override (use normal route resolution).
	// When set to a provider key, ALL model resolution uses that provider.
	providerMode atomic.Pointer[string]
}

// NewRuntime creates a Runtime with the given initial configuration.
func NewRuntime(cfg config.Config, providerMgr *provider.ProviderManager, pricing map[string]stats.ModelPricing) *Runtime {
	rt := &Runtime{}
	snapshot := &ConfigSnapshot{
		Config:      cfg,
		ProviderMgr: providerMgr,
		Pricing:     pricing,
	}
	rt.snapshot.Store(snapshot)
	return rt
}

// Current returns the current ConfigSnapshot. The returned pointer is safe
// to use and will not be mutated by future Reload calls.
func (rt *Runtime) Current() *ConfigSnapshot {
	return rt.snapshot.Load()
}

// Reload validates the given config, builds a new ProviderManager, computes
// pricing, and atomically replaces the snapshot. Returns an error if
// validation or ProviderManager construction fails; the existing snapshot
// remains unchanged.
func (rt *Runtime) Reload(cfg config.Config) error {
	rt.mu.Lock()
	defer rt.mu.Unlock()

	// Validate the new config.
	if err := cfg.Validate(); err != nil {
		return fmt.Errorf("runtime reload: config validation: %w", err)
	}

	// Build provider definitions and routes.
	providerCfg := config.ProviderFromGlobalConfig(&cfg)
	providerDefs := provider.BuildProviderDefsFromConfig(providerCfg)
	modelRoutes := provider.BuildModelRoutesFromConfig(providerCfg)

	// Build new provider manager.
	providerMgr, err := provider.NewProviderManager(providerDefs, modelRoutes)
	if err != nil {
		return fmt.Errorf("runtime reload: provider manager: %w", err)
	}

	// Compute pricing from the new config.
	pricing := provider.BuildPricingFromConfig(providerCfg)

	// Create and atomically store the new snapshot.
	snapshot := &ConfigSnapshot{
		Config:      cfg,
		ProviderMgr: providerMgr,
		Pricing:     pricing,
	}
	rt.snapshot.Store(snapshot)
	return nil
}

// SetProviderMode overrides all provider routing to use the given provider key.
// Pass empty string to restore normal route resolution.
func (rt *Runtime) SetProviderMode(mode string) {
	if mode == "" {
		rt.providerMode.Store(nil)
	} else {
		rt.providerMode.Store(&mode)
	}
}

// ProviderMode returns the current provider mode override, or empty string if none.
func (rt *Runtime) ProviderMode() string {
	if p := rt.providerMode.Load(); p != nil {
		return *p
	}
	return ""
}
