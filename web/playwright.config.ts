import Module from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const webNodeModules = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'node_modules',
);
process.env.NODE_PATH = [webNodeModules, process.env.NODE_PATH]
  .filter(Boolean)
  .join(path.delimiter);
(Module as unknown as { _initPaths: () => void })._initPaths();

const baseURL = process.env.NEW_API_BASE_URL || 'http://127.0.0.1:9992';

export default defineConfig({
  testDir: '../scripts/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    [
      'html',
      { open: 'never', outputFolder: '../test-results/playwright-report' },
    ],
  ],
  outputDir: '../test-results/playwright',
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
