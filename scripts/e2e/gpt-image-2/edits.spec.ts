import { test, expect } from '@playwright/test';
import { join } from 'node:path';
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
  uploadReference,
} from './helpers';

const asset = (name: string) =>
  join(process.cwd(), '..', 'scripts/e2e/gpt-image-2/test-assets', name);

test.describe.serial('gpt-image-2 edits', () => {
  let state: E2EFixtureState;

  test.beforeAll(async () => {
    state = await prepareFixtures();
  });

  test.afterAll(async () => {
    await cleanupFixtures(state?.user, state?.originalModelPrice);
  });

  test('sends multipart to /pg/images/edits and renders image', async ({
    page,
  }) => {
    await openPlayground(page, state.user, {
      model: 'gpt-image-2',
      imageRequestMode: 'edit',
      responseFormat: 'url',
      referenceUsage: 'composition',
      showDebugPanel: true,
    });

    await expect(page.getByText('参考图', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText('参考用途', { exact: true }).first(),
    ).toBeVisible();
    await uploadReference(page, asset('apple_red.png'));
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
      /^http:\/\/127\.0\.0\.1:11434\/static\/sample\.png/,
    );

    const echo = await mockEcho();
    expect(echo.latest.path).toBe('/v1/images/edits');
    expect(echo.latest.fields).toMatchObject({
      model: ['gpt-image-2'],
      group: ['default'],
      prompt: ['change the apple color to bright green'],
      n: ['1'],
      size: ['1024x1024'],
      quality: ['auto'],
      response_format: ['url'],
      reference_usage: ['composition'],
    });
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
      await uploadReference(page, asset(fileName));

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
});
