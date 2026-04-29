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
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import path from 'node:path';
import {
  API_ENDPOINTS,
  DEBUG_TABS,
  ENDPOINT_TYPES,
  MESSAGE_STATUS,
} from '../../constants/playground.constants';

const sseInstances = [];

class MockSSE {
  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.listeners = {};
    this.streamed = false;
    this.closed = false;
    sseInstances.push(this);
  }

  addEventListener(event, handler) {
    this.listeners[event] = handler;
  }

  stream() {
    this.streamed = true;
  }

  close() {
    this.closed = true;
  }
}

mock.module('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

mock.module('sse.js', () => ({
  SSE: MockSSE,
}));

mock.module('../../helpers', () => ({
  buildImageResponseContent: (responseData) => {
    const imageData = Array.isArray(responseData?.data)
      ? responseData.data
      : [];
    return [
      ...imageData
        .filter((item) => item?.revised_prompt)
        .map((item) => ({ type: 'text', text: item.revised_prompt })),
      ...imageData
        .map((item) => {
          const imageUrl =
            item?.url ||
            (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : '');
          return imageUrl
            ? { type: 'image_url', image_url: { url: imageUrl } }
            : null;
        })
        .filter(Boolean),
    ];
  },
  getUserIdFromLocalStorage: () => 'test-user',
  API: { get: async () => ({ data: { success: true, data: [] } }) },
  showError: () => {},
  handleApiError: (error, response = null) => ({
    error: error.message,
    status: response?.status,
  }),
  processThinkTags: (content = '', reasoningContent = '') => ({
    content,
    reasoningContent,
  }),
  processIncompleteThinkTags: (content = '', reasoningContent = '') => ({
    content,
    reasoningContent,
  }),
}));

mock.module('../../helpers/index.js', () => ({
  buildImageResponseContent: (responseData) => {
    const imageData = Array.isArray(responseData?.data)
      ? responseData.data
      : [];
    return [
      ...imageData
        .filter((item) => item?.revised_prompt)
        .map((item) => ({ type: 'text', text: item.revised_prompt })),
      ...imageData
        .map((item) => {
          const imageUrl =
            item?.url ||
            (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : '');
          return imageUrl
            ? { type: 'image_url', image_url: { url: imageUrl } }
            : null;
        })
        .filter(Boolean),
    ];
  },
  getUserIdFromLocalStorage: () => 'test-user',
  API: { get: async () => ({ data: { success: true, data: [] } }) },
  showError: () => {},
  handleApiError: (error, response = null) => ({
    error: error.message,
    status: response?.status,
  }),
  processThinkTags: (content = '', reasoningContent = '') => ({
    content,
    reasoningContent,
  }),
  processIncompleteThinkTags: (content = '', reasoningContent = '') => ({
    content,
    reasoningContent,
  }),
}));

const helpersModulePath = path.resolve('src/helpers/index.js');
mock.module(helpersModulePath, () => ({
  buildImageResponseContent: (responseData) => {
    const imageData = Array.isArray(responseData?.data)
      ? responseData.data
      : [];
    return [
      ...imageData
        .filter((item) => item?.revised_prompt)
        .map((item) => ({ type: 'text', text: item.revised_prompt })),
      ...imageData
        .map((item) => {
          const imageUrl =
            item?.url ||
            (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : '');
          return imageUrl
            ? { type: 'image_url', image_url: { url: imageUrl } }
            : null;
        })
        .filter(Boolean),
    ];
  },
  getUserIdFromLocalStorage: () => 'test-user',
  API: { get: async () => ({ data: { success: true, data: [] } }) },
  showError: () => {},
  handleApiError: (error, response = null) => ({
    error: error.message,
    status: response?.status,
  }),
  processThinkTags: (content = '', reasoningContent = '') => ({
    content,
    reasoningContent,
  }),
  processIncompleteThinkTags: (content = '', reasoningContent = '') => ({
    content,
    reasoningContent,
  }),
}));

mock.module(`file://${helpersModulePath}`, () => ({
  buildImageResponseContent: (responseData) => {
    const imageData = Array.isArray(responseData?.data)
      ? responseData.data
      : [];
    return [
      ...imageData
        .filter((item) => item?.revised_prompt)
        .map((item) => ({ type: 'text', text: item.revised_prompt })),
      ...imageData
        .map((item) => {
          const imageUrl =
            item?.url ||
            (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : '');
          return imageUrl
            ? { type: 'image_url', image_url: { url: imageUrl } }
            : null;
        })
        .filter(Boolean),
    ];
  },
  getUserIdFromLocalStorage: () => 'test-user',
  API: { get: async () => ({ data: { success: true, data: [] } }) },
  showError: () => {},
  handleApiError: (error, response = null) => ({
    error: error.message,
    status: response?.status,
  }),
  processThinkTags: (content = '', reasoningContent = '') => ({
    content,
    reasoningContent,
  }),
  processIncompleteThinkTags: (content = '', reasoningContent = '') => ({
    content,
    reasoningContent,
  }),
}));

const waitForAsyncWork = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const createHookHarness = async () => {
  const { useApiRequest } = await import('./useApiRequest');

  let messages = [
    {
      role: 'user',
      content: 'draw a mountain',
      status: MESSAGE_STATUS.COMPLETE,
    },
    {
      role: 'assistant',
      content: '',
      reasoningContent: '',
      status: MESSAGE_STATUS.LOADING,
    },
  ];
  let debugData = {};
  const activeTabs = [];
  const savedMessages = [];
  const sseSourceRef = { current: null };
  let hookResult;

  const setMessage = (updater) => {
    messages = typeof updater === 'function' ? updater(messages) : updater;
  };
  const setDebugData = (updater) => {
    debugData = typeof updater === 'function' ? updater(debugData) : updater;
  };
  const setActiveDebugTab = (tab) => {
    activeTabs.push(tab);
  };
  const saveMessages = (nextMessages) => {
    savedMessages.push(nextMessages);
  };

  const Probe = () => {
    hookResult = useApiRequest(
      setMessage,
      setDebugData,
      setActiveDebugTab,
      sseSourceRef,
      saveMessages,
    );
    return null;
  };

  renderToStaticMarkup(React.createElement(Probe));

  return {
    get messages() {
      return messages;
    },
    get debugData() {
      return debugData;
    },
    activeTabs,
    savedMessages,
    sseSourceRef,
    hookResult,
  };
};

describe('useApiRequest endpoint dispatch', () => {
  beforeEach(() => {
    sseInstances.length = 0;
    delete globalThis.fetch;
  });

  test('image-generation requests use images endpoint and map url and b64_json into assistant content', async () => {
    const harness = await createHookHarness();
    const fetchCalls = [];
    const payload = {
      model: 'gpt-image-1',
      group: 'default',
      prompt: 'draw a mountain',
      n: 2,
      size: '1024x1024',
    };

    globalThis.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          created: 1715676751,
          data: [
            {
              revised_prompt: 'draw a detailed mountain',
              url: 'https://example.com/mountain.png',
            },
            {
              b64_json: 'iVBORw0KGgo=',
            },
          ],
        }),
      };
    };

    harness.hookResult.sendRequest(
      payload,
      true,
      ENDPOINT_TYPES.IMAGE_GENERATION,
    );
    await waitForAsyncWork();
    await waitForAsyncWork();

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe(API_ENDPOINTS.IMAGES_GENERATIONS);
    expect(fetchCalls[0].options.method).toBe('POST');
    expect(fetchCalls[0].options.headers['New-Api-User']).toBe('test-user');
    expect(JSON.parse(fetchCalls[0].options.body)).toEqual(payload);
    expect(sseInstances).toHaveLength(0);
    expect(harness.debugData.request).toEqual(payload);
    expect(harness.debugData.isStreaming).toBe(false);
    expect(harness.activeTabs).toContain(DEBUG_TABS.REQUEST);
    expect(harness.activeTabs).toContain(DEBUG_TABS.RESPONSE);

    const assistantMessage = harness.messages.at(-1);
    expect(assistantMessage.status).toBe(MESSAGE_STATUS.COMPLETE);
    expect(assistantMessage.reasoningContent).toBe('');
    expect(assistantMessage.content).toEqual([
      {
        type: 'text',
        text: 'draw a detailed mountain',
      },
      {
        type: 'image_url',
        image_url: { url: 'https://example.com/mountain.png' },
      },
      {
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' },
      },
    ]);
    expect(harness.savedMessages).toHaveLength(1);
  });

  test('image edit requests use explicit edits endpoint without JSON content type', async () => {
    const harness = await createHookHarness();
    const fetchCalls = [];
    const formData = new FormData();
    const file = new File(['image bytes'], 'apple.png', {
      type: 'image/png',
    });
    formData.append('model', 'gpt-image-2');
    formData.append('prompt', 'change the apple color to bright green');
    formData.append('reference_usage', 'subject');
    formData.append('image', file, file.name);

    const payload = {
      formData,
      debugSnapshot: {
        url: API_ENDPOINTS.IMAGES_EDITS,
        fields: {
          model: 'gpt-image-2',
          prompt: 'change the apple color to bright green',
          reference_usage: 'subject',
        },
        files: {
          image: [{ name: 'apple.png', size: 11, type: 'image/png' }],
        },
      },
    };

    globalThis.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          data: [{ url: 'https://example.com/edited.png' }],
        }),
      };
    };

    harness.hookResult.sendRequest(
      payload,
      false,
      ENDPOINT_TYPES.IMAGE_GENERATION,
      API_ENDPOINTS.IMAGES_EDITS,
    );
    await waitForAsyncWork();
    await waitForAsyncWork();

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe(API_ENDPOINTS.IMAGES_EDITS);
    expect(fetchCalls[0].options.method).toBe('POST');
    expect(fetchCalls[0].options.headers).toEqual({
      'New-Api-User': 'test-user',
    });
    expect(fetchCalls[0].options.body).toBe(formData);
    expect(harness.debugData.request).toEqual(payload.debugSnapshot);
    expect(harness.debugData.request.formData).toBeUndefined();
    expect(harness.messages.at(-1).content).toEqual([
      {
        type: 'image_url',
        image_url: { url: 'https://example.com/edited.png' },
      },
    ]);
  });

  test('chat stream requests keep using chat completions SSE endpoint', async () => {
    const harness = await createHookHarness();
    const payload = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hello' }],
      stream: true,
    };

    globalThis.fetch = () => {
      throw new Error('chat streaming should not use fetch');
    };

    harness.hookResult.sendRequest(payload, true, ENDPOINT_TYPES.OPENAI);

    expect(sseInstances).toHaveLength(1);
    expect(sseInstances[0].url).toBe(API_ENDPOINTS.CHAT_COMPLETIONS);
    expect(sseInstances[0].options.method).toBe('POST');
    expect(JSON.parse(sseInstances[0].options.payload)).toEqual(payload);
    expect(sseInstances[0].streamed).toBe(true);
    expect(harness.sseSourceRef.current).toBe(sseInstances[0]);
    expect(harness.debugData.request).toEqual(payload);
    expect(harness.debugData.isStreaming).toBe(true);
  });
});
