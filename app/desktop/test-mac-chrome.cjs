const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {registrationDirectories,macRegistration}=require('./mac-chrome.cjs');
const {ChromeSetup}=require('./chrome-setup.cjs');
test('mac native messaging uses Library Application Support independently of XDG',()=>{
 const dirs=registrationDirectories('/Users/deck');
 assert.equal(dirs[0],path.join('/Users/deck','Library','Application Support','Google','Chrome','NativeMessagingHosts'));
 assert(dirs.every(dir=>!dir.includes('.config')));
});
test('mac Chrome preparation repairs missing files and preserves configuration and token',{skip:process.platform==='win32'},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'deck-mac-chrome-'));
 try{
  const runtime=path.join(dir,'runtime'),userDir=path.join(dir,"user's data");fs.mkdirSync(runtime);
  const source=path.join(runtime,'PocketDeckChromeHost');fs.writeFileSync(source,'launcher');
  fs.writeFileSync(path.join(runtime,'PocketDeckServer'),'#!/bin/sh\nprintf "%s\\n" "$@"\n');
  const manifest=path.join(userDir,'chrome-native-host.json'),targets=[path.join(dir,'Chrome'),path.join(dir,'Chromium')];
  const setup=new ChromeSetup({userDir,platform:'darwin',launcher:source,extensionSource:path.join(__dirname,'..','chrome-extension')},{registration:macRegistration(manifest,targets)});
  fs.mkdirSync(setup.dataDir,{recursive:true});fs.writeFileSync(path.join(setup.dataDir,'config.json'),'existing');
  await setup.prepare();assert((await setup.status()).prepared);
  const token=fs.readFileSync(path.join(setup.dataDir,'chrome-bridge.token'));
  fs.unlinkSync(path.join(targets[0],'local.pocket_deck.json'));assert(!(await setup.status()).prepared);
  await setup.prepare();assert((await setup.status()).prepared);
  assert.equal(fs.readFileSync(path.join(setup.dataDir,'config.json'),'utf8'),'existing');
  assert.deepEqual(fs.readFileSync(path.join(setup.dataDir,'chrome-bridge.token')),token);
  const output=require('node:child_process').execFileSync(setup.launcher,[],{encoding:'utf8'});
  assert.equal(output,'--chrome-host\n--data-dir\n'+setup.dataDir+'\n');
  fs.unlinkSync(path.join(targets[1],'local.pocket_deck.json'));fs.writeFileSync(path.join(targets[1],'local.pocket_deck.json'),'foreign');
  await assert.rejects(setup.prepare(),/上書き/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
