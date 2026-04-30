# gpt-image-2 文档内容组织优化计划

## 目标

将 `docs/guides/gpt-image-2.md` 从“综合手册页”调整为更接近 Evolink/Mintlify OpenAPI operation 的文档组织方式，同时保持本项目内置 `/docs` 的加载链路不变：`docs/guides/*.md` 经 `go:embed` 嵌入，后端解析 frontmatter 后由 `/api/docs/list` 与 `/api/docs/content` 暴露给前端。

本次原计划主要改 Markdown 文档与相关测试，不改数据库；当前内置文档没有数据库表或迁移逻辑。完整 E2E 后额外发现并修复了 playground 模型端点派生缓存失效的业务缺陷，该修复不涉及数据库迁移。

## 执行计划

- [x] 1. 复核文档加载与测试约束
  - 确认 `controller/docs.go` 只读取 `docs/guides/*.md`，frontmatter 字段仅有 `slug/title/order/category`，公开排序为 `category, order, title, slug`。
  - 确认拆分新文档只需新增 Markdown 文件，不需要后端 DTO 或路由改动。
  - 确认现有 Go 单测、前端单测和 Playwright E2E 中对 `gpt-image-2` 标题、内容和文档数量的断言。

- [x] 2. 将综合页改为概览页
  - 保留 `docs/guides/gpt-image-2.md` 的 slug 不变，避免 `/docs` 默认入口和历史链接失效。
  - 将标题改为 `gpt-image-2 概览`，正文使用摘要 bullet，避免首屏 blockquote 风格偏离目标页。
  - 只保留鉴权、Base URL、接口索引、通用限制、计费与 FAQ 等跨接口内容。
  - 删除或迁移大量 SDK 代码样板，避免概览页出现过多可被右栏误选的代码块。

- [x] 3. 新增 generations operation 页
  - 新建 `docs/guides/gpt-image-2-generations.md`，slug 为 `gpt-image-2-generations`。
  - 页面围绕 `POST /v1/images/generations` 展开，采用 `Authorizations`、`POST ...`、`Body application/json`、`Response 200 application/json`、`Error Responses`、`Usage Notes` 的结构。
  - 主请求和主响应 fenced code 加显式 meta，例如 `request title=... method=POST path=...` 与 `response status=200 title=...`，服务后续右栏示例提取逻辑。

- [x] 4. 新增 edits operation 页
  - 新建 `docs/guides/gpt-image-2-edits.md`，slug 为 `gpt-image-2-edits`。
  - 页面围绕 `POST /v1/images/edits` 展开，采用与 generations 页一致的 operation-first 结构。
  - multipart 请求与 200 响应 fenced code 同样添加显式 meta，确保右栏逻辑可稳定识别。

- [x] 5. 新增集成示例页
  - 新建 `docs/guides/gpt-image-2-examples.md`，slug 为 `gpt-image-2-examples`。
  - 将原综合页中的 Python、Node.js、curl 样板迁移到该页。
  - 代码块 meta 标为 `example` 或使用普通语言标记，避免后续右栏主请求/响应选择器把 SDK 样板当成 operation 示例。

- [x] 6. 同步文档目录说明
  - 更新 `docs/guides/README.md`，补充 operation 页建议：一页一个主接口、主请求/响应代码块使用 fence meta、概览页避免放大量 SDK 样板。

- [x] 7. 同步自动化测试
  - 更新 Playwright docs API 测试：列表应包含新增页面；`gpt-image-2` 内容断言从 `## 1. 快速开始` 改为新的概览内容；新增 operation 页内容与 meta 断言。
  - 更新 docs 页面 E2E：默认 `/docs` 仍跳到 `gpt-image-2`，但标题改为 `gpt-image-2 概览`；导航中应出现新增 operation 与示例页面。
  - 评估前端单测 mock 数据是否需要跟随标题调整，避免测试期待过期文案。

- [x] 8. 运行测试并按原因处理失败
  - 先跑 Go 文档相关测试：`go test ./controller ./router -run 'Docs|Doc'`。
  - 再跑前端单测：`cd web && bun test src/pages/Docs src/helpers/docs.test.js src/hooks/common/useNavigation.test.js`。
  - 再跑构建：`cd web && bun run build`。
  - 如本地服务可用，跑 Playwright 文档相关 E2E：`cd web && NEW_API_BASE_URL=http://127.0.0.1:9993 E2E_ROOT_USER=e2eroot E2E_ROOT_PASS=E2E_root_123456 bunx playwright test ../scripts/e2e/docs --reporter=list`。
  - 已处理文档链路失败归因：文档 E2E 失败来自测试等待/定位脆弱或本地 Web 全局限流导致页面入口 429，不是业务逻辑缺陷；因此只修文档测试代码与测试运行环境。

- [x] 10. 处理完整 E2E 暴露的 playground 模型端点缓存问题
  - 运行完整 Playwright E2E 后，`scripts/e2e/gpt-image-2/*` 失败集中在 `dall-e-3.endpoint_types` 为 `[]`，期望包含 `image-generation`。
  - 归因结论：这不是文档测试假设问题，而是业务缓存失效问题。`GetUserPlaygroundModels` 的 `endpoint_types` 依赖 pricing/endpoint 派生缓存；新增、删除、编辑渠道或能力后，`abilities` 已变化，但 pricing/endpoint 缓存可能仍保留旧数据。
  - 修复方向：所有会改变渠道能力集合的模型层写路径必须失效 pricing/endpoint 派生缓存；新增渠道成功后同步刷新内存渠道缓存；端点类型读取函数需要先确保派生缓存已刷新。
  - 补充 Go 回归测试覆盖：缓存预热后新增包含 `dall-e-3` 的启用渠道，随后读取 `GetModelSupportEndpointTypes("dall-e-3")` 必须立即包含 `image-generation`。

- [x] 11. 完整回归验证
  - 运行 `go test ./... -count=1`，确认后端与模型层回归通过。
  - 运行 `cd web && bun run test`，确认前端全量单测通过。
  - 运行 `cd web && bun run build`，确认前端构建通过。
  - 运行 gpt-image-2 Playwright E2E，确认 playground 图片链路恢复。
  - 运行完整 Playwright E2E，确认 docs 与 gpt-image-2 两类链路都通过。

- [x] 9. 记录结果
  - 在本文件追加 Review，说明修改文件、测试命令和结果。

## Review

- 已完成内容组织调整：`gpt-image-2` 保持原 slug 并改为概览页；新增 generations、edits、examples 三个子页面，operation 页采用 `Authorizations`、接口标题、请求体、响应体、错误响应、使用说明的顺序，并在主请求/响应 fenced code 上保留显式 meta。
- 已同步 `docs/guides/README.md` 与 docs 相关 Go、前端单测、Playwright E2E 断言。
- 测试失败处理记录：`docs-link-routing` 的 header 定位改为等待实际文档导航链接；`docs-page` 的重定向、英文 i18n、skeleton 断言改为等待用户可见结果和可控延迟响应。另一次 E2E 失败是本地服务 `GLOBAL_WEB_RATE_LIMIT` 默认 60/180s 导致 `/` 与 `/docs/*` 返回 429；使用临时 `new-api-e2e` 容器在 `127.0.0.1:9993` 关闭 Web 全局限流后重跑通过。
- 已执行测试：
  - `go test ./controller ./router -run 'Docs|Doc'`：通过。
  - `cd web && bun test src/pages/Docs src/helpers/docs.test.js src/hooks/common/useNavigation.test.js`：16 个测试通过。
  - `cd web && bun run build`：通过；仅有既有 Browserslist 过期、`lottie-web` eval、大 chunk 警告。
  - `cd web && NEW_API_BASE_URL=http://127.0.0.1:9993 E2E_ROOT_USER=e2eroot E2E_ROOT_PASS=E2E_root_123456 bunx playwright test ../scripts/e2e/docs --reporter=list`：27 个测试通过。
- 完整 E2E 继续暴露出 playground 模型端点缓存缺陷：新增包含 `dall-e-3` 的渠道后，`abilities` 已写入但 pricing/endpoint 派生缓存仍可能返回旧数据，导致 `endpoint_types` 为空。已在渠道/能力变更路径补充 `InvalidatePricingCache()`，让 `GetModelSupportEndpointTypes` 和 `GetSupportedEndpointMap` 读取前确保 pricing 缓存已刷新，并在新增渠道成功后立即刷新内存渠道缓存。
- 已补充回归测试 `TestChannelAbilityChangesInvalidateEndpointTypeCache`：先预热 pricing 缓存，再新增 `dall-e-3` 启用渠道，随后断言端点类型立即包含 `image-generation`。
- 完整验证结果：
  - `go test ./model -run 'TestChannelAbilityChangesInvalidateEndpointTypeCache' -count=1`：通过。
  - `go test ./... -count=1`：通过。
  - `cd web && bun run test`：58 个测试通过。
  - `cd web && bun run build`：通过；仅有既有 Browserslist 过期、`lottie-web` eval、大 chunk 警告。
  - `cd web && NEW_API_BASE_URL=http://127.0.0.1:9993 E2E_ROOT_USER=e2eroot E2E_ROOT_PASS=E2E_root_123456 E2E_MOCK_UPSTREAM=http://127.0.0.1:11434 E2E_CHANNEL_BASE_URL=http://host.docker.internal:11434 bunx playwright test ../scripts/e2e/gpt-image-2 --reporter=list`：18 个测试通过。
  - `docker build -t new-api:local .`：通过；随后用当前代码镜像重建 `new-api-e2e` 临时容器。
  - `cd web && NEW_API_BASE_URL=http://127.0.0.1:9993 E2E_ROOT_USER=e2eroot E2E_ROOT_PASS=E2E_root_123456 E2E_MOCK_UPSTREAM=http://127.0.0.1:11434 E2E_CHANNEL_BASE_URL=http://host.docker.internal:11434 bunx playwright test ../scripts/e2e --reporter=list`：45 个测试通过，最终结果来自重建后的当前代码镜像。
