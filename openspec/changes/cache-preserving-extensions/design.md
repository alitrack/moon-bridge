# Design: Cache-Preserving Extensions

## 1. 问题模型：DeepSeek Prefix Cache

```
DeepSeek API 的 KV Cache 按字节前缀匹配：

Request N:    [System|Msg1|Msg2|Msg3|User:"fix this"]
              └──────────────────────────────────────┘  full compute

Request N+1:  [System|Msg1|Msg2|Msg3|Assistant:"..."|User:"the import"]
              └───── cache hit ──────┘└── new compute ──┘
                                       
Request N+2:  [System|Msg1|Msg2|Assistant:"..."|User:"what about..."]
              └─ cache hit ──┘└── MISMATCH ──┘  ← Msg3 被删除了！
              ALL bytes after Msg2 are different → cache MISS on everything after
```

**核心规则**：前缀字节序列必须完全一致。任何在中间的插入、删除、重排都会使从变更点开始的全部内容 cache miss。

## 2. 现状分析

### 2.1 context_manager 的消息流破坏

```
当前流程（BREAKS CACHE）：
  [System] [Msg1] [Msg2] ... [Msg30] [User]
  超限 → 截断 → 
  [System] [NOTICE] [Msg10] ... [Msg30] [User]
           ^^^^^^^^
           插入点：Msg10 及之后的所有消息字节偏移变了
           → DeepSeek 看到不同的 prefix → 全部 cache miss
```

### 2.2 circuit_breaker 的消息流破坏

```
当前流程（BREAKS CACHE）：
  [System] [Asst{tool_a}] [Tool{tool_a}] [Asst{tool_a}] [Tool{tool_a}] [User]
  去重 → 
  [System] [Asst{tool_a}] [Tool{tool_a}] [User]
                                    ^^^^
                                    删除点：后续消息移位 → cache miss
```

## 3. 解决方案

### 3.1 Cache-preserving 截断策略

```
修复方案（CACHE-SAFE）：
  [System] [Msg1] [Msg2] ... [Msg30] [User]
  超限 → 仅从头部删除 →
  [System] [Msg10] ... [Msg30] [User] [NOTICE]
  
  关键：
  1. 只从 history 头部删除 → 不改变后续消息的字节前缀
  2. NOTICE 追加到末尾 → 不影响已有 prefix
  3. NOTICE 使用 "system" role → 不破坏 role 交替规则
```

**为什么是安全的**：DeepSeek 的 prefix cache 是按**请求 body 的字节序**匹配的，不是按语义。只要从前面截断（减少 prefix），后续字节完全一致，仍然能命中剩余部分的 cache。

### 3.2 配置门控

```yaml
# config.yml
extensions:
  context_manager:
    enabled: true
    config:
      context_limit: 1048576
      cache_preserving: true   # NEW: default true
      
  circuit_breaker:
    enabled: true
    config:
      max_consecutive_tools: 20
      cache_preserving: true   # NEW: default true — disables dedup
```

当 `cache_preserving: false` 时，恢复当前行为（中间插入通知、消息去重启用）。

### 3.3 SQLite Reasoning 持久化

```
┌──────────────────────────────────────────────────┐
│ deepseek_v4 extension                            │
│                                                  │
│  ┌──────────────┐     ┌───────────────────────┐ │
│  │ InMemory State│ ←─→ │ SQLiteBackend (opt)   │ │
│  │ (always on)  │     │                       │ │
│  │              │     │ CREATE TABLE thinking  │ │
│  │ maps by:     │     │ _cache (              │ │
│  │ toolCallID   │     │   key TEXT PK,        │ │
│  │ textSHA256   │     │   thinking_text TEXT, │ │
│  │              │     │   signature TEXT,     │ │
│  └──────────────┘     │   created_at INT,     │ │
│                       │   last_access INT     │ │
│                       │ );                    │ │
│                       │ TTL: 30 days          │ │
│                       │ Max rows: 100,000     │ │
│                       └───────────────────────┘ │
└──────────────────────────────────────────────────┘

流程：
Write: RememberForToolCalls() → in-memory → SQLite INSERT OR REPLACE
Read:  CachedForToolCall()  → in-memory → if miss → SQLite SELECT
Prune: On startup + hourly → DELETE WHERE created_at < now - TTL
                              + DELETE oldest if row count > max
```

**数据库位置**：`~/.moonbridge/reasoning_cache.sqlite3`

**向后兼容**：默认不启用 SQLite，需在 config 中显式配置 `persistence: sqlite`。

### 3.4 Cache Stats API

```
GET /api/v1/cache/stats  →  {
  "period": "last_24h",
  "total_requests": 1234,
  "cache_hit_requests": 1156,
  "hit_rate": 0.937,
  "tokens": {
    "total_input": 50000000,
    "cache_hit": 47000000,
    "cache_miss": 3000000,
    "cache_write": 500000
  },
  "estimated_savings": "$4.70",
  "by_model": {
    "deepseek-v4-pro": { "hit_rate": 0.95, ... },
    "deepseek-v4-flash": { "hit_rate": 0.91, ... }
  }
}
```

**数据来源**：从 ProviderManager 的 `ProviderClient` response 中提取 `usage` 字段。DeepSeek 的 Anthropic 协议响应和 Chat 协议响应都包含 `usage.cache_read_input_tokens` / `usage.cache_creation_input_tokens`。

### 3.5 Token 估算改进

```
当前：固定 chars/token = 2.0
修复：按字符类型分段

func estimateTokensImproved(text string) int {
    // CJK: 0.6-0.8 chars/token
    // 英文词: 3.5-4.0 chars/token
    // 代码: 1.2-1.5 chars/token
    // JSON: 1.0-1.3 chars/token
    // 按字符类型加权平均
}
```

使用 Unicode range 检测：CJK（U+4E00-U+9FFF）、ASCII 字母、特殊符号分段估算。

## 4. 数据流

```
Request → context_manager.RewriteMessages()
              │
              ├─ cache_preserving=true  → front-truncate only, notice at end
              └─ cache_preserving=false → legacy behavior (mid-inject notice)
              
              ↓
         circuit_breaker.MutateRequest()
              │
              ├─ cache_preserving=true  → skip deduplicateToolCalls
              └─ cache_preserving=false → legacy behavior (dedup enabled)
              
              ↓
         deepseek_v4.PrependThinkingForToolUse()
              │
              ├─ Check in-memory state first
              ├─ If miss + persistence=sqlite → query SQLite
              └─ If still miss → empty thinking block fallback
              
              ↓
         Forward to DeepSeek API → response.usage.cache_read_input_tokens
              │
              ↓
         trackCacheStats() → in-memory stats → /api/v1/cache/stats
```

## 5. 回退兼容

所有改动由 `cache_preserving` 标志控制，默认 `true`（新行为）。如果用户需要旧行为，设置 `cache_preserving: false` 即可。测试覆盖两种模式。
