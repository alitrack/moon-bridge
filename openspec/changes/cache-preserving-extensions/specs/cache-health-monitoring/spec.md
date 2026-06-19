# Spec: Cache Health Monitoring

## Purpose

当前 Moon Bridge 缺乏对 DeepSeek prefix cache 命中率的可见性。用户无法知道 cache 是否被破坏、成本是否因此上升。

## Contract

### AC-1: Cache stats API
- **Given** 服务运行中且至少有一个请求已完成
- **When** `GET /api/v1/cache/stats`
- **Then** 返回 JSON 包含：`total_requests`, `cache_hit_requests`, `hit_rate`, `tokens`（分 input/cache_hit/cache_miss/cache_write）
- **Then** 无认证要求（Admin API 已有全局 auth middleware）

### AC-2: Per-model breakdown
- **Given** 多个模型被使用
- **When** `GET /api/v1/cache/stats`
- **Then** `by_model` 字段包含每个模型的独立统计

### AC-3: Data source from upstream response
- **Given** DeepSeek 返回的 response 包含 `usage` 字段
- **When** 请求完成
- **Then** 从 `usage.cache_read_input_tokens` 和 `usage.cache_creation_input_tokens` 提取 cache 统计

### AC-4: In-memory, no persistence
- **Given** 服务重启
- **When** 查询 stats
- **Then** 统计从零开始（in-memory only）

### AC-5: Estimated savings
- **Given** 已知各模型的 input token 价格
- **When** `GET /api/v1/cache/stats`
- **Then** `estimated_savings` 字段显示估算的成本节省

## Details

### API Response Schema

```json
{
  "period": "since_restart",
  "uptime_seconds": 3600,
  "total_requests": 1234,
  "cache_hit_requests": 1156,
  "hit_rate": 0.937,
  "tokens": {
    "total_input": 50000000,
    "cache_hit": 47000000,
    "cache_miss": 3000000,
    "cache_write": 500000
  },
  "estimated_savings_usd": "4.70",
  "by_model": {
    "deepseek-v4-pro": {
      "requests": 800,
      "hit_rate": 0.95,
      "tokens": { "input": 30000000, "cache_hit": 28500000, "cache_miss": 1500000 }
    },
    "deepseek-v4-flash": {
      "requests": 434,
      "hit_rate": 0.91,
      "tokens": { "input": 20000000, "cache_hit": 18500000, "cache_miss": 1500000 }
    }
  }
}
```

### 实现位置

- `internal/service/server/cache_stats.go` — 新文件，stats 收集和 HTTP handler
- `internal/service/server/server.go` — 注册 `/api/v1/cache/stats` 路由
- `internal/service/server/usage.go` — 现有的 `usageTracker` 扩展以支持 cache 维度

### 数据收集

在 `onRequestCompleted` callback 中提取 usage：

```go
// DeepSeek response usage 结构:
// {
//   "input_tokens": 1000,
//   "output_tokens": 500,
//   "cache_read_input_tokens": 800,   // ← cache hit
//   "cache_creation_input_tokens": 200 // ← cache miss/cache write
// }
```

## Boundary Cases

| Case | Behavior |
|------|----------|
| 无请求历史 | 返回全零统计 |
| 非 DeepSeek provider | `by_model` 中该模型的 cache 字段为 0 |
| 上游不返回 cache_* 字段 | 不计入 cache 统计 |
| 并发请求 | 使用 `sync.Mutex` 保护 counter |
| 负值/溢出 | 忽略异常值 |
