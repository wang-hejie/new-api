import { test, expect, type Page } from '@playwright/test';
import {
  cleanupFixtures,
  prepareFixtures,
  type E2EFixtureState,
} from './fixtures';
import {
  fillPrompt,
  imageTestAsset,
  openPlayground,
  uploadReference,
} from './helpers';

type ConsumeLog = {
  model_name?: string;
  type?: number;
  created_at?: number;
  channel?: number;
  quota?: number;
  content?: string;
  other?: string;
};

const requestPathFromLog = (log: ConsumeLog) => {
  try {
    return JSON.parse(log.other || '{}').request_path;
  } catch {
    return undefined;
  }
};

const findCurrentConsumptionLog = async (
  page: Page,
  state: E2EFixtureState,
  startTimestamp: number,
  requestPath: string,
) => {
  const response = await page.request.get('/api/log/self/', {
    headers: { 'New-Api-User': String(state.user.id) },
    params: {
      type: '2',
      model_name: 'gpt-image-2',
      start_timestamp: String(startTimestamp),
      page_size: '10',
      p: '1',
    },
  });
  const body = await response.json();
  const items = (body.data?.items || []) as ConsumeLog[];
  return (
    items.find(
      (item) =>
        item.model_name === 'gpt-image-2' &&
        item.type === 2 &&
        Number(item.created_at || 0) >= startTimestamp &&
        item.channel === state.channelId &&
        Number(item.quota || 0) > 0 &&
        requestPathFromLog(item) === requestPath,
    ) || null
  );
};

const waitForCurrentConsumptionLog = async (
  page: Page,
  state: E2EFixtureState,
  startTimestamp: number,
  requestPath: string,
) => {
  let matched: ConsumeLog | null = null;
  await expect
    .poll(async () => {
      matched = await findCurrentConsumptionLog(
        page,
        state,
        startTimestamp,
        requestPath,
      );
      return matched ? 'found' : 'missing';
    })
    .toBe('found');
  return matched as ConsumeLog;
};

test.describe.serial('gpt-image-2 billing logs', () => {
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
    const startTimestamp = Math.floor(Date.now() / 1000) - 1;
    await fillPrompt(page, `billing apple ${Date.now()}`);
    await page.keyboard.press('Enter');
    expect((await responsePromise).ok()).toBe(true);

    const log = await waitForCurrentConsumptionLog(
      page,
      state,
      startTimestamp,
      '/pg/images/generations',
    );
    expect(log).toMatchObject({
      model_name: 'gpt-image-2',
      type: 2,
      channel: state.channelId,
    });
    expect(log.created_at).toBeGreaterThanOrEqual(startTimestamp);
    expect(log.content).toContain('大小 1024x1024');
    expect(log.content).toContain('生成数量 1');
    expect(log.quota).toBeGreaterThan(0);
    expect(requestPathFromLog(log)).toBe('/pg/images/generations');
  });

  test('edits writes consumption log with /pg/images/edits request path', async ({
    page,
  }) => {
    await openPlayground(page, state.user, {
      model: 'gpt-image-2',
      imageRequestMode: 'edit',
    });
    await uploadReference(page, imageTestAsset('apple_red.png'));
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/pg/images/edits') &&
        response.request().method() === 'POST',
    );
    const startTimestamp = Math.floor(Date.now() / 1000) - 1;
    await fillPrompt(page, `billing edit apple ${Date.now()}`);
    await page.keyboard.press('Enter');
    expect((await responsePromise).ok()).toBe(true);

    const log = await waitForCurrentConsumptionLog(
      page,
      state,
      startTimestamp,
      '/pg/images/edits',
    );
    expect(log).toMatchObject({
      model_name: 'gpt-image-2',
      type: 2,
      channel: state.channelId,
    });
    expect(log.created_at).toBeGreaterThanOrEqual(startTimestamp);
    expect(log.content).toContain('生成数量 1');
    expect(log.content).toContain('大小 1024x1024');
    expect(log.quota).toBeGreaterThan(0);
    expect(requestPathFromLog(log)).toBe('/pg/images/edits');
  });
});
