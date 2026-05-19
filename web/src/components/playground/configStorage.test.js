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

import { beforeEach, describe, expect, test } from 'bun:test';
import {
  DEFAULT_CONFIG,
  STORAGE_KEYS,
} from '../../constants/playground.constants';
import {
  loadConfig,
  sanitizePlaygroundConfig,
  sanitizePlaygroundInputsForStorage,
  saveConfig,
} from './configStorage';

const legacyReferenceUsageField = ['prompt', 'reference', 'usage'].join('_');

const installLocalStorageMock = () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => {
      storage.set(key, String(value));
    },
    removeItem: (key) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  };
  return storage;
};

describe('playground config storage sanitizers', () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  test('default image inputs no longer include legacy reference usage', () => {
    expect(DEFAULT_CONFIG.inputs[legacyReferenceUsageField]).toBeUndefined();
    expect(
      Object.prototype.hasOwnProperty.call(
        DEFAULT_CONFIG.inputs,
        legacyReferenceUsageField,
      ),
    ).toBe(false);
  });

  test('fills image defaults and removes non-serializable image files', () => {
    const referenceFile = new File(['image bytes'], 'apple.png', {
      type: 'image/png',
    });
    const sanitized = sanitizePlaygroundInputsForStorage({
      model: 'gpt-image-2',
      image_request_mode: 'edit',
      [legacyReferenceUsageField]: 'composition',
      image_reference_files: [referenceFile],
      image_mask_file: referenceFile,
    });

    expect(sanitized.model).toBe('gpt-image-2');
    expect(sanitized.image_request_mode).toBe('edit');
    expect(sanitized[legacyReferenceUsageField]).toBeUndefined();
    expect(sanitized.image_reference_files).toBeUndefined();
    expect(sanitized.image_mask_file).toBeUndefined();
  });

  test('merges parameter defaults while sanitizing imported config', () => {
    const sanitized = sanitizePlaygroundConfig({
      inputs: {
        model: 'gpt-image-2',
        [legacyReferenceUsageField]: 'style',
      },
      parameterEnabled: {
        temperature: false,
      },
    });

    expect(sanitized.inputs.image_request_mode).toBe('generation');
    expect(sanitized.inputs[legacyReferenceUsageField]).toBeUndefined();
    expect(sanitized.parameterEnabled.temperature).toBe(false);
    expect(sanitized.parameterEnabled.top_p).toBe(
      DEFAULT_CONFIG.parameterEnabled.top_p,
    );
  });

  test('saveConfig and loadConfig sanitize legacy reference usage in persisted configs', () => {
    saveConfig({
      inputs: {
        model: 'gpt-image-2',
        [legacyReferenceUsageField]: 'subject',
      },
      parameterEnabled: {
        temperature: false,
      },
    });

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.CONFIG));
    expect(saved.inputs[legacyReferenceUsageField]).toBeUndefined();

    localStorage.setItem(
      STORAGE_KEYS.CONFIG,
      JSON.stringify({
        inputs: {
          model: 'gpt-image-2',
          max_tokens: '2048',
          [legacyReferenceUsageField]: 'style',
        },
        parameterEnabled: {
          temperature: false,
        },
      }),
    );

    const loaded = loadConfig();
    expect(loaded.inputs.model).toBe('gpt-image-2');
    expect(loaded.inputs.max_tokens).toBe(2048);
    expect(loaded.inputs[legacyReferenceUsageField]).toBeUndefined();
  });
});
