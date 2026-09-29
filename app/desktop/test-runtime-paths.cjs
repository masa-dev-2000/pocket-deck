const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {runtimePaths}=require('./runtime-paths.cjs');
test('packaged and source backends use the correct OS executable without changing directory layout',()=>{
 for(const platform of ['win32','linux','darwin'])for(const packaged of [true,false]){
  const actual=runtimePaths({platform,packaged,resourcesPath:'/app/resources',sourceDirectory:'/source/desktop'});
  const folder=packaged?'/app/resources/backend':'/source/desktop/backend-build/PocketDeckServer';
  assert.equal(actual.executable,path.join(folder,'PocketDeckServer'+(platform==='win32'?'.exe':'')));
  assert.equal(actual.launcher,path.join(folder,'PocketDeckChromeHost'+(platform==='win32'?'.exe':'')));
 }
});
