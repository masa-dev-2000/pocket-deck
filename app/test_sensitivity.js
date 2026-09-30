const assert=require('node:assert/strict');
const {inputAllowed,inputRequirements,sensitivityValues}=require('./input-policy.js');
const Pad=require('./pad.js'),Wheel=Pad.WheelController;
assert.equal(inputAllowed(null,['keyboard']),false);
assert.deepEqual(inputRequirements({type:'macro',steps:[{kind:'text'},{kind:'shortcut'}]}),['text','keyboard']);
assert.deepEqual(sensitivityValues({cursor:Infinity,scroll:.1}),{cursor:1,scroll:1});
(async()=>{
 let events=[],id=0,time=0;
 const p=new Pad({send:async data=>events.push(data),owner:()=>String(++id),enabled:()=>true,now:()=>time,sensitivity:()=>({cursor:.25,scroll:2})});
 p.down(1,0,0);for(let n=1;n<=4;n++){p.move(1,n,0);await p.drain(true);}time=500;await p.up(1);
 assert.equal(events.reduce((s,e)=>s+(e.dx||0),0),1);
 events=[];p.down(1,0,0);p.down(2,10,0);p.move(1,0,10);p.move(2,10,10);await p.up(1);await p.up(2);
 assert.equal(events.reduce((s,e)=>s+(e.dy||0),0),60);
 events=[];const w=new Wheel({send:async d=>events.push(d),owner:()=>String(++id),enabled:()=>true,sensitivity:()=>({scroll:2}),invertY:true});w.down(1,0,0);w.move(1,0,10);await w.up(1);
 assert.equal(events.reduce((s,e)=>s+(e.dy||0),0),-30);
 console.log('Input policy and sensitivity: partial capabilities, fractional motion, pad/wheel scaling PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
