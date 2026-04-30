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

export function slugifyDocsHeading(text) {
  const value = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[`"'“”‘’]/g, '')
    .replace(/[^\p{Letter}\p{Number}\p{Mark}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return value || 'section';
}

export function createUniqueDocsHeadingId(text, usedIds, prefix = '') {
  const base = `${prefix || ''}${slugifyDocsHeading(text)}`;
  const count = usedIds.get(base) || 0;
  usedIds.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}
