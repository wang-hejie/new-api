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

import { beforeEach, describe, expect, test } from 'bun:test';
import { resolveDocsTarget } from './docs';

describe('resolveDocsTarget', () => {
  beforeEach(() => {
    globalThis.window = {
      location: {
        origin: 'https://example.com',
      },
    };
  });

  test('uses internal docs page for blank links', () => {
    expect(resolveDocsTarget('')).toEqual({ kind: 'internal', to: '/docs' });
    expect(resolveDocsTarget('   ')).toEqual({
      kind: 'internal',
      to: '/docs',
    });
    expect(resolveDocsTarget(undefined)).toEqual({
      kind: 'internal',
      to: '/docs',
    });
  });

  test('keeps relative docs paths inside the SPA', () => {
    expect(resolveDocsTarget('/docs')).toEqual({
      kind: 'internal',
      to: '/docs',
    });
    expect(resolveDocsTarget(' /docs/gpt-image-2 ')).toEqual({
      kind: 'internal',
      to: '/docs/gpt-image-2',
    });
    expect(resolveDocsTarget('/docs/gpt-image-2?tab=usage#examples')).toEqual({
      kind: 'internal',
      to: '/docs/gpt-image-2?tab=usage#examples',
    });
  });

  test('keeps same-origin docs URLs inside the SPA', () => {
    expect(resolveDocsTarget('https://example.com/docs')).toEqual({
      kind: 'internal',
      to: '/docs',
    });
    expect(
      resolveDocsTarget('https://example.com/docs/gpt-image-2?tab=usage#top'),
    ).toEqual({
      kind: 'internal',
      to: '/docs/gpt-image-2?tab=usage#top',
    });
  });

  test('treats same-origin non-doc URLs and external links as external', () => {
    expect(resolveDocsTarget('/console/docs')).toEqual({
      kind: 'external',
      href: '/console/docs',
    });
    expect(resolveDocsTarget('/docs-v2')).toEqual({
      kind: 'external',
      href: '/docs-v2',
    });
    expect(resolveDocsTarget('https://example.com/about')).toEqual({
      kind: 'external',
      href: 'https://example.com/about',
    });
    expect(resolveDocsTarget('https://docs.newapi.pro')).toEqual({
      kind: 'external',
      href: 'https://docs.newapi.pro',
    });
  });
});
