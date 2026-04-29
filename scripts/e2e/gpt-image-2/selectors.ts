export const selectors = {
  settingsPanel: '.model-settings-scroll',
  semiSelectSelection: '.semi-select-selection',
  semiSelectOption: '.semi-select-option',
  semiRadio: '.semi-radio',
  toast: '.semi-toast',
  chatTextarea: 'textarea[placeholder*="提示词"], textarea[placeholder*="问题"]',
  sendButton:
    'button[title], .semi-chat-inputBox-sendButton, .semi-chat-send-button',
  fileInput: 'input[type="file"][accept="image/png,image/jpeg,image/webp"]',
  assistantImage: '.semi-chat-chatBox-content img, img[src^="data:image"], img[src^="http://127.0.0.1:11434/static"]',
};
