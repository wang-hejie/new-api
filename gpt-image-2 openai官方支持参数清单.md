# gpt-image-2 实测支持参数清单

> 更新日期：2026-05-19  
> 测试上游：`https://www.aiartmirror.com`  
> 测试模型：`gpt-image-2`  
> 测试范围：`/v1/images/generations` 文生图、`/v1/images/edits` 图生图。  
> 说明：本文以真实接口调用结果为准；API key 未写入文档。

## 一、结论

当前 aiartmirror 上游的 `gpt-image-2` 在两个端点上的真实行为并不完全等同于 OpenAI 官方文档：

- 文生图和图生图都稳定支持：`model`、`prompt`、`n`、`size`、`quality`、`output_format=png/jpeg`、`output_compression`、`background=auto/opaque`、`moderation=auto/low`、`user`。
- 图生图稳定支持：`image`、`image[]`、`mask`。
- 图生图明确不支持：`response_format`、`reference_usage`、`group`、`input_fidelity`、`stream`、`partial_images`、`background=transparent`。
- 文生图的 `response_format`、`group`、`reference_usage`、`stream=true` 单独请求会返回 200，但响应仍是 `b64_json`，无法证明这些字段真的生效；不建议在操练场作为 `gpt-image-2` 官方能力发送。
- `output_format=webp` 请求会返回 200，响应元数据也标记 `output_format=webp`，但实际图片二进制头仍是 PNG；不建议依赖。

## 二、当前操练场实际携带参数

### 2.1 文生图

代码路径：

- 前端构造：`web/src/helpers/playgroundPayload.js` 的 `buildImageGenerationPayload()`
- 后端能力下发：`controller/user.go` 的 `getPlaygroundImageGenerationMetadata("gpt-image-2")`
- 请求路径：`/pg/images/generations` -> `/v1/images/generations`

当前前端会构造：

```json
{
  "model": "gpt-image-2",
  "group": "<操练场分组>",
  "prompt": "<最后一条用户消息文本>",
  "n": 1,
  "size": "1024x1024 | 1536x1024 | 1024x1536 | auto",
  "quality": "auto | low | medium | high",
  "response_format": "url | b64_json"
}
```

实测后建议调整：

- 保留：`model`、`prompt`、`n`、`size`、`quality`。
- 新增可选：`output_format`、`output_compression`、`background`、`moderation`、`user`。
- 不建议作为上游参数发送：`response_format`、`reference_usage`、`stream`、`partial_images`。
- `group` 只能作为 new-api 内部分组选渠道字段，不能依赖上游支持。

### 2.2 图生图

代码路径：

- 前端构造：`web/src/helpers/playgroundPayload.js` 的 `buildImageEditPayload()`
- UI 参数：`web/src/components/playground/ImageParameterControl.jsx`
- OpenAI adaptor multipart 重写：`relay/channel/openai/adaptor.go`
- 请求路径：`/pg/images/edits` -> `/v1/images/edits`

当前前端会构造 multipart/form-data：

```text
model=gpt-image-2
group=<操练场分组>
prompt=<最后一条用户消息文本>
n=1
size=1024x1024 | 1536x1024 | 1024x1536 | auto
quality=auto | low | medium | high
response_format=url | b64_json
reference_usage=subject | composition | style
image=@<上传的参考图>
```

实测后建议调整：

- 保留：`model`、`prompt`、`image`、`image[]`、`n`、`size`、`quality`。
- 新增可选：`mask`、`output_format`、`output_compression`、`background`、`moderation`、`user`。
- 必须停止发送：`group`、`response_format`、`reference_usage`、`input_fidelity`、`stream`、`partial_images`。

## 三、文生图实测支持参数

端点：`POST /v1/images/generations`

| 参数 | 实测值 | 结果 | 建议 |
|---|---|---:|---|
| `model` | `gpt-image-2` | 200 | 必发 |
| `prompt` | 文本提示词 | 200 | 必发 |
| `n` | `1`、`2` | 200，`n=2` 返回 2 张图 | 保留 |
| `size` | `auto`、`1024x1024`、`1536x1024`、`1024x1536` | 200 | 保留当前 UI 选项 |
| `quality` | `auto`、`low`、`medium`、`high` | 200 | 保留 |
| `output_format` | `png` | 200，返回 PNG 二进制 | 支持 |
| `output_format` | `jpeg` | 200，返回 JPEG 二进制 | 支持 |
| `output_compression` | `80`，配合 `output_format=jpeg` | 200，返回 JPEG 二进制 | 支持，仅在 `jpeg` 时展示更稳妥 |
| `background` | `auto`、`opaque` | 200 | 支持 |
| `moderation` | `auto`、`low` | 200 | 支持 |
| `user` | 字符串 | 200 | 支持，可选 |

### 文生图不建议发送

这些字段不应放入操练场 `gpt-image-2` 文生图建议参数模型：

| 参数 | 实测结果 | 原因 |
|---|---|---|
| `response_format=url` | 200，但响应仍只有 `b64_json` | 请求被接受但语义未生效，不应作为可靠能力 |
| `response_format=b64_json` | 200，响应为 `b64_json` | 与默认行为一致，没有必要发送 |
| `reference_usage=subject` | 200 | 文生图无参考图，语义不成立，不应发送 |
| `group=default` | 200 | new-api 内部字段，不能依赖上游接受 |
| `stream=true` | 200，但返回普通 JSON，不是流式响应 | 语义未生效 |
| `partial_images=1` | 400 | 报错：Partial images are only supported with streaming |
| `stream=true` + `partial_images=1` | 400 | 上游仍判定 partial images 不可用 |
| `background=transparent` | 400 | 报错：Transparent background is not supported for this model |
| `size=512x512` | 400 | 低于当前最小像素预算 |
| `size=1254x1254` | 400 | 宽高必须都能被 16 整除 |
| `output_format=webp` | 200，但实际图片二进制仍是 PNG | 元数据与二进制不一致，不建议依赖 |

## 四、图生图实测支持参数

端点：`POST /v1/images/edits`

| 参数 | 实测值 | 结果 | 建议 |
|---|---|---:|---|
| `model` | `gpt-image-2` | 200 | 必发 |
| `prompt` | 文本编辑指令 | 200 | 必发 |
| `image` | 单张 PNG | 200 | 必发 |
| `image[]` | 多张 PNG | 200 | 多图时使用 |
| `mask` | PNG mask | 200 | 支持，可作为后续图生图增强 |
| `n` | `1`、`2` | 200，`n=2` 返回 2 张图 | 保留 |
| `size` | `auto`、`1024x1024`、`1536x1024`、`1024x1536` | 200 | 保留当前 UI 选项 |
| `quality` | `auto`、`low`、`medium`、`high` | 200 | 保留 |
| `output_format` | `png` | 200，返回 PNG 二进制 | 支持 |
| `output_format` | `jpeg` | 200，返回 JPEG 二进制 | 支持 |
| `output_compression` | `80`，配合 `output_format=jpeg` | 200，返回 JPEG 二进制 | 支持，仅在 `jpeg` 时展示更稳妥 |
| `background` | `auto`、`opaque` | 200 | 支持 |
| `moderation` | `auto`、`low` | 200 | 支持 |
| `user` | 字符串 | 200 | 支持，可选 |

### 图生图必须停止发送

这些字段在 `/v1/images/edits` 实测会失败，操练场图生图必须删除：

| 参数 | 实测结果 | 错误 |
|---|---:|---|
| `response_format=url` | 400 | `Unknown parameter: 'response_format'.` |
| `response_format=b64_json` | 400 | `Unknown parameter: 'response_format'.` |
| `reference_usage=subject` | 400 | `Unknown parameter: 'reference_usage'.` |
| `group=default` | 400 | `Unknown parameter: 'group'.` |
| `input_fidelity=high` | 400 | `gpt-image-2` 不支持 `input_fidelity` |
| `stream=true` | 500 | 上游返回体解析失败；不可用 |
| `partial_images=1` | 400 | Partial images are only supported with streaming |
| `background=transparent` | 400 | Transparent background is not supported for this model |
| `size=512x512` | 400 | 低于当前最小像素预算 |
| `size=1254x1254` | 400 | 宽高必须都能被 16 整除 |
| `output_format=webp` | 200，但实际图片二进制仍是 PNG | 元数据与二进制不一致，不建议依赖 |

## 五、建议的操练场发送模型

### 5.1 文生图最小请求

```json
{
  "model": "gpt-image-2",
  "prompt": "..."
}
```

### 5.2 文生图完整可选请求

```json
{
  "model": "gpt-image-2",
  "prompt": "...",
  "n": 1,
  "size": "1024x1024",
  "quality": "auto",
  "output_format": "png",
  "background": "auto",
  "moderation": "auto"
}
```

当 `output_format=jpeg` 时可发送：

```json
{
  "output_format": "jpeg",
  "output_compression": 80
}
```

### 5.3 图生图最小请求

```text
model=gpt-image-2
prompt=...
image=@input.png
```

### 5.4 图生图完整可选请求

```text
model=gpt-image-2
prompt=...
image=@input.png
n=1
size=1024x1024
quality=auto
output_format=png
background=auto
moderation=auto
```

多图输入：

```text
model=gpt-image-2
prompt=...
image[]=@input-a.png
image[]=@input-b.png
```

带 mask：

```text
model=gpt-image-2
prompt=...
image=@input.png
mask=@mask.png
```

## 六、对当前修复计划的影响

1. `reference_usage` 必须从 `gpt-image-2` 图生图请求中移除；当前错误 `400 Unknown parameter: 'reference_usage'` 可由此修复。
2. `response_format` 必须从 `gpt-image-2` 图生图请求中移除；文生图也不建议继续暴露为能力，因为 `url` 请求没有返回 URL。
3. `group` 必须从 OpenAI edits multipart 上游请求中剥离，只保留在 new-api 内部分组选渠道流程中。
4. `output_format` 应替代 `response_format` 成为输出格式控制参数，但当前只建议开放 `png`、`jpeg`；`webp` 暂不开放。
5. `output_compression` 只建议在 `output_format=jpeg` 时展示和发送。
6. `background` 只开放 `auto`、`opaque`，不要开放 `transparent`。
7. `stream`、`partial_images`、`input_fidelity` 不要作为 `gpt-image-2` 操练场能力接入。

## 七、官方参考

- [GPT Image 2 Model](https://developers.openai.com/api/docs/models/gpt-image-2)
- [Image generation guide](https://developers.openai.com/api/docs/guides/image-generation)
- [Create image API reference](https://developers.openai.com/api/reference/resources/images/methods/generate)
- [Create image edit API reference](https://developers.openai.com/api/reference/resources/images/methods/edit)
