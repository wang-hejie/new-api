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

import { describe, expect, test } from 'bun:test';
import { selectDocsCodeExamples } from './selectDocsCodeExamples';

const heading = (text, depth = 2) => ({ text, depth, id: text });

describe('selectDocsCodeExamples', () => {
  test('显式 request / response meta 优先选中 operation 主示例', () => {
    const result = selectDocsCodeExamples([
      {
        lang: 'python',
        meta: 'example title="SDK"',
        metaMap: { example: true, title: 'SDK' },
        value: 'client.images.generate()',
        index: 0,
        headingPath: [heading('Python OpenAI SDK')],
      },
      {
        lang: 'json',
        meta: 'request title="JSON 请求体" method=POST path="/v1/images/generations"',
        metaMap: {
          request: true,
          title: 'JSON 请求体',
          method: 'POST',
          path: '/v1/images/generations',
        },
        value: '{ "model": "gpt-image-2" }',
        index: 1,
        headingPath: [heading('POST /v1/images/generations'), heading('Body')],
      },
      {
        lang: 'json',
        meta: 'response status=200 title="成功响应"',
        metaMap: { response: true, status: '200', title: '成功响应' },
        value: '{ "created": 1, "data": [] }',
        index: 2,
        headingPath: [heading('POST /v1/images/generations')],
      },
    ]);

    expect(result.hasExamples).toBe(true);
    expect(result.requests).toEqual([
      expect.objectContaining({
        title: 'JSON 请求体',
        method: 'POST',
        path: '/v1/images/generations',
        source: 'meta',
      }),
    ]);
    expect(result.responses).toEqual([
      expect.objectContaining({
        title: '成功响应',
        status: '200',
        source: 'meta',
      }),
    ]);
  });

  test('多请求和多响应按文档顺序保留，供右栏 tabs 使用', () => {
    const result = selectDocsCodeExamples([
      {
        lang: 'http',
        meta: 'request title="Header" method=POST path="/v1/images/generations"',
        metaMap: {
          request: true,
          title: 'Header',
          method: 'POST',
          path: '/v1/images/generations',
        },
        value: 'POST /v1/images/generations',
        index: 2,
        headingPath: [heading('Request')],
      },
      {
        lang: 'json',
        meta: 'request title="Body" method=POST path="/v1/images/generations"',
        metaMap: {
          request: true,
          title: 'Body',
          method: 'POST',
          path: '/v1/images/generations',
        },
        value: '{}',
        index: 3,
        headingPath: [heading('Body')],
      },
      {
        lang: 'json',
        meta: 'response status=400 title="错误响应"',
        metaMap: { response: true, status: '400', title: '错误响应' },
        value: '{ "error": {} }',
        index: 5,
        headingPath: [heading('Error Responses')],
      },
      {
        lang: 'json',
        meta: 'response status=200 title="成功响应"',
        metaMap: { response: true, status: '200', title: '成功响应' },
        value: '{ "data": [] }',
        index: 4,
        headingPath: [heading('Response')],
      },
    ]);

    expect(result.requests.map((item) => item.title)).toEqual([
      'Header',
      'Body',
    ]);
    expect(result.responses.map((item) => item.status)).toEqual(['200', '400']);
  });

  test('example meta 必须排除，示例页不产生右栏主示例', () => {
    const result = selectDocsCodeExamples([
      {
        lang: 'bash',
        meta: 'example title="curl 文本生成图像"',
        metaMap: { example: true, title: 'curl 文本生成图像' },
        value: 'curl https://www.aiartmirror.com/v1/images/generations',
        index: 0,
        headingPath: [heading('curl')],
      },
    ]);

    expect(result).toEqual({
      requests: [],
      responses: [],
      hasExamples: false,
    });
  });

  test('只有错误 response meta 的概览页不渲染右栏', () => {
    const result = selectDocsCodeExamples([
      {
        lang: 'json',
        meta: 'response status=400 title="错误响应"',
        metaMap: { response: true, status: '400', title: '错误响应' },
        value: '{ "error": { "message": "..." } }',
        index: 0,
        headingPath: [heading('错误处理')],
      },
    ]);

    expect(result.hasExamples).toBe(false);
    expect(result.requests).toEqual([]);
    expect(result.responses).toEqual([]);
  });

  test('单独存在 response meta 即使带接口 path 也不触发右栏', () => {
    const result = selectDocsCodeExamples([
      {
        lang: 'json',
        meta: 'response status=200 method=POST path="/v1/images/generations"',
        metaMap: {
          response: true,
          status: '200',
          method: 'POST',
          path: '/v1/images/generations',
        },
        value: '{ "created": 1, "data": [] }',
        index: 0,
        headingPath: [heading('POST /v1/images/generations')],
      },
    ]);

    expect(result).toEqual({
      requests: [],
      responses: [],
      hasExamples: false,
    });
  });

  test('缺少 meta 时仅在明确 operation 上下文中启用启发式', () => {
    const result = selectDocsCodeExamples([
      {
        lang: 'http',
        meta: '',
        metaMap: {},
        value: 'POST /v1/images/edits\nAuthorization: Bearer <YOUR_TOKEN>',
        index: 0,
        headingPath: [heading('POST /v1/images/edits'), heading('Request', 3)],
      },
      {
        lang: 'json',
        meta: '',
        metaMap: {},
        value: '{ "created": 1, "data": [] }',
        index: 1,
        headingPath: [
          heading('POST /v1/images/edits'),
          heading('Response 200 application/json', 3),
        ],
      },
    ]);

    expect(result.hasExamples).toBe(true);
    expect(result.requests).toEqual([
      expect.objectContaining({
        kind: 'request',
        source: 'heuristic',
      }),
    ]);
    expect(result.responses).toEqual([
      expect.objectContaining({
        kind: 'response',
        source: 'heuristic',
      }),
    ]);
  });
});
