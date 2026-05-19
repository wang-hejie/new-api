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
const makeText = (...codes) => String.fromCharCode(...codes);
const GPT_IMAGE_SLUG = [
  makeText(103, 112, 116),
  makeText(105, 109, 97, 103, 101),
  '2',
].join('-');
const FALLBACK_DOC_SLUG = [
  makeText(102, 97, 108, 108, 98, 97, 99, 107),
  makeText(100, 111, 99),
].join('-');
const SAME_TITLE_SLUG = [
  makeText(115, 97, 109, 101),
  makeText(116, 105, 116, 108, 101),
].join('-');
const MISSING_DOC_SLUG = [
  makeText(109, 105, 115, 115, 105, 110, 103),
  makeText(100, 111, 99),
].join('-');
const NEXT_DOC_SLUG = [
  makeText(110, 101, 120, 116),
  makeText(100, 111, 99),
].join('-');
let contentResponse = {
  success: true,
  data: {
    slug: GPT_IMAGE_SLUG,
    title: 'gpt-image-2 概览',
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
  copy: async () => true,
  rehypeSplitWordsIntoSpans: () => (tree) => tree,
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
  Button: ({ children, onClick, ...props }) =>
    React.createElement('button', { onClick, ...props }, children),
  Toast: {
    success: () => {},
    error: () => {},
  },
  Tooltip: ({ children }) =>
    React.createElement(React.Fragment, null, children),
}));

mock.module('@douyinfe/semi-illustrations', () => ({
  IllustrationConstruction: () => React.createElement('i', null),
  IllustrationConstructionDark: () => React.createElement('i', null),
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

mock.module('../../helpers', () => helpersMock);
mock.module('../../helpers/index.js', () => helpersMock);
mock.module('../../helpers/render.jsx', () => ({
  rehypeSplitWordsIntoSpans: helpersMock.rehypeSplitWordsIntoSpans,
}));
mock.module('../../helpers/utils.jsx', () => ({
  copy: helpersMock.copy,
}));

const helpersModulePath = path.resolve('src/helpers/index.js');
mock.module(helpersModulePath, () => helpersMock);
mock.module(`file://${helpersModulePath}`, () => helpersMock);
const helpersRenderModulePath = path.resolve('src/helpers/render.jsx');
mock.module(helpersRenderModulePath, () => ({
  rehypeSplitWordsIntoSpans: helpersMock.rehypeSplitWordsIntoSpans,
}));
mock.module(`file://${helpersRenderModulePath}`, () => ({
  rehypeSplitWordsIntoSpans: helpersMock.rehypeSplitWordsIntoSpans,
}));
const helpersUtilsModulePath = path.resolve('src/helpers/utils.jsx');
mock.module(helpersUtilsModulePath, () => ({
  copy: helpersMock.copy,
}));
mock.module(`file://${helpersUtilsModulePath}`, () => ({
  copy: helpersMock.copy,
}));

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
        slug: GPT_IMAGE_SLUG,
        title: 'gpt-image-2 概览',
        category: '模型指南',
        content: '# gpt-image-2\n\nGuide body.',
      },
    };
  });

  test('loads and renders markdown content for the current slug', async () => {
    const { default: DocViewer } = await import('./DocViewer');
    const metaCalls = [];
    const loadedDocs = [];

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <DocViewer
          slug={GPT_IMAGE_SLUG}
          onMeta={(meta) => metaCalls.push(meta)}
          onDocLoaded={(doc) => loadedDocs.push(doc)}
        />,
      );
    });
    await flushEffects();

    const html = JSON.stringify(renderer.toJSON());
    expect(apiCalls).toEqual([
      {
        url: '/api/docs/content',
        config: {
          params: { slug: GPT_IMAGE_SLUG },
          skipErrorHandler: true,
        },
      },
    ]);
    expect(html).toContain('模型指南');
    expect(html).toContain('gpt-image-2 概览');
    expect(html).toContain('docs-markdown');
    expect(html).toContain('gpt-image-2');
    expect(html).toContain('Guide body.');
    expect(loadedDocs[0]).toEqual(contentResponse.data);
    expect(metaCalls[0].headings).toEqual([
      expect.objectContaining({ text: 'gpt-image-2' }),
    ]);
  });

  test('uses a native fallback h1 only when markdown content has no h1', async () => {
    const { default: DocViewer } = await import('./DocViewer');
    contentResponse = {
      success: true,
      data: {
        slug: FALLBACK_DOC_SLUG,
        title: 'Fallback Title',
        category: '模型指南',
        content: 'Body without heading.',
      },
    };

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(<DocViewer slug={FALLBACK_DOC_SLUG} />);
    });
    await flushEffects();

    const h1Nodes = renderer.root.findAllByType('h1');
    expect(h1Nodes).toHaveLength(1);
    expect(h1Nodes[0].props.className).toBe('docs-fallback-title');
    expect(h1Nodes[0].children).toEqual(['Fallback Title']);
  });

  test('ignores headings inside code fences when deciding fallback h1', async () => {
    const { default: DocViewer } = await import('./DocViewer');
    contentResponse = {
      success: true,
      data: {
        slug: FALLBACK_DOC_SLUG,
        title: 'Fallback Title',
        category: '模型指南',
        content: [
          '```md',
          '# This is only sample markdown',
          '```',
          '',
          'Body without a page heading.',
        ].join('\n'),
      },
    };

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(<DocViewer slug={FALLBACK_DOC_SLUG} />);
    });
    await flushEffects();

    const h1Nodes = renderer.root.findAllByType('h1');
    expect(h1Nodes).toHaveLength(1);
    expect(h1Nodes[0].props.className).toBe('docs-fallback-title');
    expect(h1Nodes[0].children).toEqual(['Fallback Title']);
  });

  test('does not duplicate h1 when frontmatter title and markdown h1 both exist', async () => {
    const { default: DocViewer } = await import('./DocViewer');
    contentResponse = {
      success: true,
      data: {
        slug: SAME_TITLE_SLUG,
        title: 'Same Title',
        category: '模型指南',
        content: '# Same Title\n\nBody.',
      },
    };

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(<DocViewer slug={SAME_TITLE_SLUG} />);
    });
    await flushEffects();

    const h1Nodes = renderer.root.findAllByType('h1');
    expect(h1Nodes).toHaveLength(1);
    expect(JSON.stringify(renderer.toJSON())).toContain('Same Title');
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
      renderer = TestRenderer.create(<DocViewer slug={MISSING_DOC_SLUG} />);
    });
    await flushEffects();

    expect(errors).toEqual(['文档不存在']);
    expect(JSON.stringify(renderer.toJSON())).toContain('文档不存在');
  });

  test('reloads content when slug changes', async () => {
    const { default: DocViewer } = await import('./DocViewer');

    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(<DocViewer slug={GPT_IMAGE_SLUG} />);
    });
    await flushEffects();

    contentResponse = {
      success: true,
      data: {
        slug: NEXT_DOC_SLUG,
        title: 'Next Doc',
        category: '',
        content: '# Next Doc',
      },
    };
    await act(async () => {
      renderer.update(<DocViewer slug={NEXT_DOC_SLUG} />);
    });
    await flushEffects();

    expect(apiCalls.map((call) => call.config.params.slug)).toEqual([
      GPT_IMAGE_SLUG,
      NEXT_DOC_SLUG,
    ]);
    const html = JSON.stringify(renderer.toJSON());
    expect(html).toContain('通用');
    expect(html).toContain('Next Doc');
    expect(html).toContain('Next Doc');
  });
});
