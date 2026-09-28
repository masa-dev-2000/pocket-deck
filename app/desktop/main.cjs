const {app,BrowserWindow,Menu,Tray,nativeImage,ipcMain,dialog}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {Backend,request,BASE}=require('./backend.cjs');
const {ChromeSetup}=require('./chrome-setup.cjs');
const {shell,clipboard}=require('electron');
app.setName('Pocket Deck');app.setPath('userData',path.join(app.getPath('appData'),'Pocket Deck'));app.setAppUserModelId('local.pocket-deck.desktop');
const single=app.requestSingleInstanceLock();
let win,tray,backend,quitting=false,ready=false,lastError='',healthTimer;
const home=pathToFileURL(path.join(__dirname,'index.html')).href;
const trusted=url=>url===home||url==='about:blank'||[BASE+'/',BASE+'/editor',BASE+'/connect'].includes(url);
function show(){if(win){win.show();win.restore();win.focus();}}
async function status(){
 try{const config=await request('/api/config');if(config.version!==4||!Array.isArray(config.layouts))throw new Error('接続先を確認してください');const connection=await request('/api/connect');ready=true;lastError='';return {ready:true,url:connection.url,layouts:config.layouts.length,buttons:config.layouts.reduce((n,l)=>n+l.buttons.length,0),owned:!!backend?.child};}
 catch(e){ready=false;return {ready:false,error:lastError||'PCとの接続が切れています。「再接続」を押してください。'};}
}
async function start(){try{await backend.ensure();lastError='';}catch(e){lastError=e.message;}return status();}
async function quit(){if(quitting)return;quitting=true;clearInterval(healthTimer);await backend?.stop();app.quit();}
if(!single)app.quit();else{
 app.on('second-instance',show);
 app.on('before-quit',e=>{if(!quitting){e.preventDefault();void quit();}});
 app.on('window-all-closed',()=>{});
 app.whenReady().then(async()=>{
  const settings={executable:path.join(app.isPackaged?process.resourcesPath:path.join(__dirname,'backend-build'),'backend','PocketDeckServer.exe'),dataDir:path.join(app.getPath('userData'),'data')};
  if(!app.isPackaged)settings.executable=path.join(__dirname,'backend-build','PocketDeckServer','PocketDeckServer.exe');
  backend=new Backend(settings);
  const chromeSetup=new ChromeSetup({userDir:app.getPath('userData'),extensionSource:app.isPackaged?path.join(process.resourcesPath,'backend','chrome-extension'):path.join(__dirname,'..','chrome-extension'),launcher:path.join(path.dirname(settings.executable),'PocketDeckChromeHost.exe'),legacyManifest:path.resolve(__dirname,'..','chrome-native-host.json')});
  win=new BrowserWindow({width:1120,height:800,minWidth:760,minHeight:540,title:'Pocket Deck',backgroundColor:'#101923',icon:path.join(__dirname,'icon.png'),show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(url!==home)event.preventDefault();});
  win.webContents.on('will-frame-navigate',event=>{if(!trusted(event.url))event.preventDefault();});
  win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  win.on('close',event=>{if(!quitting){event.preventDefault();win.hide();}});
  win.once('ready-to-show',()=>{show();});
  ipcMain.handle('deck:status',event=>{checkSender(event);return status();});
  ipcMain.handle('deck:retry',event=>{checkSender(event);return start();});
  ipcMain.handle('deck:release',async event=>{checkSender(event);await request('/api/action',{action:'release_all'});return true;});
  ipcMain.handle('deck:hide',event=>{checkSender(event);win.hide();});
  ipcMain.handle('deck:quit',event=>{checkSender(event);void quit();});
  ipcMain.handle('deck:chrome-status',async event=>{checkSender(event);const setup=await chromeSetup.status();try{return {...setup,profiles:await request('/api/profiles')};}catch{return {...setup,profiles:[],serverOffline:true};}});
  ipcMain.handle('deck:chrome-prepare',event=>{checkSender(event);return chromeSetup.prepare();});
  ipcMain.handle('deck:chrome-folder',async event=>{checkSender(event);if(!(await chromeSetup.status()).prepared)throw Error('先に「連携を準備」を押してください。');const error=await shell.openPath(chromeSetup.folder);if(error)throw Error(error);});
  ipcMain.handle('deck:chrome-copy',async(event,what)=>{checkSender(event);if(what==='url')clipboard.writeText('chrome://extensions');else if(what==='folder'){if(!(await chromeSetup.status()).prepared)throw Error('先に「連携を準備」を押してください。');clipboard.writeText(chromeSetup.folder);}else throw Error('コピー対象が不正です');});
  function checkSender(event){if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url!==home)throw new Error('操作元が不正です');}
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Pocket Deck',submenu:[{label:'表示',click:show},{label:'全キー解除',click:()=>request('/api/action',{action:'release_all'}).catch(()=>{})},{type:'separator'},{label:'終了',click:quit}]},{label:'表示',submenu:[{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'}]}]));
  tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'icon.png')));tray.setToolTip('Pocket Deck');tray.setContextMenu(Menu.buildFromTemplate([{label:'Pocket Deckを開く',click:show},{label:'終了',click:quit}]));tray.on('double-click',show);
  await win.loadFile('index.html');await start();
  healthTimer=setInterval(()=>{if(!win.isDestroyed())win.webContents.send('deck:refresh');},4000);
 }).catch(e=>{dialog.showErrorBox('Pocket Deck',e.message);void quit();});
}
