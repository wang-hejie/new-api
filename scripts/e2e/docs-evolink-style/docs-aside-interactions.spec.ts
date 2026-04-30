import { expect, test } from "@playwright/test";
import {
  backupDocsState,
  disposeRootSession,
  loginRoot,
  prepareDefaultDocsState,
  restoreDocsState,
  type DocsBackup,
  type RootSession,
} from "../docs/fixtures";

let session: RootSession | undefined;
let backup: DocsBackup | undefined;

test.use({
  permissions: ["clipboard-read", "clipboard-write"],
});

test.beforeAll(async () => {
  session = await loginRoot();
  backup = await backupDocsState(session);
  await prepareDefaultDocsState(session);
});

test.afterAll(async () => {
  if (session) {
    await restoreDocsState(session, backup);
    await disposeRootSession(session);
  }
});

test.describe("docs evolink aside interactions", () => {
  test("generations request card has two tabs and switches active state", async ({
    page,
  }) => {
    await page.goto("/docs/gpt-image-2-generations");

    const card = page
      .locator(".docs-aside .docs-code-card")
      .filter({ hasText: "请求示例" });
    await expect(card).toBeVisible();

    const tabs = card.locator(".docs-code-card-tab");
    await expect(tabs).toHaveCount(2);

    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "false");
    await expect(card.locator("pre code")).toContainText(
      "POST /v1/images/generations",
    );

    await tabs.nth(1).click();
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "false");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(card.locator("pre code")).toContainText('"prompt":');
  });

  test("copy button writes the active example to clipboard", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/docs/gpt-image-2-generations");

    const card = page
      .locator(".docs-aside .docs-code-card")
      .filter({ hasText: "请求示例" });
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: "复制代码" }).click();
    await expect(
      page.locator(".semi-toast").filter({ hasText: "代码已复制到剪贴板" }),
    ).toBeVisible();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain("POST /v1/images/generations");

    await card.locator(".docs-code-card-tab").nth(1).click();
    await card.getByRole("button", { name: "复制代码" }).click();
    const clipboard2 = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboard2).toContain('"prompt":');
  });

  test("response card without multiple tabs hides the tablist", async ({
    page,
  }) => {
    await page.goto("/docs/gpt-image-2-generations");

    const card = page
      .locator(".docs-aside .docs-code-card")
      .filter({ hasText: "响应示例" });
    await expect(card).toBeVisible();
    await expect(card.locator(".docs-code-card-tabs")).toHaveCount(0);
  });

  test("overview page error responses must not trigger the operation aside", async ({
    page,
  }) => {
    await page.goto("/docs/gpt-image-2");
    await expect(
      page.getByRole("heading", { name: "gpt-image-2 概览" }).first(),
    ).toBeVisible();
    await expect(page.locator(".docs-aside .docs-code-card")).toHaveCount(0);
  });
});
