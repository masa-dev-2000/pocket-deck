'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const {compare}=require('./windows-install.cjs');
function locations(env=process.env,home=os.homedir()){
 const data=env.XDG_DATA_HOME||path.join(home,'.local','share');
 const directory=path.join(data,'pocket-deck');
 return {directory,state:path.join(directory,'installation.json'),wrapper:path.join(directory,'pocket-deck'),desktop:path.join(data,'applications','pocket-deck.desktop')};
}
async function processActive(identity){
 if(identity&&Number.isInteger(identity.pid)&&identity.pid>0&&/^\d+$/.test(identity.startTime)&&typeof identity.bootId==='string'){
  try{
   const bootId=(await fs.readFile('/proc/sys/kernel/random/boot_id','utf8')).trim();
   const stat=await fs.readFile('/proc/'+identity.pid+'/stat','utf8');
   const fields=stat.slice(stat.lastIndexOf(')')+2).split(/\s+/);
   if(bootId===identity.bootId&&fields[19]===identity.startTime&&!['Z','X'].includes(fields[0]))return true;
  }catch(error){if(error.code!=='ENOENT'&&error.code!=='ESRCH')throw Error('Pocket Deckの起動状態を確認できません。'+error.message);}
 }
 return false;
}
async function running(directory,state={}){
 if(await processActive(state.process))return true;
 for(const id of await fs.readdir('/proc')){
  if(!/^\d+$/.test(id))continue;
  try{
   const entry='/proc/'+id;
   if((await fs.stat(entry)).uid!==process.getuid())continue;
   const executable=(await fs.readlink(entry+'/exe')).replace(/ \(deleted\)$/,'');
   // Also protect a same-user application started manually from another image.
   // Chromium may erase the original argv/environment when setting its title.
   if(path.basename(executable)==='pocket-deck-desktop'&&!(await fs.readFile(entry+'/cmdline','utf8')).includes('--type='))return true;
   const environment=(await fs.readFile(entry+'/environ','utf8')).split('\0');
   if(environment.includes('POCKET_DECK_NPM_INSTALL_DIR='+directory)||environment.some(value=>value.startsWith('APPIMAGE='+directory+path.sep)))return true;
  }catch{}
 }
 return false;
}
async function inspect(paths){
 let state={};try{state=JSON.parse(await fs.readFile(paths.state,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 if(state.version){if(typeof state.file!=='string'||path.basename(state.file)!==state.file||!state.file.endsWith('.AppImage'))throw Error('導入先の記録が不正です。');state.executable=path.join(paths.directory,state.file);await fs.access(state.executable);}
 return {...state,running:await running(paths.directory,state)};
}
function open(file,paths){return new Promise((resolve,reject)=>{const child=spawn(file,[],{detached:true,stdio:'ignore',env:{...process.env,APPIMAGE_EXTRACT_AND_RUN:'1',NO_CLEANUP:'1',POCKET_DECK_NPM_INSTALL_DIR:paths.directory}});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});}
async function install({version,downloadImpl,format='AppImage',paths=locations(),inspectImpl=()=>inspect(paths),openImpl=file=>open(file,paths),log=console.log}){
 if(format==='deb')return require('./linux-deb-install.cjs').install({version,downloadImpl,log});
 if(format!=='AppImage')throw Error('Linuxの配布形式を確認してください。');
 let state=await inspectImpl();
 if(state.version&&compare(state.version,version)>=0){await openImpl(state.executable);return;}
 if(state.running)throw Error('Pocket Deckを完全に終了し、再実行してください。');
 const source=await downloadImpl();state=await inspectImpl();
 if(state.version&&compare(state.version,version)>=0){await openImpl(state.executable);return;}
 if(state.running)throw Error('導入中にアプリが起動しました。終了して再実行してください。');
 await fs.mkdir(paths.directory,{recursive:true});
 // electron-updater preserves an AppImage basename without a version. Keep
 // desktop entries and installation records valid after an in-app update.
 const file='Pocket-Deck.AppImage',executable=path.join(paths.directory,file);
 await fs.copyFile(source,executable+'.tmp');await fs.chmod(executable+'.tmp',0o755);await fs.rename(executable+'.tmp',executable);
 const quote=value=>"'"+String(value).replaceAll("'","'\\''")+"'";
  // A second extract-and-run instance must not delete the first one's resources.
  await fs.writeFile(paths.wrapper,'#!/bin/sh\nexport APPIMAGE_EXTRACT_AND_RUN=1\nexport NO_CLEANUP=1\nexport POCKET_DECK_NPM_INSTALL_DIR='+quote(paths.directory)+'\nexec '+quote(executable)+' "$@"\n',{mode:0o755});
 await fs.mkdir(path.dirname(paths.desktop),{recursive:true});
 const desktopPath=paths.wrapper.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('`','\\`').replaceAll('$','\\$').replaceAll('%','%%');
 await fs.writeFile(paths.desktop,'[Desktop Entry]\nType=Application\nName=Pocket Deck\nExec="'+desktopPath+'"\nTerminal=false\nCategories=Utility;\n');
 await fs.writeFile(paths.state+'.tmp',JSON.stringify({version,file}));await fs.rename(paths.state+'.tmp',paths.state);
 log('Pocket Deckのユーザー用アプリ導入が完了しました。アプリを開きます。');await openImpl(executable);
}
module.exports={locations,inspect,running,processActive,install,open};
