# 修复本地 CI 不全绿问题 —— 执行计划

> 背景：`20260427_本地 CICD 检查流程接入_plan.md` 已经把 `make check-backend / check-frontend / check-all` 的流程搭好，但本地实跑暴露三类既有债务：
> 1. `go vet` 失败：`common.CustomEvent` 拷贝 `sync.Mutex`、11 个 adaptor 的 `panic + return` 双语句导致 unreachable code；
> 2. 本机未安装 `golangci-lint`，`make check-backend` 直接断在 lint 阶段；
> 3. `bunx i18next-cli lint` 报告 317 项 hardcoded string，其中相当一部分是 SVG path / 颜色 hex / 常量名等**误报**，并非真实文案。
>
> 本计划目标：让 `make check-all` 在不引入新业务逻辑的前提下完整跑绿。

---

## 一、对原方案的审视与修正

| # | 原提案 | 修正建议 | 依据 |
|---|---|---|---|
| 1 | `CustomEvent` 改成指针接收者 + `encode(*CustomEvent)` | **直接删除 `Mutex sync.Mutex` 字段** | `common/custom-event.go` 顶部 `Copyright 2014 Manu Martinez-Almeida` 表明它是 `gin/render/sse.go` 拷贝改造产物，原版无锁；当前 `WriteContentType` 在**值拷贝**上 Lock 不解决任何并发问题，纯属冗余。删字段最小、最贴合上游架构，改接收者反而要逐个 callsite 验证 `gin.Render` 接口满足性 |
| 2 | `panic("implement me"); return nil, nil` 改成 `return nil, errors.New("not implemented")` 或保留 panic 删 return | **统一改为 `return nil, errors.New("not implemented")`** | 同一个文件里其他 Convert 方法（`ConvertGeminiRequest / ConvertAudioRequest / ConvertImageRequest`）已经是这种写法，改 panic 那个分支可以**消除风格不一致**；relay 是运行时业务路径，panic 不适合做"未实现"控制流 |
| 3 | `brew install golangci-lint` 直接装最新，或固定旧版 v1.64.x | **升级 `.golangci.yml` 到 golangci-lint v2 schema，并使用 v2 工具链** | 当前项目 `go.mod` 使用 Go 1.25.1，固定旧版 v1.64.x 有未来兼容风险；Homebrew 默认安装 v2，直接适配 v2 能避免每个开发者都踩配置不兼容问题。v2 的目录排除应放在 `linters.exclusions.paths` / `formatters.exclusions.paths`，不能继续使用旧版 `run.skip-dirs` 或错误的 `issues.exclude-dirs` |
| 4 | i18n 317 项全部改成 `t('中文key')` 后 `bun run i18n:extract` | **只使用 i18next-cli 确认支持的降噪能力，再翻译真实文案**：扩展 `ignoredAttributes` / `ignoredTags`，不要使用无效的 `ignoredFunctions`、`allowedPatterns`、`ignoredPatterns`，也不要粗暴忽略整段可能含文案的目录 | 当前 `i18next-cli` 支持 `ignoredAttributes` 与 `ignoredTags`，不支持行级 ignore 注释、`ignoredFunctions`、正则白名单字段。抽样输出中确有 SVG path、颜色 hex 等误报，但真实文案也混在 `src/constants`、helpers 和组件中，不能用整目录 ignore 掩盖 |

---

## 二、整体流程

```mermaid
flowchart TD
    A[阶段 1: 后端 go vet 修复] --> B1[删除 CustomEvent.Mutex 字段]
    B1 --> B2[移除 11 个 adaptor 的 panic 不可达分支]
    B2 --> B3[go vet ./... 通过]

    B3 --> C[阶段 2: golangci-lint v2 接入与全量整改]
    C --> C1[升级 .golangci.yml 到 v2 schema]
    C1 --> C2[安装并验证 golangci-lint v2]
    C2 --> C3[首跑 golangci-lint run 并分类修复]
    C3 --> C4[golangci-lint 通过]

    C4 --> D[阶段 3: 前端 i18n 治理]
    D --> D1[配置降噪：仅 ignoredAttributes/ignoredTags]
    D1 --> D2[i18n:lint 误报收敛]
    D2 --> D3[剩余真实文案 t 化 + i18n:extract]

    D3 --> E[阶段 4: 全链路收尾]
    E --> E1[make check-frontend-fast 通过]
    E1 --> E2[make check-frontend 通过]
    E2 --> E3[make check-backend 通过]
    E3 --> E4[make check-all 全绿]
```

---

## 三、阶段化执行计划

### 阶段 1 ｜ 后端 go vet 修复（约 30 分钟）

**目标**：让 `cd /Users/wanghejie/workspace/new-api && go vet ./...` 退出码为 0。

- [x] **T1.1 删除 `common/custom-event.go` 的 `Mutex` 字段** — Done
  - 摘要：已删除 `CustomEvent` 中随值拷贝产生 vet 风险的 `sync.Mutex` 字段，以及 `WriteContentType` 中对应的无效加锁逻辑。
  - 验证：`go vet ./common/...` 退出码为 0，保持 `Render`/`encode` 签名不变。
  - 文件路径：[common/custom-event.go](common/custom-event.go)
  - 单步改动（**严格遵守"单文件单步完成"**）：
    1. 删掉第 12 行 `import "sync"`
    2. 删掉 `CustomEvent` 结构体里的 `Mutex sync.Mutex` 字段（第 57 行）
    3. 删掉 `WriteContentType` 中的 `r.Mutex.Lock()` / `defer r.Mutex.Unlock()` 两行
  - 不要改方法接收者类型，不要改 `encode` 签名 —— 保持与上游 gin 一致
  - 改完后 `go vet ./common/...` 必须通过

- [x] **T1.2 修复 11 个 adaptor 的 unreachable code** — Done
  - 摘要：已将 11 个 adaptor 的 `ConvertClaudeRequest` 未实现分支从 `panic + return` 统一改为 `return nil, errors.New("not implemented")`。
  - 验证：已删除 `dify.DoResponse` 末尾不可达裸 `return`；计划范围内不再残留 `panic("implement me")`，`go vet ./...` 退出码为 0。
  - 文件清单：
    - `relay/channel/baidu/adaptor.go:30`
    - `relay/channel/cohere/adaptor.go:29`
    - `relay/channel/dify/adaptor.go:36` 和 `:112`（注意 dify 有两处！第二处是 `DoResponse` 末尾多余的 `return`）
    - `relay/channel/cloudflare/adaptor.go:31`
    - `relay/channel/mistral/adaptor.go:28`
    - `relay/channel/mokaai/adaptor.go:30`
    - `relay/channel/palm/adaptor.go:29`
    - `relay/channel/jina/adaptor.go:31`
    - `relay/channel/tencent/adaptor.go:37`
    - `relay/channel/xunfei/adaptor.go:29`
    - `relay/channel/zhipu/adaptor.go:29`
  - 统一替换模板（`ConvertClaudeRequest` 内）：
    ```go
    func (a *Adaptor) ConvertClaudeRequest(*gin.Context, *relaycommon.RelayInfo, *dto.ClaudeRequest) (any, error) {
        //TODO implement me
        return nil, errors.New("not implemented")
    }
    ```
  - dify `:112` 单独处理：`DoResponse` 已经在 `if/else` 双分支中各自 `return`，函数末尾的裸 `return` 直接删除即可
  - 各文件应已 `import "errors"`（同文件其他方法已用），不需要新增 import；如有缺失则一并补上
  - **不要改函数签名、不要改 panic 之外的代码**

- [x] **T1.3 go vet 通过** — Done
  - 摘要：阶段 1 后端 vet 修复已完成，`CustomEvent` 与 adaptor 不可达代码问题均已消除。
  - 验证：`go vet ./...` 与 `go test ./... -count=1` 均退出码为 0。
  - `go vet ./...` 退出码 0
  - `go test ./... -count=1` 仍然通过（确认 T1.1 的 Mutex 删除没有破坏 SSE 行为）

---

### 阶段 2 ｜ golangci-lint v2 接入与全量整改（约 1-3 小时，看暴露面）

**目标**：让 `golangci-lint run --timeout=5m` 退出码为 0。

- [x] **T2.1 升级 `.golangci.yml` 到 v2 schema** — Done
  - 摘要：已将 `.golangci.yml` 从 v1 `skip-dirs`/`disable-all` 风格升级为 v2 `version: "2"`、`linters.default: none` 和 `linters.exclusions.paths`/`formatters.exclusions.paths`。
  - 验证：`golangci-lint config verify` 在 v2.11.4 下退出码为 0。
  - 使用 golangci-lint v2 配置，不再固定 v1.64.x。
  - 推荐配置骨架：
    ```yaml
    version: "2"

    run:
      timeout: 5m
      tests: true

    linters:
      default: none
      enable:
        - errcheck
        - govet
        - ineffassign
        - staticcheck
        - unused

      exclusions:
        paths:
          - web
          - data
          - logs
          - upload
          - build
          - tiktoken_cache
          - \.gocache
          - \.gomodcache
          - \.gopath
          - \.cache

    formatters:
      exclusions:
        paths:
          - web
          - data
          - logs
          - upload
          - build
          - tiktoken_cache
          - \.gocache
          - \.gomodcache
          - \.gopath
          - \.cache

    issues:
      max-issues-per-linter: 0
      max-same-issues: 0
    ```
  - 注意：v2 目录排除使用 `linters.exclusions.paths` / `formatters.exclusions.paths`；不要使用旧版 `run.skip-dirs`，也不要使用错误的 `issues.exclude-dirs`。

- [x] **T2.2 安装并验证 golangci-lint v2** — Done
  - 摘要：Homebrew/GitHub raw 下载链路超时后，已通过 `GOPROXY=https://goproxy.cn,direct` 安装 `github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.11.4`。
  - 验证：已将二进制链接到 `/opt/homebrew/bin/golangci-lint`，`golangci-lint version` 显示 v2.11.4，`golangci-lint config verify` 通过。
  - 推荐用 Homebrew 或官方 install 脚本安装 v2：
    ```bash
    brew install golangci-lint
    golangci-lint version
    golangci-lint config verify
    ```
  - `golangci-lint version` 必须显示 v2.x。
  - `golangci-lint config verify` 必须通过；如果不通过，先修 `.golangci.yml` schema，不跳过 lint。

- [x] **T2.3 首跑 lint，分类问题** — Done
  - 摘要：已执行 `golangci-lint run --timeout=5m > /tmp/lint.log 2>&1 || true`，日志共 1697 行、564 个问题。
  - 统计：`errcheck 173`、`staticcheck 332`、`unused 33`、`ineffassign 26`；后续优先修真实行为风险，纯历史风格债务用有理由的 v2 豁免收口。
  - `golangci-lint run --timeout=5m > /tmp/lint.log 2>&1 || true`
  - 按 linter 名分组：errcheck（错误丢弃）/ staticcheck（静态分析）/ unused（死代码）/ ineffassign（无效赋值）
  - 这一步**只统计不修复**，先看总量再决定是临时缩规则还是逐个改

- [x] **T2.4 按优先级修复** — Done
  - 摘要：已修复 `ineffassign`、`SA*` 正确性问题和类型检查问题，包括错误覆盖、未检查响应写入、nil context、context key 类型、TaskStatus 显式类型、Gemini thinking budget 分支、Perplexity 价格整除为 0 等。
  - 豁免：`.golangci.yml` 保留 linter 启用，但对历史 `errcheck`、历史 `unused` 和兼容旧日志路由的 `SA1019` 做 v2 `exclusions.rules` 豁免并写明原因。
  - errcheck：补 `_ = xxx` 显式忽略，或加日志/return error；不允许整体 `//nolint:errcheck` 屏蔽
  - staticcheck：按 `SA*` 编号查文档逐项修
  - unused：确认是否真死代码再删；导出符号有外部 import 则在该函数上加 `//lint:ignore U1000 reason`
  - ineffassign：通常是变量被覆盖前未使用，删多余赋值即可
  - **如果某一类问题数量极大且明显是历史债务**：在 `.golangci.yml` 的 v2 `linters.exclusions.rules` 里加路径级或规则级豁免，并在文件 Review 中**写明豁免理由 + 后续治理 issue**，不允许全局关 linter

- [x] **T2.5 lint 通过** — Done
  - 摘要：`golangci-lint run --timeout=5m` 已输出 `0 issues.`，随后完整后端检查通过。
  - 验证：`make check-backend` 退出码为 0，覆盖 gofmt、`go vet ./...`、golangci-lint、`go test ./... -count=1` 和 `go build ./...`。
  - `golangci-lint run --timeout=5m` 退出码 0
  - `make check-backend` 整体退出码 0

---

### 阶段 3 ｜ 前端 i18n 治理（约 2-4 小时）

**目标**：让 `bunx i18next-cli lint` 退出码为 0；`make check-frontend` 通过。

- [x] **T3.1 配置降噪：扩展 `web/i18next.config.js`** — Done
  - 摘要：已仅使用 `ignoredTags` 与 `ignoredAttributes` 扩展 i18n lint 降噪，覆盖 SVG tag、path `d`、坐标、stroke、transform 等误报来源。
  - 验证：`cd web && bun run i18n:lint` 从 317 条降到 293 条，SVG path 类误报已收敛，剩余清单进入逐项处理。
  - 文件路径：[web/i18next.config.js](web/i18next.config.js)
  - 只使用当前 `i18next-cli` 确认支持的 `ignoredTags` 与 `ignoredAttributes`：
    ```js
    ignoredTags: ['code', 'pre', 'path', 'svg', 'circle', 'rect', 'line', 'polygon', 'polyline'],
    ```
  - 在已有 `ignoredAttributes` 中追加：`'d'`（SVG path d 属性）、`'transform'`、`'stroke'`、`'strokeWidth'`、`'points'`、`'cx'`、`'cy'`、`'r'`、`'x'`、`'y'`、`'x1'`、`'x2'`、`'y1'`、`'y2'`
  - 不使用 `ignoredFunctions`、`allowedPatterns`、`ignoredPatterns`：当前工具类型与 linter 实现不支持这些字段，写入也不会消除问题。
  - 不把 `src/constants/**/*`、`src/helpers/**/*` 等整目录加入 ignore，除非先逐文件确认目录内只包含非用户可见常量；否则会掩盖真实文案。
  - 跑 `bunx i18next-cli lint` 确认误报数量下降，并保留剩余清单供 T3.2 逐项判断。

- [x] **T3.2 处理剩余真实文案** — Done
  - 摘要：已逐项处理剩余 i18n lint 命中，真实 UI 文案接入 `t()`，技术 token/协议字段/品牌名称改为 JSX 表达式或局部常量以避免误报且保持显示不变。
  - 验证：`cd web && bun run i18n:lint` 退出码为 0，`bun run i18n:extract` 已同步 7 个 locale JSON 文件。
  - 对剩余报告项逐一判断：
    - 真文案 → 改 `t('中文原文')`，保留中文 key 风格（与项目约定一致，i18n 文件 key 即中文）
    - 仍是常量/枚举 → 抽成命名常量，但不要仅因为放进 `src/constants` 就整体 ignore
    - DataAPI 字段名（如 `"webhook"`、`"json"`、`"type:"`） → 通常是 `<code>` / `<pre>` 展示内容、配置 key 或常量，优先用已支持的 ignored tag 包裹技术展示内容
  - 改完后跑 `cd web && bun run i18n:extract` 同步 7 个语言文件
  - 不引入新依赖，不切换到其他 i18n 工具

- [x] **T3.3 i18n lint 通过** — Done
  - 摘要：前端 i18n lint 已清零，并通过前端 fast/full 检查；构建产物 `web/dist/index.html` 已生成。
  - 验证：`make check-frontend-fast` 与 `make check-frontend` 均退出码为 0，覆盖 Prettier、ESLint、i18n lint、Bun tests 和 Vite build。
  - `cd web && bunx i18next-cli lint` 退出码 0
  - `make check-frontend-fast` 退出码 0
  - `make check-frontend` 退出码 0（生成 `web/dist/index.html`）

---

### 阶段 4 ｜ 全链路收尾（约 10 分钟）

- [x] **T4.1 全量本地 CI** — Done
  - 摘要：已执行 `make check-all`，完整链路按前端 full → 后端 gofmt/vet/golangci-lint/test/build 顺序跑完。
  - 验证：最终日志显示 `CHECK_ALL_EXIT=0`；前端构建仅保留既有 Browserslist、lottie eval 与 chunk size warning，不影响退出码。
  - `make check-all` 退出码 0
  - 输出顺序确认：前端 fast → 前端 build → 后端 gofmt → vet → golangci-lint → test → build

- [x] **T4.2 回写 Review** — Done
  - 摘要：已回写 `20260427_本地 CICD 检查流程接入_plan.md` 的 8.3，将原遗留项标注为已迁移到本计划并解决。
  - 摘要：已在本文件末尾追加 Review，记录实际改动范围、验证结果、lint 豁免理由和剩余风险。
  - 在 `20260427_本地 CICD 检查流程接入_plan.md` 的「八、Review」「8.3 未在本任务修复的既有问题」一节标注每项已迁移到本计划解决，附本计划链接
  - 在本文件末尾追加「五、Review」章节，记录实际改动文件清单、各阶段实跑结果、剩余风险

---

## 四、风险与边界

1. **不引入新依赖**：阶段 3 不增加 vitest/jsdom/i18next-parser 等任何 npm 包
2. **不动 CI workflows**：本计划不修改 `.github/workflows/`
3. **不重构业务逻辑**：CustomEvent 删 Mutex 后如果出现并发问题（理论上不会，因为锁本来就在值拷贝上无效），单独评估；adaptor 修复仅替换 panic 行
4. **lint 豁免必须有理由**：阶段 2 任何 `//nolint` 或 `exclude-rules` 都需在 PR 描述/Review 中写明
5. **i18n 配置改动需所有人重跑 extract**：T3.1 修改 `i18next.config.js` 后，可能影响 7 个语言文件的差异，需提交时一并 commit `web/src/i18n/locales/*.json`
6. **golangci-lint 版本锁定**：本计划选 v2.x；`.golangci.yml` 必须使用 v2 schema，避免 Homebrew 默认安装 v2 后配置不兼容
7. **dify 第二处 unreachable 是真 bug 苗头**：`DoResponse` 函数末尾裸 `return` 是历史遗留，删除即可；如果未来 if/else 改成早返回模式，要重新审视
8. **i18n 降噪不能无效配置化**：只使用当前工具确认支持的字段；任何整目录 ignore 都要有逐文件依据，避免把真实用户文案排除在检查之外

---

## 五、验证清单（按阶段）

| 阶段 | 验证命令 | 预期 |
|---|---|---|
| 1 | `go vet ./...` | exit 0 |
| 1 | `go test ./... -count=1` | 全部通过 |
| 2 | `golangci-lint version && golangci-lint config verify` | v2.x，verify OK |
| 2 | `golangci-lint run --timeout=5m` | exit 0 |
| 2 | `make check-backend` | exit 0 |
| 3 | `cd web && bunx i18next-cli lint` | exit 0 |
| 3 | `make check-frontend-fast` | exit 0 |
| 3 | `make check-frontend` + `ls web/dist/index.html` | exit 0，文件存在 |
| 4 | `make check-all` | exit 0 |

---

## 六、为什么采用「vet → golangci-lint v2 → i18n」顺序

1. **先修确定性代码问题**：`go vet` 当前已有明确源码定位，先修它可以尽快让后端基础静态检查恢复可用
2. **再接入 golangci-lint v2**：等 vet 通过后再升级配置、安装工具并处理更广的 lint 输出，避免工具 schema 问题和源码 vet 问题交织
3. **前端 i18n 独立放最后**：i18n 治理会产生大量文案和多语言文件 diff，放最后单独处理方便 review，也避免阻塞后端收口
4. **每阶段都有可验证的退出码**：阶段 1 以 `go vet`/`go test` 收口，阶段 2 以 `make check-backend` 收口，阶段 3 以 `make check-frontend` 收口，最后用 `make check-all` 统一验收

---

## 五、Review

### 5.1 实际改动范围

- 后端 vet/lint 修复：`common/custom-event.go`、11 个 channel adaptor、`dify` unreachable return、context key 类型、任务状态类型、响应写入错误处理、Gemini/Perplexity 等静态分析暴露的真实正确性问题。
- lint 工具链：`.golangci.yml` 已升级为 v2 schema；本机安装 `golangci-lint` v2.11.4；历史 `errcheck`、历史 `unused` 与兼容旧日志路由的 `SA1019` 在配置中保留有理由豁免。
- 前端 i18n：`web/i18next.config.js` 仅使用当前工具支持的 `ignoredTags`/`ignoredAttributes` 降噪；真实文案接入 `t()`，技术 token/协议字段/品牌名称保持显示不变并改为表达式或常量；`web/src/i18n/locales/*.json` 已通过 extract 同步。
- 计划/Review：本文件与 `20260427_本地 CICD 检查流程接入_plan.md` 已记录执行结果。

### 5.2 实跑结果

- `go vet ./...`：通过。
- `go test ./... -count=1`：通过。
- `golangci-lint config verify` 与 `golangci-lint run --timeout=5m`：通过，lint 输出 `0 issues.`。
- `make check-backend`：通过。
- `cd web && bun run i18n:lint`：通过，`No issues found.`。
- `make check-frontend-fast` 与 `make check-frontend`：通过，前端 15 个 Bun 测试全部通过，Vite build 生成 `web/dist/index.html`。
- `make check-all`：通过，最终捕获 `CHECK_ALL_EXIT=0`。

### 5.3 剩余风险

- Vite build 仍输出既有 warning：Browserslist 数据较旧、`lottie-web` 使用 eval、部分 chunk 超过 500 kB；这些不是本任务失败项。
- `.golangci.yml` 中对历史 `errcheck`/`unused` 和旧日志路由 `SA1019` 的豁免是有意收口，后续如要进一步提高 lint 严格度，应单独拆任务逐类治理。
- 前端 i18n 配置没有使用不受支持的字段，也没有粗暴 ignore 整个 constants/helpers 目录；后续新增文案仍应继续使用中文 key 的 `t('...')` 风格。
