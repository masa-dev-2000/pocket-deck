const test = require('node:test');
const assert = require('node:assert/strict');
const { install, compare } = require('../bin/windows-install.cjs');
const { postinstall } = require('../bin/postinstall.cjs');
const installed = {version:'1.0.4',executable:'mock/Pocket Deck.exe'};
function fixture(states) {
  const events=[];
  return {events,options:{version:'1.0.4',log(){},inspectImpl:async()=>states.shift(),downloadImpl:async()=>{events.push('verified');return 'setup.exe';},runImpl:async()=>events.push('installed'),openImpl:async()=>events.push('opened')}};
}
test('global lifecycle installs, local/npx lifecycle does not',async()=>{
  let calls=0;const options={platform:'win32',arch:'x64',log(){},installImpl:async()=>calls++};
  await postinstall({...options,env:{}});assert.equal(calls,0);
  await postinstall({...options,env:{npm_config_global:'true'}});assert.equal(calls,1);
  await assert.rejects(postinstall({...options,env:{npm_config_global:'true'},platform:'darwin'}),/Ubuntu/);
  await assert.rejects(postinstall({...options,env:{npm_config_global:'true'},platform:'linux'}),/Linux配布/);
});
test('fresh install verifies before running and checks installed version before opening',async()=>{
  const f=fixture([{}, {}, installed]);await install(f.options);assert.deepEqual(f.events,['verified','installed','opened']);
});
test('same and newer versions launch without downgrade or download',async()=>{
  for(const version of ['1.0.4','1.0.10','2.0.0']){const f=fixture([{...installed,version}]);await install(f.options);assert.deepEqual(f.events,['opened']);}
  assert(compare('1.0.10','1.0.4')>0);assert.throws(()=>compare('bad','1.0.4'));
});
test('running app or machine installation is not forcibly replaced',async()=>{
  for(const state of [{running:true},{version:'1.0.3',machine:true}]){const f=fixture([state]);await assert.rejects(install(f.options));assert.deepEqual(f.events,[]);}
  const f=fixture([{}, {running:true}]);await assert.rejects(install(f.options));assert.deepEqual(f.events,['verified']);
});
test('verification failure, installer failure and missing installed version never launch app',async()=>{
  const a=fixture([{}]);a.options.downloadImpl=async()=>{throw Error('checksum');};await assert.rejects(install(a.options),/checksum/);assert.deepEqual(a.events,[]);
  const b=fixture([{},{}]);b.options.runImpl=async()=>{throw Error('installer');};await assert.rejects(install(b.options),/installer/);assert.deepEqual(b.events,['verified']);
  const c=fixture([{}, {}, {version:'1.0.3'}]);await assert.rejects(install(c.options),/確認できません/);assert.deepEqual(c.events,['verified','installed']);
});
