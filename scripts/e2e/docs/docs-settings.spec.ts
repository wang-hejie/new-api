import { expect, test } from "@playwright/test";
import {
  backupDocsState,
  disposeRootSession,
  headerDocsLink,
  loginInBrowser,
  loginRoot,
  restoreDocsState,
  setOption,
  type DocsBackup,
  type RootSession,
} from "./fixtures";

let session: RootSession | undefined;
let backup: DocsBackup | undefined;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  session = await loginRoot();
  backup = await backupDocsState(session);
  await setOption(session, "general_setting.docs_link", "");
  await setOption(session, "HeaderNavModules", "");
});

test.afterAll(async () => {
  if (session) {
    await restoreDocsState(session, backup);
    await disposeRootSession(session);
  }
});

test("saving docs_link refreshes status and updates the header without remounting", async ({
  page,
}) => {
  await loginInBrowser(page);
  await page.goto("/console/setting?tab=operation");

  await expect(page.getByText("通用设置").first()).toBeVisible();
  const input = page.getByPlaceholder(
    "留空使用内置文档；外链如 https://docs.newapi.pro",
  );
  await expect(input).toBeVisible();

  await input.fill("https://docs.newapi.pro");

  const externalOptionResp = page.waitForResponse(
    (res) =>
      res.url().includes("/api/option/") && res.request().method() === "PUT",
  );
  const externalStatusResp = page.waitForResponse((res) =>
    res.url().endsWith("/api/status"),
  );
  await page.getByRole("button", { name: "保存通用设置" }).click();

  expect((await (await externalOptionResp).json()).success).toBeTruthy();
  const externalStatusBody = await (await externalStatusResp).json();
  expect(externalStatusBody.success, externalStatusBody.message).toBeTruthy();
  expect(externalStatusBody.data.docs_link).toBe("https://docs.newapi.pro");

  const externalHeaderLink = await headerDocsLink(page);
  await expect(externalHeaderLink).toBeVisible();
  await expect(externalHeaderLink).toHaveAttribute("target", "_blank");
  await expect(externalHeaderLink).toHaveAttribute(
    "href",
    "https://docs.newapi.pro",
  );
  expect(new URL(page.url()).pathname).toBe("/console/setting");

  await input.fill("");

  const internalOptionResp = page.waitForResponse(
    (res) =>
      res.url().includes("/api/option/") && res.request().method() === "PUT",
  );
  const internalStatusResp = page.waitForResponse((res) =>
    res.url().endsWith("/api/status"),
  );
  await page.getByRole("button", { name: "保存通用设置" }).click();

  expect((await (await internalOptionResp).json()).success).toBeTruthy();
  const internalStatusBody = await (await internalStatusResp).json();
  expect(internalStatusBody.success, internalStatusBody.message).toBeTruthy();
  expect(internalStatusBody.data.docs_link).toBe("");

  const internalHeaderLink = await headerDocsLink(page);
  await expect(internalHeaderLink).toBeVisible();
  await expect(internalHeaderLink).not.toHaveAttribute("target", "_blank");

  await Promise.all([
    page.waitForURL((url) => url.pathname.startsWith("/docs")),
    internalHeaderLink.click(),
  ]);
  expect(new URL(page.url()).pathname).toMatch(/^\/docs/);
});
