const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('edgeTts', {
  synthesize: (text, options = {}) => ipcRenderer.invoke('edge-tts:synthesize', { text, ...options }),
  getVoices: () => ipcRenderer.invoke('edge-tts:get-voices'),
});

contextBridge.exposeInMainWorld('audioCache', {
  getOrCreateEdgeTtsAudioCacheFile: (payload) =>
    ipcRenderer.invoke('audio-cache:get-or-create-edge-tts-audio-cache-file', payload),
  prepareEdgeTtsAudioCacheFile: (payload) =>
    ipcRenderer.invoke('audio-cache:prepare-edge-tts-audio-cache-file', payload),
});

contextBridge.exposeInMainWorld('readingProgress', {
  getAll: () => ipcRenderer.invoke('reading-progress:get-all'),
  save: (payload) => ipcRenderer.invoke('reading-progress:save', payload),
  delete: (bookId) => ipcRenderer.invoke('reading-progress:delete', bookId),
});

contextBridge.exposeInMainWorld('debugTools', {
  writeExtractedText: (payload) => ipcRenderer.invoke('debug:write-extracted-text', payload),
  readExtractedTextPage: (filePath, pageNumber) =>
    ipcRenderer.invoke('debug:read-extracted-text-page', { filePath, pageNumber }),
  emptyExtractedTextFile: (filePath) => ipcRenderer.invoke('debug:empty-extracted-text-file', { filePath }),
});
