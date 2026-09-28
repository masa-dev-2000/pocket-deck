const test=require('node:test'),assert=require('node:assert/strict');
const {Backend,isConfig}=require('./backend.cjs');
test('existing Pocket Deck is reused and never killed',async()=>{
 let launches=0;const c={version:4,layouts:[{buttons:[]}]};const b=new Backend({}, {fetchConfig:async()=>c,launch:()=>launches++});
 assert.equal(await b.ensure(),c);await b.stop();assert.equal(launches,0);
});
test('another service is rejected without starting or stopping it',async()=>{
 let launches=0;const b=new Backend({}, {fetchConfig:async()=>({version:1}),launch:()=>launches++});
 await assert.rejects(b.ensure(),/別のサービス/);assert.equal(launches,0);
});
test('HTTP errors are not mistaken for a stopped server',async()=>{
 let launches=0;const b=new Backend({}, {fetchConfig:async()=>{throw new Error('HTTP 500');},launch:()=>launches++});
 await assert.rejects(b.ensure(),/500/);assert.equal(launches,0);
});
test('missing bundled executable provides actionable error',async()=>{
 const b=new Backend({executable:'Z:/missing/pocket-deck.exe'}, {fetchConfig:async()=>{const e=new Error('offline');e.cause={code:'ECONNREFUSED'};throw e;}});
 await assert.rejects(b.ensure(),/再インストール/);
});
test('config identity check',()=>{assert(!isConfig({layouts:[]}));assert(!isConfig({version:4,layouts:[{}]}));assert(isConfig({version:4,layouts:[]}));});
