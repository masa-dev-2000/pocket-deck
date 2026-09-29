const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {Updates}=require('./updates.cjs');
test('manual-only mac trial never checks or shuts down the backend',async()=>{
 const f=fixture();f.controller.manualOnlyReason='macOS trial requires manual update';
 f.updater.checkForUpdates=async()=>{throw Error('must not contact updater');};
 await f.controller.check();assert.deepEqual(f.events,[]);
 await f.controller.check(true);assert.deepEqual(f.events,['info']);
});
function fixture({version='1.0.5',accept=true,downloadError=false}={}){
 const events=[],updater=new EventEmitter();updater.checkForUpdates=async()=>({updateInfo:{version}});updater.downloadUpdate=async()=>{events.push('download');if(downloadError)throw Error('network');};updater.quitAndInstall=(silent,restart)=>events.push(['apply',silent,restart]);
 const controller=new Updates({updater,currentVersion:'1.0.4',packaged:true,ask:async()=>{events.push('ask');return accept;},inform:async()=>events.push('info'),prepare:async()=>events.push('stop-backend'),publish:s=>events.push(s.phase)});
 return {controller,updater,events};
}
test('no newer release does not prompt or download; manual check informs',async()=>{const f=fixture({version:'1.0.4'});await f.controller.check();assert(!f.events.includes('ask'));await f.controller.check(true);assert(f.events.includes('info'));assert(!f.events.includes('download'));});
test('later skips download and repeated startup prompt but allows manual retry',async()=>{const f=fixture({accept:false});await f.controller.check();await f.controller.check();assert.equal(f.events.filter(e=>e==='ask').length,1);await f.controller.check(true);assert.equal(f.events.filter(e=>e==='ask').length,2);assert(!f.events.includes('download'));});
test('consent precedes download and backend shutdown precedes install',async()=>{const f=fixture();await f.controller.check();assert.deepEqual(f.events.filter(e=>['ask','download','stop-backend'].includes(e)||Array.isArray(e)),['ask','download','stop-backend',['apply',true,true]]);assert.equal(f.updater.autoDownload,false);assert.equal(f.updater.autoInstallOnAppQuit,false);assert.equal(f.updater.allowPrerelease,false);assert.equal(f.updater.allowDowngrade,false);});
test('failed download keeps backend alive and allows retry',async()=>{const f=fixture({downloadError:true});await f.controller.check();assert(f.events.includes('error'));assert(!f.events.includes('stop-backend'));assert.equal(f.controller.busy,false);await f.controller.check(true);assert.equal(f.events.filter(e=>e==='download').length,2);});
test('concurrent checks and quit during download never apply twice',async()=>{const f=fixture();let finish;f.updater.downloadUpdate=()=>new Promise(resolve=>finish=resolve);const task=f.controller.check();await new Promise(resolve=>setImmediate(resolve));await f.controller.check(true);assert.equal(f.events.filter(e=>e==='ask').length,1);f.controller.dispose();finish();await task;assert(!f.events.includes('stop-backend'));});
test('cancelled OS installation restores backend and does not invoke library fallback',async()=>{
 const f=fixture();f.updater.downloadUpdate=async()=>['/tmp/verified-update.deb'];
 f.controller.apply=async options=>{assert.deepEqual(options,{files:['/tmp/verified-update.deb'],version:'1.0.5'});f.events.push('os-auth');throw Error('cancelled');};
 f.controller.recover=async()=>f.events.push('restore-backend');
 await f.controller.check(true);
 assert.deepEqual(f.events.filter(e=>['os-auth','restore-backend'].includes(e)),['os-auth','restore-backend']);
 assert(!f.events.some(Array.isArray));assert(f.events.includes('error'));assert.equal(f.controller.busy,false);
});
test('confirmed custom installation applies once without invoking default installer',async()=>{
 const f=fixture();f.controller.apply=async()=>f.events.push('confirmed-install');
 await f.controller.check();assert(f.events.includes('confirmed-install'));assert(!f.events.some(Array.isArray));
});
