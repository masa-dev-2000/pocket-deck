const assert=require('node:assert/strict');const Pad=require('./pad.js');
let time=0,id=0,events=[];const pad=new Pad({send:async data=>events.push(data),owner:()=>String(++id),enabled:()=>true,now:()=>time});
(async()=>{
 pad.down(1,0,0);time=50;await pad.up(1);assert.equal(events[0].action,'mouse_click');
 time=100;pad.down(1,0,0);pad.move(1,30,20);time=200;await pad.up(1);
 assert.deepEqual(events.map(e=>e.action),['mouse_click','mouse_down','mouse_move','mouse_up']);assert.equal(events[1].owner,events[3].owner);
 events=[];time=1000;pad.down(1,10,10);pad.down(2,30,10);pad.move(1,10,-30);pad.move(2,30,-30);await pad.up(1);pad.move(2,30,-60);await pad.up(2);
 assert.deepEqual(events.map(e=>e.action),['mouse_scroll']);assert.equal(events[0].dy,-120);assert.equal(events[0].dx,0);
 events=[];time=2000;pad.down(1,0,0);await pad.up(1);time=2100;pad.down(1,0,0);await pad.tail;await pad.cancel();assert.equal(events.at(-1).action,'mouse_up');assert.equal(pad.dragOwner,null);
 events=[];time=3000;pad.down(1,0,0);pad.down(2,5,0);pad.down(3,10,0);await pad.up(1);await pad.up(2);await pad.up(3);assert.equal(events.length,0);
 console.log('Pad: tap, double-tap hold/drop, natural scroll, one-finger remainder, cancel release, three-finger cancel OK');
})().catch(e=>{console.error(e);process.exitCode=1});
