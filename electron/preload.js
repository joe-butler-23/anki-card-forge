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
  zoomOut: () => ipcRenderer.invoke('zoom-out')
});
