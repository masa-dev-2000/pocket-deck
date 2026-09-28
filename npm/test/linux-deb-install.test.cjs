const {test}=require('node:test');
const assert=require('node:assert/strict');
const {install,inspect}=require('../bin/linux-deb-install.cjs');
const release='1.1.0',executable='/opt/Pocket Deck/pocket-deck-desktop';
test('deb installs only a verified package and opens after installed version confirmation',async()=>{
 const calls=[];let installed=false;
 await install({version:release,uid:1000,log(){},inspectImpl:async()=>({version:installed?release:undefined,executable,running:false}),
  downloadImpl:async()=>{calls.push('verify');return '/private/verified.deb';},
  installImpl:async file=>{assert.equal(file,'/private/verified.deb');calls.push('OS consent and install');installed=true;},
  openImpl:async file=>{assert.equal(file,executable);calls.push('open');}});
 assert.deepEqual(calls,['verify','OS consent and install','open']);
});
test('deb refuses active app and detects a launch during download without root installation',async()=>{
 for(const activeAt of [1,2]){
  let inspections=0;
  await assert.rejects(install({version:release,uid:1000,log(){},inspectImpl:async()=>({running:++inspections===activeAt}),
   downloadImpl:async()=>'/private/verified.deb',installImpl(){assert.fail('must not install');},openImpl(){assert.fail('must not open');}}),/終了/);
 }
});
test('deb does not downgrade and never opens after canceled or unconfirmed installation',async()=>{
 await install({version:release,uid:1000,log(){},inspectImpl:async()=>({version:'1.2.0',executable}),
  downloadImpl(){assert.fail('must not download');},installImpl(){assert.fail('must not install');},openImpl:async file=>assert.equal(file,executable)});
 for(const cancelled of [true,false]){
  let opened=false;
  await assert.rejects(install({version:release,uid:1000,log(){},inspectImpl:async()=>({version:undefined,running:false}),
   downloadImpl:async()=>'/private/verified.deb',installImpl:async()=>{if(cancelled)throw Error('cancelled');},openImpl:async()=>{opened=true;}}));
  assert.equal(opened,false);
 }
});
test('deb root invocation and incorrect artifact never start an installer',async()=>{
 await assert.rejects(install({version:release,uid:0,downloadImpl(){assert.fail('must not download');}}),/一般ユーザー/);
 await assert.rejects(install({version:release,uid:1000,inspectImpl:async()=>({}),downloadImpl:async()=>'/private/wrong.exe',installImpl(){assert.fail('must not install');}}),/debファイル/);
});
test('dpkg config retention after removal does not count as an installed app',async()=>{
 const query=stdout=>inspect({executeImpl:async()=>({stdout}),runningImpl:async()=>false});
 assert.equal((await query('installed\n1.1.0')).version,'1.1.0');
 assert.equal((await query('config-files\n1.1.0')).version,undefined);
 await assert.rejects(query('installed\ncustom-version'),/版番号/);
 await assert.rejects(query('unpacked\n1.1.0'),/未完了/);
 assert.equal((await inspect({executeImpl:async()=>{throw Object.assign(Error('absent'),{code:1});},runningImpl:async()=>false})).version,undefined);
});
