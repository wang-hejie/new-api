# Plan: 将 /docs 全部页面改造为 evolink Mintlify 风格

## Context

用户要求把 new-api 仓库 `/docs` 路由下的全部页面，按 https://docs.evolink.ai/en/api-manual/image-series/gpt-image-2/gpt-image-2-image-generation 的视觉风格、字体、字号"完全相同"地改造。我已经用 Playwright 抓到 evolink 真实的 100 个 CSS 变量、14 类元素 computedStyle、亮/暗双主题截图，作为不可议价基准。

这里的 `/docs` 指应用内置文档路由，不等同于仓库根目录 `docs/` 下所有文件。当前后端只通过 `//go:embed docs/guides/*.md` 暴露 `docs/guides/` 下的公开指南，并由 `/api/docs/list` 与 `/api/docs/content` 提供给前端；`docs/openapi/`、`docs/installation/`、图片和翻译 glossary 等仓库资料不在本次页面风格改造范围内。

最新前置状态：`20260430_gpt-image-2 文档内容组织优化_plan.md` 已执行完成。当前公开内置文档只有 `gpt-image-2` 相关 4 页：概览页 `gpt-image-2`、operation 页 `gpt-image-2-generations` / `gpt-image-2-edits`、示例页 `gpt-image-2-examples`。operation 页已经按一页一个接口组织，并在主请求/响应 fenced code 上写入 `request` / `response` / `method` / `path` / `status` / `title` meta；示例页代码块已标记 `example`。本风格优化必须消费这个最新组织结果，不再合并、回滚或重写这些 Markdown 内容。

之所以做这件事：当前 `/docs` 是基于 Semi UI Nav 的两栏简版，与 evolink Mintlify 三栏标杆视觉差距大；用户希望文档形象向行业标杆看齐。

四项**用户已拍板的边界条件**：
1. **作用域仅 `/docs` 内置路由**：只影响 `web/src/pages/Docs` 与该路由使用的 docs 专用 markdown 渲染分支；不动 `web/tailwind.config.js` 与全局 Semi token；console / playground / 登录页不受影响。
2. **完整三栏**：左 288px 分类导航 + 中间正文 + 右 400~448px sticky 代码示例列（请求示例卡 + 响应示例卡），含面包屑与上下页；右栏不得用 TOC 冒充目标页的代码示例区域。
3. **暗色沿用 Semi token**：`.docs-shell` 暗色背景仍用 `var(--semi-color-bg-0/1)`，不引入 evolink 的 `#090C10`；但字号/字重/行高/letter-spacing 与亮色严格等同。
4. **自托管 woff2**：Inter + JetBrains Mono 放 `web/public/fonts/`，`@font-face` 注入。

预期产出：`/docs` 的 `.docs-shell` 内视觉与 evolink 高度一致；console/playground 视觉零回退；新建 docs 专用组件、hook/util 与 1 个主题 css；零后端改动。Header/Footer、站点品牌与项目元信息不属于本次视觉复刻范围，且必须遵守 AGENTS.md 中 new-api / QuantumNous 相关受保护信息不得修改的要求。

## 不可议价的设计 Token（来自 Playwright 实测）

- 主色 scope 在 `.docs-shell` 内：`--docs-primary: #1E90FF`
- 字号/行高/字重（px）：
  - h1 `30/36 700 ls -0.75`；h2 `24/32 700 ls -0.6 margin 48-0-16`；h3 `20/28 600`
  - p/li `16/28 400 mb 20`
  - th `14/20 600 padding 8-16`；td `14/20 400 padding 8-16`
  - 行内 code `12/18 500 radius 6 padding 2-8 bg rgba(238,242,245,0.5)`
  - pre code `12/21.6 400`
  - 按钮 `radius 12 padding 6-10`
- 字体栈：
  - sans：`'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`
  - mono：`'JetBrains Mono', 'SF Mono', SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace`
- 右栏代码示例列：
  - 桌面宽度目标 `400~448px`，sticky top 与 header 高度对齐；右栏示例卡外层圆角按目标页复刻为 `16px`，内层代码面板约 `14px`；正文内普通 `pre` 圆角仍按 `12px`
  - 数据源必须优先区分请求示例与响应示例，不能只展示首个代码块

## 文件改动清单

### 新建（字体资产 + Docs 组件/hooks/util/css）

| 路径 | 用途 |
|---|---|
| `web/public/fonts/Inter-{Regular,Medium,SemiBold,Bold}.woff2` | Inter 4 字重 |
| `web/public/fonts/JetBrainsMono-{Regular,Medium}.woff2` | Mono 2 字重 |
| `web/public/fonts/README.md` 或字体 license 文件 | 记录 Inter / JetBrains Mono 的来源、版本与 OFL/license；字体二进制资产不能只依赖源码 AGPL header |
| `web/src/pages/Docs/docs-theme.css` | evolink 视觉覆盖；**全部视觉规则用 `.docs-shell` / `.docs-shell .docs-markdown` 前缀**；含 `@font-face`；只由 Docs 路由入口 import |
| `web/src/pages/Docs/components/DocsSidebar.jsx` | 左 288px 原生 div 导航（替代 Semi Nav，因为 Semi Nav 改不出 4px 主色 indicator） |
| `web/src/pages/Docs/components/DocsAside.jsx` | 右 400~448px sticky 容器，套请求/响应代码示例卡；无示例时不渲染或保留空白，不降级成桌面 TOC |
| `web/src/pages/Docs/components/DocsCodeExamples.jsx` | 选择并编排请求示例卡 + 响应示例卡，支持 language/status/tab/copy |
| `web/src/pages/Docs/components/DocsCodeExampleCard.jsx` | 单个代码示例卡（外层圆角 16 + 顶部浅灰 header + 复制按钮 + language/status 标签；正文内 `pre` 不套用右栏圆角） |
| `web/src/pages/Docs/components/DocsBreadcrumb.jsx` | 顶部"分类 / 标题"，14px tertiary，不可点 |
| `web/src/pages/Docs/components/DocsPagination.jsx` | 文末上一页/下一页两卡片 |
| `web/src/pages/Docs/components/DocsMobileTopBar.jsx` | 移动端折叠菜单触发条，sticky top-16 |
| `web/src/pages/Docs/hooks/useDocsHeadings.js` | 管理 docs headings、唯一 heading id 与可选 fallback TOC 激活态；桌面默认右栏不使用 TOC |
| `web/src/pages/Docs/hooks/useDocsNeighbors.js` | 按 `/api/docs/list` 返回顺序取上下页（后端已按 `category, order, title, slug` 稳定排序） |
| `web/src/pages/Docs/utils/selectDocsCodeExamples.js` | 从 MarkdownRenderer 上抛的 mdast code nodes 中选择请求示例与响应示例；支持 code meta 与标题上下文优先级；禁止用正则解析原始 markdown |
| 配套测试：`*.test.jsx` / `*.test.js` 同目录 | 关键组件与 hook 单测，遵循 CLAUDE.md "新文件配套测试"约定 |

### 修改（核心 4 个文件，另有按需 i18n）

| 路径 | 改动 |
|---|---|
| `web/src/pages/Docs/DocsLayout.jsx` | 整体重写为三栏 grid `288px minmax(0,1fr) minmax(400px,448px)`，外层 `.docs-shell`；保留 Skeleton/Empty/SideSheet/useIsMobile/useTranslation；丢弃 Semi `Nav` |
| `web/src/pages/Docs/DocViewer.jsx` | 外层不再自管 `mt-16`，由 DocsLayout 负责；保留面包屑数据但渲染交给 `DocsBreadcrumb`；新增 `onMeta({ headings, codeBlocks })` 回调上抛给 DocsLayout；处理 frontmatter title 与 markdown H1 去重 |
| `web/src/components/common/markdown/MarkdownRenderer.jsx` | **追加 optional docs 渲染分支**：`variant="docs"` 时根 wrapper 与子元素都使用 class-based renderers，避免现有 inline style 压过 docs-theme；同时支持 `headingIdPrefix` 与 `onDocsMetaExtract({ headings, codeBlocks })`。默认行为不变，chat / 模态框等既有调用方零影响 |
| `web/src/pages/Docs/index.jsx` | 路由级 import `./docs-theme.css`；禁止在 `web/src/index.css` 做全站 import |
| `web/src/i18n/locales/{zh,en,fr,ru,ja,vi}.json` | **按需修改**：如果新组件新增 `t()` 文案 key（如请求示例、响应示例、上一页、下一页、复制等），必须同步 locale JSON，确保 `bun run i18n:lint` 与英文 docs E2E 不因缺翻译回归失败 |

### 不动（关键白名单）

- `web/tailwind.config.js`（保持 Semi token 映射）
- `web/src/components/common/markdown/markdown.css`（chat 共享，零修改）
- `web/src/index.css`、`web/index.html`（不做 docs 主题全站 import 或全站字体 preload）
- `web/src/components/layout/PageLayout.jsx`（Header/Footer 不变）
- `controller/docs.go`、`router/api-router.go`（后端零改动）
- `docs/guides/*.md` 内容不动；仓库 `docs/` 其他子目录不纳入本次内置 `/docs` 路由风格改造
- `gpt-image-2` 已完成内容组织优化，本次只改渲染与样式；不得把 4 个已拆分页面重新合并为综合页，也不得为了右栏示例选择再改 Markdown 结构

## 复用既有资产

- `MarkdownRenderer`（共享）：`web/src/components/common/markdown/MarkdownRenderer.jsx:638` —— 通过新增 optional `variant="docs"` 与 heading props 复用；默认渲染分支必须保持完全兼容
- `useIsMobile`：`web/src/hooks/common/useIsMobile.js`
- `useTranslation`（react-i18next）—— 所有新组件文案走 i18n，**禁止硬写中文字面量**
- Semi UI 组件：`Skeleton` / `Empty` / `SideSheet` / `Button` 等继续保留；需要精确匹配 docs 字号/行高/letter-spacing 的正文标题不得用 `Typography.Title`
- `IllustrationConstruction(Dark)` 空状态插图保留
- `API` helper：`web/src/helpers`（文档列表与内容仍走 `/api/docs/list` 与 `/api/docs/content`）

## 关键设计决策

### 1. CSS scope 与暗色覆盖
- `docs-theme.css` 内**所有视觉规则前缀** `.docs-shell` 或 `.docs-shell .docs-markdown`；`@font-face` 可全局存在，但不得定义会影响非 docs 页面的全局选择器
- `docs-theme.css` 只在 `web/src/pages/Docs/index.jsx` 或 `DocsLayout.jsx` 中 import，确保 CSS 与 `@font-face` 随 Docs 路由加载；不在 `web/src/index.css` / `web/index.html` 做全站注入。注意 Vite 动态 CSS 进入页面后通常不会按路由卸载，因此隔离不能依赖“离开 `/docs` 自动移除 CSS”，必须依赖 `.docs-shell` 作用域
- 暗色覆盖用 `html.dark .docs-shell { ... }`（已验证项目走 `html.dark` + `body[theme-mode='dark']` 双标记，见 `web/src/context/Theme/index.jsx:82-83`）
- hljs 在 `.docs-shell .docs-markdown` 内重写关键 token 颜色（`hljs-keyword/string/number/tag/name`），用 evolink 的 GitHub Light/Dark 风格色号；不引入新 highlight.js 主题包
- 视觉一致性验收限定在 `.docs-shell` 内：Header/Footer、站点品牌、项目名称、作者/组织署名、HTML metadata 等受 AGENTS.md 保护的信息不参与复刻，也不得被替换或删除

### 2. MarkdownRenderer docs 渲染分支
- 当前 `MarkdownRenderer` 给 headings、段落、列表、表格、代码块写了大量 inline style；普通 CSS 无法稳定覆盖这些 inline style，因此**不能只靠 `docs-theme.css` 做 docs 正文字号和间距**
- 新增 `variant="docs"`，只在 `/docs` 使用；该分支输出 `docs-markdown` 内的 class-based 元素样式，h1/h2/h3/p/li/table/th/td/code/pre 的字号、行高、间距、padding 交给 `docs-theme.css`
- `variant="docs"` 不能只替换子元素 renderer；`MarkdownRenderer` 根节点也必须走 docs 专用 class-based wrapper，移除默认根节点上的 `fontSize: 14px`、`fontFamily: inherit`、`lineHeight: 1.6` 等 inline style，否则未覆盖元素会继承错误字号/行高
- 默认分支不传 `variant` 时必须保持现状，确保 chat、用户消息、模态框 markdown、Mermaid、KaTeX、HTML preview 等既有场景不回退
- docs 分支必须同时收集 headings 与 code nodes，但不得在 React render 阶段直接触发父组件 `setState`；用 ref 暂存本轮收集结果，并在 `useEffect` 中调用 `onDocsMetaExtract`，避免 render 期间更新父组件

### 3. 标题渲染与 Headings 提取
- 当前 `DocViewer` 会渲染 frontmatter `doc.title`，而当前公开 docs 页面本身也都有 Markdown H1，例如 `docs/guides/gpt-image-2.md` 里的 `# gpt-image-2 概览`、`gpt-image-2-generations.md` 里的 `# 文本生成图像`、`gpt-image-2-edits.md` 里的 `# 参考图编辑`；改造后必须避免双 H1
- 标题策略：优先保留 markdown 内容里的第一个 H1；如果内容没有 H1，再用 `doc.title` 渲染一个 H1。面包屑仍使用 `doc.category / doc.title`
- fallback H1 必须使用原生 `<h1>` + docs class，不得使用 Semi `Typography.Title`；Semi Title 的内置样式和 DOM 结构会干扰目标页 `30/36 700 ls -0.75` 的 computed style
- 在 remark/mdast 阶段提取 headings（不读已渲染 DOM），避免 Mermaid/KaTeX 异步渲染产生闪烁
- 实现：在 `MarkdownRenderer` docs 分支追加自定义 mdast visitor，把 `(depth, text, id)` 收集进 ref，随后通过 `onDocsMetaExtract({ headings, codeBlocks })` 上抛
- `id` 用 GitHub 风格 slugify，但必须保留中文/Unicode 标题可读性，并对重复标题做稳定去重：第一次用 `foo`，后续依次为 `foo-1`、`foo-2`
- 若未来启用 fallback TOC，`useDocsHeadings` 再用 `IntersectionObserver`，`rootMargin: '-88px 0px -70% 0px'` 跟踪激活项；桌面目标右栏默认不是 TOC

### 4. 请求/响应代码示例提取
- 不用正则从原始 markdown 抓代码块；代码块提取必须与 headings 共用 `MarkdownRenderer` docs 分支的 mdast 遍历，避免 fenced code、`~~~`、代码内容中反引号等情况解析漂移
- mdast visitor 收集 code nodes：`{ lang, meta, value, index, headingPath }`，再交给 `selectDocsCodeExamples.js` 选择右栏示例；`headingPath` 至少包含最近的上级 h2/h3 文本，用于 meta 缺失或旧文档兼容时区分“普通示例”和“主接口请求/响应示例”
- 选择优先级：
  - 最高优先级：code fence meta 显式标记，例如 `request` / `response` / `method=POST` / `path="/v1/..."` / `status=200` / `title=...`。当前 `gpt-image-2-generations` 与 `gpt-image-2-edits` operation 页已经具备这些 meta，右栏选择器必须优先消费它们
  - 排除规则：code fence meta 含 `example` 的代码块不得进入右侧主请求/响应示例卡。当前 `gpt-image-2-examples` 页的 SDK / curl 样板就是 cookbook 示例，不是 operation 右栏主示例来源
  - 页面类型规则：只有存在显式 `request` meta，或标题上下文明确命中 operation 接口章节/接口路径的页面，才渲染右侧请求/响应示例列。单独存在 `response` meta 不足以触发右栏，因为概览页可能保留错误响应 JSON；概览页中的错误响应 JSON 不应被单独识别为主接口响应卡；示例页一般不显示右侧 operation 示例列
  - 多请求示例规则：同一页存在多个 `request` meta 时，按文档顺序进入请求卡 tabs，或按 `title` / `method` / `path` meta 选择默认 tab；不能随机取第一个。响应示例同理
  - 次优先级：标题上下文命中主接口章节，例如最近上级标题包含 `POST /v1/images/generations`、`/v1/images/edits`、`请求`、`响应`。这条规则只作为旧文档或缺失 meta 时的兼容 fallback，不应覆盖显式 meta
  - 请求示例：在 meta / 标题上下文过滤后选择明显 request-like 的代码块（如 `http`、`bash`/`curl`、包含 `POST /`、`curl `、`Authorization:`、`/v1/`）
  - 响应示例：在 meta / 标题上下文过滤后选择明显 response-like 的 JSON 代码块（如 `json`，且包含 `data` / `error` / `created` / `usage` 等响应字段）
  - 不足两类时只渲染已有类别；完全没有可用示例时右栏不渲染或为空，不显示桌面 TOC 替代
- 不实现 `spotlight_code` frontmatter 优先级，因为当前后端 `docFrontmatter` 与 `/api/docs/content` 响应不暴露该字段；若未来需要显式示例选择，必须另起后端 DTO/frontmatter 改造，不混入本次零后端范围

### 5. 上一页/下一页排序
- `useDocsNeighbors` 直接使用 `/api/docs/list` 返回顺序取当前 slug 的前后项，避免前端排序与后端排序漂移
- 后端当前稳定排序规则是 `(category 字典序, order 升序, title 字典序, slug 字典序)`；如果前端必须重排，必须完整复制四键规则
- 上下页**跨 category**（与 evolink 一致）；卡片副标题显示对方所属 category，便于跨类切换

### 6. 移动端断点
- `≥1280px`：完整三栏，右侧为请求/响应代码示例列
- `1024~1280`：隐藏右 Aside，二栏
- `<1024px`：单栏，左 Sidebar 走 `SideSheet`，顶部 `DocsMobileTopBar`，右 Aside 不渲染

### 7. 字体加载策略
- `@font-face` 写在 `docs-theme.css` 顶部，`font-display: swap`
- `unicode-range: U+0000-024F, U+1E00-1EFF, U+2000-206F`（仅 latin/latin-ext，CJK 走系统字体 fallback）
- 不在 `web/index.html` preload 字体，避免所有非 docs 页面承担 docs 字体网络成本；依赖 Docs 路由级 CSS + `font-display: swap`，验收重点看最终 computed style，而不是首帧无闪烁
- 字体资产必须同时提交来源/版本/license 说明：Inter 与 JetBrains Mono 均需记录下载地址、版本或 commit/tag、license 文件；不要把第三方字体二进制当成普通源码文件处理

## 风险与缓解（必读）

1. **Semi 暗色 token + evolink 节奏的混搭**：暗色下 `.docs-shell` 内额外把 `--semi-color-text-0/1/2` 对比度提升至 `#E6EDF3 / #B1BAC4 / #8B949E`（仅 `.docs-shell` scope），使暗色阅读体验接近 evolink。
2. **MarkdownRenderer inline style 优先级**：必须通过 `variant="docs"` 走 class-based renderers 解决；不要用大量 `!important` 硬压 inline style，否则维护成本和 chat 回归风险都会升高。
3. **共享 markdown.css 的 hover 干扰**：`pre:hover { border-color: var(--semi-color-primary) }` 不修改；在 `.docs-shell .docs-markdown pre:hover` 用更高特异性选择器覆盖为 `var(--docs-primary)`，不用 `!important`。
4. **MarkdownRenderer 改造对 chat 的副作用**：新 props 必须是 optional（无传入时行为完全等于现状）；新增配套单测覆盖"默认 variant 下 chat 流程不变"。
5. **全站 CSS / 字体污染**：docs 主题 CSS 只能由 Docs 路由入口 import；`web/src/index.css` 与 `web/index.html` 不注入 docs theme 或字体 preload；但不能假设 Vite 会在离开 `/docs` 时卸载已加载 CSS，因此所有视觉规则必须依赖 `.docs-shell` scope；E2E 用 root token 快照、访问 `/docs` 后跳转 console 的 computed style 与截图验证未污染。
6. **首屏 LCP**：自托管 6 个 woff2 ≈ 200KB；不做全站 preload；fallback 字体栈中 `-apple-system / system-ui` 在字体到位前承担渲染，`font-display: swap` 降低阻塞。
7. **右栏误做成 TOC 的视觉偏差**：目标页右栏是请求/响应示例卡，计划与实现必须以代码示例列为核心；TOC 只能作为未来可选 fallback，不得成为桌面右栏默认内容。
8. **重复 H1**：frontmatter title 与 markdown H1 同时存在时，只渲染一个页面主标题；否则桌面首屏高度和字号节奏会明显偏离 evolink。
9. **hljs 主题差距（Twoslash）**：evolink 用 Shiki + Twoslash，本项目锁定 highlight.js。**不换包**，仅手写覆盖关键 hljs 类的颜色；放弃 Twoslash 类型悬浮提示——这是已知差距，验收时告知用户。
10. **License header 与第三方字体 license**：所有新建 .jsx/.js/.css 文件**必须**带 GNU AGPL header（与项目其余源文件一致），引用既有 `DocsLayout.jsx` 第 1-18 行模板；字体资产另行保留 Inter / JetBrains Mono 对应 license 说明。

## 实现顺序

1. Done - 落字体资产、字体来源/license 说明 + `docs-theme.css` 骨架，并在 Docs 路由入口局部 import（无组件先验证字体生效）
   - 已新增 Inter / JetBrains Mono Latin woff2 子集到 `web/public/fonts/`，并在 `web/public/fonts/README.md` 记录 Fontsource 5.2.8 来源与 OFL 许可。
   - 已新增 scoped `docs-theme.css` 并仅从 `web/src/pages/Docs/index.jsx` import，所有视觉规则限定在 `.docs-shell` / `.docs-markdown` 范围。
2. Done - 改造 `MarkdownRenderer` 添 `variant="docs"`、`onDocsMetaExtract({ headings, codeBlocks })` + 单测（确认默认 variant / chat 零回退，并确认不会在 render 阶段触发父组件状态更新）
   - 已新增 docs 专用 class-based 渲染分支、GitHub 风格 Unicode heading slug 去重、fenced code meta/headingPath 提取，默认 markdown 分支保持原 inline style 行为。
   - 已补 `MarkdownRenderer.test.jsx` 覆盖默认分支兼容、docs heading/code 元数据、以及通过 effect 上抛并避免父组件状态更新循环。
3. Done - 写 hooks + `selectDocsCodeExamples` utils + 单测
   - 已新增 `useDocsHeadings`、`useDocsNeighbors`、`selectDocsCodeExamples`，选择器遵守 request meta 优先、example 排除、概览页单独 response 不触发右栏的规则。
   - 已补 hooks/util 单测，并把 docs heading slug 纯函数拆到轻量 `docsMeta.js`，避免 hooks 依赖完整 MarkdownRenderer UI 栈。
4. Done - 写 Sidebar / Aside / CodeExamples / CodeExampleCard / Breadcrumb / Pagination / MobileTopBar 等新组件 + 单测
   - 已新增 Sidebar、Aside、请求/响应代码示例卡、面包屑、上下页和移动顶部栏组件，右栏无示例时不显示 TOC 替代。
   - 已补组件单测并同步新增 i18n key 到所有前端 locale JSON，覆盖活跃导航、分页 slug、代码 tab/copy 和 Aside 行为。
5. Done - 重写 `DocsLayout` + `DocViewer` 收口，完成单 H1 策略与右栏请求/响应示例列
   - 已将 Docs 页面收口为 `.docs-shell` 三栏布局，左侧原生导航、中间 docs markdown、右侧请求/响应示例列，并接入上下页与移动 SideSheet。
   - 已完成 Markdown H1 优先、缺失 H1 时原生 fallback h1 的策略，更新 Docs 单测与既有 docs E2E 结构断言。
6. Done - Playwright E2E 验收（见下）
   - 已在用户重建后的 `127.0.0.1:9991` 先跑出 Web 全局限流导致的 429，并按本计划要求改用关闭 `GLOBAL_WEB_RATE_LIMIT_ENABLE` 的临时 `new-api-e2e` 容器完成验收。
   - 已修正移动 SideSheet E2E 的二义性按钮定位，`scripts/e2e/docs` 与 `scripts/e2e/docs-evolink-style` 合计 33 条 Playwright 用例全部通过。

## 验证

### 静态校验
- `cd web && bun run build` 通过；TypeScript/ESLint 无新增错误
- `cd web && bun run i18n:lint` 不报新硬编码字面量

### 单元测试
- 在 `web/` 目录下跑 `bun test`（或现有等价命令），覆盖：
  - `useDocsHeadings` / slugify：重复标题生成唯一 id（`foo`、`foo-1`、`foo-2`），并保留中文/Unicode 标题可读性
  - `useDocsNeighbors`：按 `/api/docs/list` 返回顺序取跨 category 上下页
  - `selectDocsCodeExamples`：能区分 request-like `curl/http` 代码块与 response-like JSON；显式 code meta 优先于启发式；`example` meta 必须被排除；operation 页使用 `request` / `response` meta 选中右栏主示例；概览页只有错误响应 JSON 时返回空；无示例时返回空，不退化成首段任意代码
  - `MarkdownRenderer`：默认 variant 行为不变；`variant="docs"` 输出 docs class、heading id、mdast code nodes；`onDocsMetaExtract` 通过 effect 上抛
  - `DocViewer`：frontmatter title 与 markdown H1 同名/不同名/缺失 H1 三种场景均只渲染一个页面 H1；缺失 H1 时 fallback 标题是原生 `<h1>` docs class，不使用 Semi `Typography.Title`

### Playwright E2E（按 `.claude/rules/使用playwright mcp进行集成测试.md`）

```bash
docker compose up -d --build
curl -fsS http://127.0.0.1:9991/api/status
cd web
NEW_API_BASE_URL=http://127.0.0.1:9991 bunx playwright test ../scripts/e2e/docs ../scripts/e2e/docs-evolink-style --reporter=list
```

本地 E2E 服务必须关闭 Web 全局限流：使用 compose override 或单独测试容器，明确把 `GLOBAL_WEB_RATE_LIMIT_ENABLE=false` 注入 `new-api` 容器环境，必要时提高 `GLOBAL_API_RATE_LIMIT` / `CRITICAL_RATE_LIMIT`。不要只在 `docker compose up` 命令前临时声明环境变量；除非 compose 文件显式引用该变量，否则它不会进入容器。这是 E2E 稳定性要求，不是业务逻辑变更；此前完整 docs E2E 已证明默认 Web 限流可能导致 `/` 与 `/docs/*` 返回 429。

必须同时维护并运行既有 `scripts/e2e/docs` 与新增 `scripts/e2e/docs-evolink-style`：既有 docs E2E 负责 API、路由、设置项、移动端入口和文档切换回归；新增 docs-evolink-style 只负责 evolink 视觉 token、三栏布局、右栏代码示例与全站样式隔离。实现三栏 `.docs-shell` 后，既有 `scripts/e2e/docs/docs-page.spec.ts` 中依赖旧 Semi Nav / `.mt-16.bg-semi-color-bg-0` / 两栏结构的断言必须同步更新，不能只新增视觉测试而让旧 docs 回归失效。

新增测试脚本位于 `scripts/e2e/docs-evolink-style/docs-evolink-style.spec.ts`，断言 12 条：

1. 访问 `/docs/<某 slug>`，`getComputedStyle(.docs-shell .docs-markdown p).fontFamily` 包含 `Inter`
2. `getComputedStyle(.docs-shell).getPropertyValue('--docs-primary').trim().toLowerCase() === '#1e90ff'`（归一化大小写后比较）
3. 进入 `/docs` 前后对 `:root` Semi token 做快照，断言 `--semi-color-primary` 未变化，且 `:root` 不存在 `--docs-primary`（全局未污染）
4. 跳 `/console/token`，主按钮背景色与改造前 baseline 截图一致（pixel diff < 1%）
5. 桌面 viewport 下右 aside 存在请求/响应代码示例卡，外层 `border-radius` 为 `16px`，且不存在默认 `.docs-toc`
6. 上一页/下一页卡片 `data-slug` 与 `/api/docs/list` 返回顺序中的前后项一致
7. 字号断言：h1 30、h2 24、p 16、行内 code 12；th/td padding 8 16
8. 切换 `html.dark`，`getComputedStyle(.docs-shell).backgroundColor` 仍是 `var(--semi-color-bg-0)` 计算值（非 `#090C10`），但 h2 letterSpacing 仍 `-0.6px`
9. viewport 375，断言右 aside `display:none`、左 sidebar `display:none`、`DocsMobileTopBar` 可见
10. 右栏请求/响应示例卡优先来自显式 `request` / `response` meta；`gpt-image-2-generations` 默认请求示例应来自 `/v1/images/generations`，`gpt-image-2-edits` 默认请求示例应来自 `/v1/images/edits`；`example` meta 的 SDK/curl cookbook 代码不得进入右栏主示例；概览页不应因只有错误响应 JSON 而渲染主接口响应卡
11. 页面主标题只有一个可见 H1，避免 frontmatter title 与 markdown H1 重复
12. `.docs-shell` 内样式接近 evolink；Header/Footer、站点品牌、new-api / QuantumNous 元信息保持原项目内容不变

### 视觉对比
对照 `scripts/design-probe/out/light-fullpage.png` 与 new-api `/docs/<slug>` 改造后浏览器截图，肉眼验收。`scripts/design-probe/out/*.png` 是 Playwright 探针产物，不能假设 checkout 后一定存在；如果本地没有截图，先运行 `scripts/design-probe/probe-evolink.mjs` 重新生成，再做对比：
- 三栏比例
- 字号节奏（h1 30、h2 24、body 16）
- 右侧请求/响应代码示例卡：宽度、外层圆角 16、内层代码面板圆角约 14、顶部 header、复制按钮位置、sticky 行为
- 右栏 sticky 行为
- 主色蓝 `#1E90FF` 仅出现在 `.docs-shell` 内

## 已知差距（验收时主动告知）

1. 没有 Twoslash 类型悬浮提示（hljs 不支持，不引入 Shiki）
2. 暗色背景是 Semi 灰阶 `#1C1F23`，非 evolink 纯黑 `#090C10`（用户拍板沿用 Semi token）
3. CJK 字体不受 Inter 影响，由系统 fallback 渲染（避免拉满 200KB 中文字重）
4. Header/Footer 与项目品牌信息保持 new-api 原样；本次只复刻 `/docs` 内容区 `.docs-shell`，不替换受保护的项目/组织标识

E2E 增补完成：详见 `plan.md`，已新增 5 个 docs-evolink-style spec 并完成 `scripts/e2e/docs` + `scripts/e2e/docs-evolink-style` 全量回归。
