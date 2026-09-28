const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {registrationDirectories,linuxRegistration,prepareLauncher}=require('./linux-chrome.cjs');
test('Chrome and Chromium config roots include Chrome for Testing and respect XDG',()=>{
 assert.deepEqual(registrationDirectories({XDG_CONFIG_HOME:'/xdg',CHROME_CONFIG_HOME:'/chrome'},'/home/test'),[path.join('/chrome','google-chrome','NativeMessagingHosts'),path.join('/chrome','google-chrome-for-testing','NativeMessagingHosts'),path.join('/xdg','chromium','NativeMessagingHosts')]);
});
test('Linux registration repairs missing owned links and refuses foreign hosts',{skip:process.platform!=='linux'},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'deck-native-'));try{
  const manifest=path.join(dir,'host.json'),targets=[path.join(dir,'Chrome'),path.join(dir,'Chromium')],reg=linuxRegistration(manifest,targets);
  fs.writeFileSync(manifest,'{}');assert.equal(await reg.read(),null);await reg.write(manifest);assert.equal(await reg.read(),manifest);
  fs.unlinkSync(path.join(targets[0],'local.pocket_deck.json'));assert.equal(await reg.read(),null);await reg.write(manifest);
  fs.unlinkSync(path.join(targets[1],'local.pocket_deck.json'));fs.writeFileSync(path.join(targets[1],'local.pocket_deck.json'),'foreign');
  await assert.rejects(reg.write(manifest),/上書き/);assert.equal(fs.readFileSync(path.join(targets[1],'local.pocket_deck.json'),'utf8'),'foreign');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('native launcher survives removal of an AppImage mount and quotes data paths',{skip:process.platform!=='linux'},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'deck-launch-'));try{
  const mount=path.join(dir,'temporary mount'),userDir=path.join(dir,"user's config"),dataDir=path.join(userDir,'data');fs.mkdirSync(mount);
  fs.writeFileSync(path.join(mount,'PocketDeckServer'),'#!/bin/sh\nprintf "%s\\n" "$@"\n');
  const source=path.join(mount,'PocketDeckChromeHost');fs.writeFileSync(source,'placeholder');
  const launcher=prepareLauncher({userDir,source,dataDir});fs.rmSync(mount,{recursive:true});
  const result=require('node:child_process').execFileSync(launcher,['chrome-extension://test-origin/'],{encoding:'utf8'});assert.equal(result,'--chrome-host\n--data-dir\n'+dataDir+'\n');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('AppImage updates refresh npm version record only for the registered image',()=>{
 const {recordLinuxInstall}=require('./linux-install-state.cjs');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'deck-version-'));try{
  const image=path.join(dir,'app.AppImage'),manifest=path.join(dir,'installation.json');fs.writeFileSync(image,'owned');fs.writeFileSync(manifest,JSON.stringify({file:'app.AppImage',version:'1.0.4'}));
  assert(recordLinuxInstall({directory:dir,currentImage:image,version:'1.1.0'}));assert.equal(JSON.parse(fs.readFileSync(manifest)).version,'1.1.0');
  const other=path.join(dir,'other.AppImage');fs.writeFileSync(other,'foreign');assert(!recordLinuxInstall({directory:dir,currentImage:other,version:'1.0.0'}));assert.equal(JSON.parse(fs.readFileSync(manifest)).version,'1.1.0');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
