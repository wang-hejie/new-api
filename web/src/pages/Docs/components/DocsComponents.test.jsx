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
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

const copied = [];
const toasts = [];
const makeText = (...codes) => String.fromCharCode(...codes);
const REQUEST_EXAMPLE_LABEL = makeText(35831, 27714, 31034, 20363);
const ACTIVE_SLUG = makeText(98);
const GPT_IMAGE_JSON = `{"model":"${[
  makeText(103, 112, 116),
  makeText(105, 109, 97, 103, 101),
  '2',
].join('-')}"}`;

mock.module('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

mock.module('@douyinfe/semi-ui', () => ({
  Button: ({ children, icon, onClick, ...props }) =>
    React.createElement('button', { onClick, ...props }, icon, children),
  Toast: {
    success: (message) => toasts.push({ type: 'success', message }),
    error: (message) => toasts.push({ type: 'error', message }),
  },
  Tooltip: ({ children }) =>
    React.createElement(React.Fragment, null, children),
}));

mock.module('@douyinfe/semi-icons', () => ({
  IconChevronLeft: () => React.createElement('i', { 'data-icon': 'left' }),
  IconChevronRight: () => React.createElement('i', { 'data-icon': 'right' }),
  IconCopy: () => React.createElement('i', { 'data-icon': 'copy' }),
  IconMenu: () => React.createElement('i', { 'data-icon': 'menu' }),
}));

mock.module('../../../helpers', () => ({
  copy: async (value) => {
    copied.push(value);
    return true;
  },
  rehypeSplitWordsIntoSpans: () => (tree) => tree,
}));
mock.module('../../../helpers/utils.jsx', () => ({
  copy: async (value) => {
    copied.push(value);
    return true;
  },
}));
mock.module('../../../helpers/render.jsx', () => ({
  rehypeSplitWordsIntoSpans: () => (tree) => tree,
}));

describe('Docs components', () => {
  beforeEach(() => {
    copied.length = 0;
    toasts.length = 0;
  });

  test('DocsSidebar 分组展示文档并标记当前页', async () => {
    const { default: DocsSidebar } = await import('./DocsSidebar');
    const selected = [];
    const html = renderToStaticMarkup(
      <DocsSidebar
        activeSlug={ACTIVE_SLUG}
        onSelectDoc={(slug) => selected.push(slug)}
        docs={[
          { slug: 'a', title: 'A', category: '模型指南' },
          { slug: ACTIVE_SLUG, title: 'B', category: '模型指南' },
          { slug: 'c', title: 'C', category: '' },
        ]}
      />,
    );

    expect(html).toContain('文档中心');
    expect(html).toContain('模型指南');
    expect(html).toContain('通用');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('is-active');
  });

  test('DocsPagination 使用列表邻居 slug 并触发切换', async () => {
    const { default: DocsPagination } = await import('./DocsPagination');
    const selected = [];
    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <DocsPagination
          previous={{ slug: 'prev', title: 'Prev', category: 'A' }}
          next={{ slug: 'next', title: 'Next', category: 'B' }}
          onSelectDoc={(slug) => selected.push(slug)}
        />,
      );
    });

    const buttons = renderer.root.findAllByType('button');
    expect(buttons.map((button) => button.props['data-slug'])).toEqual([
      'prev',
      'next',
    ]);

    await act(async () => {
      buttons[1].props.onClick();
    });
    expect(selected).toEqual(['next']);
  });

  test('DocsCodeExampleCard 支持 tab 与复制当前示例', async () => {
    const { default: DocsCodeExampleCard } = await import(
      './DocsCodeExampleCard'
    );
    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <DocsCodeExampleCard
          label={REQUEST_EXAMPLE_LABEL}
          examples={[
            {
              kind: 'request',
              title: 'HTTP',
              lang: 'http',
              value: 'POST /v1/images/generations',
              index: 0,
            },
            {
              kind: 'request',
              title: 'JSON',
              lang: 'json',
              value: GPT_IMAGE_JSON,
              index: 1,
            },
          ]}
        />,
      );
    });

    const buttons = renderer.root.findAllByType('button');
    const jsonTab = buttons.find((button) => button.children.includes('JSON'));
    await act(async () => {
      jsonTab.props.onClick();
    });

    const copyButton = renderer.root
      .findAllByType('button')
      .find((button) => button.props['aria-label'] === '复制代码');
    await act(async () => {
      await copyButton.props.onClick();
    });

    expect(copied).toEqual([GPT_IMAGE_JSON]);
    expect(toasts).toEqual([
      { type: 'success', message: '代码已复制到剪贴板' },
    ]);
  });

  test('DocsAside 无示例时不渲染 TOC，存在示例时渲染请求与响应卡', async () => {
    const { default: DocsAside } = await import('./DocsAside');

    const emptyHtml = renderToStaticMarkup(
      <DocsAside
        examples={{ hasExamples: false, requests: [], responses: [] }}
      />,
    );
    expect(emptyHtml).not.toContain('docs-toc');
    expect(emptyHtml).not.toContain(REQUEST_EXAMPLE_LABEL);

    const html = renderToStaticMarkup(
      <DocsAside
        examples={{
          hasExamples: true,
          requests: [
            {
              kind: 'request',
              title: 'HTTP',
              lang: 'http',
              value: 'POST /v1/images/generations',
              index: 0,
            },
          ],
          responses: [
            {
              kind: 'response',
              title: '200',
              lang: 'json',
              status: '200',
              value: '{"data":[]}',
              index: 1,
            },
          ],
        }}
      />,
    );

    expect(html).toContain(REQUEST_EXAMPLE_LABEL);
    expect(html).toContain('响应示例');
    expect(html).toContain('POST /v1/images/generations');
    expect(html).toContain('{&quot;data&quot;:[]}');
  });
});
