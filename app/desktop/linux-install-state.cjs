const fs=require('node:fs'),path=require('node:path');
function processIdentity(){
 if(process.platform!=='linux')return undefined;
 const stat=fs.readFileSync('/proc/self/stat','utf8');
 const startTime=stat.slice(stat.lastIndexOf(')')+2).split(/\s+/)[19];
 if(!/^\d+$/.test(startTime))throw Error('Invalid process identity');
 return {pid:process.pid,startTime,bootId:fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim()};
}
function recordLinuxInstall({directory,currentImage,version}){
 if(!directory||!currentImage||!path.isAbsolute(directory)||!/^\d+\.\d+\.\d+$/.test(version))return false;
 const manifest=path.join(directory,'installation.json');
 try{
  const state=JSON.parse(fs.readFileSync(manifest,'utf8'));
  if(typeof state.file!=='string'||path.basename(state.file)!==state.file||!state.file.endsWith('.AppImage'))return false;
  if(fs.realpathSync(currentImage)!==fs.realpathSync(path.join(directory,state.file)))return false;
  fs.writeFileSync(manifest+'.tmp',JSON.stringify({...state,version,process:processIdentity()}));fs.renameSync(manifest+'.tmp',manifest);return true;
 }catch{return false;}
}
module.exports={recordLinuxInstall};
