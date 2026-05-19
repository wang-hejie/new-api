---
slug: gpt-image-2-edits
title: 参考图编辑
order: 30
category: 模型指南
---

# 参考图编辑

- 使用 `POST /v1/images/edits` 基于参考图生成编辑结果
- 推荐上传 PNG 参考图

## Authorizations

```text
Authorization: Bearer <YOUR_TOKEN>
```

## POST `/v1/images/edits`

### Request

```http request title="参考图编辑" method=POST path="/v1/images/edits"
POST /v1/images/edits
Authorization: Bearer <YOUR_TOKEN>
Content-Type: multipart/form-data
```

### Body `multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `image` | file | 是 | 参考图，推荐 PNG |
| `prompt` | string | 是 | 编辑指令 |
| `model` | string | 是 | 必须传 `"gpt-image-2"` |
| `n` | integer | 否 | 生成数量 |
| `size` | string | 否 | 同 generations |
| `quality` | string | 否 | 同 generations |

### Request Example

```bash request title="multipart 请求" method=POST path="/v1/images/edits"
curl https://www.aiartmirror.com/v1/images/edits \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -F "model=gpt-image-2" \
  -F "prompt=change the apple color to bright green" \
  -F "n=1" \
  -F "size=1024x1024" \
  -F "quality=low" \
  -F "image=@input.png"
```

### Response `200 application/json`

```json response status=200 title="成功响应"
{
  "created": 1777407500,
  "data": [
    { "b64_json": "..." }
  ],
  "model": "gpt-image-2",
  "usage": {
    "input_tokens": 0,
    "output_tokens": 0,
    "total_tokens": 0
  },
  "account": "..."
}
```

### Tested Result

| 输入 | 输出 | 耗时 | 计费结果 |
|---|---|---|---|
| 1024x1024 红苹果 PNG + `change the apple color to bright green` | HTTP 200，1024x1024 PNG | 32s | 按 1 张成功编辑计费 |

### Error Responses

| 触发条件 | HTTP | 判断建议 |
|---|---|---|
| Bearer token 无效 | 401 | 更换 token 后重试 |
| `prompt` 为空或缺失 | 400 | 补充有效编辑指令 |
| `model` 不被 channel 接受 | 503 | 改为 `gpt-image-2` |
| 图片或尺寸不合规 | 4xx / 422 | 修改上传图片或 `size` |

### Usage Notes

- 推荐使用 PNG 输入图。
- 同步编辑单张图片通常需要几十秒，客户端超时建议不低于 120 秒。
- `n > 1` 会增加耗时，并按成功返回的图片张数计费。
