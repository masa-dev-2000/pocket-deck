const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const HOST='local.pocket_deck.json';
function registrationDirectories(env=process.env,home=os.homedir()){
 const config=env.CHROME_CONFIG_HOME||env.XDG_CONFIG_HOME||path.join(home,'.config');
 const chromium=env.XDG_CONFIG_HOME||path.join(home,'.config');
 return [path.join(config,'google-chrome','NativeMessagingHosts'),path.join(config,'google-chrome-for-testing','NativeMessagingHosts'),path.join(chromium,'chromium','NativeMessagingHosts')];
}
function linuxRegistration(manifest,directories=registrationDirectories()){
 const files=directories.map(dir=>path.join(dir,HOST));
 function check(){
  for(const file of files){
   try{const info=fs.lstatSync(file);if(!info.isSymbolicLink()||path.resolve(path.dirname(file),fs.readlinkSync(file))!==path.resolve(manifest))throw Error('別の連携ホストが登録されています。自動では上書きしません。');}
   catch(error){if(error.code!=='ENOENT')throw error;}
  }
 }
 return {async read(){check();return files.every(file=>{try{return fs.lstatSync(file).isSymbolicLink();}catch{return false;}})?manifest:null;},
  async write(file){if(path.resolve(file)!==path.resolve(manifest))throw Error('Invalid native host manifest');check();for(const target of files){fs.mkdirSync(path.dirname(target),{recursive:true});try{fs.symlinkSync(manifest,target);}catch(error){if(error.code!=='EEXIST')throw error;}}}};
}
function shellQuote(value){return "'"+String(value).replaceAll("'","'\\''")+"'";}
function prepareLauncher({userDir,source,dataDir}){
 // AppImage resources are mounted at a temporary path. Keep a private backend
 // copy so Chrome can start the host after the desktop app has exited.
 const runtimes=path.join(userDir,'chrome-host-runtimes');fs.mkdirSync(runtimes,{recursive:true});
 const destination=path.join(runtimes,crypto.randomUUID());
 // Never overwrite an ELF executable or libraries used by a live Chrome host.
 fs.mkdirSync(destination);
 fs.cpSync(path.dirname(source),destination,{recursive:true,force:true});
 const executable=path.join(destination,'PocketDeckServer');fs.chmodSync(executable,0o755);
 const launcher=path.join(userDir,'chrome-host');
 fs.writeFileSync(launcher+'.tmp','#!/bin/sh\nexec '+shellQuote(executable)+' --chrome-host --data-dir '+shellQuote(dataDir)+'\n',{mode:0o700});
 fs.renameSync(launcher+'.tmp',launcher);fs.chmodSync(launcher,0o700);
 return launcher;
}
module.exports={registrationDirectories,linuxRegistration,prepareLauncher,shellQuote};
