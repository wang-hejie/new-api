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
  MESSAGE_ROLES,
} from '../constants/playground.constants';
import {
  buildChatPayload,
  buildImageEditPayload,
  buildImageGenerationPayload,
  buildImagePayload,
  buildImageResponseContent,
  buildPayloadByEndpoint,
  getApiEndpointByEndpointType,
  getApiEndpointForRequest,
  getEndpointTypeForModel,
  getEndpointTypeFromCustomBody,
  getImageQualityOptionsForModel,
  getImageSizeOptionsForModel,
  processModelsData,
} from './playgroundPayload';

const baseInputs = {
  model: 'gpt-image-1',
  group: 'default',
  prompt_size: '1024x1792',
  prompt_quality: 'invalid-quality',
  prompt_n: '2',
  prompt_response_format: 'url',
};
const legacyReferenceUsageField = ['prompt', 'reference', 'usage'].join('_');
const legacyFormReferenceUsageField = ['reference', 'usage'].join('_');

describe('playground payload helpers', () => {
  test('buildImagePayload uses last user text and sanitizes gpt-image params', () => {
    const payload = buildImagePayload(
      [
        {
          role: MESSAGE_ROLES.USER,
          content: 'old prompt',
        },
        {
          role: MESSAGE_ROLES.ASSISTANT,
          content: 'old reply',
        },
        {
          role: MESSAGE_ROLES.USER,
          content: [
            { type: 'text', text: '  draw a quiet library  ' },
            {
              type: 'image_url',
              image_url: { url: 'https://example.com/input.png' },
            },
          ],
        },
      ],
      {
        ...baseInputs,
        imageParameters: {
          response_format: false,
        },
      },
    );

    expect(payload).toEqual({
      model: 'gpt-image-1',
      group: 'default',
      prompt: 'draw a quiet library',
      n: 2,
      size: '1024x1024',
      quality: 'auto',
    });
  });

  test('buildImagePayload keeps allowed dall-e-3 response format', () => {
    const payload = buildImagePayload(
      [
        {
          role: MESSAGE_ROLES.USER,
          content: 'draw a mountain',
        },
      ],
      {
        ...baseInputs,
        model: 'dall-e-3',
        prompt_size: '1792x1024',
        prompt_quality: 'hd',
        prompt_response_format: 'b64_json',
      },
    );

    expect(payload).toEqual({
      model: 'dall-e-3',
      group: 'default',
      prompt: 'draw a mountain',
      n: 2,
      size: '1792x1024',
      quality: 'hd',
      response_format: 'b64_json',
    });
  });

  test('buildImagePayload omits dall-e-2 unsupported quality and sanitizes size', () => {
    const payload = buildImagePayload(
      [
        {
          role: MESSAGE_ROLES.USER,
          content: 'draw a small icon',
        },
      ],
      {
        ...baseInputs,
        model: 'dall-e-2',
        prompt_size: '1792x1024',
        prompt_quality: 'hd',
        prompt_response_format: 'url',
      },
    );

    expect(payload).toEqual({
      model: 'dall-e-2',
      group: 'default',
      prompt: 'draw a small icon',
      n: 2,
      size: '1024x1024',
      response_format: 'url',
    });
  });

  test('buildImagePayload keeps generic image model parameters without chat-only fields', () => {
    const payload = buildImagePayload(
      [
        {
          role: MESSAGE_ROLES.SYSTEM,
          content: 'ignored for image payload',
        },
        {
          role: MESSAGE_ROLES.USER,
          content: 'draw a city map',
        },
      ],
      {
        ...baseInputs,
        model: 'flux-pro',
        prompt_size: '1536x1024',
        prompt_quality: 'medium',
        prompt_response_format: '',
        stream: true,
        temperature: 0.2,
      },
    );

    expect(payload).toEqual({
      model: 'flux-pro',
      group: 'default',
      prompt: 'draw a city map',
      n: 2,
      size: '1536x1024',
      quality: 'medium',
    });
    expect(payload.messages).toBeUndefined();
    expect(payload.stream).toBeUndefined();
    expect(payload.temperature).toBeUndefined();
  });

  test('buildImagePayload follows image_parameters for Gemini native image models', () => {
    const payload = buildImagePayload(
      [
        {
          role: MESSAGE_ROLES.USER,
          content: 'draw a robot',
        },
      ],
      {
        ...baseInputs,
        model: 'gemini-3.1-flash-image-preview',
        prompt_n: 4,
        imageGenerationMode: 'gemini_native',
        imageParameters: {
          size: true,
          quality: true,
          response_format: false,
          n_max: 1,
        },
      },
    );

    expect(payload).toEqual({
      model: 'gemini-3.1-flash-image-preview',
      group: 'default',
      prompt: 'draw a robot',
      n: 1,
    });
  });

  test('getImageSizeOptionsForModel returns Gemini aspect ratios for gemini_native mode', () => {
    expect(
      getImageSizeOptionsForModel(
        'gemini-3.1-flash-image-preview',
        { size: true },
        'gemini_native',
      ),
    ).toEqual(['', '1:1', '4:3', '3:4', '16:9', '9:16', '21:9']);
  });

  test('getImageQualityOptionsForModel returns Gemini image sizes for gemini_native mode', () => {
    expect(
      getImageQualityOptionsForModel(
        'gemini-3.1-flash-image-preview',
        { quality: true },
        'gemini_native',
      ),
    ).toEqual(['', '1K', '2K', '4K']);
  });

  test('getImageQualityOptionsForModel drops high for gpt-image series', () => {
    const imageParameters = {
      size: true,
      quality: true,
      response_format: false,
      n_max: 10,
      supports_edits: true,
    };

    expect(
      getImageQualityOptionsForModel(
        'gpt-image-2',
        imageParameters,
        'gpt_image_v2',
      ),
    ).toEqual(['auto', 'low', 'medium']);
    expect(
      getImageQualityOptionsForModel(
        'gpt-image-1',
        imageParameters,
        'gpt_image_v1',
      ),
    ).toEqual(['auto', 'low', 'medium']);
    expect(
      getImageQualityOptionsForModel(
        'gpt-image-1-mini',
        imageParameters,
        'gpt_image_v1',
      ),
    ).toEqual(['auto', 'low', 'medium']);
  });

  test('buildImagePayload applies partial image_parameters capabilities', () => {
    const payload = buildImagePayload(
      [
        {
          role: MESSAGE_ROLES.USER,
          content: 'draw a poster',
        },
      ],
      {
        ...baseInputs,
        model: 'custom-image-model',
        prompt_size: '1792x1024',
        prompt_quality: 'hd',
        prompt_response_format: 'url',
        prompt_n: 5,
        imageParameters: {
          size: false,
          quality: true,
          response_format: true,
          n_max: 3,
        },
      },
    );

    expect(payload).toEqual({
      model: 'custom-image-model',
      group: 'default',
      prompt: 'draw a poster',
      n: 3,
      quality: 'hd',
      response_format: 'url',
    });
  });

  test('image option helpers hide unsupported image_parameters', () => {
    const imageParameters = {
      size: false,
      quality: false,
      response_format: false,
      n_max: 1,
    };

    expect(
      getImageSizeOptionsForModel(
        'gemini-3.1-flash-image-preview',
        imageParameters,
        'gemini_native',
      ),
    ).toEqual([]);
    expect(
      getImageQualityOptionsForModel(
        'gemini-3.1-flash-image-preview',
        imageParameters,
        'gemini_native',
      ),
    ).toEqual([]);
  });

  test('buildPayloadByEndpoint preserves chat payload behavior for openai models', () => {
    const messages = [
      {
        role: MESSAGE_ROLES.USER,
        content: 'hello',
      },
    ];
    const inputs = {
      ...baseInputs,
      model: 'gpt-4o',
      stream: true,
      temperature: 0,
      top_p: 1,
      max_tokens: 128,
    };
    const parameterEnabled = {
      temperature: true,
      top_p: true,
      max_tokens: true,
    };

    expect(
      buildPayloadByEndpoint(
        ENDPOINT_TYPES.OPENAI,
        IMAGE_REQUEST_MODES.GENERATION,
        messages,
        'system prompt',
        inputs,
        parameterEnabled,
      ),
    ).toEqual(
      buildChatPayload(messages, 'system prompt', inputs, parameterEnabled),
    );
  });

  test('buildPayloadByEndpoint creates image payload for image-generation models', () => {
    const payload = buildPayloadByEndpoint(
      ENDPOINT_TYPES.IMAGE_GENERATION,
      IMAGE_REQUEST_MODES.GENERATION,
      [
        {
          role: MESSAGE_ROLES.USER,
          content: 'draw a lake',
        },
      ],
      'ignored system prompt',
      {
        ...baseInputs,
        imageParameters: {
          response_format: false,
        },
      },
      {
        temperature: true,
        top_p: true,
      },
    );

    expect(payload).toEqual({
      model: 'gpt-image-1',
      group: 'default',
      prompt: 'draw a lake',
      n: 2,
      size: '1024x1024',
      quality: 'auto',
    });
  });

  test('buildImageGenerationPayload drops response_format for gpt-image-2 regardless of metadata', () => {
    const payload = buildImageGenerationPayload(
      [
        {
          role: MESSAGE_ROLES.USER,
          content: 'draw a clean product photo',
        },
      ],
      {
        ...baseInputs,
        model: 'gpt-image-2',
        prompt_size: '1536x1024',
        prompt_quality: 'low',
        prompt_response_format: 'url',
        imageParameters: {
          size: true,
          quality: true,
          response_format: true,
          n_max: 10,
          supports_edits: true,
        },
      },
    );

    expect(payload.response_format).toBeUndefined();
  });

  test('buildImageGenerationPayload only drops response_format for exact gpt-image-2', () => {
    const messages = [
      {
        role: MESSAGE_ROLES.USER,
        content: 'draw a clean product photo',
      },
    ];
    const imageParameters = {
      size: true,
      quality: true,
      response_format: true,
      n_max: 10,
    };

    const gptImage1Payload = buildImageGenerationPayload(messages, {
      ...baseInputs,
      model: 'gpt-image-1',
      prompt_response_format: 'url',
      imageParameters,
    });
    const futureGptImagePayload = buildImageGenerationPayload(messages, {
      ...baseInputs,
      model: 'gpt-image-3-preview',
      prompt_response_format: 'url',
      imageParameters,
    });

    expect(gptImage1Payload.response_format).toBe('url');
    expect(futureGptImagePayload.response_format).toBe('url');
  });

  test('legacy high quality falls back to auto for gpt-image series', () => {
    const imageParameters = {
      size: true,
      quality: true,
      response_format: false,
      n_max: 10,
      supports_edits: true,
    };
    const messages = [
      {
        role: MESSAGE_ROLES.USER,
        content: 'draw a clean product photo',
      },
    ];

    const generationPayload = buildImageGenerationPayload(messages, {
      ...baseInputs,
      model: 'gpt-image-2',
      prompt_quality: 'high',
      imageParameters,
    });
    expect(generationPayload.quality).toBe('auto');

    const file = new File(['image bytes'], 'reference.png', {
      type: 'image/png',
    });
    const editPayload = buildImageEditPayload(messages, {
      ...baseInputs,
      model: 'gpt-image-2',
      prompt_quality: 'high',
      image_reference_files: [file],
      imageParameters,
    });
    expect(editPayload.formData.get('quality')).toBe('auto');
    expect(editPayload.debugSnapshot.fields.quality).toBe('auto');
  });

  test('buildImageGenerationPayload sends Gemini aspect ratio and image size through size and quality fields', () => {
    const payload = buildImageGenerationPayload(
      [
        {
          role: MESSAGE_ROLES.USER,
          content: 'draw a vertical poster',
        },
      ],
      {
        ...baseInputs,
        model: 'gemini-3.1-flash-image-preview',
        prompt_size: '9:16',
        prompt_quality: '2K',
        prompt_response_format: 'url',
        prompt_n: 4,
        imageGenerationMode: 'gemini_native',
        imageParameters: {
          size: true,
          quality: true,
          response_format: false,
          n_max: 1,
          supports_edits: true,
        },
      },
    );

    expect(payload).toEqual({
      model: 'gemini-3.1-flash-image-preview',
      group: 'default',
      prompt: 'draw a vertical poster',
      n: 1,
      size: '9:16',
      quality: '2K',
    });
  });

  test('Gemini native default empty size and quality are omitted from generation payload', () => {
    const payload = buildImageGenerationPayload(
      [
        {
          role: MESSAGE_ROLES.USER,
          content: 'draw a default image',
        },
      ],
      {
        ...baseInputs,
        model: 'gemini-3.1-flash-image-preview',
        prompt_size: '',
        prompt_quality: '',
        imageGenerationMode: 'gemini_native',
        imageParameters: {
          size: true,
          quality: true,
          response_format: false,
          n_max: 1,
          supports_edits: true,
        },
      },
    );

    expect(payload.size).toBeUndefined();
    expect(payload.quality).toBeUndefined();
  });

  test('sanitize drops legacy OpenAI size and quality when switching to gemini_native', () => {
    const payload = buildImageGenerationPayload(
      [
        {
          role: MESSAGE_ROLES.USER,
          content: 'draw with defaults',
        },
      ],
      {
        ...baseInputs,
        model: 'gemini-3.1-flash-image-preview',
        prompt_size: '1024x1024',
        prompt_quality: 'auto',
        imageGenerationMode: 'gemini_native',
        imageParameters: {
          size: true,
          quality: true,
          response_format: false,
          n_max: 1,
          supports_edits: true,
        },
      },
    );

    expect(payload.size).toBeUndefined();
    expect(payload.quality).toBeUndefined();
  });

  test('buildImageEditPayload creates multipart payload and debug snapshot', () => {
    const file = new File(['image bytes'], 'apple.webp', {
      type: 'image/webp',
    });
    const payload = buildImageEditPayload(
      [
        {
          role: MESSAGE_ROLES.USER,
          content: 'change the apple color to bright green',
        },
      ],
      {
        ...baseInputs,
        model: 'gpt-image-2',
        prompt_size: '1024x1024',
        prompt_quality: 'low',
        prompt_response_format: 'url',
        image_reference_files: [file],
        imageParameters: {
          size: true,
          quality: true,
          response_format: true,
          n_max: 10,
          supports_edits: true,
        },
      },
    );

    expect(payload.formData).toBeInstanceOf(FormData);
    expect(payload.formData.get('model')).toBe('gpt-image-2');
    expect(payload.formData.get('prompt')).toBe(
      'change the apple color to bright green',
    );
    expect(payload.formData.has('response_format')).toBe(false);
    expect(payload.formData.has(legacyFormReferenceUsageField)).toBe(false);
    const imageFile = payload.formData.get('image');
    expect(imageFile.name).toBe('apple.webp');
    expect(imageFile.size).toBe(11);
    expect(imageFile.type).toBe('image/webp');
    expect(payload.debugSnapshot).toEqual({
      url: '/pg/images/edits',
      fields: {
        model: 'gpt-image-2',
        group: 'default',
        prompt: 'change the apple color to bright green',
        n: 2,
        size: '1024x1024',
        quality: 'low',
      },
      files: {
        image: [{ name: 'apple.webp', size: 11, type: 'image/webp' }],
      },
    });
  });

  test('buildImageEditPayload for gpt-image-2 strips legacy fields', () => {
    const file = new File(['image bytes'], 'apple.png', {
      type: 'image/png',
    });
    const payload = buildImageEditPayload(
      [
        {
          role: MESSAGE_ROLES.USER,
          content: 'keep the same product shape',
        },
      ],
      {
        ...baseInputs,
        model: 'gpt-image-2',
        prompt_size: 'auto',
        prompt_quality: 'medium',
        prompt_response_format: 'url',
        [legacyReferenceUsageField]: 'invalid-usage',
        image_reference_files: [file],
        imageParameters: {
          size: true,
          quality: true,
          response_format: false,
          n_max: 10,
          supports_edits: true,
        },
      },
    );

    expect(payload.formData.has(legacyFormReferenceUsageField)).toBe(false);
    expect(payload.formData.has('response_format')).toBe(false);
    expect(
      payload.debugSnapshot.fields[legacyFormReferenceUsageField],
    ).toBeUndefined();
    expect(payload.debugSnapshot.fields.response_format).toBeUndefined();
  });

  test('buildImageEditPayload strips edit response format and legacy reference usage for every model', () => {
    const file = new File(['image bytes'], 'style.png', {
      type: 'image/png',
    });
    const payload = buildImageEditPayload(
      [
        {
          role: MESSAGE_ROLES.USER,
          content: 'use this as the style reference',
        },
      ],
      {
        ...baseInputs,
        model: 'gpt-image-1',
        prompt_response_format: 'url',
        [legacyReferenceUsageField]: 'style',
        image_reference_files: [file],
        imageParameters: {
          size: true,
          quality: true,
          response_format: true,
          n_max: 10,
          supports_edits: true,
        },
      },
    );

    expect(payload.formData.get('model')).toBe('gpt-image-1');
    expect(payload.formData.has('response_format')).toBe(false);
    expect(payload.formData.has(legacyFormReferenceUsageField)).toBe(false);
    expect(payload.debugSnapshot.fields.response_format).toBeUndefined();
    expect(
      payload.debugSnapshot.fields[legacyFormReferenceUsageField],
    ).toBeUndefined();
  });

  test('buildImageEditPayload includes Gemini aspect ratio and image size in FormData', () => {
    const file = new File(['image bytes'], 'apple.png', {
      type: 'image/png',
    });
    const payload = buildImageEditPayload(
      [
        {
          role: MESSAGE_ROLES.USER,
          content: 'make the apple green',
        },
      ],
      {
        ...baseInputs,
        model: 'gemini-3.1-flash-image-preview',
        prompt_size: '16:9',
        prompt_quality: '4K',
        prompt_n: 3,
        imageGenerationMode: 'gemini_native',
        image_reference_files: [file],
        imageParameters: {
          size: true,
          quality: true,
          response_format: false,
          n_max: 1,
          supports_edits: true,
        },
      },
    );

    expect(payload.formData.get('size')).toBe('16:9');
    expect(payload.formData.get('quality')).toBe('4K');
    expect(payload.formData.get('n')).toBe('1');
    expect(payload.debugSnapshot.fields.size).toBe('16:9');
    expect(payload.debugSnapshot.fields.quality).toBe('4K');
  });

  test('buildPayloadByEndpoint creates edit multipart payload and requires a reference image', () => {
    const file = new File(['image bytes'], 'style.png', {
      type: 'image/png',
    });
    const payload = buildPayloadByEndpoint(
      ENDPOINT_TYPES.IMAGE_GENERATION,
      IMAGE_REQUEST_MODES.EDIT,
      [
        {
          role: MESSAGE_ROLES.USER,
          content: 'use this as the style reference',
        },
      ],
      'ignored system prompt',
      {
        ...baseInputs,
        model: 'gpt-image-2',
        image_reference_files: [file],
        imageParameters: {
          size: true,
          quality: true,
          response_format: true,
          n_max: 10,
          supports_edits: true,
        },
      },
      {},
    );

    expect(payload.formData).toBeInstanceOf(FormData);
    expect(payload.formData.has(legacyFormReferenceUsageField)).toBe(false);
    expect(payload.debugSnapshot.url).toBe('/pg/images/edits');

    expect(() =>
      buildPayloadByEndpoint(
        ENDPOINT_TYPES.IMAGE_GENERATION,
        IMAGE_REQUEST_MODES.EDIT,
        [
          {
            role: MESSAGE_ROLES.USER,
            content: 'use this as the style reference',
          },
        ],
        null,
        {
          ...baseInputs,
          model: 'gpt-image-2',
          image_reference_files: [],
        },
        {},
      ),
    ).toThrow('图生图模式需要先上传参考图');
  });

  test('getApiEndpointForRequest dispatches edit mode to images edits endpoint', () => {
    expect(
      getApiEndpointForRequest({
        endpointType: ENDPOINT_TYPES.IMAGE_GENERATION,
        imageRequestMode: IMAGE_REQUEST_MODES.EDIT,
      }),
    ).toBe('/pg/images/edits');
  });

  test('getApiEndpointByEndpointType dispatches image requests to images generations endpoint', () => {
    expect(getApiEndpointByEndpointType(ENDPOINT_TYPES.IMAGE_GENERATION)).toBe(
      '/pg/images/generations',
    );
    expect(getApiEndpointByEndpointType(ENDPOINT_TYPES.OPENAI)).toBe(
      '/pg/chat/completions',
    );
    expect(getApiEndpointByEndpointType(undefined)).toBe(
      '/pg/chat/completions',
    );
  });

  test('buildImageResponseContent maps url and b64_json images for chat rendering', () => {
    expect(
      buildImageResponseContent({
        data: [
          {
            revised_prompt: 'draw a detailed lake',
            url: 'https://example.com/lake.png',
          },
          {
            b64_json: 'iVBORw0KGgo=',
          },
          {
            revised_prompt: '',
          },
        ],
      }),
    ).toEqual([
      {
        type: 'text',
        text: 'draw a detailed lake',
      },
      {
        type: 'image_url',
        image_url: { url: 'https://example.com/lake.png' },
      },
      {
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' },
      },
    ]);
  });

  test('processModelsData supports legacy strings and endpoint metadata', () => {
    const { modelOptions, selectedModel } = processModelsData(
      [
        'gpt-4o',
        {
          name: 'gpt-image-1',
          endpoint_types: [ENDPOINT_TYPES.IMAGE_GENERATION],
          image_generation_mode: 'gemini_native',
          image_parameters: {
            size: true,
            quality: true,
            response_format: false,
            n_max: 1,
            supports_edits: true,
          },
        },
      ],
      'gpt-image-1',
    );

    expect(selectedModel).toBe('gpt-image-1');
    expect(modelOptions).toEqual([
      {
        label: 'gpt-4o',
        value: 'gpt-4o',
        endpointTypes: [ENDPOINT_TYPES.OPENAI],
      },
      {
        label: 'gpt-image-1',
        value: 'gpt-image-1',
        endpointTypes: [ENDPOINT_TYPES.IMAGE_GENERATION],
        imageGenerationMode: 'gemini_native',
        imageParameters: {
          size: true,
          quality: true,
          response_format: false,
          n_max: 1,
          supports_edits: true,
        },
      },
    ]);
  });

  test('processModelsData preserves Gemini native metadata without frontend model whitelist', () => {
    const { modelOptions, selectedModel } = processModelsData(
      [
        {
          name: 'gemini-3.1-flash-image-preview',
          endpoint_types: [
            ENDPOINT_TYPES.OPENAI,
            'gemini',
            ENDPOINT_TYPES.IMAGE_GENERATION,
          ],
          image_generation_mode: 'gemini_native',
          image_parameters: {
            size: true,
            quality: true,
            response_format: false,
            n_max: 1,
            supports_edits: true,
          },
        },
      ],
      'missing-model',
    );

    expect(selectedModel).toBe('gemini-3.1-flash-image-preview');
    expect(modelOptions).toEqual([
      {
        label: 'gemini-3.1-flash-image-preview',
        value: 'gemini-3.1-flash-image-preview',
        endpointTypes: [
          ENDPOINT_TYPES.OPENAI,
          'gemini',
          ENDPOINT_TYPES.IMAGE_GENERATION,
        ],
        imageGenerationMode: 'gemini_native',
        imageParameters: {
          size: true,
          quality: true,
          response_format: false,
          n_max: 1,
          supports_edits: true,
        },
      },
    ]);
    expect(
      getEndpointTypeForModel(modelOptions, 'gemini-3.1-flash-image-preview'),
    ).toBe(ENDPOINT_TYPES.IMAGE_GENERATION);
  });

  test('endpoint selection uses includes instead of endpoint type ordering', () => {
    const models = [
      {
        value: 'gpt-image-1',
        endpointTypes: [ENDPOINT_TYPES.OPENAI, ENDPOINT_TYPES.IMAGE_GENERATION],
      },
      {
        value: 'gpt-4o',
        endpointTypes: [ENDPOINT_TYPES.OPENAI],
      },
    ];

    expect(getEndpointTypeForModel(models, 'gpt-image-1')).toBe(
      ENDPOINT_TYPES.IMAGE_GENERATION,
    );
    expect(getEndpointTypeForModel(models, 'gpt-4o')).toBe(
      ENDPOINT_TYPES.OPENAI,
    );
    expect(getEndpointTypeForModel(models, 'missing-model')).toBe(
      ENDPOINT_TYPES.OPENAI,
    );
  });

  test('custom body model controls endpoint and falls back when invalid', () => {
    const models = [
      { value: 'gpt-4o', endpointTypes: [ENDPOINT_TYPES.OPENAI] },
      {
        value: 'gpt-image-1',
        endpointTypes: [ENDPOINT_TYPES.IMAGE_GENERATION],
      },
    ];

    expect(
      getEndpointTypeFromCustomBody(
        JSON.stringify({ model: 'gpt-image-1' }),
        models,
        'gpt-4o',
      ),
    ).toBe(ENDPOINT_TYPES.IMAGE_GENERATION);

    expect(
      getEndpointTypeFromCustomBody('{bad json', models, 'gpt-image-1'),
    ).toBe(ENDPOINT_TYPES.IMAGE_GENERATION);

    expect(
      getEndpointTypeFromCustomBody(
        JSON.stringify({ model: 'unknown-model' }),
        models,
        'gpt-4o',
      ),
    ).toBe(ENDPOINT_TYPES.OPENAI);
  });

  test('custom body chat model overrides image model selected in sidebar', () => {
    const models = [
      { value: 'gpt-4o', endpointTypes: [ENDPOINT_TYPES.OPENAI] },
      {
        value: 'gpt-image-1',
        endpointTypes: [ENDPOINT_TYPES.IMAGE_GENERATION],
      },
    ];

    expect(
      getEndpointTypeFromCustomBody(
        JSON.stringify({ model: 'gpt-4o', messages: [] }),
        models,
        'gpt-image-1',
      ),
    ).toBe(ENDPOINT_TYPES.OPENAI);
  });

  test('custom body Gemini native image model dispatches to image endpoint', () => {
    const models = [
      { value: 'gpt-4o', endpointTypes: [ENDPOINT_TYPES.OPENAI] },
      {
        value: 'gemini-3.1-flash-image-preview',
        endpointTypes: [
          ENDPOINT_TYPES.OPENAI,
          'gemini',
          ENDPOINT_TYPES.IMAGE_GENERATION,
        ],
      },
    ];

    expect(
      getEndpointTypeFromCustomBody(
        JSON.stringify({ model: 'gemini-3.1-flash-image-preview' }),
        models,
        'gpt-4o',
      ),
    ).toBe(ENDPOINT_TYPES.IMAGE_GENERATION);
  });
});
