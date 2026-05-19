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

const referenceUsageField = ['reference', 'usage'].join('_');

const waitForImageOrChatPost = (page) =>
  page.waitForResponse(
    (response) =>
      (response.url().includes('/pg/images/generations') ||
        response.url().includes('/pg/chat/completions')) &&
      response.request().method() === 'POST',
  );

test.describe.serial('gpt-image-2 generations', () => {
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
    expect(body).not.toHaveProperty('response_format');
    expect(body).not.toHaveProperty(referenceUsageField);

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
    expect(echo.latest.json).not.toHaveProperty('response_format');
    expect(echo.latest.json).not.toHaveProperty(referenceUsageField);
  });

  test('gpt-image-2 generation drops response_format even when localStorage carries it', async ({
    page,
  }) => {
    await openPlayground(page, state.user, {
      model: 'gpt-image-2',
      imageRequestMode: 'generation',
      responseFormat: 'url',
      showDebugPanel: true,
    });
    await expect(page.getByText('请求方式')).toBeVisible();
    await expect(page.getByText('文生图')).toBeVisible();
    await expect(page.getByText('返回格式')).toHaveCount(0);

    const responsePromise = waitForImageOrChatPost(page);

    await fillPrompt(page, 'legacy response format should be ignored');
    await page.keyboard.press('Enter');

    const response = await responsePromise;
    expect(response.ok()).toBe(true);
    expect(response.url()).toContain('/pg/images/generations');
    const body = JSON.parse(response.request().postData() || '{}');
    expect(body).toMatchObject({
      model: 'gpt-image-2',
      prompt: 'legacy response format should be ignored',
    });
    expect(body).not.toHaveProperty('response_format');

    const echo = await mockEcho();
    expect(echo.latest.path).toBe('/v1/images/generations');
    expect(echo.latest.json).toMatchObject({
      model: 'gpt-image-2',
      prompt: 'legacy response format should be ignored',
    });
    expect(echo.latest.json).not.toHaveProperty('response_format');
  });
});
