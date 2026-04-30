// 一次性设计探针：抓取 evolink 文档页的设计 token
// 用法：cd web && bunx playwright install chromium  (若未装)
//      bun run /Users/wanghejie/workspace/new-api/scripts/design-probe/probe-evolink.mjs

import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const URL =
  'https://docs.evolink.ai/en/api-manual/image-series/gpt-image-2/gpt-image-2-image-generation';

const OUT_DIR = '/Users/wanghejie/workspace/new-api/scripts/design-probe/out';

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    colorScheme: 'light',
  });
  const page = await context.newPage();

  console.log('→ 加载页面 (light)...');
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(1500);

  const lightTokens = await extractTokens(page);
  await page.screenshot({
    path: path.join(OUT_DIR, 'light-fullpage.png'),
    fullPage: true,
  });
  await page.screenshot({
    path: path.join(OUT_DIR, 'light-viewport.png'),
    fullPage: false,
  });

  console.log('→ 切换暗色主题...');
  await page.emulateMedia({ colorScheme: 'dark' });
  // Mintlify 通常通过 html.dark 控制暗色，主动尝试切换
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await page.waitForTimeout(800);
  const darkTokens = await extractTokens(page);
  await page.screenshot({
    path: path.join(OUT_DIR, 'dark-fullpage.png'),
    fullPage: true,
  });
  await page.screenshot({
    path: path.join(OUT_DIR, 'dark-viewport.png'),
    fullPage: false,
  });

  const report = {
    url: URL,
    capturedAt: new Date().toISOString(),
    light: lightTokens,
    dark: darkTokens,
  };

  await fs.writeFile(
    path.join(OUT_DIR, 'design-tokens.json'),
    JSON.stringify(report, null, 2),
    'utf8',
  );

  console.log(`✓ 输出目录: ${OUT_DIR}`);
  await browser.close();
}

async function extractTokens(page) {
  return await page.evaluate(() => {
    const result = {};

    // 1) :root 上所有自定义属性
    const rootStyle = getComputedStyle(document.documentElement);
    const cssVars = {};
    for (let i = 0; i < rootStyle.length; i++) {
      const name = rootStyle[i];
      if (name.startsWith('--')) {
        cssVars[name] = rootStyle.getPropertyValue(name).trim();
      }
    }
    result.cssVars = cssVars;
    result.cssVarsCount = Object.keys(cssVars).length;

    // 2) body / html 基础样式
    const pickProps = (el, props) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const out = {};
      for (const p of props) out[p] = cs[p];
      return out;
    };

    const baseProps = [
      'backgroundColor',
      'color',
      'fontFamily',
      'fontSize',
      'lineHeight',
      'fontWeight',
      'letterSpacing',
    ];
    result.html = pickProps(document.documentElement, baseProps);
    result.body = pickProps(document.body, baseProps);

    // 3) 关键语义元素
    const selectorMap = {
      h1: 'h1',
      h2: 'h2',
      h3: 'h3',
      paragraph: 'main p, article p, .prose p',
      link: 'a[href]',
      inlineCode: 'code:not(pre code)',
      preBlock: 'pre',
      preCode: 'pre code',
      table: 'table',
      th: 'th',
      td: 'td',
      sidebar: 'nav[aria-label], aside, [class*="sidebar" i]',
      sidebarLink: 'nav a, aside a',
      header: 'header, [class*="topbar" i], [class*="header" i]',
      button: 'button',
      hr: 'hr',
      blockquote: 'blockquote',
    };

    const detail = {};
    const allProps = [
      'backgroundColor',
      'color',
      'borderColor',
      'borderRadius',
      'borderWidth',
      'borderStyle',
      'fontFamily',
      'fontSize',
      'fontWeight',
      'lineHeight',
      'padding',
      'margin',
      'boxShadow',
      'letterSpacing',
      'textTransform',
    ];

    for (const [key, sel] of Object.entries(selectorMap)) {
      const el = document.querySelector(sel);
      if (!el) {
        detail[key] = { selector: sel, found: false };
        continue;
      }
      const cs = getComputedStyle(el);
      const obj = { selector: sel, found: true, text: (el.textContent || '').slice(0, 40).trim() };
      for (const p of allProps) obj[p] = cs[p];
      detail[key] = obj;
    }
    result.elements = detail;

    // 4) 暗色判定提示
    result.themeHints = {
      htmlClass: document.documentElement.className,
      htmlDataTheme: document.documentElement.getAttribute('data-theme'),
      bodyClass: document.body.className,
    };

    // 5) 字体栈完整列表（去重）
    const fonts = new Set();
    document.querySelectorAll('h1,h2,h3,p,code,pre,a,button,nav,table').forEach((el) => {
      fonts.add(getComputedStyle(el).fontFamily);
    });
    result.fontStacks = [...fonts];

    return result;
  });
}

main().catch((err) => {
  console.error('✗ 探针失败:', err);
  process.exit(1);
});
