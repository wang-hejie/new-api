---
slug: gpt-image-2-generations
title: 文本生成图像
order: 20
category: 模型指南
---

# 文本生成图像

- 使用 `POST /v1/images/generations` 从文本生成图片
- 同步生成单张图片通常耗时 20-35 秒，客户端超时建议不低于 120 秒

## Authorizations

```text
Authorization: Bearer <YOUR_TOKEN>
```

## POST `/v1/images/generations`

### Request

```http request title="文本生成图像" method=POST path="/v1/images/generations"
POST /v1/images/generations
Authorization: Bearer <YOUR_TOKEN>
Content-Type: application/json
```

### Body `application/json`

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|:---:|---|---|
| `model` | string | 是 | - | 必须传 `"gpt-image-2"` |
| `prompt` | string | 是 | - | 文本描述，不能为空字符串 |
| `n` | integer | 否 | `1` | 生成数量，1-10 |
| `size` | string | 否 | `"auto"` | `"1024x1024"` / `"1024x1536"` / `"1536x1024"` / `"auto"` |
| `quality` | string | 否 | `"auto"` | `"low"` / `"medium"` / `"high"` / `"auto"` |

### Request Body Example

```json request title="JSON 请求体" method=POST path="/v1/images/generations"
{
  "model": "gpt-image-2",
  "prompt": "a red apple on a clean white surface",
  "n": 1,
  "size": "1024x1024",
  "quality": "low"
}
```

### Response `200 application/json`

```json response status=200 title="成功响应"
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
    "input_tokens_details": {
      "image_tokens": 0,
      "text_tokens": 0
    }
  },
  "account": "..."
}
```

### Tested Results

| 调用参数 | 实际返回尺寸 | 耗时 | 计费结果 |
|---|---|---|---|
| `size=1024x1024, quality=low` | 1024x1024 | 21s | 按 1 张成功生成计费 |
| `size=1024x1536, quality=low` | 1024x1536 | 22s | 按 1 张成功生成计费 |
| `size=1536x1024, quality=low` | 1536x1024 | 22s | 按 1 张成功生成计费 |

### Error Responses

| 触发条件 | HTTP | `error.code` | `error.message` 关键文本 |
|---|---|---|---|
| Bearer token 无效 | 401 | `""` | `Invalid token` |
| `prompt` 为空或缺失 | 400 | `bad_response_status_code` | `Invalid 'prompt': empty string` |
| `model` 不被 channel 接受 | 503 | `model_not_found` | `No available channel for model` |
| `size` 不合规 | 422 | `bad_response_status_code` | `bad_size` |
| 请求体不是合法 JSON | 400 | `""` | `invalid character` |

### Usage Notes

- 快速出图优先使用 `quality=low`，效果不够再升 `medium` 或 `high`。
- 客户端不要只依赖 `error.code`，建议组合判断 HTTP 状态码与 `error.message` 关键词。
