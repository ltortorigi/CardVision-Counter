const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('cardvision',{
 getSources:()=>ipcRenderer.invoke('desktop-sources'),warmOcr:()=>ipcRenderer.invoke('warm-ocr'),ocrRanks:items=>ipcRenderer.invoke('ocr-ranks',items),
 toggleOverlay:()=>ipcRenderer.invoke('toggle-overlay'),overlayData:data=>ipcRenderer.send('overlay-data',data),
 exportSession:data=>ipcRenderer.invoke('export-session',data),diagnostics:()=>ipcRenderer.invoke('diagnostics'),
 checkUpdates:()=>ipcRenderer.invoke('check-updates'),openProject:section=>ipcRenderer.invoke('open-project',section)
});
