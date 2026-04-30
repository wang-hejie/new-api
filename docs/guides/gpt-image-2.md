---
slug: gpt-image-2
title: gpt-image-2 概览
order: 10
category: 模型指南
---

# gpt-image-2 概览

- OpenAI 兼容图像接口，当前可用模型名为 `gpt-image-2`
- 支持文本生成图像与参考图编辑两个主接口
- 本文档基于 `https://www.aiartmirror.com/` 的真实回归测试结果整理

## Authorizations

所有接口都使用 Bearer Token 鉴权。

```text
Authorization: Bearer <YOUR_TOKEN>
```

## Base URL

| 项 | 值 |
|---|---|
| Base URL | `https://www.aiartmirror.com/v1` |
| 协议 | OpenAI 兼容 |
| 推荐客户端超时 | 不低于 120 秒 |
| 默认响应格式 | 不传 `response_format` 时返回 `b64_json` |

## API Reference

| 接口 | 方法 | 用途 |
|---|---|---|
| `/v1/models` | GET | 查询可用模型，免费 |
| `/v1/images/generations` | POST | 文本生成图像 |
| `/v1/images/edits` | POST | 参考图编辑 / 风格迁移 |

## Model

| 字段 | 说明 |
|---|---|
| 模型名 | `gpt-image-2` |
| 可用性 | 唯一实测可用模型名 |
| 不可用别名 | `gpt-image-1` / `dall-e-3` / `dall-e-2` 会返回 503 |

## 通用限制

- `response_format="url"` 返回预签名 URL，24 小时内有效。
- `n > 1` 时按成功返回的图片张数计费，且同步请求耗时会增加。
- 当前上游会静默忽略 `aspect_ratio` 字段；需要超宽图时优先在 prompt 中写明 `panorama` / `cinematic ultrawide`，或使用显式 `size`。
- 不建议传 `background: true` 走异步路径；该参数可能被部分透传，但轮询路径不可用，可能产生不可预期的计费结果。

## 计费规则

| 场景 | 是否计费 |
|---|---|
| 同步 generations 成功，HTTP 200 | 计费 |
| 同步 edits 成功，HTTP 200 | 计费 |
| 任意 4xx 错误 | 不计费 |
| 5xx `model_not_found` | 不计费 |
| 批量生成 / 编辑 | 按成功返回的图片张数计费 |

具体价格以账户后台展示的计费规则为准，客户端不应依赖响应中的内部结算字段做展示或判断。

## 错误处理

所有错误响应都是 OpenAI 标准结构。

```json response status=400 title="错误响应"
{
  "error": {
    "message": "...",
    "type": "...",
    "param": "",
    "code": ""
  }
}
```

| 触发条件 | HTTP | `error.code` | 判断建议 |
|---|---|---|---|
| Bearer token 无效 | 401 | `""` | 按 HTTP 状态码判断鉴权失败 |
| `prompt` 为空或缺失 | 400 | `bad_response_status_code` | 检查 message 中的 `empty string` |
| 模型名不被接受 | 503 | `model_not_found` | 这是永久错误，不要无限重试 |
| `size` 不合规 | 422 | `bad_response_status_code` | 检查 message 中的 `bad_size` |
| 请求体不是合法 JSON | 400 | `""` | 修正请求体格式 |

## Retry Policy

| HTTP | 是否可重试 |
|---|---|
| 401 | 不可重试，需更换 token |
| 400 | 不可重试，需修改请求参数 |
| 422 | 不可重试，需修改尺寸 |
| 503 + `model_not_found` | 不可重试，需修改模型名 |
| 5xx 其他错误 | 可指数退避重试 1-2 次 |

## FAQ

**Q: 可以用 `model="gpt-image-1"` 吗?**

A: 不可以，会返回 503 `model_not_found`。当前只接受 `gpt-image-2`。

**Q: URL 模式返回的图片多久失效?**

A: 24 小时，建议拿到 URL 后尽快下载存档。

**Q: 失败了还会计费吗?**

A: 同步失败的 4xx / 5xx 不计费，只有同步 HTTP 200 成功才计费。

**Q: 一次最多生成几张?**

A: `n` 字段最大 10，但越多越慢，建议同步场景 `n <= 4`。

**Q: 支持哪些图片输入格式做 edits?**

A: 推荐 PNG，其他格式视上游兼容性。

## 联系

接口 / 充值问题，登录 `https://www.aiartmirror.com/` 后到「个人中心」处理。
