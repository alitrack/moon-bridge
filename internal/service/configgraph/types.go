package configgraph

type ResourceKind string

const (
	ResourceMode          ResourceKind = "mode"
	ResourceTrace         ResourceKind = "trace"
	ResourceLog           ResourceKind = "log"
	ResourceServer        ResourceKind = "server"
	ResourceDefaults      ResourceKind = "defaults"
	ResourceModel         ResourceKind = "model"
	ResourceProvider      ResourceKind = "provider"
	ResourceProviderOffer ResourceKind = "provider_offer"
	ResourceRoute         ResourceKind = "route"
	ResourceWebSearch     ResourceKind = "web_search"
	ResourceCache         ResourceKind = "cache"
	ResourcePersistence   ResourceKind = "persistence"
	ResourceExtension     ResourceKind = "extension"
	ResourceProxy         ResourceKind = "proxy"
)

type Graph struct {
	Revision     string          `json:"revision"`
	Resources    []Resource      `json:"resources"`
	Validation   ValidationState `json:"validation"`
	Runtime      RuntimeState    `json:"runtime"`
	Capabilities Capabilities    `json:"capabilities"`
}

type Resource struct {
	Kind          ResourceKind   `json:"kind"`
	ID            string         `json:"id"`
	Label         string         `json:"label"`
	Value         map[string]any `json:"value"`
	Schema        ResourceSchema `json:"schema"`
	Status        ResourceStatus `json:"status"`
	RuntimeImpact RuntimeImpact  `json:"runtimeImpact"`
	HotReloadable bool           `json:"hotReloadable"`
	References    []ResourceRef  `json:"references,omitempty"`
}

type ResourceSchema struct {
	Fields []FieldSchema `json:"fields"`
}

type FieldSchema struct {
	Path          string   `json:"path"`
	Type          string   `json:"type"`
	Label         string   `json:"label"`
	Required      bool     `json:"required,omitempty"`
	Secret        bool     `json:"secret,omitempty"`
	Control       string   `json:"control,omitempty"`
	Enum          []string `json:"enum,omitempty"`
	HotReloadable bool     `json:"hotReloadable"`
	RuntimeImpact string   `json:"runtimeImpact,omitempty"`
}

type ResourceStatus string

const (
	StatusSaved           ResourceStatus = "saved"
	StatusNeedsAttention  ResourceStatus = "needsAttention"
	StatusRestartRequired ResourceStatus = "restartRequired"
)

type RuntimeImpact string

const (
	ImpactNormal   RuntimeImpact = "normal"
	ImpactCritical RuntimeImpact = "critical"
)

type ResourceRef struct {
	Kind ResourceKind `json:"kind"`
	ID   string       `json:"id"`
}

type ValidationState struct {
	Valid  bool         `json:"valid"`
	Errors []FieldError `json:"errors,omitempty"`
}

type RuntimeState struct {
	Status  string       `json:"status"`
	Errors  []FieldError `json:"errors,omitempty"`
	Message string       `json:"message,omitempty"`
}

type Capabilities struct {
	Autosave bool `json:"autosave"`
	Logs     bool `json:"logs"`
}

type FieldError struct {
	ResourceKind ResourceKind `json:"resourceKind"`
	ResourceID   string       `json:"resourceId"`
	Field        string       `json:"field,omitempty"`
	Code         string       `json:"code"`
	Message      string       `json:"message"`
}

type PatchRequest struct {
	BaseRevision string    `json:"baseRevision"`
	Changes      []PatchOp `json:"changes"`
}

type PatchOp struct {
	Kind  ResourceKind `json:"kind"`
	ID    string       `json:"id"`
	Field string       `json:"field"`
	Value any          `json:"value"`
}

type PatchResult string

const (
	ResultCommitted          PatchResult = "committed"
	ResultRestartRequired    PatchResult = "restartRequired"
	ResultRevisionConflict   PatchResult = "revisionConflict"
	ResultValidationRejected PatchResult = "validationRejected"
	ResultRuntimeRejected    PatchResult = "runtimeRejected"
	ResultDraftRejected      PatchResult = "draftRejected"
)

type PatchResponse struct {
	Result        PatchResult  `json:"result"`
	Revision      string       `json:"revision"`
	Graph         *Graph       `json:"graph,omitempty"`
	Errors        []FieldError `json:"errors,omitempty"`
	RollbackValue any          `json:"rollbackValue,omitempty"`
}
