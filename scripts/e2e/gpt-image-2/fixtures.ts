import { expect, request } from '@playwright/test';
import type { APIRequestContext, APIResponse, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

export const BASE_URL = process.env.NEW_API_BASE_URL || 'http://127.0.0.1:9991';
export const MOCK_UPSTREAM = process.env.E2E_MOCK_UPSTREAM || 'http://127.0.0.1:11434';
export const CHANNEL_BASE_URL =
  process.env.E2E_CHANNEL_BASE_URL || 'http://host.docker.internal:11434';
export const PREFIX = process.env.E2E_PREFIX || 'E2E_GPT_IMAGE_2_';
export const TEST_USER = process.env.E2E_ROOT_USER || `${PREFIX}root`;
export const TEST_PASS = process.env.E2E_ROOT_PASS || 'E2E_GPT_IMAGE_2_PASS_123';
export const TEST_ACCESS_TOKEN =
  process.env.E2E_ROOT_ACCESS_TOKEN || 'e2egptimage2accesstoken00000001';
export const TEST_MODELS = [
  'gpt-image-2',
  'gpt-image-1',
  'dall-e-3',
  'gemini-3.1-flash-image-preview',
  'gpt-4o',
];
const PASS_THROUGH_OPTION_KEY = 'global.pass_through_request_enabled';

export type E2EUser = {
  id: number;
  username: string;
  display_name?: string;
  role: number;
  status: number;
  group: string;
  setting?: string;
};

export type E2EFixtureState = {
  user: E2EUser;
  channelId: number;
  createdUserByDb: boolean;
  originalModelPrice: string | null;
  originalPassThroughRequestEnabled: string | null;
  originalPassThroughRequestEnabledExists: boolean;
};

const POSTGRES_ENV = {
  PGPASSWORD: '2008Wang,.',
};
const DEFAULT_TEST_PASS_HASH =
  '$2b$10$ybeRn1i78HlVEY50gFhd9e4hDQ/S9mhi3m9U0pPOSSl2E3XrxYhPG';

function psql(sql: string) {
  execFileSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'root',
      '-d',
      'new-api',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      sql,
    ],
    {
      cwd: process.cwd().endsWith('/web') ? '..' : '.',
      env: { ...process.env, ...POSTGRES_ENV },
      stdio: 'pipe',
    },
  );
}

function psqlOutput(sql: string) {
  return execFileSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'root',
      '-d',
      'new-api',
      '-t',
      '-A',
      '-F',
      '\t',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      sql,
    ],
    {
      cwd: process.cwd().endsWith('/web') ? '..' : '.',
      env: { ...process.env, ...POSTGRES_ENV },
      stdio: 'pipe',
      encoding: 'utf8',
    },
  ).trim();
}

function psqlRows(sql: string) {
  const output = psqlOutput(sql);
  return output ? output.split('\n') : [];
}

function sqlString(value: string) {
  return `'${value.split("'").join("''")}'`;
}

function getDbOptionValue(key: string) {
  const rows = psqlRows(
    `SELECT value FROM options WHERE key = ${sqlString(key)} LIMIT 1;`,
  );
  if (rows.length === 0) {
    return { exists: false, value: null };
  }
  return { exists: true, value: rows[0] };
}

function deleteDbOption(key: string) {
  psql(`DELETE FROM options WHERE key = ${sqlString(key)};`);
}

async function restoreGlobalPassThrough(
  api: APIRequestContext,
  user: E2EUser,
  originalValue?: string | null,
  originalExists = true,
) {
  if (originalExists) {
    await updateOptionValue(
      api,
      user,
      PASS_THROUGH_OPTION_KEY,
      originalValue || 'false',
    );
    return;
  }

  deleteDbOption(PASS_THROUGH_OPTION_KEY);
  await updateOptionValue(api, user, PASS_THROUGH_OPTION_KEY, 'false').catch(
    () => undefined,
  );
  deleteDbOption(PASS_THROUGH_OPTION_KEY);
}

export function clearE2ERateLimits() {
  execFileSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'redis',
      'redis-cli',
      '-a',
      '2008Wang,.',
      '--scan',
      '--pattern',
      'rateLimit:*',
    ],
    {
      cwd: process.cwd().endsWith('/web') ? '..' : '.',
      stdio: 'pipe',
    },
  )
    .toString()
    .split('\n')
    .filter(Boolean)
    .forEach((key) => {
      execFileSync(
        'docker',
        [
          'compose',
          'exec',
          '-T',
          'redis',
          'redis-cli',
          '-a',
          '2008Wang,.',
          'DEL',
          key,
        ],
        {
          cwd: process.cwd().endsWith('/web') ? '..' : '.',
          stdio: 'ignore',
        },
      );
    });
}

async function assertApiOk(response: APIResponse) {
  const body = await response.json();
  expect(body.success, body.message || JSON.stringify(body)).toBe(true);
  return body;
}

async function createApiContext(extraHeaders: Record<string, string> = {}) {
  return await request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function authHeaders(user: E2EUser) {
  const headers: Record<string, string> = {
    'New-Api-User': String(user.id),
  };
  if (!process.env.E2E_ROOT_USER && !process.env.E2E_ROOT_PASS) {
    headers.Authorization = TEST_ACCESS_TOKEN;
  }
  return headers;
}

async function createE2EUserIfMissing() {
  if (process.env.E2E_ROOT_USER && process.env.E2E_ROOT_PASS) {
    return false;
  }
  const escapedHash = DEFAULT_TEST_PASS_HASH.split("'").join("''");
  const escapedUser = TEST_USER.split("'").join("''");
  psql(`
    INSERT INTO users (username, password, display_name, role, status, quota, "group", setting, aff_code, access_token)
    VALUES ('${escapedUser}', '${escapedHash}', 'E2E Root User', 100, 1, 100000000, 'default', '{}', 'E2E1', '${TEST_ACCESS_TOKEN}')
    ON CONFLICT (username) DO UPDATE
      SET password = EXCLUDED.password,
          role = 100,
          status = 1,
          quota = 100000000,
          "group" = 'default',
          access_token = EXCLUDED.access_token;
  `);
  return true;
}

export async function login(api: APIRequestContext) {
  clearE2ERateLimits();
  const response = await api.post('/api/user/login', {
    headers: { 'Content-Type': 'application/json' },
    data: {
      username: TEST_USER,
      password: TEST_PASS,
    },
  });
  const body = await response.json();
  expect(body.success, body.message || JSON.stringify(body)).toBe(true);
  return body.data as E2EUser;
}

function getFixtureUserFromDb() {
  if (process.env.E2E_ROOT_USER && process.env.E2E_ROOT_PASS) {
    return null;
  }
  const escapedUser = TEST_USER.split("'").join("''");
  const row = psqlOutput(
    `SELECT id, username, role, status, "group", COALESCE(setting, '') FROM users WHERE username = '${escapedUser}' LIMIT 1;`,
  );
  if (!row) {
    return null;
  }
  const [id, username, role, status, group, setting] = row.split('\t');
  return {
    id: Number(id),
    username,
    role: Number(role),
    status: Number(status),
    group,
    setting,
  } as E2EUser;
}

async function deleteE2EChannels(api: APIRequestContext, user: E2EUser) {
  const search = await api.get('/api/channel/search', {
    headers: authHeaders(user),
    params: { keyword: PREFIX, page_size: '100', p: '1' },
  });
  const body = await assertApiOk(search);
  const items = body.data?.items || [];
  for (const item of items) {
    if (String(item.name || '').startsWith(PREFIX)) {
      await assertApiOk(
        await api.delete(`/api/channel/${item.id}`, {
          headers: authHeaders(user),
        }),
      );
    }
  }
}

async function createMockChannel(api: APIRequestContext, user: E2EUser) {
  const weight = 1000;
  const priority = 1000;
  const response = await api.post('/api/channel/', {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(user),
    },
    data: {
      mode: 'single',
      channel: {
        type: 1,
        key: 'mock-key',
        status: 1,
        name: `${PREFIX}mock_gpt_image_2`,
        base_url: CHANNEL_BASE_URL,
        models: TEST_MODELS.join(','),
        group: 'default',
        priority,
        weight,
        auto_ban: 0,
      },
    },
  });
  await assertApiOk(response);

  const search = await api.get('/api/channel/search', {
    headers: authHeaders(user),
    params: { keyword: `${PREFIX}mock_gpt_image_2`, page_size: '10', p: '1' },
  });
  const body = await assertApiOk(search);
  const channel = (body.data?.items || []).find(
    (item: { name?: string }) => item.name === `${PREFIX}mock_gpt_image_2`,
  );
  expect(channel, 'created mock channel should be searchable').toBeTruthy();

  await assertApiOk(
    await api.put('/api/channel/', {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(user),
      },
      data: channel,
    }),
  );

  return Number(channel.id);
}

async function assertChannelHealthy(api: APIRequestContext, user: E2EUser, channelId: number) {
  const response = await api.get(`/api/channel/test/${channelId}`, {
    headers: authHeaders(user),
    params: {
      model: 'gpt-image-2',
      endpoint_type: 'image-generation',
    },
  });
  await assertApiOk(response);
}

async function getOptionValue(api: APIRequestContext, user: E2EUser, key: string) {
  const response = await api.get('/api/option/', {
    headers: authHeaders(user),
  });
  const body = await assertApiOk(response);
  const item = (body.data || []).find((option: { key?: string }) => option.key === key);
  return typeof item?.value === 'string' ? item.value : null;
}

async function updateOptionValue(
  api: APIRequestContext,
  user: E2EUser,
  key: string,
  value: string,
) {
  const response = await api.put('/api/option/', {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(user),
    },
    data: { key, value },
  });
  await assertApiOk(response);
}

async function forceDisableGlobalPassThrough(api: APIRequestContext, user: E2EUser) {
  const original = getDbOptionValue(PASS_THROUGH_OPTION_KEY);
  await updateOptionValue(api, user, PASS_THROUGH_OPTION_KEY, 'false');
  return {
    originalPassThroughRequestEnabled: original.value,
    originalPassThroughRequestEnabledExists: original.exists,
  };
}

async function ensureImageModelPrices(api: APIRequestContext, user: E2EUser) {
  const originalModelPrice = await getOptionValue(api, user, 'ModelPrice');
  const priceMap =
    originalModelPrice && originalModelPrice.trim()
      ? JSON.parse(originalModelPrice)
      : {};
  priceMap['gpt-image-2'] = priceMap['gpt-image-2'] || 0.04;
  priceMap['gpt-image-1'] = priceMap['gpt-image-1'] || 0.04;
  priceMap['dall-e-3'] = priceMap['dall-e-3'] || 0.04;
  priceMap['gemini-3.1-flash-image-preview'] =
    priceMap['gemini-3.1-flash-image-preview'] || 0.03;
  await updateOptionValue(api, user, 'ModelPrice', JSON.stringify(priceMap));
  return originalModelPrice;
}

async function assertModelMetadata(api: APIRequestContext, user: E2EUser) {
  const response = await api.get('/api/user/playground/models', {
    headers: authHeaders(user),
  });
  const body = await assertApiOk(response);
  const byName = new Map((body.data || []).map((item: { name: string }) => [item.name, item]));

  const gptImage2 = byName.get('gpt-image-2') as any;
  expect(gptImage2?.endpoint_types).toContain('image-generation');
  expect(gptImage2?.image_generation_mode).toBe('gpt_image_v2');
  expect(gptImage2?.image_parameters).toMatchObject({
    response_format: false,
    supports_edits: true,
    n_max: 10,
  });

  const gptImage1 = byName.get('gpt-image-1') as any;
  expect(gptImage1?.image_parameters).toMatchObject({
    response_format: false,
    supports_edits: true,
  });

  const gemini = byName.get('gemini-3.1-flash-image-preview') as any;
  expect(gemini?.image_generation_mode).toBe('gemini_native');
  expect(gemini?.image_parameters).toMatchObject({ n_max: 1 });

  const dalle = byName.get('dall-e-3') as any;
  expect(dalle?.endpoint_types).toContain('image-generation');
  expect(dalle?.image_parameters).toBeFalsy();

  return body.data;
}

export async function prepareFixtures(): Promise<E2EFixtureState> {
  const setupApi = await createApiContext();
  const setup = await setupApi.get('/api/setup');
  const setupBody = await assertApiOk(setup);
  if (setupBody.data?.status !== true) {
    const response = await setupApi.post('/api/setup', {
      data: {
        username: TEST_USER,
        password: TEST_PASS,
        confirmPassword: TEST_PASS,
        SelfUseModeEnabled: false,
        DemoSiteEnabled: false,
      },
    });
    await assertApiOk(response);
  }
  await setupApi.dispose();

  const createdUserByDb = await createE2EUserIfMissing();
  const api = await createApiContext();
  const user = getFixtureUserFromDb() || (await login(api));
  let passThroughState:
    | Pick<
        E2EFixtureState,
        | 'originalPassThroughRequestEnabled'
        | 'originalPassThroughRequestEnabledExists'
      >
    | undefined;
  try {
    await deleteE2EChannels(api, user);
    passThroughState = await forceDisableGlobalPassThrough(api, user);
    const originalModelPrice = await ensureImageModelPrices(api, user);
    const channelId = await createMockChannel(api, user);
    await assertChannelHealthy(api, user, channelId);
    await assertModelMetadata(api, user);
    return {
      user,
      channelId,
      createdUserByDb,
      originalModelPrice,
      ...passThroughState,
    };
  } catch (error) {
    if (passThroughState) {
      await restoreGlobalPassThrough(
        api,
        user,
        passThroughState.originalPassThroughRequestEnabled,
        passThroughState.originalPassThroughRequestEnabledExists,
      ).catch(() => undefined);
    }
    throw error;
  } finally {
    await api.dispose();
  }
}

export async function cleanupFixtures(
  user?: E2EUser,
  originalModelPrice?: string | null,
  originalPassThroughRequestEnabled?: string | null,
  originalPassThroughRequestEnabledExists = true,
) {
  if (user) {
    const api = await createApiContext(authHeaders(user));
    if (process.env.E2E_ROOT_USER && process.env.E2E_ROOT_PASS) {
      await login(api).catch(() => undefined);
    }
    await deleteE2EChannels(api, user).catch(() => undefined);
    if (typeof originalModelPrice === 'string') {
      await updateOptionValue(api, user, 'ModelPrice', originalModelPrice).catch(
        () => undefined,
      );
    }
    await restoreGlobalPassThrough(
      api,
      user,
      originalPassThroughRequestEnabled,
      originalPassThroughRequestEnabledExists,
    ).catch(() => undefined);
    await api.dispose();
  }
  if (!process.env.E2E_ROOT_USER && !process.env.E2E_ROOT_PASS) {
    const escapedUser = TEST_USER.split("'").join("''");
    psql(`DELETE FROM users WHERE username = '${escapedUser}';`);
  }
}

export async function loginPageByApi(page: Page, user: E2EUser) {
  const api = await createApiContext();
  await login(api);
  const storage = await api.storageState();
  await page.context().addCookies(storage.cookies);
  await api.dispose();
  await page.addInitScript((userData) => {
    window.localStorage.setItem('user', JSON.stringify(userData));
    window.localStorage.setItem('i18nextLng', 'zh-CN');
  }, user);
}

export async function storageStateForUser(user: E2EUser) {
  const api = await createApiContext();
  await login(api);
  const storage = await api.storageState();
  await api.dispose();
  return {
    ...storage,
    origins: [
      {
        origin: BASE_URL,
        localStorage: [
          { name: 'user', value: JSON.stringify(user) },
          { name: 'i18nextLng', value: 'zh-CN' },
        ],
      },
    ],
  };
}

export async function mockEcho() {
  const response = await fetch(`${MOCK_UPSTREAM}/v1/echo`);
  return await response.json();
}

export async function setMockForceError(forceError: boolean) {
  await fetch(`${MOCK_UPSTREAM}/__control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forceError }),
  });
}
