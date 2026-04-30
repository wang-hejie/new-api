import { expect, test } from "@playwright/test";
import {
  backupDocsState,
  computed,
  disposeRootSession,
  loginRoot,
  prepareDefaultDocsState,
  restoreDocsState,
  type DocsBackup,
  type RootSession,
} from "../docs/fixtures";

let session: RootSession | undefined;
let backup: DocsBackup | undefined;

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

const compactRgb = (value: string) => value.replace(/\s+/g, "");

test.describe("docs evolink responsive layout and anchors", () => {
  test("1024-1280 viewport hides aside but keeps sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto("/docs/gpt-image-2-generations");
    await expect(
      page.getByRole("heading", { name: "文本生成图像" }).first(),
    ).toBeVisible();

    await expect(page.locator(".docs-sidebar").first()).toBeVisible();
    await expect(page.locator(".docs-aside")).toBeHidden();
    await expect(page.locator(".docs-mobile-topbar")).toBeHidden();
  });

  test("headings get docs-<slug>-<id> ids and anchor navigation works", async ({
    page,
  }) => {
    await page.goto("/docs/gpt-image-2-generations");

    const headingName = /POST\s+\/v1\/images\/generations/;
    const h2 = page
      .locator(".docs-markdown h2")
      .filter({ hasText: headingName });
    await expect(h2.first()).toBeVisible();

    const id = await h2.first().getAttribute("id");
    expect(id).toBeTruthy();
    expect(id!).toMatch(/^docs-gpt-image-2-generations-/);

    await page.evaluate((headingId) => {
      window.location.hash = headingId;
    }, id);
    await page.waitForFunction(
      (headingId) => window.location.hash === `#${headingId}`,
      id,
    );
    await expect(
      page.getByRole("heading", { name: headingName }).first(),
    ).toBeVisible();

    const top = await page
      .locator(`#${id}`)
      .first()
      .evaluate((el) => Math.round(el.getBoundingClientRect().top));
    expect(top).toBeGreaterThan(0);
    expect(top).toBeLessThan(140);
  });

  test("active sidebar link renders the 4px primary indicator", async ({
    page,
  }) => {
    await page.goto("/docs/gpt-image-2-generations");

    const link = page.locator(".docs-sidebar-link.is-active").first();
    await expect(link).toBeVisible();

    const before = await link.evaluate((el) => {
      const style = getComputedStyle(el, "::before");
      return {
        width: style.width,
        background: style.backgroundColor,
      };
    });
    expect(before.width).toBe("4px");
    expect(compactRgb(before.background)).toBe("rgb(30,144,255)");
  });

  test("sidebar and aside stay sticky at header offset when main scrolls", async ({
    page,
  }) => {
    await page.goto("/docs/gpt-image-2-generations");
    await expect(page.locator(".docs-shell")).toBeVisible();

    await page.locator(".docs-main-scroll").evaluate((el) => {
      el.scrollTo(0, 800);
    });

    const sidebarTop = await page
      .locator(".docs-sidebar")
      .first()
      .evaluate((el) => Math.round(el.getBoundingClientRect().top));
    const asideTop = await page
      .locator(".docs-aside")
      .first()
      .evaluate((el) => Math.round(el.getBoundingClientRect().top));

    expect(Math.abs(sidebarTop - 64)).toBeLessThanOrEqual(2);
    expect(Math.abs(asideTop - 64)).toBeLessThanOrEqual(2);
  });

  test("pagination card hovers in docs primary color", async ({ page }) => {
    await page.goto("/docs/gpt-image-2-generations");

    const card = page.locator(".docs-pagination-card").first();
    await expect(card).toBeVisible();
    await card.hover();

    expect(await computed(card, "border-color")).toBe("rgb(30, 144, 255)");
  });
});
