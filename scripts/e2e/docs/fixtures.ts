import {
  expect,
  request,
  type APIRequestContext,
  type Locator,
  type Page,
} from "@playwright/test";

export const BASE_URL = process.env.NEW_API_BASE_URL || "http://127.0.0.1:9992";
export const ROOT_USER = process.env.E2E_ROOT_USER || "e2eroot";
export const ROOT_PASS = process.env.E2E_ROOT_PASS || "E2E_root_123456";

export type RootSession = {
  api: APIRequestContext;
  userId: number;
  username: string;
  authHeaders: Record<string, string>;
};

export type DocsBackup = {
  docsLink: string;
  headerNavModules: string;
  demoSiteEnabled: string;
  homePageContent: string;
};

export type DocMeta = {
  slug: string;
  title: string;
  order: number;
  category: string;
};

export const defaultHeaderNavModules = {
  home: true,
  console: true,
  pricing: { enabled: true, requireAuth: false },
  docs: true,
  about: true,
};

export const disabledDocsHeaderNavModules = {
  ...defaultHeaderNavModules,
  docs: false,
};

async function ensureSetup(api: APIRequestContext) {
  const res = await api.get("/api/setup");
  expect(res.ok(), `GET /api/setup failed: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  expect(body.success, body.message).toBeTruthy();

  if (body?.data?.status) {
    if (!process.env.E2E_ROOT_USER || !process.env.E2E_ROOT_PASS) {
      throw new Error(
        "系统已初始化，请显式设置 E2E_ROOT_USER / E2E_ROOT_PASS，或重建独占 E2E 数据库",
      );
    }
    return;
  }

  const setup = await api.post("/api/setup", {
    data: {
      username: ROOT_USER,
      password: ROOT_PASS,
      confirmPassword: ROOT_PASS,
      SelfUseModeEnabled: false,
      DemoSiteEnabled: false,
    },
  });
  expect(setup.ok(), `POST /api/setup failed: ${setup.status()}`).toBeTruthy();
  const setupBody = await setup.json();
  expect(setupBody.success, setupBody.message).toBeTruthy();
}

export async function loginRoot(): Promise<RootSession> {
  const api = await request.newContext({ baseURL: BASE_URL });
  await ensureSetup(api);

  const res = await api.post("/api/user/login", {
    data: { username: ROOT_USER, password: ROOT_PASS },
  });
  expect(res.ok(), `POST /api/user/login failed: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  expect(body.success, body.message).toBeTruthy();
  expect(body.data?.role, "E2E user must be root").toBeGreaterThanOrEqual(100);

  return {
    api,
    userId: body.data.id,
    username: body.data.username,
    authHeaders: { "New-API-User": String(body.data.id) },
  };
}

export async function disposeRootSession(session?: RootSession) {
  await session?.api.dispose();
}

export async function readOptions(
  session: RootSession,
): Promise<Record<string, string>> {
  const res = await session.api.get("/api/option/", {
    headers: session.authHeaders,
  });
  expect(res.ok(), `GET /api/option/ failed: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  expect(body.success, body.message).toBeTruthy();

  const map: Record<string, string> = {};
  for (const opt of body.data || []) {
    map[opt.key] = String(opt.value ?? "");
  }
  return map;
}

export async function backupDocsState(
  session: RootSession,
): Promise<DocsBackup> {
  const opts = await readOptions(session);
  return {
    docsLink: opts["general_setting.docs_link"] ?? "",
    headerNavModules: opts.HeaderNavModules ?? "",
    demoSiteEnabled: opts.DemoSiteEnabled ?? "false",
    homePageContent: opts.HomePageContent ?? "",
  };
}

export async function setOption(
  session: RootSession,
  key: string,
  value: string,
) {
  const res = await session.api.put("/api/option/", {
    headers: session.authHeaders,
    data: { key, value },
  });
  expect(
    res.ok(),
    `PUT /api/option/ ${key} failed: ${res.status()}`,
  ).toBeTruthy();
  const body = await res.json();
  expect(body.success, `${key} -> ${value}: ${body.message}`).toBeTruthy();
}

export async function restoreDocsState(
  session: RootSession,
  backup?: DocsBackup,
) {
  if (!backup) return;
  await setOption(session, "general_setting.docs_link", backup.docsLink);
  await setOption(session, "HeaderNavModules", backup.headerNavModules);
  await setOption(session, "DemoSiteEnabled", backup.demoSiteEnabled);
  await setOption(session, "HomePageContent", backup.homePageContent);
}

export async function prepareDefaultDocsState(session: RootSession) {
  await setOption(session, "general_setting.docs_link", "");
  await setOption(session, "HeaderNavModules", "");
}

export async function prepareDefaultHomeState(session: RootSession) {
  await setOption(session, "DemoSiteEnabled", "false");
  await setOption(session, "HomePageContent", "");
}

export async function loginInBrowser(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("i18nextLng", "zh-CN");
  });

  const res = await page.request.post("/api/user/login", {
    data: { username: ROOT_USER, password: ROOT_PASS },
  });
  expect(res.ok(), `browser login failed: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  expect(body.success, body.message).toBeTruthy();
  expect(
    body.data?.role,
    "browser E2E user must be root",
  ).toBeGreaterThanOrEqual(100);

  await page.addInitScript((user) => {
    localStorage.setItem("user", JSON.stringify(user));
  }, body.data);
}

export async function getPublicDocsList(
  api: APIRequestContext,
): Promise<DocMeta[]> {
  const res = await api.get("/api/docs/list");
  expect(res.ok(), `GET /api/docs/list failed: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  expect(body.success, body.message).toBeTruthy();
  expect(Array.isArray(body.data)).toBeTruthy();
  return body.data;
}

export async function waitForHomePageContent(page: Page) {
  await page.waitForResponse((res) =>
    res.url().includes("/api/home_page_content"),
  );
}

export async function waitForStatus(page: Page) {
  await page.waitForResponse((res) => res.url().endsWith("/api/status"));
}

export async function computed(locator: Locator, prop: string) {
  return locator.evaluate((el, property) => {
    return window.getComputedStyle(el).getPropertyValue(property);
  }, prop);
}

export function expectNonTransparentColor(value: string) {
  expect(value.trim()).not.toMatch(/^(transparent|rgba?\(0,\s*0,\s*0,\s*0\))$/);
}

export async function headerDocsLink(page: Page) {
  return page.locator("header nav a", { hasText: "文档" }).first();
}

export async function homeDocsButton(page: Page) {
  return page.getByRole("button", { name: "文档" }).first();
}
