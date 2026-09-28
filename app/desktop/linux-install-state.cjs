const fs=require('node:fs'),path=require('node:path');
function recordLinuxInstall({directory,currentImage,version}){
 if(!directory||!currentImage||!path.isAbsolute(directory)||!/^\d+\.\d+\.\d+$/.test(version))return false;
 const manifest=path.join(directory,'installation.json');
 try{
  const state=JSON.parse(fs.readFileSync(manifest,'utf8'));
  if(typeof state.file!=='string'||path.basename(state.file)!==state.file||!state.file.endsWith('.AppImage'))return false;
  if(fs.realpathSync(currentImage)!==fs.realpathSync(path.join(directory,state.file)))return false;
  fs.writeFileSync(manifest+'.tmp',JSON.stringify({...state,version}));fs.renameSync(manifest+'.tmp',manifest);return true;
 }catch{return false;}
}
module.exports={recordLinuxInstall};
