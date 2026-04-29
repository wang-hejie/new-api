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
import { IMAGE_REQUEST_MODES } from '../../constants/playground.constants';

mock.module('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

mock.module('@douyinfe/semi-ui', () => ({
  Button: ({ children, disabled, icon }) =>
    React.createElement('button', { disabled }, icon, children),
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
    warning: () => {},
  },
  Tooltip: ({ children }) => React.createElement('span', null, children),
  Typography: {
    Text: ({ children }) => React.createElement('span', null, children),
  },
}));

mock.module('lucide-react', () => ({
  FileOutput: () => React.createElement('i', null),
  Image: () => React.createElement('i', null),
  ImagePlus: () => React.createElement('i', null),
  Repeat2: () => React.createElement('i', null),
  SlidersHorizontal: () => React.createElement('i', null),
  Sparkles: () => React.createElement('i', null),
  Trash2: () => React.createElement('i', null),
  UploadCloud: () => React.createElement('i', null),
}));

describe('ImageRequestModeSwitch', () => {
  test('renders generation and edit modes with upstream endpoint labels', async () => {
    const { default: ImageRequestModeSwitch } = await import(
      './ImageRequestModeSwitch'
    );

    const html = renderToStaticMarkup(
      <ImageRequestModeSwitch
        imageRequestMode={IMAGE_REQUEST_MODES.EDIT}
        onInputChange={() => {}}
      />,
    );

    expect(html).toContain('请求方式');
    expect(html).toContain('文生图');
    expect(html).toContain('图生图');
    expect(html).toContain('/v1/images/generations');
    expect(html).toContain('/v1/images/edits');
    expect(html).toContain('data-value="edit"');
  });

  test('passes disabled state to the radio group', async () => {
    const { default: ImageRequestModeSwitch } = await import(
      './ImageRequestModeSwitch'
    );

    const html = renderToStaticMarkup(
      <ImageRequestModeSwitch
        imageRequestMode={IMAGE_REQUEST_MODES.GENERATION}
        onInputChange={() => {}}
        disabled
      />,
    );

    expect(html).toContain('data-disabled="true"');
  });
});
