package configgraph

import "testing"

func TestSchemaCoversCurrentFileConfigSections(t *testing.T) {
	got := map[string]bool{}
	for _, def := range ResourceDefinitions() {
		got[def.Kind] = true
	}
	for _, kind := range []ResourceKind{
		ResourceMode,
		ResourceTrace,
		ResourceLog,
		ResourceServer,
		ResourceDefaults,
		ResourceModel,
		ResourceProvider,
		ResourceRoute,
		ResourceWebSearch,
		ResourceCache,
		ResourcePersistence,
		ResourceExtension,
		ResourceProxy,
	} {
		if !got[string(kind)] {
			t.Fatalf("missing resource definition %q", kind)
		}
	}
}

func TestSchemaDoesNotAdvertiseOutOfScopeFields(t *testing.T) {
	for _, def := range ResourceDefinitions() {
		for _, field := range def.Fields {
			if (def.Kind == string(ResourceProvider) || def.Kind == string(ResourceModel)) && field.Path == "enabled" {
				t.Fatalf("out-of-scope field exposed on %s: %s", def.Kind, field.Path)
			}
			if def.Kind == string(ResourceRoute) && (field.Path == "fallback" || field.Path == "priority") {
				t.Fatalf("out-of-scope field exposed on %s: %s", def.Kind, field.Path)
			}
		}
	}
}
