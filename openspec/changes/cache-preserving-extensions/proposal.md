# Proposal: Cache-Preserving Extensions for DeepSeek

## Why

Moon Bridge 的两个核心扩展在不知情的情况下破坏了 DeepSeek 的 prefix KV cache：

1. **`context_manager`** — 消息历史超限时在 system 和历史之间**插入**截断通知，这打乱了后续所有消息的字节序列，导致 DeepSeek 的 prefix cache 从插入点开始全部失效。
2. **`circuit_breaker`** — `deduplicateToolCalls` **删除**重复的 tool call 消息块，同样破坏 cache。

**影响量化**：DeepSeek 的 cache-hit token 按 1/10 价格计费。长会话（50+ turns）如果 prefix cache 被破坏，cache-hit rate 从 95%+ 降到接近 0%，成本差异可达 **10 倍**。

此外，`deepseek_v4` 扩展的 reasoning 状态只在内存中，重启即丢失；缺少对 prefix cache 命中率的可观测性。

HN 上 Reasonix 讨论证实：已有 agent（OpenCode/Claude Code/Codex）在 DeepSeek 上能达到 97-99% cache hit。Moon Bridge 作为透明代理，不应该成为降低 cache hit 的因素。

## What Changes

### P0 — Cache-preserving message rewriting

1. **`context_manager`** — 截断通知从消息流中间注入改为作为 trailing system message 追加；仅从历史头部删除（preserves prefix）。
2. **`circuit_breaker`** — tool call 去重改为仅在 `cache_preserving: false` 时启用，默认关闭。
3. **新增 `cache_preserving` 配置标志**（默认 `true`），控制两个扩展的行为。

### P1 — Reasoning 持久化

4. **`deepseek_v4`** — 新增可选的 SQLite backend，thinking state 跨进程重启持久化。
5. SQLite schema 包含 TTL 清理和行数上限。

### P2 — Cache 健康监控

6. **新增 cache stats API** — `GET /api/v1/cache/stats`，返回 hit/miss 比率、token 分布。
7. 从 DeepSeek 响应提取 `usage.cache_read_input_tokens` 和 `usage.cache_creation_input_tokens`。

### P3 — Token 估算精度

8. **`context_manager`** — 改进 `estimateMessagesTokens`，区分中英文/代码的 chars/token 比率。

## Capabilities

### New Capabilities

- **`cache_preserving` 配置**：控制消息重写行为，保护 prefix cache
- **SQLite reasoning 持久化**：thinking state 跨重启保持
- **Cache stats API**：可见化 cache 命中率
- **语境感知 token 估算**：多语言分段估算

### Modified Capabilities

- **`context_manager` 截断策略**：从中间插入改为尾部追加
- **`circuit_breaker` 去重**：从默认启用改为默认关闭，受 `cache_preserving` 控制
- **`deepseek_v4` state**：新增可选 SQLite backend

### Non-Goals

- ❌ 不修改 Reasonix 的 append-only agent loop（moon-bridge 是代理，不是 agent）
- ❌ 不改动 visual 扩展（已有 SHA256 缓存）
- ❌ 不新增 Redis/memcached 后端（保持依赖最小）
- ❌ 不改变 SESSION 协议格式（向后兼容）
- ❌ 不引入缓存驱逐的复杂策略（LRU + TTL 足够）

## Impact

| 系统 | 影响 |
|------|------|
| `internal/extension/context_manager/` | 截断逻辑重构，新增 chars/token 估算 |
| `internal/extension/circuit_breaker/` | 去重功能受 `cache_preserving` 控制 |
| `internal/extension/deepseek_v4/` | 新增 `sqlite_state.go` |
| `internal/service/server/server.go` | 新增 cache stats handler |
| `config.yml` | 新增 `context_manager.cache_preserving`, `deepseek_v4.persistence` 配置块 |
| `go.mod` | 新增 `github.com/mattn/go-sqlite3`（SQLite driver） |

**向后兼容**：默认值保持当前行为不破坏现有配置。`cache_preserving: true` 是新增默认。
