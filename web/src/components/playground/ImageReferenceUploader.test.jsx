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

const toastWarnings = [];

mock.module('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

mock.module('@douyinfe/semi-ui', () => ({
  Button: ({ children, disabled, icon, onClick, type }) =>
    React.createElement(
      'button',
      {
        disabled,
        onClick,
        type: type || 'button',
      },
      icon,
      children,
    ),
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
  Select: ({ optionList = [] }) =>
    React.createElement(
      'select',
      null,
      optionList.map((option) =>
        React.createElement(
          'option',
          { key: option.value, value: option.value },
          option.label,
        ),
      ),
    ),
  Toast: {
    success: () => {},
    warning: (message) => toastWarnings.push(message),
  },
  Tooltip: ({ children }) => React.createElement('span', null, children),
  Typography: {
    Text: ({ children, className }) =>
      React.createElement('span', { className }, children),
  },
}));

mock.module('lucide-react', () => ({
  FileOutput: () => React.createElement('i', null),
  Image: () => React.createElement('i', null),
  ImagePlus: () => React.createElement('i', null),
  Layers: () => React.createElement('i', null),
  Repeat2: () => React.createElement('i', null),
  SlidersHorizontal: () => React.createElement('i', null),
  Sparkles: () => React.createElement('i', null),
  Trash2: () => React.createElement('i', null),
  UploadCloud: () => React.createElement('i', null),
}));

globalThis.URL.createObjectURL = globalThis.URL.createObjectURL || (() => '');
globalThis.URL.revokeObjectURL = globalThis.URL.revokeObjectURL || (() => {});

describe('ImageReferenceUploader', () => {
  test('validates MIME type and size constraints', async () => {
    const { MAX_REFERENCE_FILE_SIZE, validateImageReferenceFile } =
      await import('./ImageReferenceUploader');

    expect(
      validateImageReferenceFile(
        new File(['image bytes'], 'apple.png', { type: 'image/png' }),
      ),
    ).toBe(true);
    expect(
      validateImageReferenceFile(
        new File(['image bytes'], 'apple.gif', { type: 'image/gif' }),
      ),
    ).toBe(false);
    expect(
      validateImageReferenceFile(
        new File([new Uint8Array(MAX_REFERENCE_FILE_SIZE + 1)], 'large.webp', {
          type: 'image/webp',
        }),
      ),
    ).toBe(false);
  });

  test('renders empty upload state with accepted file guidance', async () => {
    const { default: ImageReferenceUploader } = await import(
      './ImageReferenceUploader'
    );

    const html = renderToStaticMarkup(
      <ImageReferenceUploader
        referenceFiles={[]}
        onReferenceFilesChange={() => {}}
      />,
    );

    expect(html).toContain('参考图');
    expect(html).toContain('上传参考图');
    expect(html).toContain('仅支持 PNG / JPEG / WebP，单文件不超过 10 MB');
    expect(html).toContain('WebP/JPEG 上传更快');
  });

  test('renders selected reference file metadata and delete control', async () => {
    const { default: ImageReferenceUploader } = await import(
      './ImageReferenceUploader'
    );
    const file = new File(['image bytes'], 'apple.webp', {
      type: 'image/webp',
    });

    const html = renderToStaticMarkup(
      <ImageReferenceUploader
        referenceFiles={[file]}
        onReferenceFilesChange={() => {}}
      />,
    );

    expect(html).toContain('apple.webp');
    expect(html).toContain('11 B / image/webp');
    expect(html).not.toContain('上传参考图</button>');
  });
});
