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
  imageTestAsset,
  openPlayground,
  selectSemiOptionNearLabel,
  setImageCount,
  uploadReference,
} from './helpers';

const referenceUsageField = ['reference', 'usage'].join('_');

test.describe.serial('gpt-image-2 edits', () => {
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

  test('sends multipart to /pg/images/edits and renders image', async ({
    page,
  }) => {
    await openPlayground(page, state.user, {
      model: 'gpt-image-2',
      imageRequestMode: 'edit',
      responseFormat: 'url',
      showDebugPanel: true,
    });

    await expect(page.getByText('参考图', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText('参考用途', { exact: true }).first(),
    ).toHaveCount(0);
    await uploadReference(page, imageTestAsset('apple_red.png'));
    await expect(page.getByText('apple_red.png')).toBeVisible();

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/pg/images/edits') &&
        response.request().method() === 'POST',
    );

    await fillPrompt(page, 'change the apple color to bright green');
    await page.keyboard.press('Enter');

    const response = await responsePromise;
    expect(response.ok()).toBe(true);
    const headers = response.request().headers();
    expect(headers['content-type']).toContain('multipart/form-data');
    expect(headers['content-type']).toContain('boundary=');

    const image = assistantImages(page).last();
    await expectImageLoaded(image);
    await expect(image).toHaveAttribute(
      'src',
      /^data:image\/png;base64,/,
    );

    const echo = await mockEcho();
    expect(echo.latest.path).toBe('/v1/images/edits');
    expect(echo.latest.fields).toMatchObject({
      model: ['gpt-image-2'],
      prompt: ['change the apple color to bright green'],
      n: ['1'],
      size: ['1024x1024'],
      quality: ['auto'],
    });
    expect(echo.latest.fields).not.toHaveProperty('group');
    expect(echo.latest.fields).not.toHaveProperty('response_format');
    expect(echo.latest.fields).not.toHaveProperty(referenceUsageField);
    expect(echo.latest.files.image[0]).toMatchObject({
      name: 'apple_red.png',
      type: 'image/png',
    });
    expect(echo.latest.files.image[0].size).toBeGreaterThan(0);
  });

  test('accepts jpeg and webp replacement reference files', async ({ page }) => {
    for (const fileName of ['apple_red.jpg', 'apple_red.webp']) {
      await openPlayground(page, state.user, {
        model: 'gpt-image-2',
        imageRequestMode: 'edit',
        responseFormat: 'b64_json',
      });
      await uploadReference(page, imageTestAsset(fileName));

      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/pg/images/edits') &&
          response.request().method() === 'POST',
      );
      await fillPrompt(page, `edit ${fileName}`);
      await page.keyboard.press('Enter');
      expect((await responsePromise).ok()).toBe(true);

      const echo = await mockEcho();
      expect(echo.latest.files.image[0].name).toBe(fileName);
      expect(echo.latest.files.image[0].type).toBe(
        fileName.endsWith('.jpg') ? 'image/jpeg' : 'image/webp',
      );
    }
  });

  test('gpt-image-2 edits forwards non-default size/quality/n to upstream', async ({
    page,
  }) => {
    await openPlayground(page, state.user, {
      model: 'gpt-image-2',
      imageRequestMode: 'edit',
      size: '1024x1536',
      quality: 'high',
      n: 2,
    });
    await selectSemiOptionNearLabel(page, '图像尺寸', '1024x1536');
    await selectSemiOptionNearLabel(page, '图像质量', '高');
    await setImageCount(page, 2);
    await uploadReference(page, imageTestAsset('apple_red.png'));
    const imageCountBeforeSend = await assistantImages(page).count();

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/pg/images/edits') &&
        response.request().method() === 'POST',
    );
    await fillPrompt(page, 'create two tall high quality apple variants');
    await page.keyboard.press('Enter');

    const response = await responsePromise;
    expect(response.ok()).toBe(true);

    const echo = await mockEcho();
    expect(echo.latest.path).toBe('/v1/images/edits');
    expect(echo.latest.fields).toMatchObject({
      model: ['gpt-image-2'],
      prompt: ['create two tall high quality apple variants'],
      n: ['2'],
      size: ['1024x1536'],
      quality: ['high'],
    });
    expect(echo.latest.fields).not.toHaveProperty('group');
    expect(echo.latest.fields).not.toHaveProperty('response_format');
    expect(echo.latest.fields).not.toHaveProperty(referenceUsageField);
    await expect
      .poll(async () => await assistantImages(page).count(), {
        timeout: 30_000,
      })
      .toBeGreaterThanOrEqual(imageCountBeforeSend + 2);
  });
});
