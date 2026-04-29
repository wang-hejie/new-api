import { expect, test, type Page } from "@playwright/test";
import {
  backupDocsState,
  defaultHeaderNavModules,
  disabledDocsHeaderNavModules,
  disposeRootSession,
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
});

test.afterAll(async () => {
  if (session) {
    await restoreDocsState(session, backup);
    await disposeRootSession(session);
  }
});

async function gotoAndWaitForStatus(page: Page, path: string) {
  const status = page.waitForResponse((res) =>
    res.url().endsWith("/api/status"),
  );
  await page.goto(path);
  await status;
}

test("HeaderNavModules.docs hides only the header link, not the docs route", async ({
  page,
}) => {
  expect(session, "root session must be initialized").toBeTruthy();

  await setOption(
    session!,
    "HeaderNavModules",
    JSON.stringify(disabledDocsHeaderNavModules),
  );
  await gotoAndWaitForStatus(page, "/");
  await expect(
    page.locator("header nav").getByText("文档", { exact: true }),
  ).toHaveCount(0);

  await page.goto("/docs");
  await page.waitForURL("**/docs/gpt-image-2");
  await expect(
    page.getByRole("heading", { name: "gpt-image-2 使用指南" }).first(),
  ).toBeVisible();

  await setOption(
    session!,
    "HeaderNavModules",
    JSON.stringify(defaultHeaderNavModules),
  );
  await gotoAndWaitForStatus(page, "/");
  await expect(
    page.locator("header nav").getByText("文档", { exact: true }),
  ).toBeVisible();
});
