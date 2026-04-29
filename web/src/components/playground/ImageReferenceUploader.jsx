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

import React, { useMemo, useRef } from 'react';
import { Button, Toast, Typography } from '@douyinfe/semi-ui';
import { ImagePlus, Trash2, UploadCloud } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_REFERENCE_FILE_SIZE = 10 * 1024 * 1024;
export const IMAGE_REFERENCE_FILE_ERROR =
  '仅支持 PNG / JPEG / WebP，单文件不超过 10 MB';

export const validateImageReferenceFile = (file) =>
  Boolean(
    file &&
      ACCEPTED_IMAGE_TYPES.includes(file.type) &&
      file.size <= MAX_REFERENCE_FILE_SIZE,
  );

const formatFileSize = (size = 0) => {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  if (size >= 1024) {
    return `${Math.ceil(size / 1024)} KB`;
  }
  return `${size} B`;
};

const ImageReferenceUploader = ({
  referenceFiles = [],
  onReferenceFilesChange,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const file = referenceFiles?.[0];
  const previewUrl = useMemo(() => {
    if (!file) {
      return '';
    }
    return URL.createObjectURL(file);
  }, [file]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';
    if (!selectedFile) {
      return;
    }
    if (!validateImageReferenceFile(selectedFile)) {
      Toast.warning(t(IMAGE_REFERENCE_FILE_ERROR));
      return;
    }
    onReferenceFilesChange([selectedFile]);
  };

  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className='flex items-center gap-2 mb-2'>
        <ImagePlus size={16} className='text-gray-500' />
        <Typography.Text strong className='text-sm'>
          {t('参考图')}
        </Typography.Text>
      </div>

      <input
        ref={inputRef}
        type='file'
        accept='image/png,image/jpeg,image/webp'
        onChange={handleFileChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {file ? (
        <div className='flex gap-3 items-center rounded-lg border border-gray-200 p-2 bg-gray-50'>
          {previewUrl && (
            <img
              src={previewUrl}
              alt={file.name}
              className='w-14 h-14 rounded object-cover border border-gray-200'
            />
          )}
          <div className='min-w-0 flex-1'>
            <Typography.Text className='block text-sm truncate'>
              {file.name}
            </Typography.Text>
            <Typography.Text className='block text-xs text-gray-500'>
              {formatFileSize(file.size)}
              {file.type ? ` / ${file.type}` : ''}
            </Typography.Text>
          </div>
          <Button
            icon={<Trash2 size={14} />}
            theme='borderless'
            type='danger'
            size='small'
            onClick={() => onReferenceFilesChange([])}
            disabled={disabled}
            aria-label={t('删除参考图')}
          />
        </div>
      ) : (
        <Button
          icon={<UploadCloud size={16} />}
          theme='outline'
          type='tertiary'
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          style={{ width: '100%' }}
          className='!rounded-lg'
        >
          {t('上传参考图')}
        </Button>
      )}

      <Typography.Text className='text-xs text-gray-500 mt-1 inline-block'>
        {t(IMAGE_REFERENCE_FILE_ERROR)}
      </Typography.Text>
      <Typography.Text className='text-xs text-gray-500 block'>
        {t('WebP/JPEG 上传更快')}
      </Typography.Text>
    </div>
  );
};

export default ImageReferenceUploader;
