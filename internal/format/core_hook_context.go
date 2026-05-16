package format

import "context"

type coreHookContextKey string

const coreHookModelAliasKey coreHookContextKey = "moonbridge.core_hook_model_alias"

// WithCoreHookModelAlias tags a context with the model alias used by Core hooks.
func WithCoreHookModelAlias(ctx context.Context, modelAlias string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, coreHookModelAliasKey, modelAlias)
}

// ModelAliasFromCoreHookContext extracts the model alias previously tagged
// by WithCoreHookModelAlias. Returns empty string when unset.
func ModelAliasFromCoreHookContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	model, _ := ctx.Value(coreHookModelAliasKey).(string)
	return model
}
