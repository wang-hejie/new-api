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
import { ENDPOINT_TYPES } from '../../constants/playground.constants';

mock.module('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

mock.module('@douyinfe/semi-ui', () => ({
  Button: ({ children, onClick, ...props }) =>
    React.createElement('button', { onClick, ...props }, children),
  Empty: ({ title }) => React.createElement('div', null, title),
  InputNumber: ({ disabled, max, value }) =>
    React.createElement('input', {
      disabled,
      max,
      value,
      readOnly: true,
    }),
  Modal: {
    confirm: () => {},
  },
  Nav: Object.assign(
    ({ children }) => React.createElement('nav', null, children),
    {
      Sub: ({ children, text }) =>
        React.createElement('section', null, text, children),
      Item: ({ text }) => React.createElement('button', null, text),
    },
  ),
  Select: ({ optionList = [], value = '' }) =>
    React.createElement(
      'select',
      { 'data-value': value },
      null,
      optionList.map((option) =>
        React.createElement(
          'option',
          { key: option.value, value: option.value },
          option.label,
        ),
      ),
    ),
  Radio: ({ children, extra, value }) =>
    React.createElement(
      'label',
      { 'data-value': value },
      children,
      extra ? React.createElement('span', null, extra) : null,
    ),
  RadioGroup: ({ children, disabled, value }) =>
    React.createElement(
      'div',
      { 'data-disabled': disabled ? 'true' : 'false', 'data-value': value },
      children,
    ),
  Toast: {
    success: () => {},
    warning: () => {},
  },
  SideSheet: ({ children, visible, title }) =>
    React.createElement('aside', { 'data-visible': visible }, title, children),
  Skeleton: Object.assign(() => React.createElement('div', null, 'skeleton'), {
    Paragraph: ({ rows }) =>
      React.createElement('div', { 'data-skeleton-rows': rows }),
  }),
  Tooltip: ({ children }) => React.createElement('span', null, children),
  Typography: {
    Text: ({ children }) => React.createElement('span', null, children),
    Title: ({ children }) => React.createElement('h2', null, children),
  },
}));

mock.module('lucide-react', () => ({
  Image: () => React.createElement('i', null),
  Layers: () => React.createElement('i', null),
  SlidersHorizontal: () => React.createElement('i', null),
  FileOutput: () => React.createElement('i', null),
  Repeat2: () => React.createElement('i', null),
  ImagePlus: () => React.createElement('i', null),
  Trash2: () => React.createElement('i', null),
  UploadCloud: () => React.createElement('i', null),
}));

const playgroundImageHelpers = {
  getImageSizeOptionsForModel: (
    _model = '',
    imageParameters,
    imageGenerationMode = '',
  ) => {
    if (imageParameters?.size === false) return [];
    if (imageGenerationMode === 'gemini_native') {
      return ['', '1:1', '4:3', '3:4', '16:9', '9:16', '21:9'];
    }
    return ['1024x1024'];
  },
  getImageQualityOptionsForModel: (
    model = '',
    imageParameters,
    imageGenerationMode = '',
  ) => {
    if (imageParameters?.quality === false) return [];
    if (imageGenerationMode === 'gemini_native') return ['', '1K', '2K', '4K'];
    if (model.toLowerCase().startsWith('gpt-image-')) {
      return ['auto', 'low', 'medium'];
    }
    return ['auto', 'standard', 'hd', 'low', 'medium', 'high'];
  },
  isGptImageModel: (model = '') => model.toLowerCase().startsWith('gpt-image-'),
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
};

mock.module('../../helpers', () => playgroundImageHelpers);
mock.module('../../helpers/index.js', () => playgroundImageHelpers);

const helpersModulePath = path.resolve('src/helpers/index.js');
mock.module(helpersModulePath, () => playgroundImageHelpers);
mock.module(`file://${helpersModulePath}`, () => playgroundImageHelpers);

describe('ImageParameterControl', () => {
  test('hides unsupported Gemini native image parameters from metadata', async () => {
    const { default: ImageParameterControl } = await import(
      './ImageParameterControl'
    );

    const html = renderToStaticMarkup(
      <ImageParameterControl
        inputs={{
          model: 'gemini-3.1-flash-image-preview',
          prompt_n: 1,
          imageParameters: {
            size: false,
            quality: false,
            response_format: false,
            n_max: 1,
          },
        }}
        onInputChange={() => {}}
      />,
    );

    expect(html).not.toContain('图像尺寸');
    expect(html).not.toContain('图像质量');
    expect(html).not.toContain('返回格式');
    expect(html).toContain('图像数量');
    expect(html).toContain('Gemini 图像模型一次只生成 1 张图');
    expect(html).toContain('disabled=""');
    expect(html).toContain('max="1"');
  });

  test('renders Gemini native aspect ratio and resolution labels', async () => {
    const { default: ImageParameterControl } = await import(
      './ImageParameterControl'
    );

    const html = renderToStaticMarkup(
      <ImageParameterControl
        inputs={{
          model: 'gemini-3.1-flash-image-preview',
          prompt_size: '9:16',
          prompt_quality: '2K',
          prompt_n: 1,
          imageGenerationMode: 'gemini_native',
          imageParameters: {
            size: true,
            quality: true,
            response_format: false,
            n_max: 1,
            supports_edits: true,
          },
        }}
        onInputChange={() => {}}
      />,
    );

    expect(html).toContain('宽高比');
    expect(html).toContain('图像分辨率');
    expect(html).toContain('默认（不发送）');
    expect(html).toContain('9:16（竖屏）');
    expect(html).toContain('2K');
    expect(html).not.toContain('图像尺寸');
    expect(html).not.toContain('图像质量');
    expect(html).not.toContain('返回格式');
  });

  test('shows default value when stored Gemini size or quality is invalid', async () => {
    const { default: ImageParameterControl } = await import(
      './ImageParameterControl'
    );

    const html = renderToStaticMarkup(
      <ImageParameterControl
        inputs={{
          model: 'gemini-3.1-flash-image-preview',
          prompt_size: '1024x1024',
          prompt_quality: 'auto',
          prompt_n: 1,
          imageGenerationMode: 'gemini_native',
          imageParameters: {
            size: true,
            quality: true,
            response_format: false,
            n_max: 1,
            supports_edits: true,
          },
        }}
        onInputChange={() => {}}
      />,
    );

    expect(html).toContain('宽高比');
    expect(html).toContain('图像分辨率');
    expect(html).toContain('默认（不发送）');
    expect(html).toContain('data-value=""');
  });

  test('keeps generic image controls when no capability metadata is present', async () => {
    const { default: ImageParameterControl } = await import(
      './ImageParameterControl'
    );

    const html = renderToStaticMarkup(
      <ImageParameterControl
        inputs={{
          model: 'flux-pro',
          prompt_size: '1024x1024',
          prompt_quality: 'auto',
          prompt_n: 2,
          prompt_response_format: 'url',
        }}
        onInputChange={() => {}}
      />,
    );

    expect(html).toContain('图像尺寸');
    expect(html).toContain('图像质量');
    expect(html).toContain('图像数量');
    expect(html).toContain('返回格式');
  });

  test('hides reference usage globally in edit mode', async () => {
    const { default: ImageParameterControl } = await import(
      './ImageParameterControl'
    );

    const html = renderToStaticMarkup(
      <ImageParameterControl
        inputs={{
          model: 'flux-pro',
          prompt_size: '1024x1024',
          prompt_quality: 'auto',
          prompt_n: 2,
          prompt_response_format: 'url',
          imageRequestMode: 'edit',
          imageParameters: {
            size: true,
            quality: true,
            response_format: true,
            supports_edits: true,
          },
        }}
        onInputChange={() => {}}
      />,
    );

    expect(html).not.toContain('参考用途');
    expect(html).toContain('返回格式');
  });

  test('hides response format for gpt-image-2', async () => {
    const { default: ImageParameterControl } = await import(
      './ImageParameterControl'
    );

    const html = renderToStaticMarkup(
      <ImageParameterControl
        inputs={{
          model: 'gpt-image-2',
          prompt_size: '1024x1024',
          prompt_quality: 'auto',
          prompt_n: 1,
          prompt_response_format: 'url',
          imageRequestMode: 'edit',
          imageParameters: {
            size: true,
            quality: true,
            response_format: false,
            n_max: 10,
            supports_edits: true,
          },
        }}
        onInputChange={() => {}}
      />,
    );

    expect(html).not.toContain('参考用途');
    expect(html).not.toContain('返回格式');
    expect(html).toContain('图像尺寸');
    expect(html).toContain('图像质量');
    expect(html).not.toContain('宽高比');
    expect(html).not.toContain('图像分辨率');
  });

  test('renders gpt-image quality options without high and clears stored high', async () => {
    const { default: ImageParameterControl } = await import(
      './ImageParameterControl'
    );

    const html = renderToStaticMarkup(
      <ImageParameterControl
        inputs={{
          model: 'gpt-image-2',
          prompt_size: '1024x1024',
          prompt_quality: 'high',
          prompt_n: 1,
          prompt_response_format: 'url',
          imageRequestMode: 'generation',
          imageParameters: {
            size: true,
            quality: true,
            response_format: false,
            n_max: 10,
            supports_edits: true,
          },
        }}
        onInputChange={() => {}}
      />,
    );

    expect(html).toContain('图像质量');
    expect(html).toContain('<option value="auto">自动</option>');
    expect(html).toContain('<option value="low">低</option>');
    expect(html).toContain('<option value="medium">中</option>');
    expect(html).toContain('data-value=""');
    expect(html).not.toContain('<option value="high">高</option>');
  });
});
