import { expect, test } from "@playwright/test";
import {
  backupDocsState,
  computed,
  disposeRootSession,
  loginInBrowser,
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

test.describe("docs evolink style isolation", () => {
  test("six self-hosted woff2 fonts load with HTTP 200 and font/woff2", async ({
    page,
  }) => {
    const fontUrls = [
      "/fonts/Inter-Regular.woff2",
      "/fonts/Inter-Medium.woff2",
      "/fonts/Inter-SemiBold.woff2",
      "/fonts/Inter-Bold.woff2",
      "/fonts/JetBrainsMono-Regular.woff2",
      "/fonts/JetBrainsMono-Medium.woff2",
    ];
    const seen = new Map<string, { status: number; type: string }>();

    page.on("response", (resp) => {
      const url = resp.url();
      const match = fontUrls.find((fontUrl) => url.endsWith(fontUrl));
      if (!match) return;

      seen.set(match, {
        status: resp.status(),
        type: resp.headers()["content-type"] || "",
      });
    });

    await page.goto("/docs/gpt-image-2-generations");
    await expect(page.locator(".docs-shell")).toBeVisible();

    await page.evaluate(async () => {
      const families = ["Inter", "JetBrains Mono"];
      const weights = ["400", "500", "600", "700"];
      const probes = "AaBbCc0123456789";

      for (const family of families) {
        for (const weight of weights) {
          try {
            await document.fonts.load(`${weight} 16px '${family}'`, probes);
          } catch {
            // Browser font loading can reject unsupported weights; response
            // capture below verifies the concrete files.
          }
        }
      }
      await document.fonts.ready;
    });

    for (const url of fontUrls) {
      const hit = seen.get(url);
      expect(hit, `${url} 必须被请求`).toBeTruthy();
      expect(hit!.status, `${url} 必须 200`).toBe(200);
      expect(hit!.type.toLowerCase(), `${url} content-type`).toContain(
        "font/woff2",
      );
    }

    const cjkFamily = await page
      .locator(".docs-shell .docs-markdown h1")
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(cjkFamily).toContain("Inter");
    expect(cjkFamily).toMatch(/system-ui|sans-serif|-apple-system/);
  });

  test("navigating from /docs to /console does not contaminate global font/colors", async ({
    page,
  }) => {
    await loginInBrowser(page);

    await page.goto("/console/token");
    await expect(
      page.locator("header.semi-layout-header").first(),
    ).toBeVisible();
    const primaryButton = page
      .getByRole("button", { name: "添加令牌" })
      .first();
    await expect(primaryButton).toBeVisible();

    const baseline = await page.evaluate(() => ({
      bodyFont: getComputedStyle(document.body).fontFamily,
      rootFont: getComputedStyle(document.documentElement).fontFamily,
      semiPrimary: getComputedStyle(document.documentElement)
        .getPropertyValue("--semi-color-primary")
        .trim(),
    }));
    const baselinePrimaryButton = {
      backgroundColor: await computed(primaryButton, "background-color"),
      color: await computed(primaryButton, "color"),
      fontFamily: await computed(primaryButton, "font-family"),
    };

    await page.goto("/docs/gpt-image-2-generations");
    await expect(page.locator(".docs-shell .docs-markdown")).toBeVisible();
    expect(
      await computed(
        page.locator(".docs-shell .docs-markdown p").first(),
        "font-family",
      ),
    ).toContain("Inter");

    await page.goto("/console/token");
    await expect(
      page.locator("header.semi-layout-header").first(),
    ).toBeVisible();
    const primaryButtonAfter = page
      .getByRole("button", { name: "添加令牌" })
      .first();
    await expect(primaryButtonAfter).toBeVisible();

    const after = await page.evaluate(() => ({
      bodyFont: getComputedStyle(document.body).fontFamily,
      rootFont: getComputedStyle(document.documentElement).fontFamily,
      semiPrimary: getComputedStyle(document.documentElement)
        .getPropertyValue("--semi-color-primary")
        .trim(),
      docsPrimaryOnRoot: getComputedStyle(document.documentElement)
        .getPropertyValue("--docs-primary")
        .trim(),
    }));
    const afterPrimaryButton = {
      backgroundColor: await computed(primaryButtonAfter, "background-color"),
      color: await computed(primaryButtonAfter, "color"),
      fontFamily: await computed(primaryButtonAfter, "font-family"),
    };

    expect(after.bodyFont).toBe(baseline.bodyFont);
    expect(after.rootFont).toBe(baseline.rootFont);
    expect(after.semiPrimary).toBe(baseline.semiPrimary);
    expect(after.docsPrimaryOnRoot).toBe("");
    expect(afterPrimaryButton).toEqual(baselinePrimaryButton);
    expect(after.bodyFont.toLowerCase()).not.toContain("inter");
  });
});
