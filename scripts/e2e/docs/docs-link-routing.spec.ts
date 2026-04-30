import { expect, test, type Page } from "@playwright/test";
import {
  BASE_URL,
  backupDocsState,
  disposeRootSession,
  headerDocsLink,
  homeDocsButton,
  loginRoot,
  prepareDefaultHomeState,
  restoreDocsState,
  setOption,
  type DocsBackup,
  type RootSession,
} from "./fixtures";

declare global {
  interface Window {
    __docsE2EOpenedUrls: Array<{ url: string; target: string }>;
  }
}

type RoutingScenario =
  | {
      name: string;
      docsLink: string;
      kind: "internal";
      expectedPath: RegExp;
    }
  | {
      name: string;
      docsLink: string;
      kind: "external";
      expectedHref: string;
      expectedOpenedUrl: string;
    };

const sameOriginDocsUrl = `${BASE_URL}/docs`;

const scenarios: RoutingScenario[] = [
  {
    name: "blank docs_link uses built-in docs",
    docsLink: "",
    kind: "internal",
    expectedPath: /^\/docs(\/gpt-image-2)?$/,
  },
  {
    name: "relative docs slug stays internal",
    docsLink: "/docs/gpt-image-2",
    kind: "internal",
    expectedPath: /^\/docs\/gpt-image-2$/,
  },
  {
    name: "relative docs slug with query and hash stays internal",
    docsLink: "/docs/gpt-image-2?tab=usage#examples",
    kind: "internal",
    expectedPath: /^\/docs\/gpt-image-2\?tab=usage#examples$/,
  },
  {
    name: "same-origin docs URL stays internal",
    docsLink: sameOriginDocsUrl,
    kind: "internal",
    expectedPath: /^\/docs(\/gpt-image-2)?$/,
  },
  {
    name: "external docs URL opens externally",
    docsLink: "https://docs.newapi.pro",
    kind: "external",
    expectedHref: "https://docs.newapi.pro",
    expectedOpenedUrl: "https://docs.newapi.pro",
  },
  {
    name: "non-doc same-origin path is external",
    docsLink: "/console/docs",
    kind: "external",
    expectedHref: "/console/docs",
    expectedOpenedUrl: "/console/docs",
  },
];

let session: RootSession | undefined;
let backup: DocsBackup | undefined;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  session = await loginRoot();
  backup = await backupDocsState(session);
});

test.afterAll(async () => {
  if (session) {
    await restoreDocsState(session, backup);
    await disposeRootSession(session);
  }
});

async function prepareRoutingState(docsLink: string) {
  expect(session, "root session must be initialized").toBeTruthy();
  await setOption(session!, "general_setting.docs_link", docsLink);
  await setOption(session!, "HeaderNavModules", "");
  await prepareDefaultHomeState(session!);
}

async function gotoHome(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(await headerDocsLink(page)).toBeVisible();
}

async function assertInternalUrl(page: Page, expectedPath: RegExp) {
  const url = new URL(page.url());
  const actual = `${url.pathname}${url.search}${url.hash}`;
  expect(actual).toMatch(expectedPath);
}

for (const scenario of scenarios) {
  test(`header routing: ${scenario.name}`, async ({ page }) => {
    await prepareRoutingState(scenario.docsLink);
    await gotoHome(page);

    const link = await headerDocsLink(page);
    await expect(link).toBeVisible();

    if (scenario.kind === "external") {
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("href", scenario.expectedHref);
      return;
    }

    await expect(link).not.toHaveAttribute("target", "_blank");
    await Promise.all([
      page.waitForURL((url) => url.pathname.startsWith("/docs")),
      link.click(),
    ]);
    await assertInternalUrl(page, scenario.expectedPath);
  });

  test(`home routing: ${scenario.name}`, async ({ page }) => {
    await prepareRoutingState(scenario.docsLink);
    await gotoHome(page);

    const button = await homeDocsButton(page);
    await expect(button).toBeVisible();

    if (scenario.kind === "external") {
      await page.evaluate(() => {
        window.__docsE2EOpenedUrls = [];
        window.open = (url, target) => {
          window.__docsE2EOpenedUrls.push({
            url: String(url ?? ""),
            target: String(target ?? ""),
          });
          return null;
        };
      });

      await button.click();
      const opened = await page.evaluate(() => window.__docsE2EOpenedUrls[0]);
      expect(opened).toEqual({
        url: scenario.expectedOpenedUrl,
        target: "_blank",
      });
      return;
    }

    await Promise.all([
      page.waitForURL((url) => url.pathname.startsWith("/docs")),
      button.click(),
    ]);
    await assertInternalUrl(page, scenario.expectedPath);
  });
}
