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
import { beforeEach, describe, expect, test } from 'bun:test';
import { useNavigation } from './useNavigation';

const t = (key) => key;

const getDocsLink = (docsLink, modules = undefined) => {
  let result;

  const Probe = () => {
    result = useNavigation(t, docsLink, modules);
    return null;
  };

  renderToStaticMarkup(React.createElement(Probe));
  return result.mainNavLinks.find((link) => link.itemKey === 'docs');
};

describe('useNavigation docs link', () => {
  beforeEach(() => {
    globalThis.window = {
      location: {
        origin: 'https://example.com',
      },
    };
  });

  test('hides docs nav item when the docs module is disabled', () => {
    expect(getDocsLink('', { docs: false })).toBeUndefined();
  });

  test('shows docs nav item by default when no module config is provided', () => {
    expect(getDocsLink('')).toMatchObject({
      to: '/docs',
      isExternal: false,
    });
  });

  test('routes blank docs link to the built-in docs page', () => {
    expect(getDocsLink('')).toMatchObject({
      to: '/docs',
      isExternal: false,
    });
  });

  test('routes relative and same-origin docs links inside the SPA', () => {
    expect(getDocsLink('/docs/gpt-image-2')).toMatchObject({
      to: '/docs/gpt-image-2',
      isExternal: false,
    });
    expect(getDocsLink('https://example.com/docs')).toMatchObject({
      to: '/docs',
      isExternal: false,
    });
  });

  test('keeps external docs links as external links', () => {
    expect(getDocsLink('https://docs.newapi.pro')).toMatchObject({
      externalLink: 'https://docs.newapi.pro',
      isExternal: true,
    });
  });
});
