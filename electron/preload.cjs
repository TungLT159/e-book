const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('edgeTts', {
  synthesize: (text, options = {}) => ipcRenderer.invoke('edge-tts:synthesize', { text, ...options }),
  getVoices: () => ipcRenderer.invoke('edge-tts:get-voices'),
});
