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

import { useEffect, useMemo, useState } from 'react';
import {
  createUniqueDocsHeadingId,
  slugifyDocsHeading,
} from '../../../components/common/markdown/docsMeta';

export { slugifyDocsHeading };

export function normalizeDocsHeadings(headings = []) {
  const usedIds = new Map();
  return (Array.isArray(headings) ? headings : [])
    .filter((heading) => heading && heading.text)
    .map((heading) => ({
      depth: heading.depth,
      text: heading.text,
      id:
        heading.id ||
        createUniqueDocsHeadingId(
          heading.text,
          usedIds,
          heading.idPrefix || '',
        ),
    }));
}

export function useDocsHeadings(headings = [], options = {}) {
  const { observe = false } = options;
  const normalizedHeadings = useMemo(
    () => normalizeDocsHeadings(headings),
    [headings],
  );
  const [activeId, setActiveId] = useState(normalizedHeadings[0]?.id || '');

  useEffect(() => {
    setActiveId(normalizedHeadings[0]?.id || '');
  }, [normalizedHeadings]);

  useEffect(() => {
    if (!observe || typeof IntersectionObserver === 'undefined') return;

    const elements = normalizedHeadings
      .map((heading) => document.getElementById(heading.id))
      .filter(Boolean);
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-88px 0px -70% 0px' },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [normalizedHeadings, observe]);

  return {
    headings: normalizedHeadings,
    activeId,
  };
}

export default useDocsHeadings;
