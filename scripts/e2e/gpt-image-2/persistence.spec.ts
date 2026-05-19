import { test, expect } from '@playwright/test';
import {
  cleanupFixtures,
  loginPageByApi,
  prepareFixtures,
  type E2EFixtureState,
} from './fixtures';
import {
  buildPlaygroundConfig,
  imageTestAsset,
  localStorageConfig,
  openPlayground,
  uploadReference,
} from './helpers';

const legacyReferenceUsageField = ['prompt', 'reference', 'usage'].join('_');

test.describe.serial('playground image config persistence', () => {
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

  test('does not persist File objects or legacy mask field', async ({ page }) => {
    await openPlayground(page, state.user, {
      model: 'gpt-image-2',
      imageRequestMode: 'edit',
      size: '1024x1536',
      quality: 'low',
    });
    await uploadReference(page, imageTestAsset('apple_red.png'));
    await page.waitForTimeout(1200);

    const config = await localStorageConfig(page);
    expect(config.inputs.image_request_mode).toBe('edit');
    expect(config.inputs).not.toHaveProperty(legacyReferenceUsageField);
    expect(config.inputs.prompt_size).toBe('1024x1536');
    expect(config.inputs.prompt_quality).toBe('low');
    expect(config.inputs).not.toHaveProperty('image_reference_files');
    expect(config.inputs).not.toHaveProperty('image_mask_file');

    await page.reload();
    await expect(page.getByText('上传参考图')).toBeVisible();
    const reloaded = await localStorageConfig(page);
    expect(reloaded.inputs).not.toHaveProperty(legacyReferenceUsageField);
    expect(reloaded.inputs).not.toHaveProperty('image_reference_files');
    expect(reloaded.inputs).not.toHaveProperty('image_mask_file');
  });

  test('legacy reference field in stored config is sanitized after load', async ({
    page,
  }) => {
    await loginPageByApi(page, state.user);
    await page.addInitScript(
      ({ storedConfig, promptReferenceUsageField }) => {
        window.localStorage.setItem(
          'playground_config',
          JSON.stringify({
            ...storedConfig,
            inputs: {
              ...storedConfig.inputs,
              [promptReferenceUsageField]: 'subject',
            },
            timestamp: new Date().toISOString(),
          }),
        );
        window.localStorage.setItem(
          'playground_messages',
          JSON.stringify({
            messages: [],
            timestamp: new Date().toISOString(),
          }),
        );
      },
      {
        storedConfig: buildPlaygroundConfig({
          model: 'gpt-image-2',
          imageRequestMode: 'generation',
        }),
        promptReferenceUsageField: legacyReferenceUsageField,
      },
    );

    await page.goto('/console/playground');
    await expect(
      page.getByRole('heading', { name: '模型配置' }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('gpt-image-2').first()).toBeVisible({
      timeout: 30_000,
    });

    await expect
      .poll(async () => {
        const config = await localStorageConfig(page);
        return Object.prototype.hasOwnProperty.call(
          config.inputs || {},
          legacyReferenceUsageField,
        );
      })
      .toBe(false);
    await expect(page.getByText('参考用途', { exact: true })).toHaveCount(0);
  });
});
