# Tasks: Cache-Preserving Extensions

## 1. P0 — Cache Preserving Context Manager

- [ ] 1.1 在 `context_manager/plugin.go:Config` 新增 `CachePreserving bool` 字段（yaml: `cache_preserving`，默认值 `true`）
- [ ] 1.2 修改 `RewriteMessages()`：当 `cache_preserving=true` 时，notice 追加到消息末尾而非 system 和 history 之间
- [ ] 1.3 `estimateMessagesTokens` 保持现有逻辑不变（P3 单独改）
- [ ] 1.4 编写测试：`context_manager/plugin_test.go` — 覆盖 cache_preserving=true/false 两种模式，验证截断行为和 notice 位置
- [ ] 1.5 编译验证：`go build ./... && go test ./internal/extension/context_manager/...`

## 2. P0 — Cache Preserving Circuit Breaker

- [ ] 2.1 在 `circuit_breaker/plugin.go:Config` 新增 `CachePreserving bool` 字段
- [ ] 2.2 修改 `RewriteMessages()`：当 `cache_preserving=true` 时，跳过 `deduplicateToolCalls`
- [ ] 2.3 编写测试：验证两种模式下工具去重的启用/禁用
- [ ] 2.4 编译验证：`go build ./... && go test ./internal/extension/circuit_breaker/...`

## 3. P1 — Reasoning Persistence to SQLite

- [ ] 3.1 在 `go.mod` 添加 `github.com/mattn/go-sqlite3` 依赖
- [ ] 3.2 创建 `internal/extension/deepseek_v4/sqlite_state.go` — SQLite backend 实现
  - [ ] 3.2.1 Init：打开/创建 SQLite 数据库文件，运行 CREATE TABLE IF NOT EXISTS
  - [ ] 3.2.2 Write：INSERT OR REPLACE
  - [ ] 3.2.3 Read：SELECT by key，命中时回填 in-memory state
  - [ ] 3.2.4 Prune：DELETE by TTL + row count
- [ ] 3.3 修改 `deepseek_v4/plugin.go:Init` — 读取 `persistence` 配置，初始化 SQLite backend
- [ ] 3.4 修改 `deepseek_v4/state.go:RememberForToolCalls`、`CachedForToolCall` 等 — 调用 SQLite backend
- [ ] 3.5 编写测试：验证写入/读取/过期逻辑
- [ ] 3.6 编译验证：`go build ./... && go test ./internal/extension/deepseek_v4/...`

## 4. P2 — Cache Health Monitoring

- [ ] 4.1 创建 `internal/service/server/cache_stats.go` — CacheStats 结构体和 HTTP handler
  - [ ] 4.1.1 `CacheStatsTracker` — 线程安全的内存计数器
  - [ ] 4.1.2 `RecordCacheUsage(model, usage)` — 从 response usage 提取 cache 统计
  - [ ] 4.1.3 `ServeHTTP` — JSON 响应构建
- [ ] 4.2 修改 `internal/service/server/server.go` — 注册 `/api/v1/cache/stats` 路由
- [ ] 4.3 在 `onRequestCompleted`（或各 adapter 的响应处理处）调用 `RecordCacheUsage`
- [ ] 4.4 编写测试：验证 stats 累加和 API 响应格式
- [ ] 4.5 编译验证：`go build ./... && go test ./internal/service/server/...`

## 5. P3 — Context-Aware Token Estimation

- [ ] 5.1 在 `context_manager/plugin.go` 新增 `estimateTokensImproved()`
  - [ ] 5.1.1 实现 `classifyRune` — CJK/代码/Latin/其他 四种分段
  - [ ] 5.1.2 实现 `charsPerToken` — 按分段类型返回比率
  - [ ] 5.1.3 实现分段扫描 + 累加逻辑
- [ ] 5.2 修改 `estimateMessagesTokens` — 当 `chars_per_token <= 0` 时使用改进版本
- [ ] 5.3 编写测试：纯中文、纯代码、纯英文、混合四种场景的 token 估算精度
- [ ] 5.4 编译验证：`go build ./... && go test ./internal/extension/context_manager/...`

## 6. End-to-End Verification

- [ ] 6.1 全量测试：`go test ./...` 所有测试通过
- [ ] 6.2 E2E 测试：启动 moon-bridge + 配置 cache_preserving=true → 用 Claude Code 发几轮对话 → 验证 cache hit 率
- [ ] 6.3 文档更新：在项目 README 或 docs/ 添加 `cache_preserving` 配置说明
