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

import {
  API_ENDPOINTS,
  ENDPOINT_TYPES,
  MESSAGE_ROLES,
} from '../constants/playground.constants';

export const isImageGenerationEndpoint = (endpointType) =>
  endpointType === ENDPOINT_TYPES.IMAGE_GENERATION;

export const getApiEndpointByEndpointType = (endpointType) =>
  isImageGenerationEndpoint(endpointType)
    ? API_ENDPOINTS.IMAGES_GENERATIONS
    : API_ENDPOINTS.CHAT_COMPLETIONS;

export const isGptImageModel = (model = '') =>
  model.toLowerCase().startsWith('gpt-image-');

export const isDallE3Model = (model = '') => model.toLowerCase() === 'dall-e-3';

export const isDallE2Model = (model = '') => {
  const normalizedModel = model.toLowerCase();
  return normalizedModel === 'dall-e-2' || normalizedModel === 'dall-e';
};

const GPT_IMAGE_SIZES = ['auto', '1024x1024', '1536x1024', '1024x1536'];
const DALL_E_3_SIZES = ['1024x1024', '1024x1792', '1792x1024'];
const DALL_E_2_SIZES = ['256x256', '512x512', '1024x1024'];
const GENERIC_IMAGE_SIZES = [
  '1024x1024',
  '1024x1792',
  '1792x1024',
  '1536x1024',
  '1024x1536',
];

const GPT_IMAGE_QUALITIES = ['auto', 'low', 'medium', 'high'];
const DALL_E_3_QUALITIES = ['standard', 'hd'];
const GENERIC_IMAGE_QUALITIES = [
  'auto',
  'standard',
  'hd',
  'low',
  'medium',
  'high',
];

export const getImageSizeOptionsForModel = (model = '', imageParameters) => {
  if (imageParameters?.size === false) {
    return [];
  }
  if (isGptImageModel(model)) {
    return GPT_IMAGE_SIZES;
  }
  if (isDallE3Model(model)) {
    return DALL_E_3_SIZES;
  }
  if (isDallE2Model(model)) {
    return DALL_E_2_SIZES;
  }
  return GENERIC_IMAGE_SIZES;
};

export const getImageQualityOptionsForModel = (model = '', imageParameters) => {
  if (imageParameters?.quality === false) {
    return [];
  }
  if (isGptImageModel(model)) {
    return GPT_IMAGE_QUALITIES;
  }
  if (isDallE3Model(model)) {
    return DALL_E_3_QUALITIES;
  }
  if (isDallE2Model(model)) {
    return [];
  }
  return GENERIC_IMAGE_QUALITIES;
};

const getDefaultImageSizeForModel = (model = '') => {
  if (isGptImageModel(model)) {
    return '1024x1024';
  }
  if (isDallE3Model(model) || isDallE2Model(model)) {
    return '1024x1024';
  }
  return '1024x1024';
};

const sanitizeImageSize = (model = '', size = '', imageParameters) => {
  if (imageParameters?.size === false) {
    return '';
  }
  const normalizedSize = typeof size === 'string' ? size.trim() : '';
  const options = getImageSizeOptionsForModel(model, imageParameters);

  if (options.includes(normalizedSize)) {
    return normalizedSize;
  }

  if (isGptImageModel(model) || isDallE3Model(model) || isDallE2Model(model)) {
    return getDefaultImageSizeForModel(model);
  }

  return normalizedSize || getDefaultImageSizeForModel(model);
};

const sanitizeImageQuality = (model = '', quality = '', imageParameters) => {
  if (imageParameters?.quality === false) {
    return '';
  }
  const normalizedQuality = typeof quality === 'string' ? quality.trim() : '';
  const options = getImageQualityOptionsForModel(model, imageParameters);

  if (isDallE2Model(model)) {
    return '';
  }

  if (options.includes(normalizedQuality)) {
    return normalizedQuality;
  }

  if (isGptImageModel(model)) {
    return 'auto';
  }
  if (isDallE3Model(model)) {
    return 'standard';
  }

  return normalizedQuality || 'auto';
};

const sanitizeImageCount = (count, maxCount) => {
  const parsedCount = parseInt(count, 10);
  const safeMaxCount =
    Number.isFinite(maxCount) && maxCount > 0 ? Math.floor(maxCount) : null;
  if (Number.isFinite(parsedCount) && parsedCount > 0) {
    return safeMaxCount ? Math.min(parsedCount, safeMaxCount) : parsedCount;
  }
  return 1;
};

const sanitizeImageResponseFormat = (
  model = '',
  responseFormat = '',
  imageParameters,
) => {
  if (imageParameters?.response_format === false) {
    return '';
  }
  const normalizedResponseFormat =
    typeof responseFormat === 'string' ? responseFormat.trim() : '';

  if (!normalizedResponseFormat || isGptImageModel(model)) {
    return '';
  }

  if (['url', 'b64_json'].includes(normalizedResponseFormat)) {
    return normalizedResponseFormat;
  }

  return '';
};

const getTextContent = (message) => {
  if (!message || !message.content) return '';

  if (Array.isArray(message.content)) {
    const textContent = message.content.find((item) => item.type === 'text');
    return textContent?.text || '';
  }
  return typeof message.content === 'string' ? message.content : '';
};

const getLastUserMessage = (messages) => {
  if (!Array.isArray(messages)) return null;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === MESSAGE_ROLES.USER) {
      return messages[i];
    }
  }
  return null;
};

const formatMessageForAPI = (message) => {
  if (!message) return null;

  return {
    role: message.role,
    content: message.content,
  };
};

const isValidMessage = (message) => {
  return message && message.role && (message.content || message.content === '');
};

export const buildChatPayload = (
  messages,
  systemPrompt,
  inputs,
  parameterEnabled,
) => {
  const processedMessages = messages
    .filter(isValidMessage)
    .map(formatMessageForAPI)
    .filter(Boolean);

  if (systemPrompt && systemPrompt.trim()) {
    processedMessages.unshift({
      role: MESSAGE_ROLES.SYSTEM,
      content: systemPrompt.trim(),
    });
  }

  const payload = {
    model: inputs.model,
    group: inputs.group,
    messages: processedMessages,
    stream: inputs.stream,
  };

  const parameterMappings = {
    temperature: 'temperature',
    top_p: 'top_p',
    max_tokens: 'max_tokens',
    frequency_penalty: 'frequency_penalty',
    presence_penalty: 'presence_penalty',
    seed: 'seed',
  };

  Object.entries(parameterMappings).forEach(([key, param]) => {
    const enabled = parameterEnabled[key];
    const value = inputs[param];
    const hasValue = value !== undefined && value !== null;

    if (!enabled) {
      return;
    }

    if (param === 'max_tokens') {
      if (typeof value === 'number') {
        payload[param] = value;
      }
      return;
    }

    if (hasValue) {
      payload[param] = value;
    }
  });

  return payload;
};

export const buildApiPayload = buildChatPayload;

export const buildImagePayload = (messages, inputs) => {
  const lastUserMessage = getLastUserMessage(messages);
  const prompt = getTextContent(lastUserMessage).trim();
  const imageParameters = inputs.imageParameters;
  const size = sanitizeImageSize(
    inputs.model,
    inputs.prompt_size,
    imageParameters,
  );
  const quality = sanitizeImageQuality(
    inputs.model,
    inputs.prompt_quality,
    imageParameters,
  );
  const responseFormat = sanitizeImageResponseFormat(
    inputs.model,
    inputs.prompt_response_format,
    imageParameters,
  );

  const payload = {
    model: inputs.model,
    group: inputs.group,
    prompt,
    n: sanitizeImageCount(inputs.prompt_n, imageParameters?.n_max),
  };

  if (size) {
    payload.size = size;
  }
  if (quality) {
    payload.quality = quality;
  }

  if (responseFormat) {
    payload.response_format = responseFormat;
  }

  return payload;
};

export const buildPayloadByEndpoint = (
  endpointType,
  messages,
  systemPrompt,
  inputs,
  parameterEnabled,
) => {
  if (isImageGenerationEndpoint(endpointType)) {
    return buildImagePayload(messages, inputs);
  }

  return buildChatPayload(messages, systemPrompt, inputs, parameterEnabled);
};

export const buildImageResponseContent = (responseData) => {
  const imageData = Array.isArray(responseData?.data) ? responseData.data : [];
  const textItems = imageData
    .filter((item) => item?.revised_prompt)
    .map((item) => ({
      type: 'text',
      text: item.revised_prompt,
    }));
  const imageItems = imageData
    .map((item) => {
      const imageUrl =
        item?.url ||
        (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : '');

      if (!imageUrl) {
        return null;
      }

      return {
        type: 'image_url',
        image_url: { url: imageUrl },
      };
    })
    .filter(Boolean);

  return [...textItems, ...imageItems];
};

export const processModelsData = (data, currentModel) => {
  const modelOptions = (Array.isArray(data) ? data : [])
    .map((model) => {
      if (typeof model === 'string') {
        return {
          label: model,
          value: model,
          endpointTypes: [ENDPOINT_TYPES.OPENAI],
        };
      }

      const name = model?.name || model?.model_name || model?.id || '';
      const endpointTypes =
        Array.isArray(model?.endpoint_types) && model.endpoint_types.length > 0
          ? model.endpoint_types
          : [ENDPOINT_TYPES.OPENAI];
      const imageParameters =
        model?.image_parameters && typeof model.image_parameters === 'object'
          ? model.image_parameters
          : undefined;

      return {
        label: name,
        value: name,
        endpointTypes,
        imageGenerationMode: model?.image_generation_mode,
        imageParameters,
      };
    })
    .filter((model) => model.value);

  const hasCurrentModel = modelOptions.some(
    (option) => option.value === currentModel,
  );
  const selectedModel =
    hasCurrentModel && modelOptions.length > 0
      ? currentModel
      : modelOptions[0]?.value;

  return { modelOptions, selectedModel };
};

const findModelOption = (models, modelName) =>
  (models || []).find((model) => model.value === modelName);

export const getEndpointTypeForModel = (models, modelName) => {
  const modelOption = findModelOption(models, modelName);
  const endpointTypes = modelOption?.endpointTypes || [];

  if (endpointTypes.includes(ENDPOINT_TYPES.IMAGE_GENERATION)) {
    return ENDPOINT_TYPES.IMAGE_GENERATION;
  }

  return ENDPOINT_TYPES.OPENAI;
};

export const getEndpointTypeFromCustomBody = (
  customRequestBody,
  models,
  fallbackModel,
) => {
  if (customRequestBody && customRequestBody.trim()) {
    try {
      const customPayload = JSON.parse(customRequestBody);
      if (
        customPayload?.model &&
        findModelOption(models, customPayload.model)
      ) {
        return getEndpointTypeForModel(models, customPayload.model);
      }
    } catch (_) {
      // Fall back to the selected model when custom JSON is incomplete.
    }
  }

  return getEndpointTypeForModel(models, fallbackModel);
};
