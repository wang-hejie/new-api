import { test, expect } from '@playwright/test';
import {
  cleanupFixtures,
  mockEcho,
  prepareFixtures,
  type E2EFixtureState,
} from './fixtures';
import {
  assistantImages,
  expectImageLoaded,
  fillPrompt,
  openPlayground,
} from './helpers';

test.describe.serial('gpt-image-2 generations', () => {
  let state: E2EFixtureState;

  test.beforeAll(async () => {
    state = await prepareFixtures();
  });

  test.afterAll(async () => {
    await cleanupFixtures(state?.user, state?.originalModelPrice);
  });

  test('sends JSON to /pg/images/generations and renders b64 image', async ({
    page,
  }) => {
    await openPlayground(page, state.user, {
      model: 'gpt-image-2',
      imageRequestMode: 'generation',
      responseFormat: 'b64_json',
      showDebugPanel: true,
    });

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/pg/images/generations') &&
        response.request().method() === 'POST',
    );

    await fillPrompt(page, 'a single red apple on a white table');
    await page.keyboard.press('Enter');

    const response = await responsePromise;
    expect(response.ok()).toBe(true);
    const request = response.request();
    expect(request.headers()['content-type']).toContain('application/json');
    const body = JSON.parse(request.postData() || '{}');
    expect(body).toMatchObject({
      model: 'gpt-image-2',
      group: 'default',
      prompt: 'a single red apple on a white table',
      n: 1,
      size: '1024x1024',
    });

    const image = assistantImages(page).last();
    await expectImageLoaded(image);
    await expect(image).toHaveAttribute('src', /^data:image\/png;base64,/);

    const echo = await mockEcho();
    expect(echo.latest.path).toBe('/v1/images/generations');
    expect(echo.latest.json).toMatchObject({
      model: 'gpt-image-2',
      prompt: 'a single red apple on a white table',
      n: 1,
    });
  });
});
