const {test}=require('node:test');
const assert=require('node:assert/strict');
const {assertSandbox}=require('./sandbox-policy.cjs');
test('packaged Linux rejects a launcher that disabled its sandbox',()=>{
 assert.throws(()=>assertSandbox({platform:'linux',packaged:true,noSandbox:true}),/deb版/);
 assert.doesNotThrow(()=>assertSandbox({platform:'linux',packaged:true,noSandbox:false}));
});
test('Linux lab source runs and existing Windows startup are unchanged',()=>{
 assert.doesNotThrow(()=>assertSandbox({platform:'linux',packaged:false,noSandbox:true}));
 assert.doesNotThrow(()=>assertSandbox({platform:'win32',packaged:true,noSandbox:true}));
});
