const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('deckDesktop',{
 status:()=>ipcRenderer.invoke('deck:status'),retry:()=>ipcRenderer.invoke('deck:retry'),
 release:()=>ipcRenderer.invoke('deck:release'),hide:()=>ipcRenderer.invoke('deck:hide'),quit:()=>ipcRenderer.invoke('deck:quit'),
 chromeStatus:()=>ipcRenderer.invoke('deck:chrome-status'),chromePrepare:()=>ipcRenderer.invoke('deck:chrome-prepare'),chromeFolder:()=>ipcRenderer.invoke('deck:chrome-folder'),chromeCopy:what=>ipcRenderer.invoke('deck:chrome-copy',what),
 onRefresh:callback=>{ipcRenderer.on('deck:refresh',()=>callback());}
});
