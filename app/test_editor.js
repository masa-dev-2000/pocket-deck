const assert=require('node:assert/strict');
const AutoSave=require('./autosave.js');const {swapSlots}=require('./reorder.js');
const base={version:2,revision:0,columns:3,rows:2,buttons:[{id:'a',slot:0,label:'A'},{id:'b',slot:4,label:'B'}]};
(async()=>{
 let resolve,calls=[];
 const store=new AutoSave(base,data=>{calls.push(structuredClone(data));return new Promise(r=>resolve=r);},()=>{});
 store.value.buttons[0].label='First';const task=store.flush();
 store.value.buttons[0].label='Latest';resolve({...calls[0],revision:1});
 await new Promise(r=>setImmediate(r));assert.equal(calls.length,2);assert.equal(calls[1].buttons[0].label,'Latest');
 resolve({...calls[1],revision:2});await task;assert.equal(store.dirty,false);
 store.send=async()=>{throw Error('offline');};store.value.buttons[0].label='Offline';assert.equal(await store.flush(),false);assert.equal(store.value.buttons[0].label,'Offline');assert.equal(store.dirty,true);
 store.send=async data=>({...data,revision:3});await store.flush();assert.equal(store.dirty,false);
 store.send=async()=>{const e=Error('conflict');e.status=409;throw e;};store.value.rows=3;await store.flush();assert.equal(store.error.status,409);assert.equal(store.value.rows,3);
 const c=structuredClone(base);assert(swapSlots(c,0,4));assert.equal(c.buttons[0].slot,4);assert.equal(c.buttons[1].slot,0);assert(swapSlots(c,4,3));assert.equal(c.buttons[0].slot,3);assert.equal(swapSlots(c,2,1),false);
 console.log('Autosave: serialized changes, latest edit retention, failure/retry/conflict; slots: swap and empty move OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
