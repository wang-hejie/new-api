import { defineConfig, devices } from '@playwright/test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const webNodeModules = new URL('./node_modules', import.meta.url).pathname;
process.env.NODE_PATH = process.env.NODE_PATH
  ? `${webNodeModules}:${process.env.NODE_PATH}`
  : webNodeModules;
require('module').Module._initPaths();

const baseURL = process.env.NEW_API_BASE_URL || 'http://127.0.0.1:9991';

export default defineConfig({
  testDir: '../scripts/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 180_000,
  expect: {
    timeout: 10_000,
  },
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
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
