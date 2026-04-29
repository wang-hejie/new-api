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
import {
  ENDPOINT_TYPES,
  IMAGE_REQUEST_MODES,
} from '../../constants/playground.constants';
import {
  normalizeImageRequestMode,
  shouldBlockImageEditRegeneration,
} from './imageEditGuards';

describe('useMessageEdit image edit regeneration guard', () => {
  test('normalizes edit mode from explicit supports_edits metadata only', () => {
    expect(
      normalizeImageRequestMode({
        imageRequestMode: IMAGE_REQUEST_MODES.EDIT,
        supportsEdits: true,
      }),
    ).toBe(IMAGE_REQUEST_MODES.EDIT);
    expect(
      normalizeImageRequestMode({
        imageRequestMode: IMAGE_REQUEST_MODES.EDIT,
        supportsEdits: false,
      }),
    ).toBe(IMAGE_REQUEST_MODES.GENERATION);
    expect(
      normalizeImageRequestMode({
        imageRequestMode: IMAGE_REQUEST_MODES.EDIT,
        supportsEdits: undefined,
      }),
    ).toBe(IMAGE_REQUEST_MODES.GENERATION);
    expect(
      normalizeImageRequestMode({
        imageRequestMode: IMAGE_REQUEST_MODES.GENERATION,
        supportsEdits: true,
      }),
    ).toBe(IMAGE_REQUEST_MODES.GENERATION);
  });

  test('blocks image edit regeneration when reference file is missing', () => {
    expect(
      shouldBlockImageEditRegeneration({
        endpointType: ENDPOINT_TYPES.IMAGE_GENERATION,
        imageRequestMode: IMAGE_REQUEST_MODES.EDIT,
        imageReferenceFiles: [],
      }),
    ).toBe(true);
  });

  test('allows image edit regeneration when reference file is still available', () => {
    const file = new File(['image bytes'], 'apple.png', {
      type: 'image/png',
    });

    expect(
      shouldBlockImageEditRegeneration({
        endpointType: ENDPOINT_TYPES.IMAGE_GENERATION,
        imageRequestMode: IMAGE_REQUEST_MODES.EDIT,
        imageReferenceFiles: [file],
      }),
    ).toBe(false);
  });

  test('does not affect generation mode or chat requests', () => {
    expect(
      shouldBlockImageEditRegeneration({
        endpointType: ENDPOINT_TYPES.IMAGE_GENERATION,
        imageRequestMode: IMAGE_REQUEST_MODES.GENERATION,
        imageReferenceFiles: [],
      }),
    ).toBe(false);
    expect(
      shouldBlockImageEditRegeneration({
        endpointType: ENDPOINT_TYPES.OPENAI,
        imageRequestMode: IMAGE_REQUEST_MODES.EDIT,
        imageReferenceFiles: [],
      }),
    ).toBe(false);
  });
});
