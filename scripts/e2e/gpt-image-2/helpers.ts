import { expect, type Locator, type Page } from '@playwright/test';
import { loginPageByApi, type E2EUser } from './fixtures';

export const DEFAULT_PARAMETER_ENABLED = {
  temperature: true,
  top_p: true,
  max_tokens: false,
  frequency_penalty: true,
  presence_penalty: true,
  seed: false,
};

export type PlaygroundConfigOptions = {
  model?: string;
  group?: string;
  imageRequestMode?: 'generation' | 'edit';
  size?: string;
  quality?: string;
  n?: number;
  responseFormat?: string;
  referenceUsage?: 'subject' | 'composition' | 'style';
  showDebugPanel?: boolean;
  customRequestMode?: boolean;
  customRequestBody?: string;
};

export function buildPlaygroundConfig(options: PlaygroundConfigOptions = {}) {
  return {
    inputs: {
      model: options.model || 'gpt-image-2',
      group: options.group || 'default',
      temperature: 0.7,
      top_p: 1,
      max_tokens: 4096,
      frequency_penalty: 0,
      presence_penalty: 0,
      seed: null,
      stream: true,
      imageEnabled: false,
      imageUrls: [''],
      prompt_size: options.size || '1024x1024',
      prompt_quality: options.quality || 'auto',
      prompt_n: options.n || 1,
      prompt_response_format: options.responseFormat || '',
      prompt_reference_usage: options.referenceUsage || 'subject',
      image_request_mode: options.imageRequestMode || 'generation',
    },
    parameterEnabled: DEFAULT_PARAMETER_ENABLED,
    showDebugPanel: options.showDebugPanel ?? true,
    customRequestMode: options.customRequestMode || false,
    customRequestBody: options.customRequestBody || '',
  };
}

export async function openPlayground(
  page: Page,
  user: E2EUser,
  options: PlaygroundConfigOptions = {},
) {
  await loginPageByApi(page, user);
  const config = buildPlaygroundConfig(options);
  const seedId = `${Date.now()}-${Math.random()}`;
  await page.addInitScript(
    ({ storedConfig, seedId: currentSeedId }) => {
      const seedKey = '__e2e_playground_config_seed_id';
      if (window.sessionStorage.getItem(seedKey) === currentSeedId) {
        return;
      }
      window.localStorage.setItem(
        'playground_config',
        JSON.stringify({
          ...storedConfig,
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
      window.sessionStorage.setItem(seedKey, currentSeedId);
    },
    { storedConfig: config, seedId },
  );
  await page.goto('/console/playground');
  await expect(
    page.getByRole('heading', { name: '模型配置' }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText(options.model || 'gpt-image-2').first(),
  ).toBeVisible({ timeout: 30_000 });
}

export function chatTextarea(page: Page) {
  return page.locator('textarea').filter({ hasNotText: '' }).last();
}

export function sendButton(page: Page) {
  return page
    .locator('button')
    .filter({
      has: page.locator('svg'),
    })
    .last();
}

export async function fillPrompt(page: Page, prompt: string) {
  const textarea = page
    .locator('textarea[placeholder*="提示词"], textarea[placeholder*="问题"]')
    .first();
  await textarea.fill(prompt);
}

export async function sendPrompt(page: Page, prompt: string) {
  await fillPrompt(page, prompt);
  await page.keyboard.press('Enter');
}

export function radioCard(page: Page, label: string) {
  return page.locator('.semi-radio').filter({ hasText: label }).first();
}

export async function setImageMode(page: Page, mode: '文生图' | '图生图') {
  await radioCard(page, mode).click();
}

export async function uploadReference(page: Page, filePath: string) {
  await page
    .locator('input[type="file"][accept="image/png,image/jpeg,image/webp"]')
    .setInputFiles(filePath);
}

export async function expectImageLoaded(locator: Locator) {
  await expect(locator).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => {
      return await locator.evaluate((image) => {
        const img = image as HTMLImageElement;
        return {
          width: img.naturalWidth,
          height: img.naturalHeight,
          complete: img.complete,
        };
      });
    })
    .toMatchObject({ complete: true });
  const size = await locator.evaluate((image) => {
    const img = image as HTMLImageElement;
    return img.naturalWidth * img.naturalHeight;
  });
  expect(size).toBeGreaterThan(0);
}

export function assistantImages(page: Page) {
  return page.locator(
    'img[src^="data:image"], img[src^="http://127.0.0.1:11434/static"]',
  );
}

export async function selectSemiOptionNearLabel(
  page: Page,
  label: string,
  option: string,
) {
  const labelNode = page.getByText(label, { exact: true }).first();
  const container = labelNode.locator('xpath=ancestor::div[contains(@class, "mb-2")]/following-sibling::*[1]');
  await container.locator('.semi-select, .semi-select-selection').first().click();
  await page.locator('.semi-select-option').filter({ hasText: option }).first().click();
}

export async function setImageCount(page: Page, value: number) {
  const labelNode = page.getByText('图像数量', { exact: true }).first();
  const container = labelNode.locator('xpath=ancestor::div[contains(@class, "mb-2")]/following-sibling::*[1]');
  const input = container.locator('input').first();
  await input.fill(String(value));
  await input.blur();
}

export async function localStorageConfig(page: Page) {
  return await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('playground_config') || '{}'),
  );
}
