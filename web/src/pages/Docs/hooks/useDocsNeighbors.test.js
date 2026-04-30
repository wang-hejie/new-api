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
import { getDocsNeighbors } from './useDocsNeighbors';

describe('getDocsNeighbors', () => {
  test('按 /api/docs/list 返回顺序取跨 category 上下页', () => {
    const docs = [
      { slug: 'overview', title: 'Overview', category: 'A' },
      { slug: 'operation', title: 'Operation', category: 'A' },
      { slug: 'cookbook', title: 'Cookbook', category: 'B' },
    ];

    expect(getDocsNeighbors(docs, 'operation')).toEqual({
      previous: docs[0],
      next: docs[2],
    });
  });

  test('未知 slug 返回空上下页', () => {
    expect(getDocsNeighbors([{ slug: 'known' }], 'missing')).toEqual({
      previous: null,
      next: null,
    });
  });
});
