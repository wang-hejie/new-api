import { test, expect } from '@playwright/test';
import {
  cleanupFixtures,
  prepareFixtures,
  type E2EFixtureState,
} from './fixtures';
import { imageTestAsset, openPlayground, uploadReference } from './helpers';

test.describe.serial('gpt-image-2 guards', () => {
  let state: E2EFixtureState;

  test.beforeAll(async () => {
    state = await prepareFixtures();
  });

  test.afterAll(async () => {
    await cleanupFixtures(
      state?.user,
      state?.originalModelPrice,
      state?.originalPassThroughRequestEnabled,
      state?.originalPassThroughRequestEnabledExists,
    );
  });

  test('edit mode without reference disables send and prevents request', async ({
    page,
  }) => {
    await openPlayground(page, state.user, {
      model: 'gpt-image-2',
      imageRequestMode: 'edit',
    });
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/pg/images/')) {
        requests.push(request.url());
      }
    });
    await expect(
      page.locator('button[title*="图生图模式需要先上传参考图"]').first(),
    ).toBeVisible();
    await page.keyboard.press('Enter');
    expect(requests).toHaveLength(0);
  });

  test('custom request body blocks edit mode but allows generation mode', async ({
    page,
  }) => {
    await openPlayground(page, state.user, {
      model: 'gpt-image-2',
      imageRequestMode: 'edit',
      customRequestMode: true,
      customRequestBody: JSON.stringify({
        model: 'gpt-image-2',
        prompt: 'custom generation ok',
      }),
    });
    await expect(
      page.locator('button[title*="自定义请求体模式不支持图生图"]').first(),
    ).toBeVisible();

    await openPlayground(page, state.user, {
      model: 'gpt-image-2',
      imageRequestMode: 'generation',
      customRequestMode: true,
      customRequestBody: JSON.stringify({
        model: 'gpt-image-2',
        prompt: 'custom generation ok',
      }),
    });
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/pg/images/generations') &&
        response.request().method() === 'POST',
    );
    await page
      .locator('textarea[placeholder*="提示词"], textarea[placeholder*="问题"]')
      .first()
      .fill('this prompt is only the visible chat message');
    await page.keyboard.press('Enter');
    const response = await responsePromise;
    expect(response.ok()).toBe(true);
    expect(JSON.parse(response.request().postData() || '{}')).toEqual({
      model: 'gpt-image-2',
      prompt: 'custom generation ok',
    });
  });

  test('oversize and bad mime reference files are rejected', async ({ page }) => {
    await openPlayground(page, state.user, {
      model: 'gpt-image-2',
      imageRequestMode: 'edit',
    });
    await uploadReference(page, imageTestAsset('bad_mime.txt'));
    await expect(
      page
        .locator('.semi-toast')
        .filter({ hasText: '仅支持 PNG / JPEG / WebP' })
        .last(),
    ).toBeVisible();
    await expect(page.getByText('bad_mime.txt')).toHaveCount(0);

    await uploadReference(page, imageTestAsset('too_large.png'));
    await expect(
      page
        .locator('.semi-toast')
        .filter({ hasText: '仅支持 PNG / JPEG / WebP' })
        .last(),
    ).toBeVisible();
    await expect(page.getByText('too_large.png')).toHaveCount(0);
  });
});
