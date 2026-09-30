const {app,BrowserWindow,Menu,Tray,nativeImage,ipcMain,dialog}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {Backend,request,BASE}=require('./backend.cjs');
const {runtimePaths}=require('./runtime-paths.cjs');
const {ChromeSetup}=require('./chrome-setup.cjs');
const {shell,clipboard}=require('electron');
app.setName('Pocket Deck');app.setPath('userData',path.join(app.getPath('appData'),'Pocket Deck'));if(process.platform==='win32')app.setAppUserModelId('local.pocket-deck.desktop');
const single=app.requestSingleInstanceLock();
let win,tray,backend,updates,quitting=false,ready=false,lastError='',healthTimer,updateTimer;
const home=pathToFileURL(path.join(__dirname,'index.html')).href;
const trusted=url=>url===home||url==='about:blank'||[BASE+'/',BASE+'/editor',BASE+'/connect'].includes(url);
function show(){if(win){win.show();win.restore();win.focus();}}
async function status(){
 const version=app.getVersion();
 try{const config=await request('/api/config');if(config.version!==5||!Array.isArray(config.layouts))throw new Error('接続先を確認してください');const connection=await request('/api/connect');const input=await request('/api/input-status').catch(()=>({state:'unknown',reason:'入力機能の状態を取得できません。'}));ready=true;lastError='';return {ready:true,version,url:connection.url,input,layouts:config.layouts.length,buttons:config.layouts.reduce((n,l)=>n+l.buttons.length,0),owned:!!backend?.child};}
 catch(e){ready=false;return {ready:false,version,error:lastError||'PCとの接続が切れています。「再接続」を押してください。'};}
}
async function start(){try{await backend.ensure();lastError='';}catch(e){lastError=e.message;}return status();}
async function quit(){if(quitting)return;quitting=true;clearTimeout(updateTimer);updates?.dispose();clearInterval(healthTimer);await backend?.stop();app.quit();}
if(!single)app.quit();else{
 app.on('second-instance',show);
 app.on('activate',show);
 app.on('before-quit',e=>{if(!quitting){e.preventDefault();void quit();}});
 app.on('window-all-closed',()=>{});
 app.whenReady().then(async()=>{
  require('./sandbox-policy.cjs').assertSandbox({platform:process.platform,packaged:app.isPackaged,noSandbox:app.commandLine.hasSwitch('no-sandbox')});
  if(process.platform==='linux')require('./linux-install-state.cjs').recordLinuxInstall({directory:process.env.POCKET_DECK_NPM_INSTALL_DIR,currentImage:process.env.APPIMAGE,version:app.getVersion()});
  const runtime=runtimePaths({packaged:app.isPackaged,resourcesPath:process.resourcesPath,sourceDirectory:__dirname});
  const settings={executable:runtime.executable,dataDir:path.join(app.getPath('userData'),'data')};
  backend=new Backend(settings,{clipboardWrite:async text=>clipboard.writeText(text)});
  const chromeSetup=new ChromeSetup({userDir:app.getPath('userData'),extensionSource:app.isPackaged?path.join(process.resourcesPath,'backend','chrome-extension'):path.join(__dirname,'..','chrome-extension'),launcher:runtime.launcher,legacyManifest:path.resolve(__dirname,'..','chrome-native-host.json')});
  // Wayland can omit ready-to-show for an initially hidden window (Electron #48859).
  // Linux displays the matching background immediately; Windows keeps first-paint startup.
  win=new BrowserWindow({width:1120,height:800,minWidth:760,minHeight:540,title:'Pocket Deck',backgroundColor:'#101923',icon:path.join(__dirname,'icon.png'),show:process.platform==='linux',webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(url!==home)event.preventDefault();});
  win.webContents.on('will-frame-navigate',event=>{if(!trusted(event.url))event.preventDefault();});
  win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  win.on('close',event=>{if(!quitting){event.preventDefault();win.hide();}});
  if(process.platform!=='linux')win.once('ready-to-show',()=>{show();});
  const {Updates}=require('./updates.cjs');
  const debUpdate=process.platform==='linux'&&app.isPackaged&&!process.env.APPIMAGE;
  updates=new Updates({updater:require('electron-updater').autoUpdater,currentVersion:app.getVersion(),packaged:app.isPackaged,
   manualOnlyReason:process.platform==='darwin'?'macOS試験版は手動更新です。Appleの配布署名・公証と更新試験が完了するまでは自動更新しません。新しいDMGを取得してアプリを終了し、Applications内のアプリを置き換えてください。登録データは別の場所に保存されます。':'',
   ask:async message=>{show();return (await dialog.showMessageBox(win,{type:'question',title:'Pocket Deckの更新',message,buttons:['更新する','後で'],defaultId:1,cancelId:1})).response===0;},
   inform:message=>dialog.showMessageBox(win,{type:'info',title:'Pocket Deckの更新',message}),
   prepare:async()=>{await request('/api/action',{action:'release_all'}).catch(()=>{});await backend.stop();if(!debUpdate)quitting=true;clearTimeout(updateTimer);clearInterval(healthTimer);},
   ...(debUpdate?{
    apply:options=>require('./linux-deb-update.cjs').apply({...options,relaunch:async()=>{if(updates.closed)return;quitting=true;app.relaunch();app.quit();}}),
    recover:async()=>{quitting=false;await start();healthTimer=setInterval(()=>{if(!win.isDestroyed())win.webContents.send('deck:refresh');},4000);if(!win.isDestroyed())win.webContents.send('deck:refresh');}
   }:{}),
   publish:state=>{if(!win.isDestroyed()){win.webContents.send('deck:update-state',state);win.setProgressBar(state.phase==='downloading'?state.percent/100:-1);}},
   log:message=>{try{fs.appendFileSync(path.join(app.getPath('userData'),'updates.log'),`${new Date().toISOString()} ${message}\n`);}catch{}}
  });
  ipcMain.handle('deck:update-check',event=>{checkSender(event);void updates.check(true);return true;});
  ipcMain.handle('deck:network-status',event=>{checkSender(event);return request('/api/network-status');});
  ipcMain.handle('deck:network-select',(event,network)=>{checkSender(event);return request('/api/connect-network',network);});
  ipcMain.handle('deck:firewall',async(event,operation,network)=>{checkSender(event);if(process.platform!=='linux')throw Error('Ubuntuの接続診断です。');const status=await request('/api/network-status');if(!status.canConfigure)throw Error('deb版とUFW、OSの管理者認証を確認してください。');return require('./linux-firewall.cjs').configure(operation,network);});
  ipcMain.handle('deck:input-enable',async event=>{checkSender(event);const result=await request('/api/input-enable',{});if(process.platform==='darwin'&&result.state!=='ready')await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');return result;});
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
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Pocket Deck',submenu:[{label:'表示',click:show},{label:'更新を確認',click:()=>updates.check(true)},{label:'全キー解除',click:()=>request('/api/action',{action:'release_all'}).catch(()=>{})},{type:'separator'},{label:'終了',click:quit}]},{label:'表示',submenu:[{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'}]}]));
  if(process.platform==='darwin')Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Pocket Deck',submenu:[{role:'about'},{label:'表示',click:show},{label:'更新を確認',click:()=>updates.check(true)},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{label:'終了',accelerator:'Command+Q',click:quit}]},{role:'editMenu'},{role:'viewMenu'}]));
  const trayIcon=nativeImage.createFromPath(path.join(__dirname,'icon.png'));const menuIcon=process.platform==='darwin'?trayIcon.resize({width:18,height:18}):trayIcon;if(process.platform==='darwin')menuIcon.setTemplateImage(true);
  tray=new Tray(menuIcon);tray.setToolTip('Pocket Deck');tray.setContextMenu(Menu.buildFromTemplate([{label:'Pocket Deckを開く',click:show},{label:'終了',click:quit}]));tray.on('double-click',show);
  await win.loadFile('index.html');await start();
  healthTimer=setInterval(()=>{if(!win.isDestroyed())win.webContents.send('deck:refresh');},4000);
  updateTimer=setTimeout(()=>updates.check(false),5000);
 }).catch(e=>{dialog.showErrorBox('Pocket Deck',e.message);void quit();});
}
