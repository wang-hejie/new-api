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

let params = {};
const navigateCalls = [];
const apiCalls = [];
let docsListResponse = {
  success: true,
  data: [
    {
      slug: 'gpt-image-2',
      title: 'gpt-image-2 使用指南',
      category: '模型指南',
      order: 10,
    },
    {
      slug: 'common-doc',
      title: 'Common Doc',
      category: '',
      order: 20,
    },
  ],
};
const errors = [];
let mobile = false;
const t = (key) => key;
let contentResponse = {
  success: true,
  data: {
    slug: 'common-doc',
    title: 'Common Doc',
    category: '通用',
    content: '# Common Doc',
  },
};

const helpersMock = {
  API: {
    get: async (url) => {
      apiCalls.push(url);
      if (url === '/api/docs/content') {
        return { data: contentResponse };
      }
      return { data: docsListResponse };
    },
  },
  showError: (message) => {
    errors.push(message);
  },
};

mock.module('react-i18next', () => ({
  useTranslation: () => ({ t }),
}));

mock.module('react-router-dom', () => ({
  useNavigate: () => (to, options) => navigateCalls.push({ to, options }),
  useParams: () => params,
}));

mock.module('@douyinfe/semi-ui', () => ({
  Button: ({ children, onClick, ...props }) =>
    React.createElement('button', { onClick, ...props }, children),
  Empty: ({ title }) => React.createElement('div', null, title),
  Nav: Object.assign(
    ({ children }) => React.createElement('nav', null, children),
    {
      Sub: ({ children, text }) =>
        React.createElement('section', null, text, children),
      Item: ({ text }) => React.createElement('button', null, text),
    },
  ),
  Skeleton: Object.assign(() => React.createElement('div', null, 'skeleton'), {
    Paragraph: ({ rows }) =>
      React.createElement('div', { 'data-skeleton-rows': rows }),
  }),
  SideSheet: ({ children, visible, title }) =>
    React.createElement(
      'aside',
      { 'data-visible': visible },
      title,
      children,
  ),
  Typography: {
    Text: ({ children }) => React.createElement('span', null, children),
    Title: ({ children }) => React.createElement('h2', null, children),
  },
}));

mock.module('@douyinfe/semi-icons', () => ({
  IconMenu: () => React.createElement('i', null),
}));

mock.module('@douyinfe/semi-illustrations', () => ({
  IllustrationConstruction: () => React.createElement('i', null),
  IllustrationConstructionDark: () => React.createElement('i', null),
}));

mock.module('../../hooks/common/useIsMobile', () => ({
  useIsMobile: () => mobile,
}));

mock.module('../../components/common/markdown/MarkdownRenderer', () => ({
  default: ({ content }) => React.createElement('pre', null, content),
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

describe('DocsLayout', () => {
  beforeEach(() => {
    params = {};
    navigateCalls.length = 0;
    apiCalls.length = 0;
    errors.length = 0;
    mobile = false;
    docsListResponse = {
      success: true,
      data: [
        {
          slug: 'gpt-image-2',
          title: 'gpt-image-2 使用指南',
          category: '模型指南',
          order: 10,
        },
        {
          slug: 'common-doc',
          title: 'Common Doc',
          category: '',
          order: 20,
        },
      ],
    };
    contentResponse = {
      success: true,
      data: {
        slug: 'common-doc',
        title: 'Common Doc',
        category: '通用',
        content: '# Common Doc',
      },
    };
  });

  test('loads the public docs list and redirects /docs to the first doc', async () => {
    const { default: DocsLayout } = await import('./DocsLayout');

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(<DocsLayout />);
    });
    await flushEffects();

    const html = JSON.stringify(renderer.toJSON());
    expect(apiCalls).toEqual(['/api/docs/list']);
    expect(navigateCalls).toEqual([
      { to: '/docs/gpt-image-2', options: { replace: true } },
    ]);
    expect(html).toContain('文档中心');
    expect(html).toContain('模型指南');
    expect(html).toContain('gpt-image-2 使用指南');
    expect(html).toContain('通用');
    expect(html).toContain('Common Doc');
  });

  test('renders the requested doc without redirecting when slug is present', async () => {
    const { default: DocsLayout } = await import('./DocsLayout');
    params = { slug: 'common-doc' };

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(<DocsLayout />);
    });
    await flushEffects();

    const html = JSON.stringify(renderer.toJSON());
    expect(apiCalls).toEqual(['/api/docs/list', '/api/docs/content']);
    expect(html).toContain('Common Doc');
    expect(html).toContain('# Common Doc');
    expect(navigateCalls).toEqual([]);
  });

  test('renders empty state and reports the API message when list loading fails', async () => {
    const { default: DocsLayout } = await import('./DocsLayout');
    docsListResponse = {
      success: false,
      message: 'list failed',
      data: null,
    };

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(<DocsLayout />);
    });
    await flushEffects();

    expect(errors).toEqual(['list failed']);
    expect(JSON.stringify(renderer.toJSON())).toContain('暂无文档');
    expect(navigateCalls).toEqual([]);
  });
});
