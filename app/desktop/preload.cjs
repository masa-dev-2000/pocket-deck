const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('deckDesktop',{
 status:()=>ipcRenderer.invoke('deck:status'),retry:()=>ipcRenderer.invoke('deck:retry'),
 release:()=>ipcRenderer.invoke('deck:release'),hide:()=>ipcRenderer.invoke('deck:hide'),quit:()=>ipcRenderer.invoke('deck:quit'),
 chromeStatus:()=>ipcRenderer.invoke('deck:chrome-status'),chromePrepare:()=>ipcRenderer.invoke('deck:chrome-prepare'),chromeFolder:()=>ipcRenderer.invoke('deck:chrome-folder'),chromeCopy:what=>ipcRenderer.invoke('deck:chrome-copy',what),
 updateCheck:()=>ipcRenderer.invoke('deck:update-check'),
 networkStatus:()=>ipcRenderer.invoke('deck:network-status'),networkSelect:network=>ipcRenderer.invoke('deck:network-select',network),firewall:(operation,network)=>ipcRenderer.invoke('deck:firewall',operation,network),
 inputEnable:()=>ipcRenderer.invoke('deck:input-enable'),
 onUpdateState:callback=>{ipcRenderer.on('deck:update-state',(_event,state)=>callback(state));},
 onRefresh:callback=>{ipcRenderer.on('deck:refresh',()=>callback());}
});
