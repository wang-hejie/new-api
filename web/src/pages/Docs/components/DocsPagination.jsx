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
import clsx from 'clsx';
import { IconChevronLeft, IconChevronRight } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const PaginationCard = ({ doc, direction, onSelectDoc }) => {
  const { t } = useTranslation();
  if (!doc) return <div />;

  const isNext = direction === 'next';
  return (
    <button
      type='button'
      className={clsx('docs-pagination-card', { 'is-next': isNext })}
      data-slug={doc.slug}
      onClick={() => onSelectDoc?.(doc.slug)}
    >
      <div className='docs-pagination-kicker'>
        {isNext ? t('下一页') : t('上一页')}
      </div>
      <div className='docs-pagination-title'>
        {!isNext && <IconChevronLeft size='small' />} {doc.title}{' '}
        {isNext && <IconChevronRight size='small' />}
      </div>
      <div className='docs-pagination-category'>{doc.category || t('通用')}</div>
    </button>
  );
};

const DocsPagination = ({ previous, next, onSelectDoc }) => {
  const { t } = useTranslation();
  if (!previous && !next) return null;

  return (
    <nav className='docs-pagination' aria-label={t('文档翻页')}>
      <PaginationCard
        doc={previous}
        direction='previous'
        onSelectDoc={onSelectDoc}
      />
      <PaginationCard doc={next} direction='next' onSelectDoc={onSelectDoc} />
    </nav>
  );
};

export default DocsPagination;
