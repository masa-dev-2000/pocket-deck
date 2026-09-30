const assert=require('node:assert/strict');
const {WheelController}=require('./pad.js');
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function fixture(send,options={}){
 let now=0,id=0,enabled=true;const timers=new Map(),events=[];
 const wheel=new WheelController({...options,send:send||async function(e){events.push(e)},owner:()=>String(++id),enabled:()=>enabled,now:()=>now,
  schedule:(fn,delay)=>{const key=++id;timers.set(key,{fn,at:now+delay});return key;},unschedule:key=>timers.delete(key)});
 return {wheel,events,timers,disable:()=>enabled=false,async advance(ms){
  const end=now+ms;
  for(;;){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;
   now=next[1].at;timers.delete(next[0]);next[1].fn();await flush();
  }now=end;await flush();
 }};
}
(async()=>{
 const reverse=fixture(null,{invertY:true});reverse.wheel.down(1,0,0);reverse.wheel.move(1,20,50);await reverse.wheel.drain(true);
 assert.equal(reverse.events.at(-1).dx,-30);assert.equal(reverse.events.at(-1).dy,-75);reverse.events.length=0;
 await reverse.advance(560);assert(reverse.events.length>0);assert(reverse.events.every(e=>e.dx<0&&e.dy<0));
 await reverse.wheel.up(1);const reversedCount=reverse.events.length;await reverse.advance(1000);assert.equal(reverse.events.length,reversedCount);
 const f=fixture(),w=f.wheel;
 w.down(1,100,100);await f.advance(100);w.move(1,100,150);await w.drain(true);
 assert.equal(f.events.at(-1).dy,75);f.events.length=0;
 await f.advance(399);assert.equal(w.phase,'scroll');await f.advance(1);assert.equal(w.phase,'continuous');
 await f.advance(160);assert.equal(f.events.reduce((n,e)=>n+e.dy,0),144);
 assert(f.events.every(e=>e.action==='mouse_scroll'&&e.dx===0));
 w.move(1,100,100);const count=f.events.length;await f.advance(100);assert.equal(f.events.length,count);
 w.move(1,150,50);await f.advance(16);assert(f.events.at(-1).dx<0&&f.events.at(-1).dy<0);
 w.move(1,1000,1000);await f.advance(16);assert(Math.abs(f.events.at(-1).dx)<=29&&Math.abs(f.events.at(-1).dy)<=29);
 await w.up(1);const stopped=f.events.length;await f.advance(1000);assert.equal(f.events.length,stopped);assert.equal(f.timers.size,0);
 // A regular swipe that never pauses must not become continuous.
 w.down(1,0,0);for(let i=1;i<=8;i++){await f.advance(100);w.move(1,0,i*12);await w.drain(true);assert.equal(w.phase,'scroll');}
 await w.up(1);
 // Multitouch and disabled input stop an active hold immediately.
 w.down(1,0,0);w.move(1,0,50);await w.drain(true);await f.advance(400);w.down(2,0,0);assert.equal(w.phase,'blocked');assert.equal(f.timers.size,0);
 await w.up(1);await w.up(2);w.down(1,0,0);w.move(1,0,50);await w.drain(true);await f.advance(400);f.disable();await f.advance(16);assert.equal(w.phase,'idle');assert.equal(f.timers.size,0);
 // Slow transport gets one in-flight packet, with no accumulated catch-up.
 let resolve;const sent=[];const slow=fixture(e=>{sent.push(e);return new Promise(r=>resolve=r)}),s=slow.wheel;
 s.down(1,0,0);s.move(1,0,90);s.clearMotion();await slow.advance(400);await slow.advance(16);
 assert.equal(sent.length,1);await slow.advance(1000);assert.equal(sent.length,1);resolve();await flush();await slow.advance(16);
 assert.equal(sent.length,2);assert(Math.abs(sent[1].dy)<=29);const pending=resolve,canceled=s.cancel();pending();await canceled;await flush();
 console.log('Wheel hold: pause activation, ordinary swipe, speed/direction, neutral stop, lift, multitouch, disabled state and slow-transport drop OK');
})().catch(e=>{console.error(e);process.exitCode=1});
