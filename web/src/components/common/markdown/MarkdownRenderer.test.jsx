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

import React, { useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, mock, test } from 'bun:test';

mock.module('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

mock.module('@douyinfe/semi-ui', () => ({
  Button: ({ children, icon, onClick, ...props }) =>
    React.createElement('button', { onClick, ...props }, icon, children),
  Toast: {
    success: () => {},
    error: () => {},
  },
  Tooltip: ({ children }) => React.createElement(React.Fragment, null, children),
}));

mock.module('@douyinfe/semi-icons', () => ({
  IconCopy: () => React.createElement('i', null),
}));

mock.module('mermaid', () => ({
  default: {
    initialize: () => {},
    run: async () => {},
  },
}));

mock.module('../../../helpers', () => ({
  copy: async () => true,
  rehypeSplitWordsIntoSpans: () => (tree) => tree,
}));
mock.module('../../../helpers/utils.jsx', () => ({
  copy: async () => true,
}));
mock.module('../../../helpers/render.jsx', () => ({
  rehypeSplitWordsIntoSpans: () => (tree) => tree,
}));

describe('MarkdownRenderer', () => {
  const headingPrefix = ['d', 'o', 'c', '-'].join('');

  test('默认 variant 保留 markdown-body 根样式与 inline heading 样式', async () => {
    const { default: MarkdownRenderer } = await import('./MarkdownRenderer');

    const html = renderToStaticMarkup(
      <MarkdownRenderer content={'# 标题\n\n正文'} fontSize={15} />,
    );

    expect(html).toContain('class="markdown-body"');
    expect(html).toContain('font-size:15px');
    expect(html).toContain('font-size:24px');
    expect(html).toContain('正文');
    expect(html).not.toContain('docs-markdown');
  });

  test('docs variant 输出 docs class、heading id 与 code nodes 元数据', async () => {
    const { default: MarkdownRenderer } = await import('./MarkdownRenderer');
    const extracted = [];
    const content = [
      '# 文本生成图像',
      '',
      '## POST `/v1/images/generations`',
      '',
      '```http request title="文本生成图像" method=POST path="/v1/images/generations"',
      'POST /v1/images/generations',
      '```',
      '',
      '## POST `/v1/images/generations`',
      '',
      '```json response status=200 title="成功响应"',
      '{"created": 1}',
      '```',
    ].join('\n');

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <MarkdownRenderer
          content={content}
          variant='docs'
          headingIdPrefix={headingPrefix}
          onDocsMetaExtract={(meta) => extracted.push(meta)}
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    const html = JSON.stringify(renderer.toJSON());
    expect(html).toContain('docs-markdown');
    expect(html).toContain('doc-文本生成图像');
    expect(html).toContain('doc-post-v1imagesgenerations');
    expect(html).toContain('doc-post-v1imagesgenerations-1');
    expect(extracted.length).toBe(1);
    expect(extracted[0].headings.map((heading) => heading.id)).toEqual([
      'doc-文本生成图像',
      'doc-post-v1imagesgenerations',
      'doc-post-v1imagesgenerations-1',
    ]);
    expect(extracted[0].codeBlocks).toEqual([
      expect.objectContaining({
        lang: 'http',
        meta: 'request title="文本生成图像" method=POST path="/v1/images/generations"',
        metaMap: expect.objectContaining({
          request: true,
          title: '文本生成图像',
          method: 'POST',
          path: '/v1/images/generations',
        }),
        index: 0,
        headingPath: expect.arrayContaining([
          expect.objectContaining({ text: 'POST /v1/images/generations' }),
        ]),
      }),
      expect.objectContaining({
        lang: 'json',
        metaMap: expect.objectContaining({
          response: true,
          status: '200',
          title: '成功响应',
        }),
        index: 1,
      }),
    ]);
  });

  test('docs meta 通过 effect 上抛，避免渲染阶段更新父组件状态', async () => {
    const { default: MarkdownRenderer } = await import('./MarkdownRenderer');

    function Probe() {
      const [count, setCount] = useState(0);
      return (
        <section data-count={count}>
          <MarkdownRenderer
            content={'# 标题\n\n```json response\n{}\n```'}
            variant='docs'
            onDocsMetaExtract={() => setCount((value) => value + 1)}
          />
        </section>
      );
    }

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(<Probe />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(renderer.root.findByType('section').props['data-count']).toBe(1);
  });
});
