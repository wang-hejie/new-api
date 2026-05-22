import { test, expect } from '@playwright/test';
import {
  cleanupFixtures,
  prepareFixtures,
  type E2EFixtureState,
} from './fixtures';
import {
  openPlayground,
  radioCard,
  semiOptionsNearLabel,
  setImageMode,
} from './helpers';

test.describe.serial('playground image capability metadata', () => {
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

  test('gpt-image-2 exposes edit mode and hides unsupported controls', async ({ page }) => {
    await openPlayground(page, state.user, { model: 'gpt-image-2' });
    await expect(page.getByText('请求方式')).toBeVisible();
    await expect(page.getByText('图生图')).toBeVisible();
    await expect(page.getByText('返回格式')).toHaveCount(0);
    await expect(page.getByText('参考用途')).toHaveCount(0);
    await expect(page.getByText('图像数量')).toBeVisible();

    const selectedStyle = await radioCard(page, '文生图').evaluate((node) => {
      const style = window.getComputedStyle(node as HTMLElement);
      return {
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
      };
    });
    const editStyle = await radioCard(page, '图生图').evaluate((node) => {
      const style = window.getComputedStyle(node as HTMLElement);
      return {
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
      };
    });
    expect(selectedStyle.backgroundColor).not.toBe(editStyle.backgroundColor);
    expect(selectedStyle.borderColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('gpt-image-2 quality dropdown omits high in generation and edit modes', async ({
    page,
  }) => {
    await openPlayground(page, state.user, {
      model: 'gpt-image-2',
      imageRequestMode: 'generation',
      quality: 'high',
    });

    await expect(page.getByText('图像质量')).toBeVisible();
    await expect(semiOptionsNearLabel(page, '图像质量')).resolves.toEqual([
      '自动',
      '低',
      '中',
    ]);

    await setImageMode(page, '图生图');
    await expect(semiOptionsNearLabel(page, '图像质量')).resolves.toEqual([
      '自动',
      '低',
      '中',
    ]);
  });

  test('gpt-image-1 keeps edits but hides response_format', async ({ page }) => {
    await openPlayground(page, state.user, { model: 'gpt-image-1' });
    await expect(page.getByText('请求方式')).toBeVisible();
    await expect(page.getByText('图生图')).toBeVisible();
    await expect(page.getByText('返回格式')).toHaveCount(0);
  });

  test('gemini native image keeps edits and locks n=1', async ({ page }) => {
    await openPlayground(page, state.user, {
      model: 'gemini-3.1-flash-image-preview',
    });
    await expect(page.getByText('请求方式')).toBeVisible();
    await expect(page.getByText('图生图')).toBeVisible();
    await expect(page.getByText('返回格式')).toHaveCount(0);
    await expect(
      page.getByText('Gemini 图像模型一次只生成 1 张图').first(),
    ).toBeVisible();
  });

  test('dall-e-3 remains generation-only with legacy image controls', async ({
    page,
  }) => {
    await openPlayground(page, state.user, { model: 'dall-e-3' });
    await expect(page.getByText('请求方式')).toHaveCount(0);
    await expect(page.getByText('图像尺寸')).toBeVisible();
    await expect(page.getByText('图像质量')).toBeVisible();
    await expect(page.getByText('返回格式')).toBeVisible();
  });
});
