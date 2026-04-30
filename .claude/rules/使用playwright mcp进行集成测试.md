# 使用 Playwright MCP 进行集成测试

> 本文档根据另一个项目的 Playwright 集成测试流程整理，并已按本项目的 Go/Gin/GORM 后端、React/Vite/Semi UI 前端、Bun 工具链和 `docker-compose.yml` 实际配置改写。
> 目标是指导在本项目中用 Playwright MCP 做浏览器级探索、调试和回归测试，并把可重复的流程固化为 Playwright test specs。

---

## 一、适用性结论

原文档中的核心方法和原则适用于本项目，尤其是以下部分：

- 先读源码，再写测试计划，不根据页面观感猜选择器。
- 用可重复夹具准备数据，测试结束清理数据。
- 用浏览器级测试覆盖登录、权限、表单、列表、筛选、分页、弹窗、网络请求和样式渲染。
- 对关键 UI 不只检查 DOM class，还要用 `getComputedStyle` 验证浏览器实际渲染值。
- 用 Playwright MCP 或有头模式调试真实 DOM，再把稳定步骤沉淀为 specs。

但原文不能直接照搬，必须按本项目改写：

- 原文的 `http://localhost:3001` 不适用。本项目 Docker Compose 暴露的是 `http://127.0.0.1:9991`，容器内服务端口是 `3000`。
- 原文的 Prisma 夹具不适用。本项目后端是 Go + GORM，数据库访问要遵守 SQLite/MySQL/PostgreSQL 三库兼容规则。
- 原文的 npm/npx 命令不是首选。本项目前端工具链优先使用 Bun。
- 原文的 Radix/DayPicker/Tailwind v4 案例只能作为原则参考。本项目主要使用 Semi UI、Tailwind v3、Semi CSS variables 和自定义 `web/src/index.css`。
- 本项目有初始化向导。新数据库不应假设存在固定 root 账号，需要通过 `/api/setup` 或专用测试夹具建立账号。

---

## 二、整体流程

```
1. 阅读源码       -> 页面组件、路由、API、权限、中间件、模型、CSS/主题配置
2. 明确环境       -> Docker Compose 端口、数据库状态、初始化状态、测试账号
3. 编写测试计划   -> 阶段、账号、夹具、选择器、网络断言、样式断言、清理策略
4. 准备夹具       -> 优先 API 夹具；必要时用 Go/GORM 夹具；避免不可移植 raw SQL
5. MCP 探索调试   -> 真实浏览器点击、定位 Semi UI portal、截图、读取计算样式
6. 固化测试脚本   -> Playwright test spec，串行执行，失败保留截图/trace
7. 验证与清理     -> 无头跑通，清理 E2E 数据，记录已知限制
```

MCP 更适合探索和调试真实页面状态；可重复回归测试应写成 `*.spec.ts`，并在本地或 CI 中执行。

---

## 三、测试环境

### 3.1 Docker Compose 事实

从 `docker-compose.yml` 可确认：

- 服务包括 `new-api`、`postgres`、`redis`。
- 浏览器访问入口是 `http://127.0.0.1:9991`。
- `new-api` 容器内部监听 `3000`，端口映射为 `127.0.0.1:9991:3000`。
- 默认数据库是 PostgreSQL 15，DSN 指向 Compose 网络内的 `postgres:5432/new-api`。
- Redis 在 Compose 网络内，外部未暴露端口。
- PostgreSQL 数据保存在 `pg_data` volume，重复启动会复用旧数据。
- Docker 镜像构建会先用 Bun 构建 `web/dist`，再把前端静态资源嵌入 Go 后端。

启动和检查：

```bash
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:9991/api/status
docker compose logs -f new-api
```

页面级本地 E2E 必须关闭 Web 全局限流，否则密集导航和静态资源请求可能返回 429。用 Compose override 或专用 E2E 容器把 `GLOBAL_WEB_RATE_LIMIT_ENABLE=false` 注入 `new-api` 容器环境；如测试包含大量初始化、登录或设置请求，同时提高 `GLOBAL_API_RATE_LIMIT` / `CRITICAL_RATE_LIMIT`。不要只在 `docker compose up` 命令前临时声明环境变量，除非 compose 文件显式引用并转发这些变量。

只在独占 E2E 数据库中才允许删除 volume：

```bash
docker compose down -v
```

不要在共享开发数据库上用 `down -v` 或宽泛删除语句清理数据。

### 3.2 Base URL

Playwright 和 MCP 默认使用：

```text
http://127.0.0.1:9991
```

本地前后端分离调试时可以用：

- 后端：`go run . --port 3000`
- 前端：`cd web && bun run dev`
- Vite 页面通常是 `http://127.0.0.1:5173`，`/api` 代理到 `http://localhost:3000`

文档和测试脚本应通过环境变量覆盖：

```bash
NEW_API_BASE_URL=http://127.0.0.1:9991
```

### 3.3 初始化状态

新数据库首次启动后，系统可能未初始化。先检查：

```bash
curl -fsS http://127.0.0.1:9991/api/setup
```

如果 `data.status` 为 `false`，需要走初始化流程。E2E 可通过 UI 初始化，也可通过 API 初始化独占测试库：

```json
{
  "username": "e2eroot",
  "password": "E2E_root_123456",
  "confirmPassword": "E2E_root_123456",
  "SelfUseModeEnabled": false,
  "DemoSiteEnabled": false
}
```

`e2eroot / E2E_root_123456` 只能作为“当前夹具刚刚初始化的独占 E2E 数据库”的示例账号。因为 Compose 的 `pg_data` volume 会复用旧数据，如果 `/api/setup` 返回 `data.status: true`，测试脚本不得继续默认使用这个账号。

如果系统已经初始化，不要假设管理员密码。应使用 `E2E_ROOT_USER` / `E2E_ROOT_PASS` 显式传入已知 root/admin 测试账号，或重建独占测试数据库。缺少这两个环境变量时，夹具脚本应直接失败，而不是尝试默认账号。

---

## 四、Playwright 安装与配置

本项目前端包管理器优先使用 Bun。推荐把 Playwright 依赖放在 `web/`，测试文件可放在项目级目录。

```bash
cd web
bun add -d @playwright/test
bunx playwright install chromium
```

推荐配置文件：`web/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.NEW_API_BASE_URL || 'http://127.0.0.1:9991';

export default defineConfig({
  testDir: '../scripts/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: '../test-results/playwright-report' }],
  ],
  outputDir: '../test-results/playwright',
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

执行：

```bash
cd web
NEW_API_BASE_URL=http://127.0.0.1:9991 bunx playwright test
NEW_API_BASE_URL=http://127.0.0.1:9991 bunx playwright test ../scripts/e2e/<feature> --headed
```

---

## 五、测试计划规范

每个功能测试前先写计划，建议放在：

```text
scripts/e2e/<feature>/plan.md
```

必须包含：

| 章节 | 内容 |
| --- | --- |
| 测试目标 | 覆盖哪个用户流程、API 或后台能力 |
| 环境 | Docker Compose 入口、是否需要新数据库、是否依赖 Redis、是否依赖外部上游 |
| 测试账号 | root/admin/common 用户、密码、角色、分组、额度 |
| 夹具数据 | 前缀、创建方式、清理方式、关联表 |
| DOM 选择器 | 基于源码列出按钮、输入框、表格行、弹窗、下拉选项 |
| 网络断言 | 需要监听的 `/api/...` 请求、请求方法、参数、响应结构 |
| 样式断言 | 需要读取的 `backgroundColor`、`color`、`borderColor`、`display`、`opacity` 等 |
| 阶段步骤 | 每阶段的操作和预期 |
| 风险 | 权限、竞态、分页、缓存、三库兼容、外部上游成本 |

覆盖维度检查：

- [ ] 未登录访问和登录后访问。
- [ ] root/admin/common 用户的权限差异。
- [ ] UI 可见性和后端权限校验同时验证。
- [ ] Semi UI 表单输入、校验、提交、Toast。
- [ ] 表格搜索、筛选、分页、排序、列设置。
- [ ] Modal、SideSheet、Dropdown、Select、DatePicker 等 portal 组件。
- [ ] API 请求参数和 `success/message/data` 结构。
- [ ] 业务错误。注意很多业务错误 HTTP 状态仍是 200，但 `success:false`。
- [ ] Redis/缓存导致的刷新、重复请求和状态滞后。
- [ ] 样式计算值，不只检查 class。
- [ ] 清理 E2E 数据后再次运行仍可通过。

如果涉及动态/阶梯计费，先读 `pkg/billingexpr/expr.md`，再设计计费夹具和断言。

---

## 六、夹具设计

### 6.1 优先级

夹具优先级如下：

```
API 夹具 > Go/GORM 夹具 > 手工 SQL
```

优先用 API 创建测试数据，因为它最接近真实用户路径，且不需要 Compose 暴露数据库端口。

只有在 API 无法构造目标状态时，才写 Go/GORM 夹具。避免提交只适用于 PostgreSQL 的 raw SQL 脚本，因为本项目必须同时兼容 SQLite、MySQL 和 PostgreSQL。

### 6.2 统一前缀

所有 E2E 数据必须有唯一前缀：

```text
E2E_<FEATURE>_<timestamp>_
```

清理时只删除该前缀数据，不影响用户数据。

### 6.3 API 夹具模板

推荐文件：

```text
scripts/e2e/<feature>/fixtures.ts
```

示例：

```typescript
import { request, expect, type APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.NEW_API_BASE_URL || 'http://127.0.0.1:9991';
const DEFAULT_ROOT_USER = 'e2eroot';
const DEFAULT_ROOT_PASS = 'E2E_root_123456';
const PREFIX = `E2E_FEATURE_${Date.now()}_`;

type E2EUser = { id: number; username: string; role: number };

async function ensureSetup(api: APIRequestContext) {
  const statusResp = await api.get('/api/setup');
  const statusBody = await statusResp.json();

  if (statusBody?.data?.status) {
    const hasExplicitRoot = Boolean(process.env.E2E_ROOT_USER && process.env.E2E_ROOT_PASS);
    if (!hasExplicitRoot) {
      throw new Error('系统已初始化，请设置 E2E_ROOT_USER / E2E_ROOT_PASS，或重建独占 E2E 数据库');
    }
    return;
  }

  const rootUser = process.env.E2E_ROOT_USER || DEFAULT_ROOT_USER;
  const rootPass = process.env.E2E_ROOT_PASS || DEFAULT_ROOT_PASS;

  const setupResp = await api.post('/api/setup', {
    data: {
      username: rootUser,
      password: rootPass,
      confirmPassword: rootPass,
      SelfUseModeEnabled: false,
      DemoSiteEnabled: false,
    },
  });
  const setupBody = await setupResp.json();
  expect(setupBody.success, setupBody.message).toBeTruthy();
}

async function login(api: APIRequestContext) {
  const username = process.env.E2E_ROOT_USER || DEFAULT_ROOT_USER;
  const password = process.env.E2E_ROOT_PASS || DEFAULT_ROOT_PASS;
  const resp = await api.post('/api/user/login', {
    data: { username, password },
  });
  const body = await resp.json();
  expect(body.success, body.message).toBeTruthy();
  return body.data as E2EUser;
}

function authHeaders(user: E2EUser) {
  return { 'New-API-User': String(user.id) };
}

async function inject() {
  const api = await request.newContext({ baseURL: BASE_URL });
  await ensureSetup(api);
  const user = await login(api);
  const headers = authHeaders(user);

  // 用 API 创建 E2E 数据，例如用户、渠道、令牌、模型配置等。
  // 所有 name/remark/display_name 中写入 PREFIX。
  // 受保护接口必须带 headers，因为本项目后端同时校验 session cookie 和 New-API-User。
  // await api.post('/api/channel/', { headers, data: { ... } });

  await api.dispose();
  console.log(PREFIX);
}

async function cleanup() {
  const api = await request.newContext({ baseURL: BASE_URL });
  const user = await login(api);
  const headers = authHeaders(user);

  // 用 API 删除 PREFIX 数据。若某些接口不支持搜索/删除，再考虑 Go/GORM 夹具。
  // await api.delete('/api/channel/123', { headers });

  await api.dispose();
}

const action = process.argv[2];
if (action === 'inject') inject();
else if (action === 'cleanup') cleanup();
else {
  console.error('Usage: bunx tsx scripts/e2e/<feature>/fixtures.ts [inject|cleanup]');
  process.exit(1);
}
```

### 6.4 Go/GORM 夹具原则

如果必须直连数据库，夹具必须遵守本项目规则：

- 使用 GORM 模型和方法，避免 raw SQL。
- 读 `model/*.go` 确认必填字段、默认值、软删除、唯一索引和外键关系。
- JSON 编解码在 Go 代码中使用 `common.Marshal`、`common.Unmarshal` 等项目封装。
- 不使用 Prisma。
- 不写只兼容单一数据库的迁移或夹具逻辑。
- raw SQL 不可避免时，必须提供 SQLite/MySQL/PostgreSQL 分支。

Compose 默认不暴露 PostgreSQL 到宿主机。若要从宿主机运行 Go/GORM 夹具，应使用测试专用 override 暂时暴露数据库端口，或运行在同一个 Docker 网络内的临时 Go 容器。不要为了 E2E 修改默认 Compose 文件。

---

## 七、Playwright 脚本结构

推荐目录：

```text
scripts/e2e/<feature>/
  plan.md
  fixtures.ts
  <feature>.spec.ts
```

测试脚本模板：

```typescript
import { test, expect, type Page, type Request } from '@playwright/test';

type StepResult = { step: string; passed: boolean; detail?: string };
const results: StepResult[] = [];

function record(step: string, passed: boolean, detail = '') {
  results.push({ step, passed, detail });
}

async function setChineseLocale(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'zh-CN');
  });
}

async function loginByApi(page: Page, username: string, password: string) {
  const resp = await page.request.post('/api/user/login', {
    data: { username, password },
  });
  const body = await resp.json();
  expect(body.success, body.message).toBeTruthy();

  await page.addInitScript((user) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('i18nextLng', 'zh-CN');
  }, body.data);
}

async function waitForSemiLoadingDone(page: Page) {
  await page.locator('.semi-spin').first().waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
}

test.describe('<功能名> E2E', () => {
  test.setTimeout(180_000);

  test('完整流程', async ({ page }) => {
    await setChineseLocale(page);

    const apiRequests: Request[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/<endpoint>')) apiRequests.push(req);
    });

    await loginByApi(page, process.env.E2E_ROOT_USER || 'e2eroot', process.env.E2E_ROOT_PASS || 'E2E_root_123456');
    await page.goto('/console/token');
    await waitForSemiLoadingDone(page);

    // 阶段 1: 断言页面加载
    try {
      await expect(page.getByText('令牌').first()).toBeVisible();
      record('页面加载', true);
    } catch (err) {
      record('页面加载', false, String(err));
    }

    const failed = results.filter((r) => !r.passed);
    for (const r of results) {
      console.log(`${r.passed ? 'PASS' : 'FAIL'} ${r.step} ${r.detail || ''}`);
    }
    expect(failed, JSON.stringify(failed, null, 2)).toHaveLength(0);
  });
});
```

对于一个有严格状态链的用户流程，可以用单个 `test` 串起来，并用 `record` 输出阶段结果。不同角色、未登录、反向权限验证建议拆成独立 spec，避免互相污染登录态。

---

## 八、选择器策略

### 8.1 总体优先级

```
getByRole > getByLabel > getByPlaceholder > getByText > 可访问 aria-label > data-testid > Semi class > CSS 结构选择器
```

新增或修改前端时，图标按钮、危险操作和表格行操作应补充 `aria-label` 或可稳定定位的文本。不要依赖随机 DOM 层级。

### 8.2 Semi UI 常见组件

| 组件 | 推荐策略 |
| --- | --- |
| Button | `getByRole('button', { name: '保存' })`，图标按钮用 `aria-label` |
| Form.Input | 优先 `getByPlaceholder()`，其次根据 `.semi-form-field` + label 文本定位 |
| Select | 点 `.semi-select` 后，在 `.semi-select-option` 或 portal 中按文本选项定位 |
| Dropdown | 展开按钮后，在 `.semi-dropdown` 内定位 `.semi-dropdown-item` |
| Modal | `page.locator('.semi-modal').filter({ hasText: '标题或内容' })` |
| SideSheet | `page.locator('.semi-sidesheet').filter({ hasText: '标题或内容' })` |
| Table | 在 `.semi-table-tbody .semi-table-row` 中按唯一文本筛行，再在行内操作 |
| Tabs | 优先 `getByRole('tab', { name })`，不稳定时用 `.semi-tabs-tab-button` |
| Toast | `.semi-toast` 或按 Toast 文本断言 |
| DatePicker | `.semi-datepicker`、输入框 placeholder、日期文本组合定位 |
| Spin/Loading | `.semi-spin` 消失，或等待目标 API 响应 |

### 8.3 Portal 定位

Semi 的 Modal、Select、Dropdown、Tooltip、DatePicker 常渲染到 body 下的 portal，不一定是触发按钮的子元素。

错误模式：

```typescript
const field = page.locator('.my-form-field');
await field.locator('.semi-select-option').getByText('default').click();
```

推荐模式：

```typescript
await page.getByText('选择分组').click();
await page.locator('.semi-select-option').filter({ hasText: 'default' }).click();
```

### 8.4 表格行定位

不要用第 N 行作为主要断言。用夹具的唯一前缀定位：

```typescript
const row = page.locator('.semi-table-tbody .semi-table-row').filter({
  hasText: 'E2E_TOKEN_searchable',
});
await expect(row).toBeVisible();
await row.getByRole('button', { name: '编辑' }).click();
```

如果操作按钮只有图标，优先给按钮补 `aria-label`，再写测试。

---

## 九、网络断言

本项目 API 通常返回：

```json
{ "success": true, "message": "", "data": {} }
```

业务错误也经常是 HTTP 200 且 `success:false`。测试不能只断言 `status === 200`。

本项目受保护 API 同时校验 session cookie 和 `New-API-User` 请求头。浏览器内前端请求会由 `web/src/helpers/api.js` 从 localStorage 自动带上该头；但测试里的 `request.newContext()`、`page.request.get/post` 不会自动补齐。只要是登录后的直接 API 调用，都必须显式传入：

```typescript
const headers = { 'New-API-User': String(user.id) };
await page.request.get('/api/user/self', { headers });
```

示例：

```typescript
const resp = await page.waitForResponse((r) =>
  r.url().includes('/api/token/') && r.request().method() === 'GET',
);
expect(resp.ok()).toBeTruthy();
const body = await resp.json();
expect(body.success, body.message).toBeTruthy();
```

监听请求参数：

```typescript
const requests: Request[] = [];
page.on('request', (req) => {
  if (req.url().includes('/api/channel/search')) requests.push(req);
});

// 触发筛选后
const last = requests.at(-1);
expect(last?.url()).toContain('keyword=');
```

权限反向验证：

```typescript
const resp = await page.request.get('/api/user/', {
  headers: { 'New-API-User': String(user.id) },
});
const body = await resp.json().catch(() => null);

expect([401, 403, 200]).toContain(resp.status());
if (resp.status() === 200) {
  expect(body.success).toBeFalsy();
} else {
  expect(body?.success ?? false).toBeFalsy();
}
```

---

## 十、样式验证

### 10.1 核心原则

DOM class 不等于实际样式。以下情况都可能导致 class 存在但视觉无效：

- Tailwind v3 配置没有生成目标 utility。
- Semi CSS variable 未按主题或暗色模式生效。
- `web/src/index.css` 的覆盖选择器命中了错误元素。
- portal 中的组件不在预期父级下，父选择器不生效。
- 响应式布局下样式断点不同。

关键 UI 要读取 `getComputedStyle`。

### 10.2 工具函数

```typescript
function isTransparent(color: string) {
  return color === 'transparent' || color === 'rgba(0, 0, 0, 0)' || color === 'rgba(0,0,0,0)';
}

async function computedStyle(locator, prop: keyof CSSStyleDeclaration) {
  return locator.evaluate((el, p) => window.getComputedStyle(el)[p], prop);
}

async function expectNonTransparent(locator, prop: keyof CSSStyleDeclaration, label: string) {
  const value = await computedStyle(locator, prop);
  expect(isTransparent(String(value)), `${label}: ${prop} is ${value}`).toBeFalsy();
}
```

### 10.3 必测属性

| 属性 | 场景 |
| --- | --- |
| `backgroundColor` | 选中态、状态标签、按钮主色、表格高亮 |
| `color` | 禁用态、危险操作、链接、主题切换 |
| `borderColor` | 输入校验、聚焦态、Tag、Modal 分隔 |
| `display` | 权限隐藏、响应式折叠 |
| `opacity` | 禁用按钮、加载态 |
| `pointerEvents` | 不可点击状态 |
| `fontWeight` | 当前 Tab、强调文本 |

### 10.4 Semi/Tailwind 专项检查

本项目使用 Tailwind v3，颜色大量来自 `web/tailwind.config.js` 中的 Semi CSS variables，以及 `web/src/index.css` 的主题变量和覆盖样式。涉及 UI 样式改动时先读：

- `web/tailwind.config.js`
- `web/src/index.css`
- 相关组件源码
- Semi UI 组件实际 DOM

对自定义主题和暗色模式，至少在浅色和暗色两种状态下验证关键颜色：

```typescript
await page.evaluate(() => document.documentElement.classList.add('dark'));
await expectNonTransparent(page.locator('.semi-button-primary').first(), 'backgroundColor', 'dark primary button');
```

---

## 十一、MCP 调试规范

用 Playwright MCP 做探索时，按这个顺序：

1. 打开 `http://127.0.0.1:9991`。
2. 固定语言为 `zh-CN`，避免选择器受浏览器语言影响。
3. 检查 `/api/status` 和 `/api/setup`，确认系统状态。
4. 登录或初始化测试账号。
5. 对每一步操作截图或记录关键 DOM。
6. 对 Semi portal 组件展开后再重新观察 DOM。
7. 对样式问题用浏览器 evaluate 读取 `getComputedStyle`。
8. 把稳定步骤迁移为 `*.spec.ts`。

MCP 调试中发现选择器不稳定时，优先修改前端可访问性属性或增加稳定测试锚点，而不是写更脆弱的层级 CSS。

---

## 十二、外部上游与费用控制

本项目是 AI API 网关，很多流程会触发上游模型请求和计费。E2E 默认不得调用真实付费上游。

设计原则：

- UI 管理流程可以只验证渠道、模型、令牌配置的增删改查。
- Relay 流程需要真实后端到上游交互时，使用 mock upstream 服务。
- 测试渠道的 base URL 指向 mock server，不指向真实 OpenAI、Claude、Gemini、Azure、Bedrock 等。
- 计费断言使用小额度、固定 token、固定响应。
- 测试结束清理渠道、令牌、日志和计费记录。

Playwright 的 `page.route()` 只能拦截浏览器到后端的请求，不能拦截 Go 后端到上游 provider 的请求。后端上游请求要用 mock server 或后端集成测试处理。

---

## 十三、执行流程

完整流程：

```bash
# 1. 启动服务
docker compose up -d --build
curl -fsS http://127.0.0.1:9991/api/status

# 2. 准备夹具
cd web
NEW_API_BASE_URL=http://127.0.0.1:9991 bunx tsx ../scripts/e2e/<feature>/fixtures.ts inject

# 3. 运行 E2E
NEW_API_BASE_URL=http://127.0.0.1:9991 bunx playwright test ../scripts/e2e/<feature> --reporter=list

# 4. 调试失败
NEW_API_BASE_URL=http://127.0.0.1:9991 bunx playwright test ../scripts/e2e/<feature> --headed --reporter=list

# 5. 清理夹具
NEW_API_BASE_URL=http://127.0.0.1:9991 bunx tsx ../scripts/e2e/<feature>/fixtures.ts cleanup
```

如果项目尚未安装 `tsx`，也可以把夹具写成普通 JavaScript，或用 Playwright spec 的 `test.beforeAll` 和 `test.afterAll` 管理夹具。

---

## 十四、Checklist

开始前：

- [ ] 已读相关前端组件、hook、helper、CSS。
- [ ] 已读 `router/`、`controller/`、`middleware/`、`model/` 中相关后端逻辑。
- [ ] 已确认 Docker Base URL 是 `http://127.0.0.1:9991`。
- [ ] 已确认 `/api/setup` 初始化状态。
- [ ] 已准备独占测试账号或独占测试数据库。
- [ ] 如果系统已初始化，已显式设置 `E2E_ROOT_USER` / `E2E_ROOT_PASS`，没有依赖默认示例账号。
- [ ] 已写 `plan.md`。

写夹具：

- [ ] 所有数据使用 `E2E_<FEATURE>_` 前缀。
- [ ] `inject` 可重复执行。
- [ ] `cleanup` 只删除 E2E 数据。
- [ ] 优先 API，必要时 Go/GORM。
- [ ] API 夹具调用受保护接口时显式传入 `New-API-User` header。
- [ ] 没有提交单库 raw SQL。

写测试：

- [ ] `workers: 1`。
- [ ] 固定 `locale`、`timezoneId` 和 `i18nextLng`。
- [ ] 登录态同时包含 session cookie 和 localStorage user。
- [ ] `page.request` 或 `request.newContext()` 直接调用受保护 API 时显式传入 `New-API-User` header。
- [ ] Semi portal 选择器已按真实 DOM 调试。
- [ ] API 断言检查 `success/message/data`。
- [ ] 权限测试包含 UI 不可见和后端拒绝。
- [ ] 样式测试读取 `getComputedStyle`。
- [ ] 外部上游使用 mock，不调用真实付费服务。

收尾：

- [ ] 无头模式通过。
- [ ] 失败截图和 trace 已查看。
- [ ] E2E 数据已清理。
- [ ] 计划文档更新了结论和已知限制。
