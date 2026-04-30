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

import React, { useEffect, useMemo, useState } from 'react';
import { Empty, Skeleton } from '@douyinfe/semi-ui';
import {
  IllustrationConstruction,
  IllustrationConstructionDark,
} from '@douyinfe/semi-illustrations';
import { useTranslation } from 'react-i18next';
import { API, showError } from '../../helpers';
import MarkdownRenderer from '../../components/common/markdown/MarkdownRenderer';
import DocsBreadcrumb from './components/DocsBreadcrumb';

export const markdownStartsWithH1 = (content = '') => {
  const lines = String(content).split(/\r?\n/);
  let inFence = false;
  let fenceMarker = '';
  let fenceLength = 0;

  return lines.some((line) => {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);

    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      const markerLength = fenceMatch[1].length;
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
        fenceLength = markerLength;
      } else if (marker === fenceMarker && markerLength >= fenceLength) {
        inFence = false;
        fenceMarker = '';
        fenceLength = 0;
      }
      return false;
    }

    if (inFence || !trimmed || /^( {4,}|\t)/.test(line)) {
      return false;
    }

    return /^#\s+/.test(trimmed);
  });
};

const DocViewer = ({ slug, onMeta, onDocLoaded, footer }) => {
  const { t } = useTranslation();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasMarkdownH1 = useMemo(
    () => markdownStartsWithH1(doc?.content || ''),
    [doc?.content],
  );

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
          onDocLoaded?.(data);
        } else {
          const nextError = message || t('文档不存在');
          setError(nextError);
          onDocLoaded?.(null);
          onMeta?.({ headings: [], codeBlocks: [] });
          showError(nextError);
        }
      } catch (error) {
        if (mounted) {
          setError(t('加载文档失败'));
          onDocLoaded?.(null);
          onMeta?.({ headings: [], codeBlocks: [] });
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
  }, [onDocLoaded, onMeta, slug, t]);

  useEffect(() => {
    if (!slug) {
      onDocLoaded?.(null);
      onMeta?.({ headings: [], codeBlocks: [] });
    }
  }, [onDocLoaded, onMeta, slug]);

  if (loading) {
    return (
      <div className='docs-main-inner'>
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
      <div className='docs-main-inner'>
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
    <article className='docs-main-inner'>
      <DocsBreadcrumb category={doc.category || t('通用')} title={doc.title} />
      {!hasMarkdownH1 && <h1 className='docs-fallback-title'>{doc.title}</h1>}
      <MarkdownRenderer
        content={doc.content || ''}
        variant='docs'
        headingIdPrefix={`docs-${doc.slug}-`}
        onDocsMetaExtract={onMeta}
      />
      {footer}
    </article>
  );
};

export default DocViewer;
