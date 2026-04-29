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
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import path from 'node:path';

const apiCalls = [];
const errors = [];
let contentResponse = {
  success: true,
  data: {
    slug: 'gpt-image-2',
    title: 'gpt-image-2 使用指南',
    category: '模型指南',
    content: '# gpt-image-2\n\nGuide body.',
  },
};
const t = (key) => key;

const helpersMock = {
  API: {
    get: async (url, config) => {
      apiCalls.push({ url, config });
      return { data: contentResponse };
    },
  },
  showError: (message) => {
    errors.push(message);
  },
};

mock.module('react-i18next', () => ({
  useTranslation: () => ({ t }),
}));

mock.module('@douyinfe/semi-ui', () => ({
  Empty: ({ title }) => React.createElement('div', null, title),
  Skeleton: Object.assign(() => React.createElement('div', null, 'skeleton'), {
    Paragraph: ({ rows }) =>
      React.createElement('div', { 'data-skeleton-rows': rows }),
  }),
  Typography: {
    Text: ({ children }) => React.createElement('span', null, children),
    Title: ({ children }) => React.createElement('h1', null, children),
  },
}));

mock.module('@douyinfe/semi-illustrations', () => ({
  IllustrationConstruction: () => React.createElement('i', null),
  IllustrationConstructionDark: () => React.createElement('i', null),
}));

mock.module('../../components/common/markdown/MarkdownRenderer', () => ({
  default: ({ content }) =>
    React.createElement('pre', { 'data-markdown-content': content }, content),
}));

mock.module('../../helpers', () => helpersMock);
mock.module('../../helpers/index.js', () => helpersMock);

const helpersModulePath = path.resolve('src/helpers/index.js');
mock.module(helpersModulePath, () => helpersMock);
mock.module(`file://${helpersModulePath}`, () => helpersMock);

const flushEffects = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('DocViewer', () => {
  beforeEach(() => {
    apiCalls.length = 0;
    errors.length = 0;
    contentResponse = {
      success: true,
      data: {
        slug: 'gpt-image-2',
        title: 'gpt-image-2 使用指南',
        category: '模型指南',
        content: '# gpt-image-2\n\nGuide body.',
      },
    };
  });

  test('loads and renders markdown content for the current slug', async () => {
    const { default: DocViewer } = await import('./DocViewer');

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(<DocViewer slug='gpt-image-2' />);
    });
    await flushEffects();

    const html = JSON.stringify(renderer.toJSON());
    expect(apiCalls).toEqual([
      {
        url: '/api/docs/content',
        config: {
          params: { slug: 'gpt-image-2' },
          skipErrorHandler: true,
        },
      },
    ]);
    expect(html).toContain('模型指南');
    expect(html).toContain('gpt-image-2 使用指南');
    expect(html).toContain('# gpt-image-2');
    expect(html).toContain('Guide body.');
  });

  test('shows the API error message when the document does not exist', async () => {
    const { default: DocViewer } = await import('./DocViewer');
    contentResponse = {
      success: false,
      message: '文档不存在',
      data: null,
    };

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(<DocViewer slug='missing-doc' />);
    });
    await flushEffects();

    expect(errors).toEqual(['文档不存在']);
    expect(JSON.stringify(renderer.toJSON())).toContain('文档不存在');
  });

  test('reloads content when slug changes', async () => {
    const { default: DocViewer } = await import('./DocViewer');

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(<DocViewer slug='gpt-image-2' />);
    });
    await flushEffects();

    contentResponse = {
      success: true,
      data: {
        slug: 'next-doc',
        title: 'Next Doc',
        category: '',
        content: '# Next Doc',
      },
    };
    await act(async () => {
      renderer.update(<DocViewer slug='next-doc' />);
    });
    await flushEffects();

    expect(apiCalls.map((call) => call.config.params.slug)).toEqual([
      'gpt-image-2',
      'next-doc',
    ]);
    const html = JSON.stringify(renderer.toJSON());
    expect(html).toContain('通用');
    expect(html).toContain('Next Doc');
    expect(html).toContain('# Next Doc');
  });
});
