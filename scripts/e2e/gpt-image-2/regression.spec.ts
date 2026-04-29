import { test, expect } from '@playwright/test';
import {
  cleanupFixtures,
  prepareFixtures,
  type E2EFixtureState,
} from './fixtures';
import { assistantImages, expectImageLoaded, fillPrompt, openPlayground } from './helpers';

test.describe.serial('playground regression coverage', () => {
  let state: E2EFixtureState;

  test.beforeAll(async () => {
    state = await prepareFixtures();
  });

  test.afterAll(async () => {
    await cleanupFixtures(state?.user, state?.originalModelPrice);
  });

  test('gpt-4o still uses chat completions', async ({ page }) => {
    await openPlayground(page, state.user, { model: 'gpt-4o' });
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/pg/chat/completions') &&
        response.request().method() === 'POST',
    );
    await fillPrompt(page, 'hello chat');
    await page.keyboard.press('Enter');
    expect((await responsePromise).ok()).toBe(true);
    await expect(page.getByText('mock chat ok')).toBeVisible({ timeout: 30_000 });
  });

  test('dall-e-3 still uses generations without edit radio', async ({ page }) => {
    await openPlayground(page, state.user, { model: 'dall-e-3' });
    await expect(page.getByText('请求方式')).toHaveCount(0);
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/pg/images/generations') &&
        response.request().method() === 'POST',
    );
    await fillPrompt(page, 'legacy dall-e generation');
    await page.keyboard.press('Enter');
    expect((await responsePromise).ok()).toBe(true);
    await expectImageLoaded(assistantImages(page).last());
  });
});
