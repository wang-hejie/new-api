import { test, expect } from '@playwright/test';
import { cleanupFixtures, prepareFixtures } from './fixtures';
import { openPlayground, radioCard } from './helpers';

test('explore playground selectors for gpt-image-2', async ({ page }) => {
  const state = await prepareFixtures();
  try {
    await openPlayground(page, state.user, {
      model: 'gpt-image-2',
      imageRequestMode: 'generation',
    });
    await expect(page.getByText('请求方式')).toBeVisible();
    await expect(radioCard(page, '文生图')).toBeVisible();
    await expect(radioCard(page, '图生图')).toBeVisible();
    await expect(page.getByText('返回格式')).toHaveCount(0);
    await expect(page.getByText('参考用途')).toHaveCount(0);
    await page.screenshot({
      path: '../test-results/playwright/gpt-image-2-explore.png',
      fullPage: true,
    });
  } finally {
    await cleanupFixtures(
      state.user,
      state.originalModelPrice,
      state.originalPassThroughRequestEnabled,
      state.originalPassThroughRequestEnabledExists,
    );
  }
});
