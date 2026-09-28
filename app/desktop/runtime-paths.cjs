const path=require('node:path');
function runtimePaths({packaged,resourcesPath,sourceDirectory,platform=process.platform}){
 const suffix=platform==='win32'?'.exe':'';
 const folder=packaged?path.join(resourcesPath,'backend'):path.join(sourceDirectory,'backend-build','PocketDeckServer');
 return {executable:path.join(folder,'PocketDeckServer'+suffix),launcher:path.join(folder,'PocketDeckChromeHost'+suffix)};
}
module.exports={runtimePaths};
