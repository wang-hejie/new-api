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

test.describe("docs evolink typography and dark theme", () => {
  test("dark mode applies the full --docs-text-* palette and hljs token swap", async ({
    page,
  }) => {
    await page.goto("/docs/gpt-image-2-generations");
    await expect(page.locator(".docs-shell")).toBeVisible();

    const stringToken = page.locator(".docs-markdown .hljs-string").first();
    const numberToken = page.locator(".docs-markdown .hljs-number").first();
    await expect(stringToken).toBeVisible();
    await expect(numberToken).toBeVisible();

    const lightString = await computed(stringToken, "color");
    const lightNumber = await computed(numberToken, "color");

    await page.evaluate(() => document.documentElement.classList.add("dark"));

    const tokens = await page.locator(".docs-shell").evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        text0: style.getPropertyValue("--docs-text-0").trim().toLowerCase(),
        text1: style.getPropertyValue("--docs-text-1").trim().toLowerCase(),
        text2: style.getPropertyValue("--docs-text-2").trim().toLowerCase(),
      };
    });
    expect(tokens.text0).toBe("#e6edf3");
    expect(tokens.text1).toBe("#b1bac4");
    expect(tokens.text2).toBe("#8b949e");

    const pColor = await computed(
      page.locator(".docs-markdown p").first(),
      "color",
    );
    expect(compactRgb(pColor)).toBe("rgb(177,186,196)");

    const darkString = await computed(stringToken, "color");
    const darkNumber = await computed(numberToken, "color");
    expect(compactRgb(darkString)).toBe("rgb(165,214,255)");
    expect(compactRgb(darkNumber)).toBe("rgb(121,192,255)");
    expect(darkString).not.toBe(lightString);
    expect(darkNumber).not.toBe(lightNumber);

    const cardBg = await computed(
      page.locator(".docs-aside .docs-code-card-pre").first(),
      "background-color",
    );
    expect(cardBg.trim()).not.toMatch(
      /^(transparent|rgba?\(0,\s*0,\s*0,\s*0\))$/,
    );
  });

  test("typography rhythm: h2 has top-margin 48 and h3 has top-margin 32", async ({
    page,
  }) => {
    await page.goto("/docs/gpt-image-2-generations");

    const h2 = page.locator(".docs-markdown h2").first();
    const h3 = page.locator(".docs-markdown h3").first();
    await expect(h2).toBeVisible();
    await expect(h3).toBeVisible();

    expect(await computed(h2, "margin-top")).toBe("48px");
    expect(await computed(h2, "margin-bottom")).toBe("16px");
    expect(await computed(h3, "margin-top")).toBe("32px");
    expect(await computed(h3, "margin-bottom")).toBe("12px");
  });

  test("inline code uses Mintlify radius/padding and JetBrains Mono", async ({
    page,
  }) => {
    await page.goto("/docs/gpt-image-2-generations");

    const code = page.locator(".docs-markdown :not(pre) > code").first();
    await expect(code).toBeVisible();

    expect(await computed(code, "border-radius")).toBe("6px");
    expect(await computed(code, "padding")).toBe("2px 8px");
    expect(await computed(code, "font-family")).toContain("JetBrains Mono");
  });
});
