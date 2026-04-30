import { test, expect } from '@playwright/test';
import {
  cleanupFixtures,
  prepareFixtures,
  type E2EFixtureState,
} from './fixtures';
import {
  imageTestAsset,
  localStorageConfig,
  openPlayground,
  uploadReference,
} from './helpers';

test.describe.serial('playground image config persistence', () => {
  let state: E2EFixtureState;

  test.beforeAll(async () => {
    state = await prepareFixtures();
  });

  test.afterAll(async () => {
    await cleanupFixtures(state?.user, state?.originalModelPrice);
  });

  test('does not persist File objects or legacy mask field', async ({ page }) => {
    await openPlayground(page, state.user, {
      model: 'gpt-image-2',
      imageRequestMode: 'edit',
      referenceUsage: 'composition',
      size: '1024x1536',
      quality: 'low',
    });
    await uploadReference(page, imageTestAsset('apple_red.png'));
    await page.waitForTimeout(1200);

    const config = await localStorageConfig(page);
    expect(config.inputs.image_request_mode).toBe('edit');
    expect(config.inputs.prompt_reference_usage).toBe('composition');
    expect(config.inputs.prompt_size).toBe('1024x1536');
    expect(config.inputs.prompt_quality).toBe('low');
    expect(config.inputs).not.toHaveProperty('image_reference_files');
    expect(config.inputs).not.toHaveProperty('image_mask_file');

    await page.reload();
    await expect(page.getByText('上传参考图')).toBeVisible();
    const reloaded = await localStorageConfig(page);
    expect(reloaded.inputs).not.toHaveProperty('image_reference_files');
    expect(reloaded.inputs).not.toHaveProperty('image_mask_file');
  });
});
