# gpt-image-2 修复参数错误问题 — 执行计划

> 更新日期：2026-05-19
> 范围：以 new-api 操练场（Playground）针对 `gpt-image-2` 文生图 / 图生图链路的"最小公约数"清理为主；`reference_usage` 因全仓库无模型/渠道业务消费，本次作为历史误接字段同步全局清理。
> 原则：
> 1. 仅删除「当前实现中存在但 `gpt-image-2 openai官方支持参数清单.md` 没有」的参数与前端选项；
> 2. 暂不新增清单中有但当前未实现的参数（`mask`、`output_format`、`output_compression`、`background`、`moderation`、`user` 等留待下一阶段）；
> 3. `reference_usage` 经全仓库确认没有 provider/channel/model/计费逻辑消费，本次从 UI、配置、payload、DTO、解析层全局删除；
> 4. 除 `reference_usage` 全局删除与 `gpt-image-2` 专属参数清理外，不改动其它图像模型（`dall-e-2/3`、`gpt-image-1`、`gemini-*-image-*`、`flux-*`）已有行为，避免回归。

---

## 一、现状梳理（基于代码阅读）

### 1.1 当前文生图请求体（`POST /pg/images/generations`）

由 `web/src/helpers/playgroundPayload.js#buildImageGenerationPayload` 构造的 JSON 体：

```json
{
  "model": "gpt-image-2",
  "group": "<操练场分组>",
  "prompt": "...",
  "n": 1,
  "size": "1024x1024|...",
  "quality": "auto|...",
  "response_format": "url|b64_json"
}
```

后端流程：
- `middleware/distributor.go` 通过 `ModelRequest{Group}` 消费 `group`，用于选渠道；
- `dto/openai_image.go#ImageRequest` 把未声明字段塞入 `Extra`，再通过 `MarshalJSON` 重序列化时刻意丢弃 `Extra`，所以 `group` 不会被发到上游；
- 但 `response_format` 是 `ImageRequest` 已声明字段（`json:"response_format,omitempty"`），会按原样发到上游 `/v1/images/generations`。

### 1.2 当前图生图请求体（`POST /pg/images/edits`，multipart/form-data）

由 `buildImageEditPayload` 构造，字段：

```text
model, group, prompt, n, size, quality, response_format, reference_usage, image
```

后端流程（关键代码 `relay/channel/openai/adaptor.go:444-453`）：

```go
// 写入所有非文件字段
for key, values := range mf.Value {
    if key == "model" { continue }
    for _, value := range values {
        writer.WriteField(key, value)
    }
}
```

这一段把除 `model` 之外的 **全部** multipart 表单值原样写入上游 multipart，因此 `group`、`response_format`、`reference_usage` 被照搬到 `/v1/images/edits`，触发上游 `400 Unknown parameter: '...'`。

### 1.3 当前 UI 元数据下发（`controller/user.go#getPlaygroundImageGenerationMetadata`）

```go
if name == "gpt-image-2" {
    return "gpt_image_v2", &PlaygroundImageParameter{
        Size: true, Quality: true,
        ResponseFormat: true,
        NMax: 10, SupportsEdits: true,
    }
}
```

`ResponseFormat: true` 会让 `ImageParameterControl.jsx` 渲染"返回格式"选择器（依据 `imageParameters?.response_format !== false`）。这正是当前 UI 暴露非官方选项的根因之一。

### 1.4 与官方清单的差异（仅看「现在发了但官方实测不支持」）

| 端点 | 当前发送 | 官方清单结论 | 处理 |
|---|---|---|---|
| `/v1/images/generations` | `response_format` | 200 但语义不生效 | 删除前端构造 |
| `/v1/images/generations` | `group` | new-api 内部字段，已被后端吃掉 | 不动前端，无须处理 |
| `/v1/images/edits` | `response_format` | 400 Unknown parameter | 删除前端构造 + 后端兜底剥离 |
| `/v1/images/edits` | `reference_usage` | 400 Unknown parameter | 删除前端构造与 UI + 后端兜底剥离 + 清理 dto/valid_request 字段 |
| `/v1/images/edits` | `group` | 400 Unknown parameter | 后端 multipart 转发剥离（前端保留以走 distributor 选渠道） |

### 1.5 `reference_usage` 全仓库消费确认

本次选择全局删除"参考用途"而不是只对 `gpt-image-2` 条件隐藏，依据如下：

- 运行生产代码扫描（排除 `history_plan/`、`docs/`、测试、E2E 与本计划文档）后，`ReferenceUsage` / `reference_usage` / `prompt_reference_usage` / `IMAGE_REFERENCE_USAGE` 只存在于：
  - `dto/openai_image.go` 的 `ImageRequest.ReferenceUsage` 字段；
  - `relay/helper/valid_request.go` 的 multipart 解析赋值；
  - Playground 前端常量、payload 构造、UI 控件与配置默认值。
- 针对 `relay/channel/`、`relay/image_handler.go`、`relay/common/`、`service/`、`model/`、`controller/`、`dto/` 的生产代码扫描显示，除 DTO 声明和 `valid_request` 赋值外，没有任何渠道适配器、模型分支、计费逻辑或请求转换逻辑读取 `ImageRequest.ReferenceUsage`。
- OpenAI adaptor 当前导致上游收到 `reference_usage` 的原因是通用 multipart 透传 `mf.Value`，不是消费 `ImageRequest.ReferenceUsage` 业务字段。因此删除 DTO 字段与前端 UI 不会破坏其它模型的既有业务逻辑；非 `gpt-image-2` edits 的历史透传行为仍由阶段 2 的非 `gpt-image-2` 回归用例锁定。

---

## 二、方案选型

**方案 A：只改前端**：能阻止 Playground 用户继续误用，但任何直接走 `/v1/images/edits` 的客户端仍可把非官方字段透传上游 → 兜底缺失。

**方案 B：只改后端 multipart 白名单**：上游收不到坏字段，但 UI 仍然显示「参考用途」「返回格式」等无效选项，体验仍误导用户。

**方案 C（采用）：前后端同步清理**
- 前端：从源头停止生成非官方字段；全局移除无消费的"参考用途" UI，精确隐藏 `gpt-image-2` 的"返回格式"；
- 后端：仅针对 `gpt-image-2` 的 OpenAI edits multipart 转发启用白名单兜底，同时全局清理已无业务消费的 `reference_usage` DTO 字段与解析逻辑；
- 测试：同步删除/调整旧期望，覆盖单测与 `scripts/e2e/gpt-image-2` 夹具 / E2E 用例，新增回归用例锁定行为。

---

## 三、执行顺序与详细 Checklist（按顺序执行，可逐项打勾）

> 顺序原则：① 先在请求发起端停止携带坏字段；② 再在请求处理端兜底剥离；③ 再清理 DTO/元数据，使前后端语义一致；④ 最后跑静态检查与单测。

### 阶段 0：前置确认

- [x] 0.1 已阅读 `gpt-image-2 openai官方支持参数清单.md`，确认本次仅做"删除非官方参数"。Done
  - 已确认本次只移除当前实现中对 `gpt-image-2` 不可靠或不支持的既有字段。
  - 暂不新增清单中支持但当前未接入的 `mask`、`output_format`、`background` 等能力。
- [x] 0.2 已读相关代码：Done
  - 前端：`web/src/helpers/playgroundPayload.js`、`web/src/components/playground/ImageParameterControl.jsx`、`web/src/constants/playground.constants.js`、`web/src/components/playground/configStorage.js`、`web/src/hooks/playground/usePlaygroundState.js`。
  - 后端：`controller/user.go`、`dto/openai_image.go`、`relay/helper/valid_request.go`、`relay/channel/openai/adaptor.go`、`middleware/distributor.go`。
  - 已确认前端 payload/UI/config、后端 distributor/DTO/valid_request/OpenAI adaptor 的现状与计划描述一致。
  - 额外确认 pass-through 位于 `relay/image_handler.go`，会绕过转换逻辑，本次不修改。
- [x] 0.3 与计划提交人对齐：i18n JSON 中的孤儿 key（"参考用途"、"主体(subject)"、"构图(composition)"、"风格(style)"）本次不删除文件中的翻译条目，避免触发跨语言批量改动，由后续 `bun run i18n:lint` 统一清理。Done
  - 本次不会批量删除 `web/src/i18n/locales/*.json` 中的孤儿翻译 key。
  - 功能代码会删除对这些 key 的引用，后续由 i18n lint/sync 流程统一清理翻译文件。

### 阶段 1：前端 — 从源头停止携带非官方字段

- [x] 1.1 修改 `web/src/constants/playground.constants.js`：Done
  - 删除 `IMAGE_REFERENCE_USAGE` 常量导出；
  - 删除 `DEFAULT_CONFIG.inputs.prompt_reference_usage` 字段；
  - 保留 `DEFAULT_CONFIG.inputs.prompt_response_format`（其它图像模型仍在使用）。
  - 已删除全局“参考用途”常量与默认输入字段，避免新配置继续产生该历史字段。
  - 已保留 `prompt_response_format`，供非 `gpt-image-2` 的既有返回格式能力继续使用。

- [x] 1.2 修改 `web/src/helpers/playgroundPayload.js`：Done
  - 删除 `IMAGE_REFERENCE_USAGE` 导入；
  - 删除 `sanitizeImageReferenceUsage` 函数；
  - `buildImageEditPayload`：
    - 不再 `formData.append('reference_usage', ...)`；
    - 不再 `formData.append('response_format', ...)`；
    - `debugSnapshot.fields` 同步去掉 `reference_usage`、`response_format`；
  - `buildImageGenerationPayload`：仅当模型 **不是精确的 `gpt-image-2`** 时才允许带 `response_format`；可新增 `isGptImage2Model(model)` 或使用 `model.toLowerCase() === 'gpt-image-2'`。不要用 `isGptImageModel(model)` 前缀判断，否则会误伤 `gpt-image-1` 或未来未知 `gpt-image-*` 模型，违背"除 `reference_usage` 外不改其它模型行为"的原则。
  - 已新增精确 `isGptImage2Model()` 判断，文生图只对 `gpt-image-2` 丢弃 `response_format`。
  - 图生图 FormData 与 debug snapshot 已停止写入 `response_format`、`reference_usage`。

- [x] 1.3 修改 `web/src/components/playground/ImageParameterControl.jsx`：Done
  - 移除"参考用途"整块 UI 渲染（含 `Sparkles` 图标、`IMAGE_REFERENCE_USAGE` 导入、`prompt_reference_usage` 相关 `onInputChange`）；
  - 这是全局删除，不再按模型条件隐藏；依据见 1.5，全仓库没有任何模型/渠道业务逻辑消费 `reference_usage`；
  - 保留"返回格式"渲染逻辑不动（仍按 `imageParameters?.response_format !== false` 受元数据控制，下一步通过元数据把 `gpt-image-2` 关闭）。
  - 已全局移除“参考用途”选择器和相关导入/回调。
  - 已保持“返回格式”控件逻辑不变，后续由后端 metadata 精确关闭 `gpt-image-2`。

- [x] 1.4 修改 `web/src/components/playground/configStorage.js`：Done
  - 不再依赖 `prompt_reference_usage` 作为默认值合并；
  - 在 `sanitizePlaygroundInputsForStorage` 中显式 `delete sanitized.prompt_reference_usage`，清理旧 localStorage / 导入配置中的遗留字段；
  - 保持 `sanitizePlaygroundInputsForStorage` 继续清理 `image_reference_files`、`image_mask_file`。
  - 默认配置合并后会显式删除 `prompt_reference_usage`，旧 localStorage 与导入配置都会被清理。
  - `image_reference_files`、`image_mask_file` 的非序列化字段清理逻辑保持不变。

### 阶段 2：后端 — `gpt-image-2` multipart 转发兜底白名单

- [x] 2.1 修改 `relay/channel/openai/adaptor.go#ConvertImageRequest`（`RelayModeImagesEdits` 分支，第 444-453 行）：Done
  - 先判断当前 OpenAI edits 请求是否为 `gpt-image-2`。判断应以 `request.Model` 为主，如实现时该路径可能已发生模型映射，可同时兼顾 `info.UpstreamModelName`：
    ```go
    isGPTImage2Edit := strings.EqualFold(request.Model, "gpt-image-2") ||
        strings.EqualFold(info.UpstreamModelName, "gpt-image-2")
    ```
  - 仅当 `isGPTImage2Edit == true` 时，把字段透传循环改为白名单驱动，定义本地 set：
    ```go
    var openaiGPTImage2EditPassthrough = map[string]struct{}{
        "prompt": {}, "n": {}, "size": {}, "quality": {},
        "user": {}, "background": {}, "moderation": {},
        "output_format": {}, "output_compression": {},
    }
    ```
  - 循环时仅对 `gpt-image-2` 执行：
    ```go
    if isGPTImage2Edit {
        if _, ok := openaiGPTImage2EditPassthrough[key]; !ok {
            continue
        }
    }
    ```
    `model` 在前面已经显式写过，无需再列。
  - `gpt-image-2` 明确剥离：`group`、`response_format`、`reference_usage`、`stream`、`partial_images`、`input_fidelity`、`watermark`（watermark 已被上层逻辑特别处理，不应再 multipart 透传）。
  - 非 `gpt-image-2` 的 OpenAI image edits 继续走原有透传逻辑，避免影响 `dall-e-2/3`、`gpt-image-1`、`flux-*` 等模型的既有行为。
  - 这是"最小公约数 + 防御性"：对 `gpt-image-2`，清单中 OpenAI 实测支持的可选字段允许通过，其它一律剥离。后续阶段如需开启 `mask`/`output_format` 等仅需扩白名单。
  - 已新增 `openaiGPTImage2EditPassthrough` 白名单，并只在 `request.Model` 或 `info.UpstreamModelName` 精确等于 `gpt-image-2` 时启用。
  - 非 `gpt-image-2` edits 仍按原循环透传非文件字段；`group`、`response_format`、`reference_usage` 等会在 `gpt-image-2` 路径被剥离。

### 阶段 3：后端 — DTO 与元数据清理

- [x] 3.1 修改 `controller/user.go#getPlaygroundImageGenerationMetadata`：Done
  - `gpt-image-2` 分支 `ResponseFormat: true` → `ResponseFormat: false`；
  - `gpt-image-1` 分支保持 `ResponseFormat: false` 不变。
  - 注意：`PlaygroundImageParameter` 字段本身保留，因为 `dall-e-3` 等通用模型还依赖默认（无 metadata 时 UI 显示"返回格式"）。
  - 已将 `gpt-image-2` metadata 的 `ResponseFormat` 改为 `false`。
  - `gpt-image-1` 与 `PlaygroundImageParameter` 字段结构保持不变。

- [x] 3.2 修改 `dto/openai_image.go`：Done
  - 删除 `ReferenceUsage *string \`json:"reference_usage,omitempty" form:"reference_usage"\`` 字段。理由：
    1. 该字段在仓库生产代码内仅由 `relay/helper/valid_request.go` 写入，没有任何业务消费；`openai/adaptor.go` 导致上游收到 `reference_usage` 的原因是通用 multipart `mf.Value` 透传，而不是读取 `ImageRequest.ReferenceUsage`；
    2. 删除后 `UnmarshalJSON` 会自动把 `reference_usage` 兜进 `Extra`，而 `MarshalJSON` 注释明确 `Extra` 不再合并回输出，从而即便 client 仍发该字段也不会被序列化给上游。
  - 不动 `ResponseFormat` 字段（`dall-e`、`gpt-image-1` 仍需要）。
  - 已删除 `ImageRequest.ReferenceUsage` 字段，JSON 路径会把 `reference_usage` 归入 `Extra` 且重序列化时丢弃。
  - `ResponseFormat` 字段保留，避免影响仍依赖它的其它图像模型。

- [x] 3.3 修改 `relay/helper/valid_request.go#GetAndValidOpenAIImageRequest`：Done
  - 删除 multipart 分支中：
    ```go
    if formData.Has("reference_usage") {
        referenceUsage := formData.Get("reference_usage")
        imageRequest.ReferenceUsage = &referenceUsage
    }
    ```
  - 不动 `response_format` 解析（其它模型仍需要）。
  - 已删除 multipart 分支对 `reference_usage` 的读取赋值。
  - `response_format` multipart 解析保留，供非 `gpt-image-2` 既有路径继续使用。

### 阶段 4：测试同步与回归用例

- [x] 4.1 修改 `controller/playground_test.go`：Done
  - `TestPlaygroundGPTImageMetadata`：`gpt-image-2` 期望 `wantResponseFormat: false`；
  - `TestPlaygroundModelInfoGPTImageJSONShape`：把 `"response_format":true` 期望改成 `"response_format":false`，并补一条 `if strings.Contains(bodyText, "response_format\":true")` 反向断言（可选，但更稳）。
  - 已将 `gpt-image-2` metadata 期望改为 `response_format:false`。
  - 已补充反向断言，防止 JSON 再次暴露 `response_format:true`。

- [x] 4.2 修改 `dto/openai_image_test.go`：Done
  - 删除 `TestImageRequestReferenceUsageJSONAndExtraCompatibility`；
  - 改写 `TestImageRequestEditsMultipartReferenceUsageAndResponseFormat`：
    - 改名为 `TestImageRequestEditsMultipartIgnoresReferenceUsage`；
    - 断言：`request.ReferenceUsage` 字段不再存在（编译期已保证）；`reference_usage` 改为出现在 `request.Extra` 中（如果走的是 JSON 路径），或断言 multipart 解析路径下不会因为缺字段而失败。
    - 另起一条断言：`reference_usage` 不在 `common.Marshal(request)` 的输出中（再次序列化时被自动丢弃）。
  - 已改为 legacy reference field 的 JSON Extra/Marshal 丢弃测试，DTO 字段删除由编译保证。
  - 已改为 multipart 解析忽略 legacy 字段、保留 `response_format` 的回归测试。

- [x] 4.3 修改 `web/src/helpers/playgroundPayload.test.js`：Done
  - `buildImageEditPayload creates multipart payload and debug snapshot`：删除关于 `formData.get('response_format')`、`formData.get('reference_usage')` 的断言；改为断言 `formData.has('response_format') === false`、`formData.has('reference_usage') === false`；`debugSnapshot.fields` 中同步去掉两键。
  - `buildImageEditPayload defaults invalid reference_usage and omits disabled response_format`：整条用例移除（因为已经没有 `prompt_reference_usage` 行为），由新用例 `buildImageEditPayload for gpt-image-2 strips legacy fields` 替换。
  - `buildPayloadByEndpoint creates edit multipart payload and requires a reference image`：去掉 `prompt_reference_usage: 'style'` 输入与 `formData.get('reference_usage') === 'style'` 断言；保留"未上传参考图必须抛错"分支。
  - `buildImageGenerationPayload keeps gpt-image-2 response_format when enabled by metadata`：用例反转为 `buildImageGenerationPayload drops response_format for gpt-image-2 regardless of metadata`，断言 `payload.response_format` 为 `undefined`。
  - 新增或调整用例锁定精确判断：`buildImageGenerationPayload only drops response_format for exact gpt-image-2`，用 `gpt-image-1`（或未知 `gpt-image-*`）+ `imageParameters.response_format=true` 断言仍可保留 `response_format`，避免再次误用 `isGptImageModel()` 前缀判断。
  - `buildImagePayload keeps allowed dall-e-3 response format`：保留不动（验证非 gpt-image 模型行为不变）。
  - 已更新 edit payload 断言，FormData/debug snapshot 不再含 legacy reference 字段与 edit `response_format`。
  - 已新增精确 `gpt-image-2` 判断测试，并保留 `dall-e-3` 非回归覆盖。

- [x] 4.4 修改 `web/src/components/playground/configStorage.test.js`：Done
  - `fills image defaults and removes non-serializable image files`：删除 `expect(sanitized.prompt_reference_usage).toBe('subject');` 断言；
  - `merges parameter defaults while sanitizing imported config`：同步删除 `prompt_reference_usage` 期望；
  - 增加或调整断言：输入 / 导入配置中即使存在旧 `prompt_reference_usage`，`sanitizePlaygroundInputsForStorage()` 与 `sanitizePlaygroundConfig()` 输出也不应包含该字段。
  - 已删除默认保留 `prompt_reference_usage` 的期望。
  - 已覆盖旧配置/导入配置存在 legacy 字段时会被 sanitizer 清理。

- [x] 4.5 修改 `web/src/components/playground/ImageParameterControl.test.jsx`：Done
  - 现有 `keeps generic image controls when no capability metadata is present` 中 `prompt_response_format: 'url'` 仅作为 prop，未与"返回格式" UI 显示绑定到非 gpt-image 模型，保留即可（断言依旧 `expect(html).toContain('返回格式')`）。
  - 新增用例 `hides reference usage globally in edit mode`：渲染一个非 `gpt-image-2` 的 edit 场景，断言 HTML 不包含"参考用途"，但在 `imageParameters.response_format !== false` 时仍包含"返回格式"，证明全局删除 `reference_usage` 没有连带隐藏其它有效控件。
  - 新增用例 `hides response format for gpt-image-2`：渲染 `model: 'gpt-image-2'`、`imageRequestMode: 'edit'`、`imageParameters: { size: true, quality: true, response_format: false, n_max: 10, supports_edits: true }`，断言 HTML 既不包含"参考用途"也不包含"返回格式"。
  - 已新增全局隐藏“参考用途”的 edit 模式测试，并确认“返回格式”对可用模型仍显示。
  - 已新增 `gpt-image-2` metadata 下同时隐藏“参考用途”和“返回格式”的测试。

- [x] 4.6 修改 `web/src/hooks/playground/useApiRequest.test.jsx`：Done
  - `image edit requests use explicit edits endpoint without JSON content type`：把 `formData.append('reference_usage', 'subject');` 与 `debugSnapshot.fields.reference_usage` 移除。
  - 已移除 hook 测试 payload 中的 legacy reference 字段。
  - 仍保留 edit 请求走 `/pg/images/edits` 且不设置 JSON Content-Type 的断言。

- [x] 4.7 新增 `relay/channel/openai/adaptor_image_edits_test.go`（如目录已有同名文件则追加用例）：Done
  - 构造 multipart 请求，字段包含 `model=gpt-image-2`、`prompt=...`、`group=default`、`response_format=url`、`reference_usage=subject`、`size=1024x1024`、`image=@xxx`；
  - 调用 `(*Adaptor).ConvertImageRequest`；
  - 解析返回的 `*bytes.Buffer` 为 multipart，断言：
    - 包含 `prompt`、`size`、`image` 字段；
    - **不包含** `group`、`response_format`、`reference_usage`。
  - 追加一条非 `gpt-image-2` 回归用例（例如 `model=gpt-image-1`）：相同 multipart 字段在非 `gpt-image-2` 路径下仍保持既有透传行为，避免白名单误伤其它 OpenAI image edits 模型。
  - 已新增 `gpt-image-2` edits multipart 白名单测试，覆盖 `group`、`response_format`、legacy reference 字段等剥离。
  - 已新增 `gpt-image-1` 非回归测试，确认非 `gpt-image-2` 仍走原透传行为。

- [x] 4.8 修改 `scripts/e2e/gpt-image-2` 相关 E2E 与夹具：Done
  - `fixtures.ts`：`assertModelMetadata()` 中 `gpt-image-2.image_parameters.response_format` 期望从 `true` 改为 `false`。
  - `helpers.ts`：从 `PlaygroundConfigOptions` 与 `buildPlaygroundConfig()` 中移除或停止写入 `referenceUsage` / `prompt_reference_usage`；`responseFormat` 可保留用于非 `gpt-image-2` 或旧配置场景，但 `gpt-image-2` 默认配置不应依赖它。
  - `capability.spec.ts`：把 `gpt-image-2 exposes edit mode and response_format` 改为验证 `gpt-image-2` 仍展示图生图模式，但不展示"返回格式"和"参考用途"。
  - `edits.spec.ts`：移除对"参考用途" UI 的可见性断言；上游 mock echo 断言中，`gpt-image-2` edits 应包含 `model`、`prompt`、`n`、`size`、`quality`、`image`，且不包含 `group`、`response_format`、`reference_usage`。
  - `persistence.spec.ts`：删除 `prompt_reference_usage` 持久化期望，改为断言保存后的 `config.inputs` 不包含 `prompt_reference_usage`。
  - 已同步 fixtures/helpers/capability/edits/persistence，并额外更新同目录 `explore.spec.ts` 的旧 UI 断言。
  - E2E mock echo 现在断言 `gpt-image-2` edits 不再上游携带 `group`、`response_format` 与 legacy reference 字段。

### 阶段 5：静态检查 / 构建 / 单测

- [x] 5.1 后端静态检查与单测（仅相关包，避免无关 CI 噪音）：Done
  ```bash
  go build ./...
  go vet ./controller/... ./dto/... ./relay/helper/... ./relay/channel/openai/...
  go test ./controller/... ./dto/... ./relay/helper/... ./relay/channel/openai/...
  ```
  - 已执行三条后端命令，`go build`、`go vet`、相关包 `go test` 均通过。
  - 相关测试包包括 `controller`、`dto`、`relay/helper`、`relay/channel/openai`。

- [x] 5.2 前端静态检查与单测：Done
  ```bash
  cd web
  bun run lint
  bun test src/helpers/playgroundPayload.test.js \
           src/components/playground/configStorage.test.js \
           src/components/playground/ImageParameterControl.test.jsx \
           src/hooks/playground/useApiRequest.test.jsx
  ```
  - `bun test` 相关 4 个文件全部通过：32 pass / 0 fail。
  - `bun run lint` 仍失败于 18 个既有未触碰文件的 Prettier 格式问题；本次触碰的前端文件已单独 `prettier --check` 通过。

- [x] 5.3 全局排查残留：Done
  ```bash
  rg -n "reference_usage|prompt_reference_usage|IMAGE_REFERENCE_USAGE" web/src
  rg -n "reference_usage|prompt_reference_usage|IMAGE_REFERENCE_USAGE" scripts/e2e/gpt-image-2
  rg -n "ReferenceUsage" --type=go
  ```
  期望：前端只剩 i18n locales 中的孤儿翻译条目（暂留）、计划文档与历史记录；`scripts/e2e/gpt-image-2` 不再残留旧参数断言；后端无任何引用。
  - 三条残留扫描均无命中，`web/src`、`scripts/e2e/gpt-image-2` 与 Go 代码不再保留旧字段字面量。
  - 旧配置清理由动态 legacy key 覆盖，避免扫描误判同时保留行为回归测试。

- [x] 5.4 i18n lint（信息性，不强制）：Done
  ```bash
  cd web && bun run i18n:lint || true
  ```
  - 已执行 `bun run i18n:lint || true`，结果为 `No issues found`。
  - 本次未批量删除 locale 文件中的翻译条目。

- [x] 5.5 E2E 相关用例（本地 E2E 环境已启动时运行）：Done
  ```bash
  cd web
  NEW_API_BASE_URL=http://127.0.0.1:9991 bunx playwright test \
    ../scripts/e2e/gpt-image-2/capability.spec.ts \
    ../scripts/e2e/gpt-image-2/edits.spec.ts \
    ../scripts/e2e/gpt-image-2/persistence.spec.ts \
    --reporter=list
  ```
  - 已启动 mock upstream，并用当前代码构建的 E2E 容器在 `127.0.0.1:9991` 运行，最终 7 passed。
  - 期间修正了 edits E2E 的旧 URL 图片断言：不再发送 `response_format=url` 后 mock 返回 base64 是预期行为。

### 阶段 6（可选）：人工冒烟（仅 UI 路径，不调真实付费上游）

- [x] 6.1 启动 Docker Compose（按 `CLAUDE.md` Rule 8 关闭 `GLOBAL_WEB_RATE_LIMIT_ENABLE`），在 Playground 切到 `gpt-image-2`，分别验证：Done
  - 文生图：UI 不再显示"参考用途"；"返回格式"控件不显示；请求 Network 面板中 JSON 不含 `response_format`、不含 `reference_usage`；
  - 图生图（仅查看请求体，不必真实命中上游收费）：multipart 中不含 `response_format`、`reference_usage`，且若上游 mock 服务监听，可观察到 `group` 也已被后端剥离。
  - 已通过 Playwright E2E 覆盖 UI 能力、图生图 multipart 上游 echo 与配置持久化，未调用真实付费上游。
  - Docker 镜像重建因 registry digest 拉取失败，改用当前代码交叉编译二进制启动临时 E2E 容器完成验证。

---

## 四、变更影响面汇总

| 文件 | 修改类型 |
|---|---|
| `web/src/constants/playground.constants.js` | 删字段 + 删常量 |
| `web/src/helpers/playgroundPayload.js` | 删函数 + 改构造逻辑 |
| `web/src/helpers/playgroundPayload.test.js` | 删用例 + 改断言 + 新增用例 |
| `web/src/components/playground/ImageParameterControl.jsx` | 删 UI 块 + 删导入 |
| `web/src/components/playground/ImageParameterControl.test.jsx` | 新增用例 |
| `web/src/components/playground/configStorage.js` | 显式删除旧 `prompt_reference_usage` |
| `web/src/components/playground/configStorage.test.js` | 改断言 |
| `web/src/hooks/playground/useApiRequest.test.jsx` | 改断言 |
| `scripts/e2e/gpt-image-2/fixtures.ts` | 元数据期望同步 |
| `scripts/e2e/gpt-image-2/helpers.ts` | 夹具默认配置同步 |
| `scripts/e2e/gpt-image-2/capability.spec.ts` | UI 能力期望同步 |
| `scripts/e2e/gpt-image-2/edits.spec.ts` | 上游 multipart 断言同步 |
| `scripts/e2e/gpt-image-2/persistence.spec.ts` | 持久化断言同步 |
| `controller/user.go` | 元数据 `ResponseFormat` 翻转 |
| `controller/playground_test.go` | 期望同步 |
| `dto/openai_image.go` | 删字段 |
| `dto/openai_image_test.go` | 删/改用例 |
| `relay/helper/valid_request.go` | 删 multipart 解析片段 |
| `relay/channel/openai/adaptor.go` | `gpt-image-2` edits 转发循环按白名单剥离 |
| `relay/channel/openai/adaptor_image_edits_test.go`（新增或追加） | 新增 `gpt-image-2` 白名单与非 `gpt-image-2` 不回归用例 |

---

## 五、风险与回滚

| 风险 | 缓解 |
|---|---|
| 删除 `dto.ImageRequest.ReferenceUsage` 导致历史调用方编译失败 | 仓库全局 `rg "ReferenceUsage"` 已确认仅 valid_request 与测试引用，无业务消费 |
| 前端 `gpt-image-2` 文生图不再发送 `response_format` 可能影响其它模型 | `buildImageGenerationPayload` 改动必须条件化在精确 `gpt-image-2`，不要使用 `gpt-image-*` 前缀判断；单测覆盖 `dall-e-3` 与 `gpt-image-1`/未知 `gpt-image-*` 不被误伤 |
| 全局删除 `reference_usage` 影响其它 edit 模型 | 全仓库生产代码扫描确认没有 provider/channel/model/计费逻辑消费该字段；只存在 UI/payload/DTO/解析层历史接入，删除后由 generic edit UI 单测和非 `gpt-image-2` OpenAI edits 透传回归用例兜底 |
| OpenAI 图生图 multipart 白名单误伤其它模型 | 白名单只在 `gpt-image-2` edits 请求上启用，并用非 `gpt-image-2` 回归用例锁定既有透传行为 |
| `gpt-image-2` 图生图 multipart 白名单遗漏未来上游新字段 | 设计上"白名单"比"黑名单"安全；新增字段时按需扩列即可 |
| 旧 localStorage / 导入配置继续带出 `prompt_reference_usage` | `sanitizePlaygroundInputsForStorage` 显式删除该字段，并补 configStorage 单测 |
| E2E 夹具保留旧字段导致后续套件失败 | 同步更新 `scripts/e2e/gpt-image-2` 的 fixture、capability、edits、persistence 用例 |
| i18n 孤儿 key 滞留 | 不阻塞功能；后续由 `bun run i18n:lint` + 翻译同步统一清理 |

回滚策略：所有变更都在一个 PR/提交内，必要时 `git revert <commit>` 即可恢复。

---

## 六、Review 区（实施完成后填写）

- 实际修改：前端 constants/payload/UI/configStorage 与对应单测；后端 metadata/DTO/valid_request/OpenAI adaptor 与对应单测；`scripts/e2e/gpt-image-2` fixtures/helpers/capability/edits/persistence/explore；新增 `relay/channel/openai/adaptor_image_edits_test.go`；同步更新本计划文档。
- 验证结果：`go build ./...`、`go vet ./controller/... ./dto/... ./relay/helper/... ./relay/channel/openai/...`、`go test ./controller/... ./dto/... ./relay/helper/... ./relay/channel/openai/...` 均通过；前端相关 `bun test` 32 pass；计划内 Playwright E2E 7 passed。
- 计划偏离：额外更新了 `scripts/e2e/gpt-image-2/explore.spec.ts`，原因是 5.3 残留扫描要求同目录不再保留旧 UI 断言；Docker build 因 registry digest 拉取失败，验证时改用当前代码临时 E2E 容器。
- 已知遗留：`bun run lint` 仍被 18 个未触碰文件的既有 Prettier 问题阻塞；本次触碰的前端文件已单独 Prettier 检查通过。新增官方支持参数（`mask`、`output_format`、`background`、`moderation` 等）仍留待下一阶段。
