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

const isDocsPath = (path) => path === '/docs' || path.startsWith('/docs/');

export const resolveDocsTarget = (docsLink) => {
  const trimmed = (docsLink || '').trim();
  if (!trimmed) return { kind: 'internal', to: '/docs' };

  const relativePath = trimmed.split(/[?#]/, 1)[0];
  if (trimmed.startsWith('/') && isDocsPath(relativePath)) {
    return { kind: 'internal', to: trimmed };
  }

  try {
    const url = new URL(trimmed);
    if (
      typeof window !== 'undefined' &&
      url.origin === window.location.origin &&
      isDocsPath(url.pathname)
    ) {
      return { kind: 'internal', to: url.pathname + url.search + url.hash };
    }
  } catch {
    // Non-URL non-doc values keep the legacy external-link behavior.
  }

  return { kind: 'external', href: trimmed };
};
