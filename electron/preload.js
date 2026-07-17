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
  checkCodex: () => ipcRenderer.invoke('check-codex'),
  generateFlashcards: (payload) => ipcRenderer.invoke('generate-cards', payload),
  amendFlashcard: (payload) => ipcRenderer.invoke('amend-card', payload),
  onCardPacket: (callback) => {
    const listener = (_event, packet) => callback(packet);
    ipcRenderer.on('card-packet-received', listener);
    return () => ipcRenderer.removeListener('card-packet-received', listener);
  },
  setCardPacketReady: (ready) => ipcRenderer.invoke('card-packet-ready', ready),
  markCardPacketVisible: (packetId) => ipcRenderer.invoke('card-packet-visible', packetId),
  updateCardPacket: (packetId, update) => ipcRenderer.invoke('card-packet-update', packetId, update),
});
