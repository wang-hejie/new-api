import { test, expect } from '@playwright/test';
import { cleanupFixtures, mockEcho, prepareFixtures } from './fixtures';

test('fixtures prepare mock channel and metadata', async () => {
  const state = await prepareFixtures();
  try {
    expect(state.user.username).toMatch(/^E2E_GPT_IMAGE_2_|.+/);
    expect(state.channelId).toBeGreaterThan(0);
    const echo = await mockEcho();
    expect(echo.ok).toBe(true);
  } finally {
    await cleanupFixtures(
      state.user,
      state.originalModelPrice,
      state.originalPassThroughRequestEnabled,
      state.originalPassThroughRequestEnabledExists,
    );
  }
});
