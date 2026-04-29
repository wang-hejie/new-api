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
import { Radio, RadioGroup, Typography } from '@douyinfe/semi-ui';
import { Repeat2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IMAGE_REQUEST_MODES } from '../../constants/playground.constants';

const IMAGE_REQUEST_MODE_ENDPOINT_LABELS = {
  [IMAGE_REQUEST_MODES.GENERATION]: ['POST', '/v1/images/generations'].join(
    ' ',
  ),
  [IMAGE_REQUEST_MODES.EDIT]: ['POST', '/v1/images/edits'].join(' '),
};

const ImageRequestModeSwitch = ({
  imageRequestMode = IMAGE_REQUEST_MODES.GENERATION,
  onInputChange,
  disabled = false,
}) => {
  const { t } = useTranslation();

  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className='flex items-center gap-2 mb-2'>
        <Repeat2 size={16} className='text-gray-500' />
        <Typography.Text strong className='text-sm'>
          {t('请求方式')}
        </Typography.Text>
      </div>
      <RadioGroup
        value={imageRequestMode}
        onChange={(event) =>
          onInputChange('image_request_mode', event?.target?.value || event)
        }
        type='card'
        direction='vertical'
        disabled={disabled}
        style={{ width: '100%' }}
      >
        <Radio
          value={IMAGE_REQUEST_MODES.GENERATION}
          extra={
            IMAGE_REQUEST_MODE_ENDPOINT_LABELS[IMAGE_REQUEST_MODES.GENERATION]
          }
          style={{ width: '100%' }}
        >
          {t('文生图')}
        </Radio>
        <Radio
          value={IMAGE_REQUEST_MODES.EDIT}
          extra={IMAGE_REQUEST_MODE_ENDPOINT_LABELS[IMAGE_REQUEST_MODES.EDIT]}
          style={{ width: '100%' }}
        >
          {t('图生图')}
        </Radio>
      </RadioGroup>
    </div>
  );
};

export default ImageRequestModeSwitch;
