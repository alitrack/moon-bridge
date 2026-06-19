# Spec: Reasoning Persistence to SQLite

## Purpose

`deepseek_v4` 扩展当前仅在内存中缓存 reasoning/thinking 状态。进程重启后缓存丢失，导致后续 tool-call 请求无法回放 thinking block，触发 DeepSeek 的 `reasoning_content must be passed back` 错误。

## Contract

### AC-1: Persistent store on write
- **Given** `persistence: sqlite` 已配置
- **When** `RememberForToolCalls` 被调用
- **Then** 数据同时写入 in-memory state 和 SQLite
- **Then** SQLite INSERT OR REPLACE 保证幂等

### AC-2: Fallback read from SQLite
- **Given** `persistence: sqlite` 已配置
- **When** `CachedForToolCall` 在内存中 miss
- **Then** 查询 SQLite，命中则返回并回填内存
- **Then** 更新 `last_access` 时间戳

### AC-3: Start-up cache load (optional, for hot restart performance)
- **Given** `persistence: sqlite` 且数据库文件已存在
- **When** 扩展 Init
- **Then** 可选择预加载最近 N 条记录到内存（默认不预加载，惰性读取足够）

### AC-4: TTL cleanup
- **Given** 记录 `created_at` 超过 `reasoning_cache_max_age_seconds`（默认 30 天）
- **When** 启动时和每小时 cron
- **Then** 过期记录被删除

### AC-5: Row limit enforcement
- **Given** 记录数超过 `reasoning_cache_max_rows`（默认 100,000）
- **When** 启动时和每小时 cron
- **Then** 最旧的记录被删除直到在限制内

### AC-6: Disabled by default
- **Given** 未配置 `persistence: sqlite`
- **Then** 行为与当前完全一致（仅 in-memory）

## Details

### Schema

```sql
CREATE TABLE IF NOT EXISTS thinking_cache (
    key TEXT PRIMARY KEY,           -- "tool_call:<id>" or "text:<sha256>"
    thinking_text TEXT NOT NULL,
    signature TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,    -- unix timestamp
    last_access INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_thinking_cache_last_access 
    ON thinking_cache(last_access);

CREATE INDEX IF NOT EXISTS idx_thinking_cache_created_at 
    ON thinking_cache(created_at);
```

### 配置

```yaml
extensions:
  deepseek_v4:
    enabled: true
    config:
      persistence: sqlite            # NEW: "memory" (default) or "sqlite"
      reasoning_cache_max_age_seconds: 2592000   # 30 days
      reasoning_cache_max_rows: 100000
      reasoning_cache_db_path: ""     # defaults to ~/.moonbridge/reasoning_cache.sqlite3
```

### 实现位置

- `internal/extension/deepseek_v4/sqlite_state.go` — 新文件
- `internal/extension/deepseek_v4/plugin.go` — Init 中根据配置初始化
- `internal/extension/deepseek_v4/state.go` — 修改读写方法

### Key 设计

- Tool call: `"tool_call:<toolCallID>"` — 按 tool call ID 索引
- Assistant text: `"text:<sha256(text)>"` — 按文本哈希索引
- 与 cursor-proxy 的 SHA-256 隔离策略一致，防止并发会话冲突

## Boundary Cases

| Case | Behavior |
|------|----------|
| SQLite 文件不存在 | 自动创建 |
| SQLite 写入失败 | 记录日志 + 回退到 in-memory only |
| 同一 key 并发写入 | INSERT OR REPLACE 幂等 |
| 数据库被外部删除 | 下次写入自动重建 |
| `persistence: memory` | 完全跳过 SQLite |
