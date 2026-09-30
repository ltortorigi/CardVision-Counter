const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('overlayAPI',{onData:fn=>ipcRenderer.on('overlay-data',(_e,data)=>fn(data))});
