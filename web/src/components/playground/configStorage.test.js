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

import { describe, expect, test } from 'bun:test';
import { DEFAULT_CONFIG } from '../../constants/playground.constants';
import {
  sanitizePlaygroundConfig,
  sanitizePlaygroundInputsForStorage,
} from './configStorage';

describe('playground config storage sanitizers', () => {
  test('fills image defaults and removes non-serializable image files', () => {
    const referenceFile = new File(['image bytes'], 'apple.png', {
      type: 'image/png',
    });
    const sanitized = sanitizePlaygroundInputsForStorage({
      model: 'gpt-image-2',
      image_request_mode: 'edit',
      image_reference_files: [referenceFile],
      image_mask_file: referenceFile,
    });

    expect(sanitized.model).toBe('gpt-image-2');
    expect(sanitized.image_request_mode).toBe('edit');
    expect(sanitized.prompt_reference_usage).toBe('subject');
    expect(sanitized.image_reference_files).toBeUndefined();
    expect(sanitized.image_mask_file).toBeUndefined();
  });

  test('merges parameter defaults while sanitizing imported config', () => {
    const sanitized = sanitizePlaygroundConfig({
      inputs: {
        model: 'gpt-image-2',
      },
      parameterEnabled: {
        temperature: false,
      },
    });

    expect(sanitized.inputs.image_request_mode).toBe('generation');
    expect(sanitized.inputs.prompt_reference_usage).toBe('subject');
    expect(sanitized.parameterEnabled.temperature).toBe(false);
    expect(sanitized.parameterEnabled.top_p).toBe(
      DEFAULT_CONFIG.parameterEnabled.top_p,
    );
  });
});
