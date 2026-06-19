# Spec: Cache-Preserving Context Truncation

## Purpose

`context_manager` 扩展在消息历史超限时进行截断，但当前实现在消息流中间注入通知，破坏了 DeepSeek 的 prefix KV cache。此 spec 定义缓存安全的截断行为。

## Contract

### AC-1: Front-only truncation
- **Given** 消息历史超过 `context_limit - completion_headroom`
- **When** `cache_preserving: true`
- **Then** 仅从 `historyMsgs[0]` 开始删除，不从中间删除
- **Then** 至少保留 `min_recent_messages` 条最新消息

### AC-2: Notice at end, not mid-stream
- **Given** 消息被截断
- **When** `cache_preserving: true`
- **Then** 截断通知作为最后一条消息（system role）追加，不插入在 system 和历史之间
- **Then** 通知格式为：`[System: Earlier conversation history has been truncated...]`

### AC-3: Preserve system messages
- **Given** 请求包含 system 消息
- **When** 截断发生
- **Then** system 消息始终保留在最前面，不被删除

### AC-4: Legacy mode preserved
- **Given** `cache_preserving: false`
- **When** 消息超限
- **Then** 行为与当前完全一致（中间注入通知）

### AC-5: No-op when under budget
- **Given** 消息历史未超过 `context_limit - completion_headroom`
- **When** `RewriteMessages` 被调用
- **Then** 返回原始消息，不做任何修改

## Details

### 配置

```yaml
extensions:
  context_manager:
    enabled: true
    config:
      context_limit: 1048576
      completion_headroom: 8192
      chars_per_token: 2.0
      min_recent_messages: 10
      cache_preserving: true    # NEW
```

### 实现位置

`internal/extension/context_manager/plugin.go` — `RewriteMessages()` 方法

### 关键改动

```go
// OLD: inject between system and history
result = append(result, systemMsgs...)
result = append(result, notice)       // ← 这里
result = append(result, historyMsgs...)

// NEW: append at end
result = append(result, systemMsgs...)
result = append(result, historyMsgs...)
result = append(result, notice)       // ← 移到这里
```

## Boundary Cases

| Case | Behavior |
|------|----------|
| 只超限 1 条消息 | 删除最旧的 1 条，通知追加 |
| 历史全是 system 消息 | 保留全部 system，history 为空 |
| `min_recent_messages: 0` | 允许删除到只剩 system |
| 消息恰好等于预算 | 不触发截断 |
| `cache_preserving: false` | 保持旧行为，通知在中间 |
