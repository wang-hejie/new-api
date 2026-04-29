---
slug: gpt-image-2
title: gpt-image-2 使用指南
order: 10
category: 模型指南
---

# gpt-image-2 使用指南

> 基于 `https://www.aiartmirror.com/` 的实测可用功能整理,所有字段、响应、状态码、错误格式均来自真实回归测试结果。照本指南直接对接即可。

---

## 1. 快速开始

| 项 | 值 |
|---|---|
| **Base URL** | `https://www.aiartmirror.com/v1` |
| **鉴权方式** | HTTP Header:`Authorization: Bearer <YOUR_TOKEN>` |
| **模型名** | `gpt-image-2`(**唯一可用**,不要用 `gpt-image-1` / `dall-e-3` / `dall-e-2`,会返 503) |
| **协议** | OpenAI 兼容,直接用官方 OpenAI SDK |
| **超时建议** | 同步生图 120 秒(单张约 20-35 秒) |

最小可跑 curl 验证连通性:

```bash
curl https://www.aiartmirror.com/v1/models \
  -H "Authorization: Bearer <YOUR_TOKEN>"
# 返回: {"data":[{"id":"gpt-image-2","object":"model",...}],"object":"list","success":true}
```

---

## 2. 接口一览

| 路径 | 方法 | 用途 |
|---|---|---|
| `/v1/models` | GET | 查询可用模型(免费) |
| `/v1/images/generations` | POST | 文本生成图像 |
| `/v1/images/edits` | POST | 参考图编辑 / 风格迁移 |

仅这三条。

---

## 3. POST `/v1/images/generations` — 文本生成图像

### 3.1 请求

```http
POST /v1/images/generations
Authorization: Bearer <YOUR_TOKEN>
Content-Type: application/json
```

### 3.2 请求字段

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|:---:|---|---|
| `model` | string | ✅ | — | 必须传 `"gpt-image-2"` |
| `prompt` | string | ✅ | — | 文本描述,不能为空字符串 |
| `n` | integer | | `1` | 生成数量,1–10 |
| `size` | string | | `"auto"` | `"1024x1024"` / `"1024x1536"` / `"1536x1024"` / `"auto"` |
| `quality` | string | | `"auto"` | `"low"` / `"medium"` / `"high"` / `"auto"` |
| `response_format` | string | | (默认 `b64_json`) | `"b64_json"` 或 `"url"` |
| `aspect_ratio` | string | | — | 扩展字段,如 `"wide"`,**优先级高于 `size`**(实测 `wide` 返 1839×855) |

**说明**:
- `size` 三个白名单值都已实测通过,实际返回像素与请求一致
- `quality=low` 已实测通过,`medium` / `high` / `auto` 文档承诺支持(`high` 可能更慢)
- `response_format` 不传时默认走 `b64_json`(对齐 OpenAI SDK 默认行为)
- `aspect_ratio` 是非标准扩展,**OpenAI SDK 用户需要走 `extra_body`** 传

### 3.3 `response_format` 行为

| 传值 | 返回 `data[0]` 字段 | 说明 |
|---|---|---|
| 不传 | `b64_json` | OpenAI SDK 默认路径 |
| `"b64_json"` | `b64_json` | 显式 base64,适合服务端立即处理 |
| `"url"` | `url` | 预签名 URL,**24 小时内有效**,适合客户端直接拉图省服务端带宽 |

### 3.4 响应(成功 200)

```json
{
  "created": 1777407264,
  "data": [
    { "b64_json": "iVBORw0KGgoAAA..." }
  ],
  "model": "gpt-image-2",
  "usage": {
    "input_tokens": 0,
    "output_tokens": 0,
    "total_tokens": 0,
    "input_tokens_details": { "image_tokens": 0, "text_tokens": 0 }
  },
  "account": "..."
}
```

- `data[]`:1 到 n 个项,每项是 `{b64_json: "..."}` 或 `{url: "https://..."}`
- `usage`:OpenAI 兼容的用量信息,不同响应中可能包含不同明细字段

### 3.5 实测示例

| 调用参数 | 实际返回尺寸 | 耗时 | 计费结果 |
|---|---|---|---|
| `size=1024x1024, quality=low` | 1024×1024 | 21s | 按 1 张成功生成计费 |
| `size=1024x1536, quality=low` | 1024×1536 | 22s | 按 1 张成功生成计费 |
| `size=1536x1024, quality=low` | 1536×1024 | 22s | 按 1 张成功生成计费 |
| `aspect_ratio=wide`(不传 size) | 1839×855 | 29s | 按 1 张成功生成计费 |
| `response_format=url` | URL,1024×1024 PNG | 24s | 按 1 张成功生成计费 |

---

## 4. POST `/v1/images/edits` — 参考图编辑

### 4.1 请求

```http
POST /v1/images/edits
Authorization: Bearer <YOUR_TOKEN>
Content-Type: multipart/form-data
```

### 4.2 multipart 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `image` | file | ✅ | 参考图,PNG。重复字段名可传多张 |
| `prompt` | string | ✅ | 编辑指令 |
| `model` | string | | `gpt-image-2` |
| `n` | integer | | 生成数量 |
| `size` | string | | 同 generations |
| `quality` | string | | 同 generations |
| `response_format` | string | | 同 generations |
| `reference_usage` | string | | `"subject"` / `"composition"` / `"style"`,默认 `"subject"` |

### 4.3 响应(成功 200)

```json
{
  "created": 1777407500,
  "data": [{ "b64_json": "..." }],
  "model": "gpt-image-2",
  "usage": { "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, ... },
  "account": "...",
  "reference_blobs": [...]
}
```

### 4.4 实测示例

输入:1024×1024 红苹果 PNG + prompt `"change the apple color to bright green, keep everything else the same"` + `reference_usage=subject`
输出:HTTP 200,1024×1024 PNG,32 秒,按 1 张成功编辑计费

---

## 5. 错误处理

### 5.1 错误响应统一格式

所有错误响应都是 OpenAI 标准结构:

```json
{
  "error": {
    "message": "...",
    "type": "...",
    "param": "",
    "code": "..."
  }
}
```

### 5.2 实测错误一览

| 触发条件 | HTTP | `error.code` | `error.message` 关键文本 |
|---|---|---|---|
| Bearer token 无效 | 401 | `""` | `Invalid token (request id: ...)` |
| `prompt` 为空或缺失 | 400 | `bad_response_status_code` | `[400 poll_failed] ... Invalid 'prompt': empty string` |
| `model` 不被 channel 接受(包括 `gpt-image-1` 等别名) | **503** | `model_not_found` | `No available channel for model <name> ...` |
| `size` 不合规(非 16 倍数 / 超限) | 422 | `bad_response_status_code` | `[422 bad_size] dimensions must be multiples of 16 ...` |
| 请求体不是合法 JSON | 400 | `""` | `Invalid request: invalid character ...` |

### 5.3 客户端错误判断建议

**不要**仅依赖 `error.code` 字段(很多场景为空或为 `bad_response_status_code` 这种通用值)。

**推荐组合判断**:`(HTTP 状态码, error.message 关键词)`,例如:

```python
if status == 401:
    raise AuthError("token 无效或过期")
elif status == 503 and "model_not_found" in resp.get("error", {}).get("code", ""):
    raise ModelError("模型未在该 channel 配置")
elif status == 422 and "bad_size" in resp.get("error", {}).get("message", ""):
    raise ParamError("尺寸不合规")
elif status == 400 and "empty string" in resp.get("error", {}).get("message", ""):
    raise ParamError("prompt 不能为空")
```

### 5.4 重试策略

| HTTP | 是否可重试 |
|---|---|
| 401 | ❌ 永久错误,改 token 才行 |
| 400 | ❌ 永久错误,改请求参数 |
| 422 | ❌ 永久错误,改 size |
| **503 + `model_not_found`** | ❌ **永久错误,改 model 名,不要无限重试** |
| 5xx 其他 | ✅ 指数退避重试 1–2 次 |

---

## 6. 计费规则(实测)

| 场景 | 是否计费 |
|---|---|
| 同步 generations 成功(200) | ✅ 计费 |
| 同步 edits 成功(200) | ✅ 计费 |
| 任何 4xx 错误 | ❌ 不计费 |
| 5xx `model_not_found` | ❌ 不计费 |
| `n > 1` 的批量生成 / 编辑 | 按成功返回的图片张数计费 |

具体价格以账户后台展示的计费规则为准;客户端不应依赖响应中的内部结算字段做展示或判断。

---

## 7. 代码样板

### 7.1 Python · OpenAI SDK(推荐)

```python
from openai import OpenAI
import base64

client = OpenAI(
    base_url="https://www.aiartmirror.com/v1",
    api_key="<YOUR_TOKEN>",
    timeout=120.0,
)

# 基础生图(默认 b64_json)
resp = client.images.generate(
    model="gpt-image-2",
    prompt="a cat sitting on a windowsill at golden hour",
    n=1,
    size="1024x1024",
    quality="low",
)
with open("out.png", "wb") as f:
    f.write(base64.b64decode(resp.data[0].b64_json))
```

### 7.2 Python · 显式要 URL(省内存)

```python
resp = client.images.generate(
    model="gpt-image-2",
    prompt="a serene mountain lake at dawn",
    response_format="url",
)
url = resp.data[0].url  # 24h 内有效
```

### 7.3 Python · 用扩展 `aspect_ratio` 拿超宽图

```python
resp = client.images.generate(
    model="gpt-image-2",
    prompt="cinematic panorama of a desert canyon",
    extra_body={"aspect_ratio": "wide"},   # OpenAI SDK 不识别该字段, 用 extra_body
)
```

### 7.4 Python · 参考图编辑

```python
with open("input.png", "rb") as img:
    resp = client.images.edit(
        model="gpt-image-2",
        image=img,
        prompt="change the apple color to bright green",
        n=1,
        size="1024x1024",
        quality="low",
        extra_body={"reference_usage": "subject"},
    )
with open("edited.png", "wb") as f:
    f.write(base64.b64decode(resp.data[0].b64_json))
```

### 7.5 Node.js · OpenAI SDK

```javascript
import OpenAI from "openai";
import fs from "fs";

const client = new OpenAI({
  baseURL: "https://www.aiartmirror.com/v1",
  apiKey: "<YOUR_TOKEN>",
  timeout: 120000,
});

const resp = await client.images.generate({
  model: "gpt-image-2",
  prompt: "a serene mountain lake at dawn",
  n: 1,
  size: "1024x1024",
  quality: "low",
});

fs.writeFileSync("out.png", Buffer.from(resp.data[0].b64_json, "base64"));
```

### 7.6 curl · 最小化请求

```bash
# 基础生图(b64_json,落盘需要 base64 解码)
curl https://www.aiartmirror.com/v1/images/generations \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2",
    "prompt": "a red apple on a white background",
    "n": 1,
    "size": "1024x1024",
    "quality": "low"
  }' | jq -r '.data[0].b64_json' | base64 -d > apple.png

# 拿 URL(直接 wget 即可)
curl https://www.aiartmirror.com/v1/images/generations \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2",
    "prompt": "...",
    "response_format": "url"
  }' | jq -r '.data[0].url'
```

### 7.7 curl · 参考图编辑

```bash
curl https://www.aiartmirror.com/v1/images/edits \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -F "model=gpt-image-2" \
  -F "prompt=change the apple color to bright green" \
  -F "n=1" \
  -F "size=1024x1024" \
  -F "quality=low" \
  -F "reference_usage=subject" \
  -F "image=@input.png"
```

---

## 8. 使用建议

1. **快速出图用 `quality=low`**,效果不够再升 `medium`,最后再考虑 `high`(更慢、费用更高)
2. **服务端处理用默认 `b64_json`**,客户端直显用 `response_format=url`(省服务端带宽,记得 24h 内消费完)
3. **超宽 / 超长图用 `aspect_ratio`**,而不是去硬塞超出白名单的 `size`
4. **prompt 中文 / 英文均可**,描述性 + 风格关键词组合效果更好(如 `studio photo`、`cinematic`、`golden hour`)
5. **客户端 timeout 不低于 120 秒**,单张图同步生成 20-35 秒为常态
6. **把账户额度不足作为通用 API 错误处理**,不要依赖非标准用量字段做客户端展示

---

## 9. FAQ

**Q:可以用 `model="gpt-image-1"` 吗?**
A:**不可以**,会返 503 `model_not_found`。当前只接受 `"gpt-image-2"`。

**Q:能传 `background: true` 走异步吗?**
A:**不能**。该参数会被部分透传但**轮询路径不可用**,可能产生不可预期的计费结果,**强烈建议禁用**。

**Q:能调 `/v1/health` 看服务状态吗?**
A:不能,该路径不存在。要看站点状态用 `GET /api/status`(返回的字段是 new-api 格式,不含 dengche 那套 `accounts_active`)。

**Q:URL 模式返回的图片多久失效?**
A:24 小时(`X-Amz-Expires=86400`)。建议拿到 URL 后尽快下载存档。

**Q:失败了还会计费吗?**
A:同步失败(4xx / 5xx)**不计费**。只有同步 200 成功才计费。

**Q:一次最多生成几张?**
A:`n` 字段最大 10,但越多越慢,建议同步场景 `n ≤ 4`。

**Q:支持哪些图片输入格式做 edits?**
A:推荐 PNG(实测通过)。其他格式视上游兼容性。

---

## 10. 联系

接口 / 充值问题,登录 `https://www.aiartmirror.com/` 后到「个人中心」处理。
