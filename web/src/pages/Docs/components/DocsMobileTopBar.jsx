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
import { Button } from '@douyinfe/semi-ui';
import { IconMenu } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const DocsMobileTopBar = ({ onOpenMenu }) => {
  const { t } = useTranslation();

  return (
    <div className='docs-mobile-topbar'>
      <div className='docs-mobile-title'>{t('文档中心')}</div>
      <Button
        icon={<IconMenu />}
        onClick={onOpenMenu}
        aria-label={t('返回文档列表')}
      />
    </div>
  );
};

export default DocsMobileTopBar;
