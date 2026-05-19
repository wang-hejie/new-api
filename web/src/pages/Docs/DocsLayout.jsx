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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Empty, Skeleton, SideSheet } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import {
  IllustrationConstruction,
  IllustrationConstructionDark,
} from '@douyinfe/semi-illustrations';
import { API, showError } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import DocViewer from './DocViewer';
import DocsSidebar from './components/DocsSidebar';
import DocsAside from './components/DocsAside';
import DocsMobileTopBar from './components/DocsMobileTopBar';
import DocsPagination from './components/DocsPagination';
import { useDocsNeighbors } from './hooks/useDocsNeighbors';
import { selectDocsCodeExamples } from './utils/selectDocsCodeExamples';

const DocsLayout = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { slug } = useParams();
  const isMobile = useIsMobile();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [docMeta, setDocMeta] = useState({
    headings: [],
    codeBlocks: [],
  });
  const [currentDoc, setCurrentDoc] = useState(null);

  const firstDoc = docs[0];
  const neighbors = useDocsNeighbors(docs, slug);
  const codeExamples = useMemo(
    () => selectDocsCodeExamples(docMeta.codeBlocks || []),
    [docMeta.codeBlocks],
  );

  useEffect(() => {
    let mounted = true;

    const loadDocs = async () => {
      setLoading(true);
      try {
        const res = await API.get('/api/docs/list');
        const { success, message, data } = res.data;
        if (!mounted) return;
        if (success) {
          setDocs(Array.isArray(data) ? data : []);
        } else {
          showError(message || t('加载文档失败'));
          setDocs([]);
        }
      } catch (error) {
        if (mounted) {
          showError(t('加载文档失败'));
          setDocs([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDocs();
    return () => {
      mounted = false;
    };
  }, [t]);

  useEffect(() => {
    if (!loading && !slug && firstDoc?.slug) {
      navigate(`/docs/${firstDoc.slug}`, { replace: true });
    }
  }, [firstDoc?.slug, loading, navigate, slug]);

  const handleSelectDoc = useCallback(
    (docSlug) => {
      if (!docSlug) return;
      navigate(`/docs/${docSlug}`);
      setDrawerVisible(false);
    },
    [navigate],
  );

  const handleDocMeta = useCallback((meta) => {
    setDocMeta({
      headings: meta?.headings || [],
      codeBlocks: meta?.codeBlocks || [],
    });
  }, []);

  const handleDocLoaded = useCallback((doc) => {
    setCurrentDoc(doc);
  }, []);

  useEffect(() => {
    setDocMeta({ headings: [], codeBlocks: [] });
    setCurrentDoc(null);
  }, [slug]);

  const sidebar = (
    <DocsSidebar docs={docs} activeSlug={slug} onSelectDoc={handleSelectDoc} />
  );

  const pagination = (
    <DocsPagination
      previous={neighbors.previous}
      next={neighbors.next}
      onSelectDoc={handleSelectDoc}
    />
  );

  if (loading) {
    return (
      <div className='docs-shell docs-loading-shell'>
        <div className='docs-loading-grid'>
          {!isMobile && (
            <aside>
              <Skeleton
                placeholder={<Skeleton.Paragraph rows={8} />}
                loading
                active
              />
            </aside>
          )}
          <main>
            <Skeleton
              placeholder={<Skeleton.Paragraph rows={12} />}
              loading
              active
            />
          </main>
        </div>
      </div>
    );
  }

  if (!docs.length) {
    return (
      <div className='docs-shell docs-empty-shell'>
        <Empty
          title={t('暂无文档')}
          image={
            <IllustrationConstruction style={{ width: 150, height: 150 }} />
          }
          darkModeImage={
            <IllustrationConstructionDark style={{ width: 150, height: 150 }} />
          }
        />
      </div>
    );
  }

  return (
    <div className='docs-shell'>
      <div className='docs-layout-grid'>
        {sidebar}

        <main className='docs-main-scroll'>
          {isMobile && (
            <DocsMobileTopBar onOpenMenu={() => setDrawerVisible(true)} />
          )}
          {slug ? (
            <DocViewer
              slug={slug}
              onMeta={handleDocMeta}
              onDocLoaded={handleDocLoaded}
              footer={pagination}
            />
          ) : (
            <div className='docs-main-inner'>
              <Empty
                title={t('请从左侧选择一篇文档查看')}
                image={
                  <IllustrationConstruction
                    style={{ width: 150, height: 150 }}
                  />
                }
                darkModeImage={
                  <IllustrationConstructionDark
                    style={{ width: 150, height: 150 }}
                  />
                }
              />
            </div>
          )}
        </main>

        <DocsAside examples={codeExamples} />
      </div>

      <SideSheet
        title={t('文档中心')}
        visible={drawerVisible}
        onCancel={() => setDrawerVisible(false)}
        placement='left'
        width={300}
      >
        <div className='docs-shell docs-drawer-shell'>
          <DocsSidebar
            docs={docs}
            activeSlug={slug}
            onSelectDoc={handleSelectDoc}
            title={currentDoc?.title || t('文档中心')}
          />
        </div>
      </SideSheet>
    </div>
  );
};

export default DocsLayout;
