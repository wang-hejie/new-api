import { test, expect } from '@playwright/test';
import {
  cleanupFixtures,
  prepareFixtures,
  type E2EFixtureState,
} from './fixtures';
import { fillPrompt, openPlayground } from './helpers';

test.describe.serial('gpt-image-2 billing logs', () => {
  let state: E2EFixtureState;

  test.beforeAll(async () => {
    state = await prepareFixtures();
  });

  test.afterAll(async () => {
    await cleanupFixtures(state?.user, state?.originalModelPrice);
  });

  test('generations writes consumption log with request path', async ({ page }) => {
    await openPlayground(page, state.user, {
      model: 'gpt-image-2',
      imageRequestMode: 'generation',
    });
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/pg/images/generations') &&
        response.request().method() === 'POST',
    );
    await fillPrompt(page, 'billing apple');
    await page.keyboard.press('Enter');
    expect((await responsePromise).ok()).toBe(true);

    await expect
      .poll(async () => {
        const response = await page.request.get('/api/log/self/', {
          headers: { 'New-Api-User': String(state.user.id) },
          params: {
            type: '2',
            model_name: 'gpt-image-2',
            page_size: '10',
            p: '1',
          },
        });
        const body = await response.json();
        return body.data?.items || [];
      })
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            model_name: 'gpt-image-2',
            type: 2,
          }),
        ]),
      );

    const logsResponse = await page.request.get('/api/log/self/', {
      headers: { 'New-Api-User': String(state.user.id) },
      params: {
        type: '2',
        model_name: 'gpt-image-2',
        page_size: '10',
        p: '1',
      },
    });
    const logsBody = await logsResponse.json();
    const log = logsBody.data.items.find(
      (item: { model_name?: string; content?: string }) =>
        item.model_name === 'gpt-image-2' && item.content?.includes('生成数量 1'),
    );
    expect(log.content).toContain('大小 1024x1024');
    expect(log.quota).toBeGreaterThan(0);
    expect(JSON.parse(log.other).request_path).toBe('/pg/images/generations');
  });
});
