export const queryKeys = {
  status: ["status"] as const,
  providers: (page: { limit: number; offset: number }) => ["providers", page] as const,
  models: (page: { limit: number; offset: number }) => ["models", page] as const,
  routes: (page: { limit: number; offset: number }) => ["routes", page] as const,
  configGraph: ["config", "graph"] as const,
  changes: ["changes"] as const,
  logsRecent: (limit?: number) => ["logs", "recent", { limit }] as const,
  extensions: ["extensions"] as const,
  statsSummary: ["stats", "summary"] as const,
  usageStats: ["stats", "usage"] as const,
  sessions: ["sessions"] as const
};
