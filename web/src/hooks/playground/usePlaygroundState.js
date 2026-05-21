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

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_MESSAGES,
  getDefaultMessages,
  DEFAULT_CONFIG,
  DEBUG_TABS,
  IMAGE_REQUEST_MODES,
  MESSAGE_STATUS,
} from '../../constants/playground.constants';
import {
  loadConfig,
  saveConfig,
  loadMessages,
  saveMessages,
  sanitizePlaygroundConfig,
  sanitizePlaygroundInputsForStorage,
} from '../../components/playground/configStorage';
import { processIncompleteThinkTags } from '../../helpers';
import {
  getEndpointTypeForModel,
  getEndpointTypeFromCustomBody,
} from '../../helpers';
import { normalizeImageRequestMode } from './imageEditGuards';

const findModelOption = (models, modelName) =>
  (models || []).find((model) => model.value === modelName);

export const usePlaygroundState = () => {
  const { t } = useTranslation();

  // 使用惰性初始化，确保只在组件首次挂载时加载配置和消息
  const [savedConfig] = useState(() => loadConfig());
  const [initialMessages] = useState(() => {
    const loaded = loadMessages();
    // 检查是否是旧的中文默认消息，如果是则清除
    if (
      loaded &&
      loaded.length === 2 &&
      loaded[0].id === '2' &&
      loaded[1].id === '3'
    ) {
      const hasOldChinese =
        loaded[0].content === '你好' ||
        loaded[1].content === '你好，请问有什么可以帮助您的吗？' ||
        loaded[1].content === '你好！很高兴见到你。有什么我可以帮助你的吗？';

      if (hasOldChinese) {
        // 清除旧的默认消息
        localStorage.removeItem('playground_messages');
        return null;
      }
    }
    return loaded;
  });

  // 基础配置状态
  const [inputs, setInputs] = useState(() => ({
    ...DEFAULT_CONFIG.inputs,
    ...(savedConfig.inputs || {}),
    image_reference_files: [],
  }));
  const [parameterEnabled, setParameterEnabled] = useState(
    savedConfig.parameterEnabled || DEFAULT_CONFIG.parameterEnabled,
  );
  const [showDebugPanel, setShowDebugPanel] = useState(
    savedConfig.showDebugPanel || DEFAULT_CONFIG.showDebugPanel,
  );
  const [customRequestMode, setCustomRequestMode] = useState(
    savedConfig.customRequestMode || DEFAULT_CONFIG.customRequestMode,
  );
  const [customRequestBody, setCustomRequestBody] = useState(
    savedConfig.customRequestBody || DEFAULT_CONFIG.customRequestBody,
  );

  // UI状态
  const [showSettings, setShowSettings] = useState(false);
  const [models, setModels] = useState([]);
  const [groups, setGroups] = useState([]);
  const [status, setStatus] = useState({});

  // 消息相关状态 - 使用加载的消息或默认消息初始化
  const [message, setMessage] = useState(
    () => initialMessages || getDefaultMessages(t),
  );

  const selectedEndpointType = useMemo(
    () => getEndpointTypeForModel(models, inputs.model),
    [models, inputs.model],
  );

  const endpointType = useMemo(() => {
    if (!customRequestMode) {
      return selectedEndpointType;
    }

    return getEndpointTypeFromCustomBody(
      customRequestBody,
      models,
      inputs.model,
    );
  }, [
    customRequestMode,
    customRequestBody,
    models,
    inputs.model,
    selectedEndpointType,
  ]);

  const selectedModelOption = useMemo(
    () => findModelOption(models, inputs.model),
    [models, inputs.model],
  );
  const imageParameters = selectedModelOption?.imageParameters;
  const imageGenerationMode = selectedModelOption?.imageGenerationMode || '';
  const imageRequestMode = useMemo(() => {
    const supportsEdits = selectedModelOption?.imageParameters?.supports_edits;
    const persisted =
      inputs.image_request_mode || IMAGE_REQUEST_MODES.GENERATION;
    return normalizeImageRequestMode({
      imageRequestMode: persisted,
      supportsEdits,
    });
  }, [selectedModelOption, inputs.image_request_mode]);
  const inputsWithImageParameters = useMemo(
    () => ({
      ...inputs,
      imageParameters,
      imageGenerationMode,
      imageRequestMode,
    }),
    [inputs, imageParameters, imageGenerationMode, imageRequestMode],
  );

  useEffect(() => {
    if (
      imageRequestMode === IMAGE_REQUEST_MODES.GENERATION &&
      (inputs.image_reference_files || []).length > 0
    ) {
      setInputs((prev) => ({ ...prev, image_reference_files: [] }));
    }
  }, [imageRequestMode, inputs.image_reference_files]);

  // 当语言改变时，如果是默认消息则更新
  useEffect(() => {
    // 只在没有保存的消息时才更新默认消息
    if (!initialMessages) {
      setMessage(getDefaultMessages(t));
    }
  }, [t, initialMessages]); // 当语言改变时

  // 调试状态
  const [debugData, setDebugData] = useState({
    request: null,
    response: null,
    timestamp: null,
    previewRequest: null,
    previewTimestamp: null,
  });
  const [activeDebugTab, setActiveDebugTab] = useState(DEBUG_TABS.PREVIEW);
  const [previewPayload, setPreviewPayload] = useState(null);

  // 编辑状态
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Refs
  const sseSourceRef = useRef(null);
  const chatRef = useRef(null);
  const saveConfigTimeoutRef = useRef(null);
  const saveMessagesTimeoutRef = useRef(null);

  // 配置更新函数
  const handleInputChange = useCallback((name, value) => {
    setInputs((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleParameterToggle = useCallback((paramName) => {
    setParameterEnabled((prev) => ({
      ...prev,
      [paramName]: !prev[paramName],
    }));
  }, []);

  // 消息保存函数 - 改为立即保存，可以接受参数
  const saveMessagesImmediately = useCallback(
    (messagesToSave) => {
      // 如果提供了参数，使用参数；否则使用当前状态
      saveMessages(messagesToSave || message);
    },
    [message],
  );

  // 配置保存
  const debouncedSaveConfig = useCallback(() => {
    if (saveConfigTimeoutRef.current) {
      clearTimeout(saveConfigTimeoutRef.current);
    }

    saveConfigTimeoutRef.current = setTimeout(() => {
      const configToSave = {
        inputs: sanitizePlaygroundInputsForStorage(inputs),
        parameterEnabled,
        showDebugPanel,
        customRequestMode,
        customRequestBody,
      };
      saveConfig(configToSave);
    }, 1000);
  }, [
    inputs,
    parameterEnabled,
    showDebugPanel,
    customRequestMode,
    customRequestBody,
    endpointType,
    selectedEndpointType,
  ]);

  // 配置导入/重置
  const handleConfigImport = useCallback((importedConfig) => {
    const sanitizedConfig = sanitizePlaygroundConfig(importedConfig);
    if (sanitizedConfig.inputs) {
      const parsedMaxTokens = parseInt(sanitizedConfig.inputs.max_tokens, 10);
      setInputs((prev) => ({
        ...prev,
        ...sanitizedConfig.inputs,
        image_reference_files: [],
        max_tokens: Number.isNaN(parsedMaxTokens)
          ? sanitizedConfig.inputs.max_tokens
          : parsedMaxTokens,
      }));
    }
    if (sanitizedConfig.parameterEnabled) {
      setParameterEnabled((prev) => ({
        ...prev,
        ...sanitizedConfig.parameterEnabled,
      }));
    }
    if (typeof sanitizedConfig.showDebugPanel === 'boolean') {
      setShowDebugPanel(sanitizedConfig.showDebugPanel);
    }
    if (typeof sanitizedConfig.customRequestMode === 'boolean') {
      setCustomRequestMode(sanitizedConfig.customRequestMode);
    }
    if (typeof sanitizedConfig.customRequestBody === 'string') {
      setCustomRequestBody(sanitizedConfig.customRequestBody);
    }
    // 如果导入的配置包含消息，也恢复消息
    if (sanitizedConfig.messages && Array.isArray(sanitizedConfig.messages)) {
      setMessage(sanitizedConfig.messages);
    }
  }, []);

  const handleConfigReset = useCallback((options = {}) => {
    const { resetMessages = false } = options;

    setInputs({
      ...DEFAULT_CONFIG.inputs,
      image_reference_files: [],
    });
    setParameterEnabled(DEFAULT_CONFIG.parameterEnabled);
    setShowDebugPanel(DEFAULT_CONFIG.showDebugPanel);
    setCustomRequestMode(DEFAULT_CONFIG.customRequestMode);
    setCustomRequestBody(DEFAULT_CONFIG.customRequestBody);

    // 只有在明确指定时才重置消息
    if (resetMessages) {
      setMessage([]);
      setTimeout(() => {
        setMessage(getDefaultMessages(t));
      }, 0);
    }
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveConfigTimeoutRef.current) {
        clearTimeout(saveConfigTimeoutRef.current);
      }
    };
  }, []);

  // 页面首次加载时，若最后一条消息仍处于 LOADING/INCOMPLETE 状态，自动修复
  useEffect(() => {
    if (!Array.isArray(message) || message.length === 0) return;

    const lastMsg = message[message.length - 1];
    if (
      lastMsg.status === MESSAGE_STATUS.LOADING ||
      lastMsg.status === MESSAGE_STATUS.INCOMPLETE
    ) {
      const processed = processIncompleteThinkTags(
        lastMsg.content || '',
        lastMsg.reasoningContent || '',
      );

      const fixedLastMsg = {
        ...lastMsg,
        status: MESSAGE_STATUS.COMPLETE,
        content: processed.content,
        reasoningContent: processed.reasoningContent || null,
        isThinkingComplete: true,
      };

      const updatedMessages = [...message.slice(0, -1), fixedLastMsg];
      setMessage(updatedMessages);

      // 保存修复后的消息列表
      setTimeout(() => saveMessagesImmediately(updatedMessages), 0);
    }
  }, []);

  return {
    // 配置状态
    inputs: inputsWithImageParameters,
    parameterEnabled,
    showDebugPanel,
    customRequestMode,
    customRequestBody,
    endpointType,
    selectedEndpointType,
    imageRequestMode,

    // UI状态
    showSettings,
    models,
    groups,
    status,

    // 消息状态
    message,

    // 调试状态
    debugData,
    activeDebugTab,
    previewPayload,

    // 编辑状态
    editingMessageId,
    editValue,

    // Refs
    sseSourceRef,
    chatRef,
    saveConfigTimeoutRef,

    // 更新函数
    setInputs,
    setParameterEnabled,
    setShowDebugPanel,
    setCustomRequestMode,
    setCustomRequestBody,
    setShowSettings,
    setModels,
    setGroups,
    setStatus,
    setMessage,
    setDebugData,
    setActiveDebugTab,
    setPreviewPayload,
    setEditingMessageId,
    setEditValue,

    // 处理函数
    handleInputChange,
    handleParameterToggle,
    debouncedSaveConfig,
    saveMessagesImmediately,
    handleConfigImport,
    handleConfigReset,
  };
};
