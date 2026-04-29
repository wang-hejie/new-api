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
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Empty,
  Nav,
  Skeleton,
  SideSheet,
  Typography,
} from '@douyinfe/semi-ui';
import { IconMenu } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import {
  IllustrationConstruction,
  IllustrationConstructionDark,
} from '@douyinfe/semi-illustrations';
import { API, showError } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import DocViewer from './DocViewer';

const { Title } = Typography;

const groupDocsByCategory = (docs) =>
  docs.reduce((groups, doc) => {
    const category = doc.category || '通用';
    if (!groups[category]) groups[category] = [];
    groups[category].push(doc);
    return groups;
  }, {});

const docsViewportStyle = { height: 'calc(100dvh - 64px)' };

const DocsLayout = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { slug } = useParams();
  const isMobile = useIsMobile();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const groupedDocs = useMemo(() => groupDocsByCategory(docs), [docs]);
  const categories = useMemo(() => Object.keys(groupedDocs), [groupedDocs]);
  const firstDoc = docs[0];

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

  const handleSelectDoc = (docSlug) => {
    if (!docSlug) return;
    navigate(`/docs/${docSlug}`);
    setDrawerVisible(false);
  };

  const renderNav = () => (
    <Nav
      selectedKeys={slug ? [slug] : []}
      defaultOpenKeys={categories}
      onSelect={({ itemKey }) => handleSelectDoc(itemKey)}
      style={{ border: 'none', background: 'transparent' }}
    >
      {categories.map((category) => (
        <Nav.Sub
          key={category}
          itemKey={category}
          text={<span className='font-semibold'>{category}</span>}
        >
          {groupedDocs[category].map((doc) => (
            <Nav.Item
              key={doc.slug}
              itemKey={doc.slug}
              text={<span className='truncate'>{doc.title}</span>}
              onClick={() => handleSelectDoc(doc.slug)}
            />
          ))}
        </Nav.Sub>
      ))}
    </Nav>
  );

  if (loading) {
    return (
      <div
        className='mt-16 bg-semi-color-bg-0 p-4 md:p-6'
        style={docsViewportStyle}
      >
        <div className='flex h-full gap-6'>
          {!isMobile && (
            <aside className='w-64 shrink-0'>
              <Skeleton
                placeholder={<Skeleton.Paragraph rows={8} />}
                loading
                active
              />
            </aside>
          )}
          <main className='min-w-0 flex-1'>
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
      <div
        className='mt-16 flex items-center justify-center bg-semi-color-bg-0 p-6'
        style={docsViewportStyle}
      >
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
    <div className='mt-16 bg-semi-color-bg-0' style={docsViewportStyle}>
      <div className='flex h-full min-h-0'>
        {!isMobile && (
          <aside className='h-full w-72 shrink-0 overflow-y-auto border-r border-semi-color-border bg-semi-color-bg-1 px-3 py-4'>
            <Title heading={5} className='px-3 pb-3'>
              {t('文档中心')}
            </Title>
            {renderNav()}
          </aside>
        )}

        <main className='min-w-0 flex-1 overflow-y-auto'>
          {isMobile && (
            <div className='sticky top-0 z-10 flex items-center justify-between border-b border-semi-color-border bg-semi-color-bg-0 px-4 py-3'>
              <Title heading={5}>{t('文档中心')}</Title>
              <Button
                icon={<IconMenu />}
                onClick={() => setDrawerVisible(true)}
                aria-label={t('返回文档列表')}
              />
            </div>
          )}
          {slug ? (
            <DocViewer slug={slug} />
          ) : (
            <div className='flex min-h-full items-center justify-center p-6'>
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
      </div>

      <SideSheet
        title={t('文档中心')}
        visible={drawerVisible}
        onCancel={() => setDrawerVisible(false)}
        placement='left'
        width={300}
      >
        {renderNav()}
      </SideSheet>
    </div>
  );
};

export default DocsLayout;
