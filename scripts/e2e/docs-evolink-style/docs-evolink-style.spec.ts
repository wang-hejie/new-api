import { expect, test } from "@playwright/test";
import {
  backupDocsState,
  computed,
  disposeRootSession,
  getPublicDocsList,
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

test.describe("docs evolink style", () => {
  test("scopes Mintlify-style tokens to docs shell", async ({ page }) => {
    await page.goto("/docs/gpt-image-2-generations");
    await expect(page.locator(".docs-shell")).toBeVisible();

    const rootPrimaryBefore = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue(
        "--semi-color-primary",
      ),
    );

    await expect(
      page.locator(".docs-shell .docs-markdown p").first(),
    ).toBeVisible();
    const paragraphFont = await computed(
      page.locator(".docs-shell .docs-markdown p").first(),
      "font-family",
    );
    expect(paragraphFont).toContain("Inter");

    const docsPrimary = await page.locator(".docs-shell").evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--docs-primary").trim().toLowerCase(),
    );
    expect(docsPrimary).toBe("#1e90ff");

    const rootTokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        semiPrimary: style.getPropertyValue("--semi-color-primary"),
        docsPrimary: style.getPropertyValue("--docs-primary"),
      };
    });
    expect(rootTokens.semiPrimary).toBe(rootPrimaryBefore);
    expect(rootTokens.docsPrimary.trim()).toBe("");
  });

  test("renders desktop three-column layout and operation code examples", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/docs/gpt-image-2-generations");
    await expect(
      page.getByRole("heading", { name: "文本生成图像" }).first(),
    ).toBeVisible();

    const sidebar = page.locator(".docs-sidebar").first();
    const aside = page.locator(".docs-aside").first();
    await expect(sidebar).toBeVisible();
    await expect(aside).toBeVisible();
    await expect(page.locator(".docs-toc")).toHaveCount(0);

    const sidebarBox = await sidebar.boundingBox();
    const asideBox = await aside.boundingBox();
    expect(Math.round(sidebarBox?.width || 0)).toBe(288);
    expect(asideBox?.width || 0).toBeGreaterThanOrEqual(400);
    expect(asideBox?.width || 0).toBeLessThanOrEqual(448);

    const requestCard = aside
      .locator(".docs-code-card")
      .filter({ hasText: "请求示例" })
      .filter({ hasText: "/v1/images/generations" });
    const responseCard = aside
      .locator(".docs-code-card")
      .filter({ hasText: "响应示例" })
      .filter({ hasText: '"created": 1777407264' });

    await expect(requestCard).toBeVisible();
    await expect(responseCard).toBeVisible();
    expect(await computed(requestCard.first(), "border-radius")).toBe("16px");

    await page.goto("/docs/gpt-image-2-edits");
    await expect(
      page
        .locator(".docs-aside .docs-code-card")
        .filter({ hasText: "请求示例" })
        .filter({ hasText: "/v1/images/edits" }),
    ).toBeVisible();

    await page.goto("/docs/gpt-image-2-examples");
    await expect(
      page.locator(".docs-aside .docs-code-card").filter({ hasText: "SDK" }),
    ).toHaveCount(0);

    await page.goto("/docs/gpt-image-2");
    await expect(page.locator(".docs-aside .docs-code-card")).toHaveCount(0);
  });

  test("matches docs typography tokens and single h1 strategy", async ({
    page,
  }) => {
    await page.goto("/docs/gpt-image-2-generations");
    await expect(
      page.getByRole("heading", { name: "文本生成图像" }).first(),
    ).toBeVisible();

    const h1 = page.locator(".docs-markdown h1").first();
    const h2 = page.locator(".docs-markdown h2").first();
    const paragraph = page.locator(".docs-markdown p").first();
    const inlineCode = page.locator(".docs-markdown :not(pre) > code").first();
    const th = page.locator(".docs-markdown th").first();
    const td = page.locator(".docs-markdown td").first();

    expect(await computed(h1, "font-size")).toBe("30px");
    expect(await computed(h1, "line-height")).toBe("36px");
    expect(await computed(h2, "font-size")).toBe("24px");
    expect(await computed(h2, "letter-spacing")).toBe("-0.6px");
    expect(await computed(paragraph, "font-size")).toBe("16px");
    expect(await computed(inlineCode, "font-size")).toBe("12px");
    expect(await computed(th, "padding")).toBe("8px 16px");
    expect(await computed(td, "padding")).toBe("8px 16px");

    await expect(page.locator("article h1")).toHaveCount(1);
  });

  test("keeps dark background on Semi token while preserving type rhythm", async ({
    page,
  }) => {
    await page.goto("/docs/gpt-image-2-generations");
    await expect(page.locator(".docs-shell")).toBeVisible();

    await page.evaluate(() => document.documentElement.classList.add("dark"));
    const expectedBg = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.backgroundColor = "var(--semi-color-bg-0)";
      document.body.appendChild(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    });

    expect(await computed(page.locator(".docs-shell").first(), "background-color")).toBe(
      expectedBg,
    );
    expect(await computed(page.locator(".docs-markdown h2").first(), "letter-spacing")).toBe(
      "-0.6px",
    );
  });

  test("uses responsive mobile layout", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/docs/gpt-image-2-generations");
    await expect(
      page.getByRole("heading", { name: "文本生成图像" }).first(),
    ).toBeVisible();

    await expect(page.locator(".docs-aside")).toBeHidden();
    await expect(page.locator(".docs-sidebar").first()).toBeHidden();
    await expect(page.locator(".docs-mobile-topbar")).toBeVisible();
  });

  test("pagination follows /api/docs/list order", async ({ page }) => {
    const docs = await getPublicDocsList(page.request);
    const index = docs.findIndex((doc) => doc.slug === "gpt-image-2-generations");
    expect(index).toBeGreaterThan(0);

    await page.goto("/docs/gpt-image-2-generations");
    await expect(
      page.getByRole("heading", { name: "文本生成图像" }).first(),
    ).toBeVisible();

    const cards = page.locator(".docs-pagination-card");
    await expect(cards.first()).toHaveAttribute("data-slug", docs[index - 1].slug);
    await expect(cards.nth(1)).toHaveAttribute("data-slug", docs[index + 1].slug);
  });
});
