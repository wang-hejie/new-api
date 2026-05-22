import { test, expect, request as pwRequest } from '@playwright/test';
import { basename } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  BASE_URL,
  cleanupFixtures,
  mockEcho,
  prepareFixtures,
  storageStateForUser,
  type E2EFixtureState,
} from './fixtures';
import { imageTestAsset } from './helpers';

const referenceUsageField = ['reference', 'usage'].join('_');

const imagePart = (fileName = 'apple_red.png') => {
  const path = imageTestAsset(fileName);
  return {
    name: basename(path),
    mimeType: 'image/png',
    buffer: readFileSync(path),
  };
};

test.describe.serial('gpt-image-2 backend bypass guards', () => {
  let state: E2EFixtureState;
  let api: Awaited<ReturnType<typeof pwRequest.newContext>>;

  test.beforeAll(async () => {
    state = await prepareFixtures();
    api = await pwRequest.newContext({
      baseURL: BASE_URL,
      storageState: await storageStateForUser(state.user),
      extraHTTPHeaders: {
        'New-Api-User': String(state.user.id),
      },
    });
  });

  test.afterAll(async () => {
    await api?.dispose();
    await cleanupFixtures(
      state?.user,
      state?.originalModelPrice,
      state?.originalPassThroughRequestEnabled,
      state?.originalPassThroughRequestEnabledExists,
    );
  });

  test('gpt-image-2 direct edits POST strips legacy fields', async () => {
    const response = await api.post('/pg/images/edits', {
      multipart: {
        model: 'gpt-image-2',
        prompt: 'bypass edit prompt',
        n: '1',
        size: '1024x1024',
        quality: 'auto',
        group: state.user.group,
        response_format: 'url',
        [referenceUsageField]: 'subject',
        image: imagePart(),
      },
    });

    expect(response.ok()).toBe(true);
    const echo = await mockEcho();
    expect(echo.latest.path).toBe('/v1/images/edits');
    expect(echo.latest.fields).toMatchObject({
      model: ['gpt-image-2'],
      prompt: ['bypass edit prompt'],
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

  test('gpt-image-1 direct edits POST keeps legacy fields (no regression)', async () => {
    const response = await api.post('/pg/images/edits', {
      multipart: {
        model: 'gpt-image-1',
        prompt: 'bypass gpt image one edit prompt',
        n: '1',
        size: '1024x1024',
        quality: 'auto',
        group: state.user.group,
        response_format: 'url',
        [referenceUsageField]: 'subject',
        image: imagePart(),
      },
    });

    expect(response.ok()).toBe(true);
    const echo = await mockEcho();
    expect(echo.latest.path).toBe('/v1/images/edits');
    expect(echo.latest.fields).toMatchObject({
      model: ['gpt-image-1'],
      prompt: ['bypass gpt image one edit prompt'],
      n: ['1'],
      size: ['1024x1024'],
      quality: ['auto'],
      group: [state.user.group],
      response_format: ['url'],
      [referenceUsageField]: ['subject'],
    });
    expect(echo.latest.files.image[0]).toMatchObject({
      name: 'apple_red.png',
      type: 'image/png',
    });
  });

  test('gpt-image-2 direct generations POST drops legacy reference field via DTO Extra', async () => {
    const response = await api.post('/pg/images/generations', {
      data: {
        model: 'gpt-image-2',
        prompt: 'bypass generation prompt',
        n: 1,
        size: '1024x1024',
        quality: 'auto',
        [referenceUsageField]: 'subject',
      },
    });

    expect(response.ok()).toBe(true);
    const echo = await mockEcho();
    expect(echo.latest.path).toBe('/v1/images/generations');
    expect(echo.latest.json).toMatchObject({
      model: 'gpt-image-2',
      prompt: 'bypass generation prompt',
      n: 1,
      size: '1024x1024',
      quality: 'auto',
    });
    expect(echo.latest.json).not.toHaveProperty(referenceUsageField);
  });

  test('gpt-image-2 direct edits POST without legacy fields succeeds', async () => {
    const response = await api.post('/pg/images/edits', {
      multipart: {
        model: 'gpt-image-2',
        prompt: 'clean bypass edit prompt',
        n: '1',
        size: '1024x1024',
        quality: 'auto',
        image: imagePart(),
      },
    });

    expect(response.ok()).toBe(true);
    const echo = await mockEcho();
    expect(echo.latest.path).toBe('/v1/images/edits');
    expect(echo.latest.fields).toMatchObject({
      model: ['gpt-image-2'],
      prompt: ['clean bypass edit prompt'],
      n: ['1'],
      size: ['1024x1024'],
      quality: ['auto'],
    });
    expect(echo.latest.files.image[0].size).toBeGreaterThan(0);
  });
});
