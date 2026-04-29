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
import { Empty, Skeleton, Typography } from '@douyinfe/semi-ui';
import {
  IllustrationConstruction,
  IllustrationConstructionDark,
} from '@douyinfe/semi-illustrations';
import { useTranslation } from 'react-i18next';
import { API, showError } from '../../helpers';
import MarkdownRenderer from '../../components/common/markdown/MarkdownRenderer';

const { Text, Title } = Typography;

const DocViewer = ({ slug }) => {
  const { t } = useTranslation();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    let mounted = true;

    const loadDoc = async () => {
      setLoading(true);
      setError('');
      setDoc(null);
      try {
        const res = await API.get('/api/docs/content', {
          params: { slug },
          skipErrorHandler: true,
        });
        const { success, message, data } = res.data;
        if (!mounted) return;
        if (success) {
          setDoc(data);
        } else {
          const nextError = message || t('文档不存在');
          setError(nextError);
          showError(nextError);
        }
      } catch (error) {
        if (mounted) {
          setError(t('加载文档失败'));
          showError(t('加载文档失败'));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDoc();
    return () => {
      mounted = false;
    };
  }, [slug, t]);

  if (loading) {
    return (
      <div className='mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8'>
        <Skeleton
          placeholder={<Skeleton.Paragraph rows={14} />}
          loading
          active
        />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className='flex min-h-full items-center justify-center p-6'>
        <Empty
          title={error || t('文档不存在')}
          image={<IllustrationConstruction style={{ width: 150, height: 150 }} />}
          darkModeImage={
            <IllustrationConstructionDark style={{ width: 150, height: 150 }} />
          }
        />
      </div>
    );
  }

  return (
    <article className='mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8'>
      <div className='mb-6 border-b border-semi-color-border pb-4'>
        <Text type='tertiary' size='small'>
          {doc.category || t('通用')} / {doc.title}
        </Text>
        <Title heading={2} className='mt-2 !mb-0'>
          {doc.title}
        </Title>
      </div>
      <div className='docs-markdown'>
        <MarkdownRenderer content={doc.content || ''} />
      </div>
    </article>
  );
};

export default DocViewer;
