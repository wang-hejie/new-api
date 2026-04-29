/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'bun:test';
import { ENDPOINT_TYPES } from '../../constants/playground.constants';

const createHarness = async ({
  endpointType = ENDPOINT_TYPES.OPENAI,
  isModelMetadataReady = true,
  customRequestBody = JSON.stringify({ model: 'gpt-4o' }),
} = {}) => {
  const { useSyncMessageAndCustomBody } = await import(
    './useSyncMessageAndCustomBody'
  );
  const customBodyUpdates = [];
  const messageUpdates = [];
  let saveCount = 0;
  let hookResult;

  const Probe = () => {
    hookResult = useSyncMessageAndCustomBody(
      true,
      customRequestBody,
      [{ id: 'u1', role: 'user', content: 'hello' }],
      { model: 'gpt-4o', temperature: 0.7, stream: true },
      (value) => customBodyUpdates.push(value),
      (value) => messageUpdates.push(value),
      () => {
        saveCount += 1;
      },
      endpointType,
      isModelMetadataReady,
    );
    return null;
  };

  renderToStaticMarkup(React.createElement(Probe));

  return {
    hookResult,
    customBodyUpdates,
    messageUpdates,
    get saveCount() {
      return saveCount;
    },
  };
};

const waitForAsyncWork = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

describe('useSyncMessageAndCustomBody metadata readiness', () => {
  test('does not mutate custom request body before model metadata is ready', async () => {
    const harness = await createHarness({
      isModelMetadataReady: false,
      customRequestBody: JSON.stringify({
        model: 'gpt-image-2',
        prompt: 'custom generation ok',
      }),
    });

    harness.hookResult.syncMessageToCustomBody();
    harness.hookResult.syncCustomBodyToMessage();

    expect(harness.customBodyUpdates).toEqual([]);
    expect(harness.messageUpdates).toEqual([]);
    expect(harness.saveCount).toBe(0);
  });

  test('does not sync chat messages into image-generation custom request bodies', async () => {
    const harness = await createHarness({
      endpointType: ENDPOINT_TYPES.IMAGE_GENERATION,
      customRequestBody: JSON.stringify({
        model: 'gpt-image-2',
        prompt: 'custom generation ok',
      }),
    });

    harness.hookResult.syncMessageToCustomBody();
    harness.hookResult.syncCustomBodyToMessage();

    expect(harness.customBodyUpdates).toEqual([]);
    expect(harness.messageUpdates).toEqual([]);
  });

  test('keeps chat custom request body and message sync behavior after metadata is ready', async () => {
    const harness = await createHarness({
      endpointType: ENDPOINT_TYPES.OPENAI,
      customRequestBody: JSON.stringify({ model: 'gpt-4o' }),
    });

    harness.hookResult.syncMessageToCustomBody();
    await waitForAsyncWork();

    expect(harness.customBodyUpdates).toHaveLength(1);
    expect(JSON.parse(harness.customBodyUpdates[0])).toMatchObject({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(harness.saveCount).toBe(1);
  });
});
