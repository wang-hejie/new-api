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
  MESSAGE_ROLES,
} from '../constants/playground.constants';
import {
  buildChatPayload,
  buildImagePayload,
  buildImageResponseContent,
  buildPayloadByEndpoint,
  getApiEndpointByEndpointType,
  getEndpointTypeForModel,
  getEndpointTypeFromCustomBody,
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
      baseInputs,
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
      [
        {
          role: MESSAGE_ROLES.USER,
          content: 'draw a lake',
        },
      ],
      'ignored system prompt',
      baseInputs,
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
      },
    ]);
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
});
