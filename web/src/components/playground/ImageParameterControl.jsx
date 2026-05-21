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
import { InputNumber, Select, Tooltip, Typography } from '@douyinfe/semi-ui';
import { Image, Layers, SlidersHorizontal, FileOutput } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  getImageQualityOptionsForModel,
  getImageSizeOptionsForModel,
} from '../../helpers';

const labelByValue = {
  '': '默认（不发送）',
  auto: '自动',
  standard: '标准',
  hd: '高清',
  low: '低',
  medium: '中',
  high: '高',
  url: 'URL',
  b64_json: 'Base64 JSON',
  '1:1': '1:1（方形）',
  '4:3': '4:3',
  '3:4': '3:4',
  '16:9': '16:9（宽屏）',
  '9:16': '9:16（竖屏）',
  '21:9': '21:9（超宽）',
  '1K': '1K（默认）',
  '2K': '2K',
  '4K': '4K',
};

const toOptionList = (values, t) =>
  values.map((value) => ({
    value,
    label: t(labelByValue[value] || value),
  }));

const normalizeSelectValue = (value, options) =>
  options.some((option) => option.value === value) ? value : '';

const ImageParameterControl = ({ inputs, onInputChange, disabled = false }) => {
  const { t } = useTranslation();
  const imageParameters = inputs.imageParameters;
  const isGeminiNative = inputs.imageGenerationMode === 'gemini_native';
  const sizeOptions = useMemo(
    () =>
      toOptionList(
        getImageSizeOptionsForModel(
          inputs.model,
          imageParameters,
          inputs.imageGenerationMode,
        ),
        t,
      ),
    [inputs.model, imageParameters, inputs.imageGenerationMode, t],
  );
  const qualityOptions = useMemo(
    () =>
      toOptionList(
        getImageQualityOptionsForModel(
          inputs.model,
          imageParameters,
          inputs.imageGenerationMode,
        ),
        t,
      ),
    [inputs.model, imageParameters, inputs.imageGenerationMode, t],
  );
  const sizeValue = normalizeSelectValue(inputs.prompt_size, sizeOptions);
  const qualityValue = normalizeSelectValue(
    inputs.prompt_quality,
    qualityOptions,
  );
  const sizeLabel = isGeminiNative ? t('宽高比') : t('图像尺寸');
  const qualityLabel = isGeminiNative ? t('图像分辨率') : t('图像质量');
  const maxImageCount = imageParameters?.n_max || undefined;
  const isCountLocked = maxImageCount === 1;

  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className='space-y-4'>
        {sizeOptions.length > 0 && (
          <div>
            <div className='flex items-center gap-2 mb-2'>
              <Image size={16} className='text-gray-500' />
              <Typography.Text strong className='text-sm'>
                {sizeLabel}
              </Typography.Text>
            </div>
            <Select
              value={sizeValue}
              optionList={sizeOptions}
              onChange={(value) => onInputChange('prompt_size', value)}
              style={{ width: '100%' }}
              className='!rounded-lg'
              disabled={disabled}
            />
          </div>
        )}

        {qualityOptions.length > 0 && (
          <div>
            <div className='flex items-center gap-2 mb-2'>
              <SlidersHorizontal size={16} className='text-gray-500' />
              <Typography.Text strong className='text-sm'>
                {qualityLabel}
              </Typography.Text>
            </div>
            <Select
              value={qualityValue}
              optionList={qualityOptions}
              onChange={(value) => onInputChange('prompt_quality', value)}
              style={{ width: '100%' }}
              className='!rounded-lg'
              disabled={disabled}
            />
          </div>
        )}

        <div>
          <div className='flex items-center gap-2 mb-2'>
            <Layers size={16} className='text-gray-500' />
            <Typography.Text strong className='text-sm'>
              {t('图像数量')}
            </Typography.Text>
          </div>
          <InputNumber
            value={inputs.prompt_n}
            onNumberChange={(value) => onInputChange('prompt_n', value || 1)}
            min={1}
            max={maxImageCount}
            precision={0}
            style={{ width: '100%' }}
            disabled={disabled || isCountLocked}
          />
          {isCountLocked && (
            <Tooltip content={t('Gemini 图像模型一次只生成 1 张图')}>
              <Typography.Text className='text-xs text-gray-500 mt-1 inline-block'>
                {t('Gemini 图像模型一次只生成 1 张图')}
              </Typography.Text>
            </Tooltip>
          )}
        </div>

        {imageParameters?.response_format !== false && (
          <div>
            <div className='flex items-center gap-2 mb-2'>
              <FileOutput size={16} className='text-gray-500' />
              <Typography.Text strong className='text-sm'>
                {t('返回格式')}
              </Typography.Text>
            </div>
            <Select
              value={inputs.prompt_response_format}
              optionList={[
                { value: '', label: t('不发送') },
                { value: 'url', label: t('URL') },
                { value: 'b64_json', label: t('Base64 JSON') },
              ]}
              onChange={(value) =>
                onInputChange('prompt_response_format', value)
              }
              style={{ width: '100%' }}
              className='!rounded-lg'
              disabled={disabled}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageParameterControl;
