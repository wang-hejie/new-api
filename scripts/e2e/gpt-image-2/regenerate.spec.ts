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
  uploadReference,
} from './helpers';

const referenceUsageField = ['reference', 'usage'].join('_');

const sendEditRequest = async (page, prompt: string) => {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/pg/images/edits') &&
      response.request().method() === 'POST',
  );
  await fillPrompt(page, prompt);
  await page.keyboard.press('Enter');
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  await expectImageLoaded(assistantImages(page).last());
};

const editLatestUserMessage = async (page, nextPrompt: string) => {
  await page.getByRole('button', { name: '编辑' }).first().click();
  await page.getByPlaceholder('请输入消息内容...').fill(nextPrompt);
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('消息已编辑')).toBeVisible();
};

const confirmRegeneration = async (page) => {
  await page
    .locator('.semi-modal')
    .locator('button')
    .filter({ hasText: '重新生成' })
    .click();
};

test.describe.serial('gpt-image-2 regeneration guards', () => {
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

  test('edit message regeneration keeps using edits while reference file is present', async ({
    page,
  }) => {
    await openPlayground(page, state.user, {
      model: 'gpt-image-2',
      imageRequestMode: 'edit',
      responseFormat: 'b64_json',
    });
    await uploadReference(page, imageTestAsset('apple_red.png'));
    await sendEditRequest(page, 'initial edit prompt');

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/pg/images/edits') &&
        response.request().method() === 'POST',
    );
    await editLatestUserMessage(page, 'regenerated edit prompt');
    await confirmRegeneration(page);
    const response = await responsePromise;
    expect(response.ok()).toBe(true);

    const echo = await mockEcho();
    expect(echo.latest.path).toBe('/v1/images/edits');
    expect(echo.latest.fields.prompt).toEqual(['regenerated edit prompt']);
    expect(echo.latest.files.image[0]).toMatchObject({
      name: 'apple_red.png',
      type: 'image/png',
    });
    expect(echo.latest.fields).not.toHaveProperty('group');
    expect(echo.latest.fields).not.toHaveProperty('response_format');
    expect(echo.latest.fields).not.toHaveProperty(referenceUsageField);
  });

  test('edit message regeneration after reload is blocked instead of falling back to generations', async ({
    page,
  }) => {
    await openPlayground(page, state.user, {
      model: 'gpt-image-2',
      imageRequestMode: 'edit',
      responseFormat: 'b64_json',
    });
    await uploadReference(page, imageTestAsset('apple_red.png'));
    await sendEditRequest(page, 'reload guarded edit prompt');
    await page.reload();
    await expect(page.getByText('上传参考图')).toBeVisible();

    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/pg/images/')) {
        requests.push(request.url());
      }
    });
    await editLatestUserMessage(page, 'regenerate without file');
    await confirmRegeneration(page);
    await expect(
      page.locator('.semi-toast').filter({
        hasText: '图生图重新生成需要重新上传参考图',
      }),
    ).toBeVisible();
    await expect.poll(() => requests.length).toBe(0);
  });
});
