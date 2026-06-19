# Spec: Context-Aware Token Estimation

## Purpose

`context_manager` 当前使用固定比率 `chars/token = 2.0` 估算 token 数。这对混合中英文+代码的场景不准确：中文 0.6-0.8 chars/token，代码 1.2-1.5 chars/token，英文 3.5-4.0 chars/token。不准确的估算导致过早或过晚触发截断。

## Contract

### AC-1: Multi-segment estimation
- **Given** 混合了 CJK/英文/代码的文本
- **When** `estimateMessagesTokens` 被调用
- **Then** 使用改进的算法按字符类型分段估算
- **Then** 总 token 数 = 各段估算之和

### AC-2: CJK detection
- **Given** 字符在 Unicode CJK 范围（U+4E00-U+9FFF, U+3400-U+4DBF, U+F900-U+FAFF）
- **When** token 估算
- **Then** 使用 0.75 chars/token

### AC-3: Code block awareness
- **Given** 消息内容包含 markdown 代码块或明显的代码结构
- **When** token 估算
- **Then** 对代码块使用 1.3 chars/token

### AC-4: Fallback to legacy
- **Given** `chars_per_token` 被显式配置
- **When** token 估算
- **Then** 优先使用用户配置的值（向后兼容）

### AC-5: Conservative estimate
- **Given** 不确定字符类型（emoji、符号等）
- **When** token 估算
- **Then** 使用最高比率 2.0（宁可稍高估，不过早截断）

## Details

### 算法

```go
func estimateTokensImproved(content string) float64 {
    var tokens float64
    var currentType segmentType
    var segmentLen int
    
    for _, r := range content {
        t := classifyRune(r)
        if t != currentType || segmentLen > 256 {
            if segmentLen > 0 {
                tokens += float64(segmentLen) / charsPerToken(currentType)
            }
            currentType = t
            segmentLen = 0
        }
        segmentLen++
    }
    if segmentLen > 0 {
        tokens += float64(segmentLen) / charsPerToken(currentType)
    }
    return tokens
}

type segmentType int
const (
    segCJK    segmentType = iota // 0.75
    segCode                      // 1.3
    segLatin                     // 3.8
    segOther                     // 2.0
)

func charsPerToken(t segmentType) float64 {
    switch t {
    case segCJK:   return 0.75
    case segCode:  return 1.3
    case segLatin: return 3.8
    default:       return 2.0
    }
}
```

### 实现位置

`internal/extension/context_manager/plugin.go` — `estimateMessagesTokens()` 替换为改进版本

### 配置

```yaml
extensions:
  context_manager:
    enabled: true
    config:
      chars_per_token: 0           # 0 = auto-detect (NEW default)
      # Or explicit override:
      # chars_per_token: 2.0       # legacy fixed ratio
```

## Boundary Cases

| Case | Behavior |
|------|----------|
| 纯中文 | 每 0.75 字符 = 1 token |
| 纯代码 | 每 1.3 字符 = 1 token |
| 纯英文 | 每 3.8 字符 = 1 token |
| 混合中英文 | 自动分段，分别计算 |
| `chars_per_token` 显式设置 | 跳过自检测，使用固定值 |
| 空字符串 | 返回 0 |
| JSON 内容 | 归类为代码（segCode） |
