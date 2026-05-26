# Moon Bridge Codex Enhancement PRD

> 目标：在 moon-bridge 上补齐 codex-deepseek-v4-proxy 的差异化功能，纯 DeepSeek 场景。

## 变更清单

### P0 — web_fetch 代理工具

**问题**：Codex 沙箱拦截 shell HTTP 请求，模型无法直接读取网页 URL。

**方案**：新增 `web_fetch` 扩展，通过 `ToolInjector` 注入工具。当 Codex 调用 `web_fetch(url)` 时，moon-bridge 代理侧用 Jina Reader（或直接 HTTP）抓取内容，返回 markdown。

**实现**：
- 新文件：`internal/extension/web_fetch/plugin.go`
- 接口：`plugin.ToolInjector` + `plugin.Plugin`
- 工具定义：`web_fetch(url, method, headers, body)` → `{status, body}`
- HTTP 抓取：Jina Reader（`r.jina.ai`）或直接 HTTP GET
- 配置：`extensions.web_fetch.enabled: true`

### P1 — 工具调用断路器

**问题**：模型偶尔陷入工具调用死循环（相同工具反复调）。

**方案**：新增 `circuit_breaker` 扩展，通过 `StreamInterceptor` 监控连续 `tool_use` 事件。超过阈值（默认 20 次）注入 reflection prompt，连续 30 次强制终止。

**实现**：
- 新文件：`internal/extension/circuit_breaker/plugin.go`
- 接口：`plugin.StreamInterceptor` + `plugin.Plugin`
- 配置：`extensions.circuit_breaker.max_consecutive_tools: 20`

### P2 — previous_response_id 桥接

**问题**：Codex 有时引用之前的 response_id，moon-bridge 无状态无法处理。

**方案**：在 `ResponsePostProcessor` 中存储每次响应的 ID → output 映射。请求时若带 `previous_response_id`，注入历史上下文。

**实现**：
- 新文件：`internal/extension/response_store/plugin.go`
- 接口：`plugin.ResponsePostProcessor` + `plugin.RequestMutator`
- 存储：内存 LRU（无持久化需求）
- TTL：1 小时，最多 500 条

## 影响范围

| 文件 | 操作 | 说明 |
|------|------|------|
| `internal/extension/web_fetch/plugin.go` | 新增 | web_fetch 工具 |
| `internal/extension/circuit_breaker/plugin.go` | 新增 | 断路器 |
| `internal/extension/response_store/plugin.go` | 新增 | 响应桥接 |
| `internal/service/app/extensions.go` | 修改 | 注册 3 个新扩展 |
| `config.yml` | 修改 | 默认启用 |

## 测试验证

```bash
# 1. web_fetch：Codex 中用 web_fetch 读一个网页
# 2. circuit_breaker：连续调 20+ 次 read_file → 被拦截
# 3. response_store：带 previous_response_id 的请求正常桥接
```
