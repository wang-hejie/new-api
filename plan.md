# 本地 CICD 检查流程接入 —— 执行计划

> 目标：参考 `claude_code_official` 项目的 `*_service_build.md` 命令模板，在 new-api 项目中建立一套**本地 CI 检查流程**，通过 Slash Command 触发、由 makefile 实际执行，覆盖后端 Go + 前端 React/JSX。

---

## 一、用户已拍板的 6 件事

1. **方案 A**：Slash Command 薄壳 + makefile 实现（命令文件只调度，逻辑沉淀到 makefile，可被人/CI/Claude 复用）
2. **前端测试使用 Bun 原生 runner**：现有测试已是 `bun:test` 风格，新增 `bun test "src/**/*.test.{js,jsx}"` 脚本，不引入 Vitest/jsdom/testing-library
3. **`golangci-lint` 固定配置并阻塞**：新增 `.golangci.yml`，固定启用规则；`check-backend` 中 `golangci-lint run` 失败即失败
4. **`check-all` 串行但前端先行**：先跑前端安装/测试/构建，确保 `web/dist` 存在，再跑后端 gofmt/vet/lint/test/build
5. **项目级 Slash Command 需要随仓库交付**：新增 `.claude/commands/*.md`，同时更新 `.gitignore` 反向规则，避免 `.claude` 被整体忽略
6. **前端检查拆分 fast/full**：`check-frontend-fast` 跑静态检查与测试，`check-frontend` 在此基础上再跑生产构建；`check-all` 使用 full 流程

---

## 二、整体流程图

```mermaid
flowchart TD
    Start([Slash Command 入口]) --> C{选择}
    C -->|/backend_check| MB[make check-backend]
    C -->|/frontend_check| MF[make check-frontend]
    C -->|/local_ci_all| MA[make check-all]

    subgraph make check-backend
      direction TB
      B1[gofmt -l 检查格式<br/>有输出则失败] --> B2[go vet ./...]
      B2 --> B3[golangci-lint run --timeout=5m<br/>按 .golangci.yml 固定规则阻塞]
      B3 --> B4
      B4[go test ./... -count=1] --> B5[go build ./...]
    end

    subgraph make check-frontend-fast
      direction TB
      F1[bun install --frozen-lockfile] --> F2[bun run lint<br/>prettier --check]
      F2 --> F3[bun run eslint<br/>含 header 版权校验]
      F3 --> F4[bun run i18n:lint]
      F4 --> F5[bun run test<br/>bun test src/**/*.test.{js,jsx}]
    end

    subgraph make check-frontend
      direction TB
      F5 --> F6[bun run build<br/>生成 web/dist 供 Go embed 使用]
    end

    MB --> DoneBackend([后端检查完成])
    MF --> DoneFrontend([前端检查完成])
    MA --> AF[make check-frontend] --> AB[make check-backend] --> DoneAll([全量检查完成])
```

---

## 三、关键代码与文件位点

| 类别 | 位置 | 现状 | 改动 |
|---|---|---|---|
| 命令模板（参考） | `/Users/wanghejie/workspace/claude_code_official/.claude/commands/*_service_build.md` | 4 份 TS 项目模板 | 仅参考，不修改 |
| 项目级命令 | `.claude/commands/`（不存在且 `.claude` 被 `.gitignore` 忽略） | 缺 | **新建** 3 份并添加 `.gitignore` 反向规则 |
| 构建脚本 | `makefile` | 仅 `build-frontend / start-backend` | **新增** target |
| Go lint 配置 | `.golangci.yml`（不存在） | 缺 | **新建**，固定 lint 规则与超时 |
| 前端 package | `web/package.json` | 无 test runner | **新增 Bun test 脚本**，不新增测试框架依赖 |
| 已存在 `.test.{js,jsx}` | `web/src/helpers/playgroundPayload.test.js` 等 3 份 | 已用 `bun:test`，但无统一脚本 | 接入 `bun run test` |
| 后端测试 | 30+ `*_test.go` | 可跑 | 直接复用 `go test ./...` |

---

## 四、具体改动清单（按文件）

### 4.1 `makefile` —— 新增 target，保留原有

新增：
- `check-backend`：依次执行 gofmt、go vet、golangci-lint、go test、go build
- `check-frontend-fast`：依次执行 bun install、prettier、eslint、i18n:lint、bun test
- `check-frontend`：依赖 `check-frontend-fast`，再执行 bun build
- `check-all`：串行调用 `check-frontend` → `check-backend`
- `.PHONY` 同步增补

> `gofmt -l` 列出待格式化文件，**有输出即失败**（用 `test -z`）。
> `check-all` 必须前端先行：`main.go` 使用 `//go:embed web/dist` 与 `//go:embed web/dist/index.html`，干净 checkout 下 `web/dist` 被 `.gitignore` 忽略，不先构建前端会导致后端编译链路失败。

### 4.2 `.golangci.yml` —— 新建固定配置

- 新增 `.golangci.yml`，固定启用规则、超时、排除项，避免不同开发机默认规则漂移。
- `check-backend` 中直接执行 `golangci-lint run --timeout=5m`；未安装或 lint 失败都应阻塞，并在 Slash Command 注意事项中提示安装方式。
- 初始规则应保守，优先选择当前代码库能通过或能明确修复的问题；不要一次性开启大批风格化规则导致接入成本失控。

### 4.3 `web/package.json` —— 加 Bun test 脚本

- `scripts.test`: `bun test "src/**/*.test.{js,jsx}"`
- `scripts.test:watch`: `bun test --watch "src/**/*.test.{js,jsx}"`
- 不新增 `vitest / jsdom / @testing-library/*` 依赖。当前测试已经显式从 `bun:test` 导入，Bun 原生 runner 是最小且最贴合现状的方案。

### 4.4 `.gitignore` —— 放行项目级 Slash Command

- 当前根目录 `.gitignore` 忽略 `.claude`，需要追加反向规则：
  ```gitignore
  !.claude/
  !.claude/commands/
  !.claude/commands/*.md
  ```
- 只放行命令模板，不放行 `.claude` 下可能出现的本地状态、缓存或个人配置。

### 4.5 `.claude/commands/backend_check.md` —— 新建

结构对齐参考模板（`# 标题`、`## 执行步骤`、`## 注意事项`），命令体调 `make check-backend`。注意事项中说明需要本机已安装 `golangci-lint`，且版本应与 `.golangci.yml` 兼容。

### 4.6 `.claude/commands/frontend_check.md` —— 新建

同上，调 `make check-frontend`。

### 4.7 `.claude/commands/local_ci_all.md` —— 新建

同上，调 `make check-all`，并强调**前端 full 检查先跑、后端检查后跑、任一步失败即停**。

### 4.8 已有 3 份测试文件 —— 检查可运行性

- `web/src/helpers/playgroundPayload.test.js`
- `web/src/hooks/playground/usePlaygroundState.test.jsx`
- `web/src/hooks/playground/useApiRequest.test.jsx`

读一遍是否依赖 jest/vitest 全局、msw 或其他未声明 API；如果测试文件已经显式从 `bun:test` 导入 `describe/test/expect/mock`，则保持现状，只做必要的最小兼容修补。
当前实际测试均已使用 `bun:test`，因此只需确认 `bun test "src/**/*.test.{js,jsx}"` 能发现并运行它们；不要迁移到 Vitest。

---

## 五、待办列表（执行清单）

- [ ] **T1**：读取并核验 3 份既有前端 `.test.{js,jsx}` 的 API 风格，确认 Bun test 兼容性
- [ ] **T2**：修改 `makefile`，新增 `check-backend / check-frontend-fast / check-frontend / check-all` 四个 target，保持原有 target 不变
- [ ] **T3**：新建 `.golangci.yml`，用保守规则固定 `golangci-lint` 行为，并让 `check-backend` 中 lint 失败阻塞
- [ ] **T4**：修改 `web/package.json`，新增 `test / test:watch` 脚本，不新增 Vitest/jsdom/testing-library 依赖
- [ ] **T5**：修改 `.gitignore`，放行 `.claude/commands/*.md`
- [ ] **T6**：新建 `.claude/commands/backend_check.md`
- [ ] **T7**：新建 `.claude/commands/frontend_check.md`
- [ ] **T8**：新建 `.claude/commands/local_ci_all.md`
- [ ] **T9**：本地实跑 `make check-frontend-fast`，确认 prettier / eslint / i18n:lint / bun test 全部可运行
- [ ] **T10**：本地实跑 `make check-frontend`，确认生产构建成功并生成 `web/dist`
- [ ] **T11**：本地实跑 `make check-backend`，把失败项收集后**仅记录**，不在本任务里强行修业务代码（避免任务边界蔓延）
- [ ] **T12**：本地实跑 `make check-all`，确认顺序为 `check-frontend` → `check-backend`
- [ ] **T13**：在本文件末尾追加「Review」章节，汇总变更与遗留问题

---

## 六、风险与边界

1. **不修业务代码**：本任务只搭流程；如果 `gofmt / vet / eslint / 测试` 暴露既有问题，**只汇报不顺手修**，避免越权。除非问题阻塞流程本身（如某测试 panic 导致 `go test` 整体失败），才在 Review 中单独说明。
2. **不动 CI workflows**：`.github/workflows/` 不修改，本任务范围只到「本地」。
3. **不引入 TS**：当前前端是 JSX，不强行 type-check（参考项目独有的 `npm run type-check` 步骤在此**不映射**）。
4. **不引入 Vitest**：当前 3 份测试已使用 `bun:test`，为了运行这些测试而引入 Vitest/jsdom/testing-library 会增加迁移成本和依赖面；后续确实需要 DOM 交互测试时再单独评估。
5. **bun.lock 漂移**：本方案不新增前端依赖，理论上不应导致 `web/bun.lock` 漂移；`check-frontend*` 使用 `bun install --frozen-lockfile` 做无漂移校验。
6. **golangci-lint 版本**：新增 `.golangci.yml` 后 lint 结果仍可能受大版本影响，Slash Command 中应提示推荐安装版本；如果本地版本过旧导致配置不兼容，应升级工具而不是跳过 lint。
7. **Go embed 顺序风险**：`main.go` 依赖 `web/dist`，而 `web/dist` 被忽略；`check-all` 必须先跑完整前端构建，再跑后端编译/测试。
8. **`.claude` 忽略规则风险**：只放行 `.claude/commands/*.md`，避免把个人本地状态误提交。

---

## 七、验证策略

- 后端：`make check-backend` 退出码 0 视作通过；不为 0 时输出末尾应有明确失败步骤名。
- 前端 fast：`make check-frontend-fast` 退出码 0 视作静态检查与 Bun 单测通过；`bun test` 至少能识别到现有 3 份 `.test.{js,jsx}` 并跑出结果。
- 前端 full：`make check-frontend` 退出码 0 视作 fast 检查通过且 `bun run build` 成功，`web/dist/index.html` 存在。
- 综合：`make check-all` 串行先前端 full 后后端，任一阶段失败立即停止（依赖 make 默认 fail-fast）。

---

## 八、Review（实施完成后填写）

> 待实施后补充：
>
> - 实际改动文件列表与行数
> - 各步骤本地实跑结果（pass / fail / skip）
> - 暴露但未在本任务修复的既有问题（仅记录，不修改）
> - 后续建议（例如：把 `make check-all` 接入 PR check workflow，或加入 pre-commit hook）
