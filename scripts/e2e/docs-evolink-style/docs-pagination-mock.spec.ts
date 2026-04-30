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

test.describe("docs evolink pagination with mocked categories", () => {
  test("pagination crosses categories using /api/docs/list order", async ({
    page,
  }) => {
    await page.route(/\/api\/docs\/list(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "",
          data: [
            { slug: "alpha-1", title: "Alpha 1", order: 10, category: "Alpha" },
            { slug: "alpha-2", title: "Alpha 2", order: 20, category: "Alpha" },
            {
              slug: "gpt-image-2",
              title: "gpt-image-2 概览",
              order: 10,
              category: "模型指南",
            },
            {
              slug: "gpt-image-2-generations",
              title: "文本生成图像",
              order: 20,
              category: "模型指南",
            },
          ],
        }),
      });
    });

    await page.goto("/docs/gpt-image-2");
    await expect(
      page.getByRole("heading", { name: "gpt-image-2 概览" }).first(),
    ).toBeVisible();

    const cards = page.locator(".docs-pagination-card");
    await expect(cards.nth(0)).toHaveAttribute("data-slug", "alpha-2");
    await expect(cards.nth(0)).toContainText("Alpha");
    await expect(cards.nth(1)).toHaveAttribute(
      "data-slug",
      "gpt-image-2-generations",
    );

    await cards.nth(0).click();
    await page.waitForURL("**/docs/alpha-2");
  });
});
