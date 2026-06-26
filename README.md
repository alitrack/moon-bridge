# Moon Bridge

Moon Bridge 是一个用 Go 编写的协议转换与模型路由代理。**三个入口端点原生支持**：`/v1/messages`（Claude Code）、`/v1/responses`（Codex CLI）、`/v1/chat/completions`（OpenAI Chat 客户端）。所有请求统一转换为内部 CoreRequest，按配置路由到 **Anthropic Messages**、**Google Gemini（GenAI）**、**OpenAI Chat Completions** 等上游协议。客户端指定不同模型别名时，自动将请求路由到对应上游 Provider 并在协议间自动转换。

> 🍳 **新手先看这里** → [CookBook.md](CookBook.md)：一份按目标找做法的菜谱，5 分钟跑通第一个对话。

## 特别感谢 🙏

<table align="center">
  

  <tr>
    <td align="center" width="160">
      <a href=" "><img src="./Images/volcano.png" alt="火山引擎" height="32"></a ><br>
      <a href="https://dis.chatdesks.cn/chatdesk/hsyqmoon-bridge.html"><strong>方舟 Agent Plan</strong></a >
    </td>
    <td align="left">
      <sub>感谢 <a href="https://dis.chatdesks.cn/chatdesk/hsyqmoon-bridge.html">方舟 Agent Plan </a>模型订阅套餐集成了包含 Doubao-Seed、Doubao-Seedance、Doubao-Seedream 等在内的字节跳动自研 SOTA 级模型，覆盖文本、代码、图像、视频等多模态任务。最新支持 MiniMax-M3、DeepSeek-V4 系列、GLM-5.2、Doubao-Seed-2.0 系列、Kimi-K2.6 等模型，工具不限。超全模态模型与 Harness 升级一步到位，深度支持 Agent 框架与 AI 编程工具。一次订阅，可以为不同任务切换合适的 AI 引擎。 </sub>
    </td>
  </tr>
  
</table>

---

## 快速开始

```bash
# pacman 或二进制安装后直接启动
moonbridge

# 首次无配置启动会创建 $HOME/moonbridge/config.yml
# 打开 http://127.0.0.1:38440/console/
# 在 Web Console 中配置 Provider、Model 和 API Key

# 源码开发也可以直接运行
go run ./cmd/moonbridge

# 另见 CookBook.md 中的详细使用场景
```

源码开发要求 Go 1.25+。

## 核心能力

- **协议转换**：三入口（Messages / Responses / Chat Completions）→ Anthropic Messages / Google Gemini / OpenAI Chat，统一管道转换
- **模型路由**：通过 `routes` 配置将模型别名映射到不同 Provider 的上游模型名
- **插件扩展**：`CorePluginHooks` 接口，支持请求预处理、响应后处理、流拦截
- **请求跟踪**：完整链路记录，每步转换均可追溯
- **用量统计**：按会话聚合 token 与费用
- **管理 API**：运行时热重载配置（需启用持久化）
- **Web Search 注入**：自动/注入模式，支持 Tavily、Firecrawl
- **Prompt 缓存**：explicit / automatic / hybrid 三种模式

## 内置扩展

所有扩展通过 `config.yml` 的 `extensions` 字段启用，支持 Global / Provider / Model / Route 四级作用域。

| 扩展 | 类型 | 功能 |
|------|------|------|
| `codex_tool_proxy` | ToolInjector | 为 Codex 注入 `apply_patch` 等工具代理 |
| `deepseek_v4` | ReasoningExtractor | DeepSeek V4/V3 thinking/reasoning 提取与转换。支持 `persistence: sqlite` 跨重启持久化 |
| `context_manager` | MessageRewriter | 上下文窗口超限时自动截断历史消息。`cache_preserving: true`（默认）保护 DeepSeek prefix cache，`chars_per_token: 0`（默认）中/英/代码分段估算 |
| `web_fetch` | ToolInjector + MessageRewriter | 注入 `web_fetch(url)` 工具，代理侧通过 Jina Reader 抓取网页 Markdown，绕过 Codex 沙箱的 HTTP 限制 |
| `circuit_breaker` | RequestMutator | 按会话统计连续 tool_use 调用次数，超过阈值注入警告或强制终止。`cache_preserving: true`（默认）跳过去重以保护 prefix cache |
| `response_store` | ResponsePostProcessor | 缓存上游响应，当请求携带 `previous_response_id` 时自动桥接上次 assistant 输出到新请求 Input |
| `kimi_workaround` | InputPreprocessor | Kimi 模型兼容处理 |
|| `visual` | ContentFilter + ToolInjector | 为纯文本模型注入 `visual_brief` / `visual_qa` 工具，自动剥离图片 block，路由到视觉模型分析后回填结果。支持 5 种场景的自动检测（错误日志/图表/问题定位/UI 布局/OCR），输出特化分析指令 |
| `db_sqlite` / `db_d1` | Provider | SQLite / Cloudflare D1 持久化存储 |
| `metrics` | RequestCompletionHook | Token 用量与费用统计 |
| `session_recorder` | RequestCompletionHook | 记录每次请求的模型、token、耗时到 `~/.moonbridge/sessions/YYYY-MM-DD.jsonl` |
| `skill_injector` | CoreRequestMutator | 从 `~/.moonbridge/skills/<name>/SKILL.md` 读取技能，关键词匹配后注入 system prompt，无匹配时 fallback 到 Top-3 |

### 配置示例

```yaml
extensions:
  web_fetch:
    enabled: true
  circuit_breaker:
    enabled: true
    config:
      max_consecutive_tools: 20
      hard_limit: 30
      cache_preserving: true   # 默认 true — 跳过去重以保护 DeepSeek prefix cache
  context_manager:
    enabled: true
    config:
      context_limit: 1048576
      cache_preserving: true   # 默认 true — 仅从头部截断，通知追加到末尾
      chars_per_token: 0       # 默认 0 — 自动分段（CJK=0.75, code=1.3, Latin=3.8）
  deepseek_v4:
    enabled: true
    config:
      persistence: sqlite      # 可选 "sqlite" 跨重启持久化 reasoning 缓存
  response_store:
    enabled: true
    config:
      ttl_seconds: 3600
      max_entries: 500
```

### Visual 扩展（场景感知图像分析）

为纯文本模型（如 DeepSeek V4）赋予图像理解能力。模型通过 `visual_brief` / `visual_qa` 工具调用视觉模型，支持自动场景检测与特化 prompt：

| 场景 | 触发关键词 | 输出特化 |
|------|-----------|---------|
| 错误日志 (C) | error, stack, crash, 500, panic | **逐字提取**，保留栈层级与文件路径 |
| 图表数据 (E) | chart, trend, bar chart, pie | 提取数据点、轴标签、趋势、异常 |
| 问题定位 (B) | fix, bug, red box, arrow, wrong | 标记定位 + 症状分析 + 修复建议 |
| UI 布局 (A) | html, page, mockup, figma, css | 像素级描述 + **ASCII 布局图** |
| 文字提取 (D) | ocr, extract text, transcribe | 全文逐字输出，保留层级与角色 |

检测优先级：错误日志 > 图表 > 问题定位 > UI 布局 > 文字提取。

```yaml
extensions:
  visual:
    enabled: true
    config:
      provider: "openai"      # 视觉模型所在的 provider 名称
      model: "gpt-4o"         # 视觉模型名
      max_rounds: 4           # 最大多轮追问次数（默认 4）
      max_tokens: 2048        # 单次分析最大输出 token
```

## 三种工作模式

| 模式 | 行为 |
|------|------|
| `Transform`（默认） | 接收 Messages / Responses / Chat Completions 三种入口请求 → 协议转换 → 转发到上游 → 反向转换后返回 |
| `CaptureAnthropic` | 接收 Anthropic Messages 请求 → 透明转发到 Anthropic 上游 |
| `CaptureResponse` | 接收 OpenAI Responses 请求 → 透明转发到 OpenAI 上游 |

## 配置说明

采用 YAML 格式，核心结构为 `models`、`providers`、`routes` 三段式。完整配置说明见 [CONFIGURATION.md](docs/CONFIGURATION.md)。

## 与 Codex CLI 配合使用

将 Moon Bridge 地址设为 Codex 的 custom provider：

```toml
[model_providers.custom]
name = "custom"
wire_api = "responses"
requires_openai_auth = false
base_url = "http://127.0.0.1:38440/v1"
```

然后在 Moon Bridge 配置的 `routes` 中定义模型别名映射。

## 与 Claude Code 配合使用

```bash
export ANTHROPIC_BASE_URL=http://127.0.0.1:38440/v1
export ANTHROPIC_AUTH_TOKEN=any-value
export ANTHROPIC_MODEL=your-alias
```

## Docker 部署

```bash
docker build -t moonbridge .
docker run -p 38440:38440 -v $(pwd)/config.yml:/config/config.yml moonbridge
```

## 命令行选项

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `-config` | `$HOME/moonbridge/config.yml` | 配置文件路径 |
| `-addr` | 来自配置文件 | 覆盖监听地址 |
| `-mode` | 来自配置文件 | 覆盖运行模式（Transform/CaptureAnthropic/CaptureResponse） |
| `-print-addr` | — | 打印配置的监听地址后退出 |
| `-print-mode` | — | 打印配置的运行模式后退出 |
| `-print-default-model` | — | 打印默认模型别名后退出 |
| `-print-codex-model` | — | 打印 Codex 模型后退出 |
| `-print-codex-config <model>` | — | 为指定模型生成 Codex config.toml 后退出 |
| `-dump-config-schema` | — | 生成 config.schema.json 后退出 |

## HTTP API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/v1/messages` | POST | Anthropic Messages API 入口（Claude Code 直连） |
| `/messages` | POST | 同上（无 `/v1` 前缀） |
| `/v1/responses` | POST | OpenAI Responses API 入口（Codex CLI 直连） |
| `/responses` | POST | 同上（无 `/v1` 前缀） |
| `/v1/chat/completions` | POST | OpenAI Chat Completions API 入口 |
| `/v1/models` | GET | 列出可用模型 |
| `/models` | GET | 同上 |
| `/console/` | GET | 嵌入式 Web Console |
| `/api/v1/` | — | 管理 API（需启用持久化） |
| `/api/v1/cache/stats` | GET | 查询 DeepSeek prefix cache 命中率与 token 分布 |

详细 API 文档见 [API.md](docs/api.md)。

## 请求跟踪

通过配置中的 `trace.enabled` 或特定工作模式启用请求跟踪，将完整请求/响应链路记录到文件。跟踪文件按 `session/模型名/类别/序号.json` 组织，支持 Chat、Response、Anthropic 三种分类。

## 许可证

[GPL v3](LICENSE)
