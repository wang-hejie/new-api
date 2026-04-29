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
import { describe, expect, mock, test } from 'bun:test';
import path from 'node:path';
import {
  DEFAULT_CONFIG,
  ENDPOINT_TYPES,
} from '../../constants/playground.constants';

const buildImageResponseContent = (responseData) => {
  const imageData = Array.isArray(responseData?.data) ? responseData.data : [];
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
};

mock.module('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

mock.module('../../components/playground/configStorage', () => ({
  loadConfig: () => DEFAULT_CONFIG,
  saveConfig: () => {},
  loadMessages: () => null,
  saveMessages: () => {},
}));

mock.module('../../components/playground/configStorage.js', () => ({
  loadConfig: () => DEFAULT_CONFIG,
  saveConfig: () => {},
  loadMessages: () => null,
  saveMessages: () => {},
}));

mock.module('../../helpers', () => ({
  buildImageResponseContent,
  getUserIdFromLocalStorage: () => 'test-user',
  API: { get: async () => ({ data: { success: true, data: [] } }) },
  showError: () => {},
  handleApiError: (error, response = null) => ({
    error: error.message,
    status: response?.status,
  }),
  processIncompleteThinkTags: (content = '', reasoningContent = '') => ({
    content,
    reasoningContent,
  }),
  processThinkTags: (content = '', reasoningContent = '') => ({
    content,
    reasoningContent,
  }),
  getEndpointTypeForModel: (models = [], modelName = '') => {
    const model = models.find((item) => item.value === modelName);
    return model?.endpointTypes?.includes(ENDPOINT_TYPES.IMAGE_GENERATION)
      ? ENDPOINT_TYPES.IMAGE_GENERATION
      : ENDPOINT_TYPES.OPENAI;
  },
  getEndpointTypeFromCustomBody: (
    customRequestBody,
    models = [],
    fallbackModel = '',
  ) => {
    try {
      const parsed = JSON.parse(customRequestBody || '{}');
      const model = models.find((item) => item.value === parsed.model);
      if (model) {
        return model.endpointTypes.includes(ENDPOINT_TYPES.IMAGE_GENERATION)
          ? ENDPOINT_TYPES.IMAGE_GENERATION
          : ENDPOINT_TYPES.OPENAI;
      }
    } catch (_) {}

    const fallback = models.find((item) => item.value === fallbackModel);
    return fallback?.endpointTypes?.includes(ENDPOINT_TYPES.IMAGE_GENERATION)
      ? ENDPOINT_TYPES.IMAGE_GENERATION
      : ENDPOINT_TYPES.OPENAI;
  },
}));

mock.module('../../helpers/index.js', () => ({
  buildImageResponseContent,
  getUserIdFromLocalStorage: () => 'test-user',
  API: { get: async () => ({ data: { success: true, data: [] } }) },
  showError: () => {},
  handleApiError: (error, response = null) => ({
    error: error.message,
    status: response?.status,
  }),
  processIncompleteThinkTags: (content = '', reasoningContent = '') => ({
    content,
    reasoningContent,
  }),
  processThinkTags: (content = '', reasoningContent = '') => ({
    content,
    reasoningContent,
  }),
  getEndpointTypeForModel: (models = [], modelName = '') => {
    const model = models.find((item) => item.value === modelName);
    return model?.endpointTypes?.includes(ENDPOINT_TYPES.IMAGE_GENERATION)
      ? ENDPOINT_TYPES.IMAGE_GENERATION
      : ENDPOINT_TYPES.OPENAI;
  },
  getEndpointTypeFromCustomBody: (
    customRequestBody,
    models = [],
    fallbackModel = '',
  ) => {
    try {
      const parsed = JSON.parse(customRequestBody || '{}');
      const model = models.find((item) => item.value === parsed.model);
      if (model) {
        return model.endpointTypes.includes(ENDPOINT_TYPES.IMAGE_GENERATION)
          ? ENDPOINT_TYPES.IMAGE_GENERATION
          : ENDPOINT_TYPES.OPENAI;
      }
    } catch (_) {}

    const fallback = models.find((item) => item.value === fallbackModel);
    return fallback?.endpointTypes?.includes(ENDPOINT_TYPES.IMAGE_GENERATION)
      ? ENDPOINT_TYPES.IMAGE_GENERATION
      : ENDPOINT_TYPES.OPENAI;
  },
}));

const configStorageModulePath = path.resolve(
  'src/components/playground/configStorage.js',
);
mock.module(configStorageModulePath, () => ({
  loadConfig: () => DEFAULT_CONFIG,
  saveConfig: () => {},
  loadMessages: () => null,
  saveMessages: () => {},
}));

mock.module(`file://${configStorageModulePath}`, () => ({
  loadConfig: () => DEFAULT_CONFIG,
  saveConfig: () => {},
  loadMessages: () => null,
  saveMessages: () => {},
}));

const helpersModulePath = path.resolve('src/helpers/index.js');
mock.module(helpersModulePath, () => ({
  buildImageResponseContent,
  getUserIdFromLocalStorage: () => 'test-user',
  API: { get: async () => ({ data: { success: true, data: [] } }) },
  showError: () => {},
  handleApiError: (error, response = null) => ({
    error: error.message,
    status: response?.status,
  }),
  processIncompleteThinkTags: (content = '', reasoningContent = '') => ({
    content,
    reasoningContent,
  }),
  processThinkTags: (content = '', reasoningContent = '') => ({
    content,
    reasoningContent,
  }),
  getEndpointTypeForModel: (models = [], modelName = '') => {
    const model = models.find((item) => item.value === modelName);
    return model?.endpointTypes?.includes(ENDPOINT_TYPES.IMAGE_GENERATION)
      ? ENDPOINT_TYPES.IMAGE_GENERATION
      : ENDPOINT_TYPES.OPENAI;
  },
  getEndpointTypeFromCustomBody: (
    customRequestBody,
    models = [],
    fallbackModel = '',
  ) => {
    try {
      const parsed = JSON.parse(customRequestBody || '{}');
      const model = models.find((item) => item.value === parsed.model);
      if (model) {
        return model.endpointTypes.includes(ENDPOINT_TYPES.IMAGE_GENERATION)
          ? ENDPOINT_TYPES.IMAGE_GENERATION
          : ENDPOINT_TYPES.OPENAI;
      }
    } catch (_) {}

    const fallback = models.find((item) => item.value === fallbackModel);
    return fallback?.endpointTypes?.includes(ENDPOINT_TYPES.IMAGE_GENERATION)
      ? ENDPOINT_TYPES.IMAGE_GENERATION
      : ENDPOINT_TYPES.OPENAI;
  },
}));

mock.module(`file://${helpersModulePath}`, () => ({
  buildImageResponseContent,
  getUserIdFromLocalStorage: () => 'test-user',
  API: { get: async () => ({ data: { success: true, data: [] } }) },
  showError: () => {},
  handleApiError: (error, response = null) => ({
    error: error.message,
    status: response?.status,
  }),
  processIncompleteThinkTags: (content = '', reasoningContent = '') => ({
    content,
    reasoningContent,
  }),
  processThinkTags: (content = '', reasoningContent = '') => ({
    content,
    reasoningContent,
  }),
  getEndpointTypeForModel: (models = [], modelName = '') => {
    const model = models.find((item) => item.value === modelName);
    return model?.endpointTypes?.includes(ENDPOINT_TYPES.IMAGE_GENERATION)
      ? ENDPOINT_TYPES.IMAGE_GENERATION
      : ENDPOINT_TYPES.OPENAI;
  },
  getEndpointTypeFromCustomBody: (
    customRequestBody,
    models = [],
    fallbackModel = '',
  ) => {
    try {
      const parsed = JSON.parse(customRequestBody || '{}');
      const model = models.find((item) => item.value === parsed.model);
      if (model) {
        return model.endpointTypes.includes(ENDPOINT_TYPES.IMAGE_GENERATION)
          ? ENDPOINT_TYPES.IMAGE_GENERATION
          : ENDPOINT_TYPES.OPENAI;
      }
    } catch (_) {}

    const fallback = models.find((item) => item.value === fallbackModel);
    return fallback?.endpointTypes?.includes(ENDPOINT_TYPES.IMAGE_GENERATION)
      ? ENDPOINT_TYPES.IMAGE_GENERATION
      : ENDPOINT_TYPES.OPENAI;
  },
}));

describe('usePlaygroundState endpoint type', () => {
  test('exposes derived endpointType for playground page request routing', async () => {
    const { usePlaygroundState } = await import('./usePlaygroundState');
    let capturedState;

    const Probe = () => {
      capturedState = usePlaygroundState();
      return React.createElement('div', null, capturedState.endpointType);
    };

    renderToStaticMarkup(React.createElement(Probe));

    expect(capturedState.endpointType).toBe(ENDPOINT_TYPES.OPENAI);
    expect(capturedState.selectedEndpointType).toBe(ENDPOINT_TYPES.OPENAI);
    expect(capturedState.setModels).toBeFunction();
  });
});
