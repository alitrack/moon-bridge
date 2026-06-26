package config

import (
	"fmt"
	"path/filepath"
)

const (
	DefaultDataDirName       = "data"
	DefaultSQLiteDBFileName  = "moonbridge.db"
	starterModelName         = "local-starter-model"
	starterProviderName      = "local"
	starterRouteName         = "moonbridge"
	starterProviderBaseURL   = "https://api.example.invalid"
	starterProviderAPIKey    = "replace-with-your-provider-api-key"
	starterProviderProtocol  = ProtocolOpenAIChat
	starterModelContextLimit = 128000
	starterModelOutputLimit  = 4096
	starterDefaultMaxTokens  = 1024
)

// StarterSQLiteDBPath returns the default first-run SQLite database path for a
// resolved config path. The returned path is absolute so later service starts do
// not depend on the process working directory.
func StarterSQLiteDBPath(configPath string) (string, error) {
	if configPath == "" {
		return "", fmt.Errorf("config path is required")
	}
	path := filepath.Join(filepath.Dir(configPath), DefaultDataDirName, DefaultSQLiteDBFileName)
	absPath, err := filepath.Abs(path)
	if err != nil {
		return "", fmt.Errorf("resolve starter sqlite path: %w", err)
	}
	return absPath, nil
}

// StarterFileConfig builds the first-run Transform configuration. The SQLite
// path must already be absolute to avoid persisting a working-directory-relative
// database location into the user's default config.
func StarterFileConfig(sqliteDBPath string) (FileConfig, error) {
	if sqliteDBPath == "" {
		return FileConfig{}, fmt.Errorf("sqlite db path is required")
	}
	if !filepath.IsAbs(sqliteDBPath) {
		return FileConfig{}, fmt.Errorf("sqlite db path must be absolute: %s", sqliteDBPath)
	}
	enabled := true
	return FileConfig{
		Mode: string(ModeTransform),
		Log: LogFileConfig{
			Level:  "info",
			Format: "text",
		},
		Server: ServerFileConfig{
			Addr: DefaultAddr,
		},
		Defaults: DefaultsFileConfig{
			Model:     starterRouteName,
			MaxTokens: starterDefaultMaxTokens,
		},
		Models: map[string]ModelDefFileConfig{
			starterModelName: {
				ContextWindow:   starterModelContextLimit,
				MaxOutputTokens: starterModelOutputLimit,
			},
		},
		Providers: map[string]ProviderDefFileConfig{
			starterProviderName: {
				BaseURL:  starterProviderBaseURL,
				APIKey:   starterProviderAPIKey,
				Protocol: starterProviderProtocol,
				Offers: []OfferFileConfig{
					{
						Model:        starterModelName,
						UpstreamName: starterModelName,
					},
				},
			},
		},
		Routes: map[string]RouteFileConfig{
			starterRouteName: {
				Provider: starterProviderName,
				Model:    starterModelName,
			},
		},
		Persistence: PersistenceFileConfig{
			ActiveProvider: "db_sqlite",
		},
		Extensions: map[string]ExtensionFileConfig{
			"db_sqlite": {
				Enabled: &enabled,
				Config: map[string]any{
					"path":            sqliteDBPath,
					"wal":             true,
					"busy_timeout_ms": 5000,
					"max_open_conns":  1,
				},
			},
		},
	}, nil
}

// StarterConfigYAML returns a validated YAML document for the first-run config.
func StarterConfigYAML(sqliteDBPath string, opts LoadOptions) ([]byte, error) {
	fileConfig, err := StarterFileConfig(sqliteDBPath)
	if err != nil {
		return nil, err
	}
	data, err := fileConfig.MarshalYAML()
	if err != nil {
		return nil, fmt.Errorf("marshal starter config: %w", err)
	}
	if _, err := LoadFromYAMLWithOptions(data, opts); err != nil {
		return nil, fmt.Errorf("validate starter config: %w", err)
	}
	return data, nil
}
