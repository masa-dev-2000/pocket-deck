const test=require('node:test'),assert=require('node:assert/strict');
const {apply}=require('./linux-deb-update.cjs');
function fixture(){const calls=[];return {calls,options:{files:['/tmp/verified-update.deb'],version:'1.1.0',uid:1000,
 accessImpl:async()=>{},installImpl:async()=>calls.push('install'),
 executeImpl:async()=>({stdout:'installed\n1.1.0'}),relaunch:async()=>calls.push('relaunch')}};}
test('cancelled OS authentication runs one installer and never queries or relaunches',async()=>{
 const f=fixture();f.options.installImpl=async()=>{f.calls.push('install');throw Error('cancelled');};
 f.options.executeImpl=async()=>{throw Error('must not query after cancellation');};
 await assert.rejects(apply(f.options),/cancelled/);assert.deepEqual(f.calls,['install']);
});
test('OS success with unchanged version never relaunches',async()=>{
 const f=fixture();f.options.executeImpl=async()=>({stdout:'installed\n1.0.4'});
 await assert.rejects(apply(f.options),/導入を確認できません/);assert.deepEqual(f.calls,['install']);
});
test('confirmed installed version relaunches only after installation',async()=>{
 const f=fixture();await apply(f.options);assert.deepEqual(f.calls,['install','relaunch']);
});
test('invalid file or root process cannot start installation',async()=>{
 const f=fixture();f.options.files=['relative.deb'];await assert.rejects(apply(f.options),/deb更新ファイル/);
 f.options.files=['/tmp/verified-update.deb'];f.options.uid=0;await assert.rejects(apply(f.options),/通常ユーザー/);assert.deepEqual(f.calls,[]);
});
