import { expect, test } from "@playwright/test";
import {
  backupDocsState,
  computed,
  disposeRootSession,
  expectNonTransparentColor,
  getPublicDocsList,
  loginRoot,
  prepareDefaultDocsState,
  restoreDocsState,
  type DocsBackup,
  type RootSession,
} from "./fixtures";

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

test.describe("docs page integration", () => {
  test("redirects /docs to the first embedded document", async ({ page }) => {
    await page.goto("/docs");
    await page.waitForURL("**/docs/gpt-image-2");
    await expect(
      page.getByRole("heading", { name: "gpt-image-2 使用指南" }).first(),
    ).toBeVisible();
  });

  test("renders desktop nav, markdown content, and computed styles", async ({
    page,
  }) => {
    await page.goto("/docs/gpt-image-2");
    await page.waitForResponse((res) =>
      res.url().includes("/api/docs/content?slug=gpt-image-2"),
    );

    const aside = page.locator("aside").first();
    await expect(aside.getByText("文档中心")).toBeVisible();
    await expect(aside.getByText("模型指南")).toBeVisible();
    await expect(aside.getByText("gpt-image-2 使用指南")).toBeVisible();
    await expect(
      aside
        .locator(
          '[class*="selected"], [aria-current="page"], [aria-selected="true"]',
        )
        .filter({ hasText: "gpt-image-2 使用指南" })
        .first(),
    ).toBeVisible();

    const article = page.locator("article").first();
    await expect(
      article.getByText("模型指南 / gpt-image-2 使用指南"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "gpt-image-2 使用指南" }).first(),
    ).toBeVisible();
    await expect(article.getByText("1. 快速开始")).toBeVisible();
    await expect(article.getByText("Base URL")).toBeVisible();
    await expect(article.locator("table").first()).toBeVisible();
    await expect(article.locator("pre code").first()).toBeVisible();

    expect(
      await page.evaluate(() => localStorage.getItem("docs:gpt-image-2")),
    ).toBeNull();

    expectNonTransparentColor(await computed(aside, "background-color"));
    expectNonTransparentColor(await computed(aside, "border-right-color"));

    const pageSurface = page.locator(".mt-16.bg-semi-color-bg-0").first();
    expectNonTransparentColor(await computed(pageSurface, "background-color"));

    const mainBox = await page.locator("main").first().boundingBox();
    expect(mainBox?.height || 0).toBeGreaterThan(0);

    await page.evaluate(() => document.documentElement.classList.add("dark"));
    expectNonTransparentColor(await computed(aside, "background-color"));
  });

  test("shows an empty state for an unknown slug while keeping the nav", async ({
    page,
  }) => {
    await page.goto("/docs/does-not-exist");

    await expect(page.getByText("文档不存在").first()).toBeVisible();
    await expect(page.locator("aside").getByText("文档中心")).toBeVisible();
  });

  test("switches documents from nav when more than one document exists", async ({
    page,
  }) => {
    const docs = await getPublicDocsList(page.request);
    test.skip(docs.length < 2, "需要至少两篇内置文档");

    const target = docs.find((doc) => doc.slug !== "gpt-image-2") || docs[1];
    let contentRequests = 0;
    page.on("request", (req) => {
      if (req.url().includes("/api/docs/content")) contentRequests += 1;
    });

    await page.goto("/docs/gpt-image-2");
    await expect(
      page.getByRole("heading", { name: "gpt-image-2 使用指南" }).first(),
    ).toBeVisible();
    await page.locator("aside").getByText(target.title).click();
    await page.waitForURL(`**/docs/${target.slug}`);
    await expect(
      page.getByRole("heading", { name: target.title }).first(),
    ).toBeVisible();
    expect(contentRequests).toBeGreaterThanOrEqual(2);
    expect(
      await page.evaluate(
        (slug) => localStorage.getItem(`docs:${slug}`),
        target.slug,
      ),
    ).toBeNull();
  });

  test("opens and closes the mobile document SideSheet", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/docs");
    await page.waitForURL("**/docs/gpt-image-2");

    await expect(page.locator("aside")).toHaveCount(0);
    await page.getByLabel("返回文档列表").click();

    const sideSheet = page.locator(".semi-sidesheet").first();
    await expect(sideSheet).toBeVisible();
    await expect(sideSheet.getByText("文档中心")).toBeVisible();
    await sideSheet.getByText("gpt-image-2 使用指南").click();
    await expect(sideSheet).toBeHidden();
  });

  test("renders the docs shell in English without raw i18n keys", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("i18nextLng", "en");
    });

    await page.goto("/docs/gpt-image-2");
    await expect(
      page.locator("aside").getByText("Documentation Center"),
    ).toBeVisible();
    await expect(page.locator("aside").getByText("文档中心")).toHaveCount(0);
  });

  test("shows skeletons while the docs list is loading", async ({ page }) => {
    await page.route("**/api/docs/list", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });

    await page.goto("/docs/gpt-image-2", { waitUntil: "domcontentloaded" });
    await expect(
      page
        .locator(
          ".semi-skeleton-paragraph li, .semi-skeleton-title, .semi-skeleton-active",
        )
        .first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "gpt-image-2 使用指南" }).first(),
    ).toBeVisible();
  });
});
