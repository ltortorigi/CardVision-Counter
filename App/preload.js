const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cardvision', {
  getSources: () => ipcRenderer.invoke('desktop-sources'),
  warmOcr: () => ipcRenderer.invoke('warm-ocr'),
  ocrRanks: (items) => ipcRenderer.invoke('ocr-ranks', items)
});
