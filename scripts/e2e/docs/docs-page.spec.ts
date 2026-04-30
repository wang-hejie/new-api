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
    await page.goto("/docs", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "gpt-image-2 概览" }).first(),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/docs/gpt-image-2");
  });

  test("renders desktop nav, markdown content, and computed styles", async ({
    page,
  }) => {
    await page.goto("/docs/gpt-image-2");
    await page.waitForResponse((res) =>
      res.url().includes("/api/docs/content?slug=gpt-image-2"),
    );

    const shell = page.locator(".docs-shell").first();
    const sidebar = page.locator(".docs-sidebar").first();
    await expect(sidebar.getByText("文档中心")).toBeVisible();
    await expect(sidebar.getByText("模型指南")).toBeVisible();
    await expect(sidebar.getByText("gpt-image-2 概览")).toBeVisible();
    await expect(
      sidebar
        .locator('[aria-current="page"], .docs-sidebar-link.is-active')
        .filter({ hasText: "gpt-image-2 概览" })
        .first(),
    ).toBeVisible();

    const article = page.locator("article").first();
    await expect(
      article.getByText("模型指南 / gpt-image-2 概览"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "gpt-image-2 概览" }).first(),
    ).toBeVisible();
    await expect(
      article.getByRole("heading", { name: "API Reference" }),
    ).toBeVisible();
    await expect(
      article.getByRole("heading", { name: "Base URL" }),
    ).toBeVisible();
    await expect(sidebar.getByText("文本生成图像")).toBeVisible();
    await expect(sidebar.getByText("参考图编辑")).toBeVisible();
    await expect(sidebar.getByText("集成示例")).toBeVisible();
    await expect(article.locator("table").first()).toBeVisible();
    await expect(article.locator("pre code").first()).toBeVisible();
    await expect(page.locator(".docs-toc")).toHaveCount(0);

    expect(
      await page.evaluate(() => localStorage.getItem("docs:gpt-image-2")),
    ).toBeNull();

    expectNonTransparentColor(await computed(sidebar, "background-color"));
    expectNonTransparentColor(await computed(sidebar, "border-right-color"));
    expectNonTransparentColor(await computed(shell, "background-color"));

    const mainBox = await page.locator("main").first().boundingBox();
    expect(mainBox?.height || 0).toBeGreaterThan(0);

    await page.evaluate(() => document.documentElement.classList.add("dark"));
    expectNonTransparentColor(await computed(sidebar, "background-color"));
  });

  test("shows an empty state for an unknown slug while keeping the nav", async ({
    page,
  }) => {
    await page.goto("/docs/does-not-exist");

    await expect(page.getByText("文档不存在").first()).toBeVisible();
    await expect(page.locator(".docs-sidebar").getByText("文档中心")).toBeVisible();
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
      page.getByRole("heading", { name: "gpt-image-2 概览" }).first(),
    ).toBeVisible();
    await page.locator(".docs-sidebar").getByText(target.title).click();
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

  test("renders operation-first pages with request and response examples", async ({
    page,
  }) => {
    await page.goto("/docs/gpt-image-2-generations");
    await page.waitForResponse((res) =>
      res.url().includes("/api/docs/content?slug=gpt-image-2-generations"),
    );

    const article = page.locator("article").first();
    await expect(
      page.getByRole("heading", { name: "文本生成图像" }).first(),
    ).toBeVisible();
    await expect(
      article.getByRole("heading", { name: "Authorizations" }),
    ).toBeVisible();
    await expect(
      article.getByRole("heading", { name: "POST /v1/images/generations" }),
    ).toBeVisible();
    await expect(
      article.getByRole("heading", { name: "Body application/json" }),
    ).toBeVisible();
    await expect(
      article.getByRole("heading", { name: "Response 200 application/json" }),
    ).toBeVisible();
    await expect(
      article
        .locator("pre code")
        .filter({ hasText: "POST /v1/images/generations" }),
    ).toBeVisible();
    await expect(
      article.locator("pre code").filter({ hasText: '"created": 1777407264' }),
    ).toBeVisible();
    await expect(
      page
        .locator(".docs-aside .docs-code-card")
        .filter({ hasText: "请求示例" })
        .filter({ hasText: "/v1/images/generations" }),
    ).toBeVisible();
    await expect(
      page
        .locator(".docs-aside .docs-code-card")
        .filter({ hasText: "响应示例" })
        .filter({ hasText: '"created": 1777407264' }),
    ).toBeVisible();
    await expect(page.locator(".docs-toc")).toHaveCount(0);
  });

  test("opens and closes the mobile document SideSheet", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/docs");
    await expect(
      page.getByRole("heading", { name: "gpt-image-2 概览" }).first(),
    ).toBeVisible();

    await expect(page.locator(".docs-aside")).toBeHidden();
    await expect(page.locator(".docs-sidebar").first()).toBeHidden();
    await page.getByLabel("返回文档列表").click();

    const sideSheet = page.locator(".semi-sidesheet").first();
    await expect(sideSheet).toBeVisible();
    await expect(sideSheet.getByText("文档中心")).toBeVisible();
    await sideSheet.getByRole("button", { name: "gpt-image-2 概览" }).click();
    await expect(sideSheet).toBeHidden();
  });

  test("renders the docs shell in English without raw i18n keys", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("i18nextLng", "en");
      localStorage.setItem(
        "user",
        JSON.stringify({ id: -1, role: 100, setting: '{"language":"en"}' }),
      );
    });

    await page.goto("/docs/gpt-image-2");
    await expect(
      page.locator(".docs-sidebar").getByText("Documentation Center"),
    ).toBeVisible();
    await expect(page.locator(".docs-sidebar").getByText("文档中心")).toHaveCount(0);
  });

  test("shows skeletons while the docs list is loading", async ({ page }) => {
    await page.route(/\/api\/docs\/list(?:\?.*)?$/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "",
          data: [
            {
              slug: "gpt-image-2",
              title: "gpt-image-2 概览",
              order: 10,
              category: "模型指南",
            },
          ],
        }),
      });
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
      page.getByRole("heading", { name: "gpt-image-2 概览" }).first(),
    ).toBeVisible();
  });
});
