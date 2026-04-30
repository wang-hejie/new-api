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

import React, { useMemo } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

export const groupDocsByCategory = (docs) =>
  (Array.isArray(docs) ? docs : []).reduce((groups, doc) => {
    const category = doc.category || '通用';
    if (!groups[category]) groups[category] = [];
    groups[category].push(doc);
    return groups;
  }, {});

const DocsSidebar = ({ docs, activeSlug, onSelectDoc, title }) => {
  const { t } = useTranslation();
  const groupedDocs = useMemo(() => groupDocsByCategory(docs), [docs]);
  const categories = useMemo(() => Object.keys(groupedDocs), [groupedDocs]);

  return (
    <nav className='docs-sidebar' aria-label={t('文档中心')}>
      <h2 className='docs-sidebar-title'>{title || t('文档中心')}</h2>
      {categories.map((category) => (
        <section key={category}>
          <div className='docs-sidebar-category'>{t(category)}</div>
          <div className='docs-sidebar-items'>
            {groupedDocs[category].map((doc) => (
              <button
                key={doc.slug}
                type='button'
                className={clsx('docs-sidebar-link', {
                  'is-active': doc.slug === activeSlug,
                })}
                aria-current={doc.slug === activeSlug ? 'page' : undefined}
                onClick={() => onSelectDoc?.(doc.slug)}
                title={doc.title}
              >
                {doc.title}
              </button>
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
};

export default DocsSidebar;
