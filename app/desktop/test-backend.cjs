const test=require('node:test'),assert=require('node:assert/strict');
const {Backend,isConfig}=require('./backend.cjs');
test('existing Pocket Deck is reused and never killed',async()=>{
 let launches=0;const c={version:5,layouts:[{buttons:[]}]};const b=new Backend({}, {fetchConfig:async()=>c,launch:()=>launches++});
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
test('config identity check',()=>{assert(!isConfig({layouts:[]}));assert(!isConfig({version:5,layouts:[{}]}));assert(isConfig({version:5,layouts:[]}));});

test('owned backend clipboard requests survive split UTF-8 chunks and return a correlated ack',async()=>{
 const {EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();
 let checks=0;const texts=[],acks=[];child.stdin.on('data',chunk=>acks.push(JSON.parse(chunk.toString())));
 const b=new Backend({executable:__filename,dataDir:'fixture'},{launch:()=>child,wait:async()=>{},clipboardWrite:async text=>texts.push(text),fetchConfig:async()=>{
  if(!checks++){const error=Error('offline');error.cause={code:'ECONNREFUSED'};throw error;}return {version:5,layouts:[]};
 }});
 await b.ensure();const id='a'.repeat(32),text='日本語\n😀';
 const wire=Buffer.from(JSON.stringify({deck:'clipboard',id,text})+'\n');
 for(const byte of wire)child.stdout.write(Buffer.from([byte]));
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(texts,[text]);assert.deepEqual(acks,[{deck:'clipboard-result',id,ok:true}]);
 await b.desktopMessage({},JSON.stringify({deck:'clipboard',id,text}));assert.equal(texts.length,1);
 assert.equal(child.stdin.listenerCount('error'),1);
 child.stdout.destroy();child.stderr.destroy();child.stdin.destroy();
});
