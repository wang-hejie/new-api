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

import React, { useEffect, useState } from 'react';
import { Button, Toast, Tooltip } from '@douyinfe/semi-ui';
import { IconCopy } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { copy } from '../../../helpers/utils.jsx';

const DocsCodeExampleCard = ({ label, examples = [] }) => {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeExample = examples[activeIndex] || examples[0];

  useEffect(() => {
    setActiveIndex(0);
  }, [examples]);

  if (!activeExample) return null;

  const handleCopy = async () => {
    if (await copy(activeExample.value || '')) {
      Toast.success(t('代码已复制到剪贴板'));
    } else {
      Toast.error(t('复制失败，请手动复制'));
    }
  };

  return (
    <section className='docs-code-card' data-kind={activeExample.kind}>
      <div className='docs-code-card-header'>
        <div className='docs-code-card-meta'>
          <span className='docs-code-card-title'>{label}</span>
          {activeExample.lang && (
            <span className='docs-code-card-pill'>{activeExample.lang}</span>
          )}
          {activeExample.status && (
            <span className='docs-code-card-pill'>{activeExample.status}</span>
          )}
        </div>
        <Tooltip content={t('复制代码')}>
          <Button
            size='small'
            theme='borderless'
            className='docs-code-card-copy'
            icon={<IconCopy />}
            onClick={handleCopy}
            aria-label={t('复制代码')}
          />
        </Tooltip>
      </div>
      {examples.length > 1 && (
        <div className='docs-code-card-tabs' role='tablist'>
          {examples.map((example, index) => (
            <button
              key={`${example.kind}-${example.index}-${example.title}`}
              type='button'
              role='tab'
              aria-selected={index === activeIndex}
              className={clsx('docs-code-card-tab', {
                'is-active': index === activeIndex,
              })}
              onClick={() => setActiveIndex(index)}
            >
              {example.title || label}
            </button>
          ))}
        </div>
      )}
      <pre className='docs-code-card-pre'>
        <code>{activeExample.value}</code>
      </pre>
    </section>
  );
};

export default DocsCodeExampleCard;
