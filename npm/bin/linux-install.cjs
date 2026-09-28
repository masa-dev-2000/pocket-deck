'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const {compare}=require('./windows-install.cjs');
function locations(env=process.env,home=os.homedir()){
 const data=env.XDG_DATA_HOME||path.join(home,'.local','share');
 const directory=path.join(data,'pocket-deck');
 return {directory,state:path.join(directory,'installation.json'),wrapper:path.join(directory,'pocket-deck'),desktop:path.join(data,'applications','pocket-deck.desktop')};
}
async function running(directory){
 for(const id of await fs.readdir('/proc')){
  if(!/^\d+$/.test(id))continue;
  try{const environment=(await fs.readFile('/proc/'+id+'/environ','utf8')).split('\0');if(environment.includes('POCKET_DECK_NPM_INSTALL_DIR='+directory)||environment.some(value=>value.startsWith('APPIMAGE='+directory+path.sep)))return true;}catch{}
 }
 return false;
}
async function inspect(paths){
 let state={};try{state=JSON.parse(await fs.readFile(paths.state,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 if(state.version){if(typeof state.file!=='string'||path.basename(state.file)!==state.file||!state.file.endsWith('.AppImage'))throw Error('導入先の記録が不正です。');state.executable=path.join(paths.directory,state.file);await fs.access(state.executable);}
 return {...state,running:await running(paths.directory)};
}
function open(file,paths){return new Promise((resolve,reject)=>{const child=spawn(file,[],{detached:true,stdio:'ignore',env:{...process.env,APPIMAGE_EXTRACT_AND_RUN:'1',POCKET_DECK_NPM_INSTALL_DIR:paths.directory}});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});}
async function install({version,downloadImpl,paths=locations(),inspectImpl=()=>inspect(paths),openImpl=file=>open(file,paths),log=console.log}){
 let state=await inspectImpl();
 if(state.version&&compare(state.version,version)>=0){await openImpl(state.executable);return;}
 if(state.running)throw Error('Pocket Deckを完全に終了し、再実行してください。');
 const source=await downloadImpl();state=await inspectImpl();
 if(state.version&&compare(state.version,version)>=0){await openImpl(state.executable);return;}
 if(state.running)throw Error('導入中にアプリが起動しました。終了して再実行してください。');
 await fs.mkdir(paths.directory,{recursive:true});
 const file='Pocket-Deck-'+version+'-x86_64.AppImage',executable=path.join(paths.directory,file);
 await fs.copyFile(source,executable+'.tmp');await fs.chmod(executable+'.tmp',0o755);await fs.rename(executable+'.tmp',executable);
 const quote=value=>"'"+String(value).replaceAll("'","'\\''")+"'";
 await fs.writeFile(paths.wrapper,'#!/bin/sh\nexport APPIMAGE_EXTRACT_AND_RUN=1\nexport POCKET_DECK_NPM_INSTALL_DIR='+quote(paths.directory)+'\nexec '+quote(executable)+' "$@"\n',{mode:0o755});
 await fs.mkdir(path.dirname(paths.desktop),{recursive:true});
 const desktopPath=paths.wrapper.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('`','\\`').replaceAll('$','\\$').replaceAll('%','%%');
 await fs.writeFile(paths.desktop,'[Desktop Entry]\nType=Application\nName=Pocket Deck\nExec="'+desktopPath+'"\nTerminal=false\nCategories=Utility;\n');
 await fs.writeFile(paths.state+'.tmp',JSON.stringify({version,file}));await fs.rename(paths.state+'.tmp',paths.state);
 log('Pocket Deckのユーザー用アプリ導入が完了しました。アプリを開きます。');await openImpl(executable);
}
module.exports={locations,inspect,running,install,open};
