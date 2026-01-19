const { contextBridge, ipcRenderer } = require('electron');

const readOverrides = () => {
  try {
    const overrides = ipcRenderer.sendSync('read-prompt-overrides-sync');
    if (overrides && typeof overrides === 'object') {
      return overrides;
    }
  } catch (error) {
    console.error('Unable to read prompt overrides synchronously:', error);
  }
  return {};
};

const promptOverrides = readOverrides();

contextBridge.exposeInMainWorld('customPromptOverrides', promptOverrides);

contextBridge.exposeInMainWorld('electronAPI', {
  savePrompt: (topic, content) => ipcRenderer.invoke('save-prompt', topic, content),
  loadPromptBackups: (topic) => ipcRenderer.invoke('load-prompt-backups', topic),
  refreshPromptOverrides: () => ipcRenderer.invoke('read-prompt-overrides'),
  zoomIn: () => ipcRenderer.invoke('zoom-in'),
  zoomOut: () => ipcRenderer.invoke('zoom-out'),
  // Secure API Key Storage
  hasApiKey: () => ipcRenderer.invoke('has-api-key'),
  setApiKey: (apiKey) => ipcRenderer.invoke('set-api-key', apiKey),
  clearApiKey: () => ipcRenderer.invoke('clear-api-key'),
  // Gemini API via main process
  generateFlashcards: (payload) => ipcRenderer.invoke('generate-cards', payload),
  amendFlashcard: (payload) => ipcRenderer.invoke('amend-card', payload),
});
