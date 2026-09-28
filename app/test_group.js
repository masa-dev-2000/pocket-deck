const assert=require('node:assert/strict');
const {groupedLayout,lineSelection,validLayout}=require('./layout');
const b=(id,slot,width=1,height=1)=>({id,slot,width,height});
const c={columns:4,rows:4,buttons:[b('pad',0,2,2),b('a',2),b('b',6),b('c',12)]};
const original=structuredClone(c);
assert.deepEqual(lineSelection(c,'row',new Set([1])),['pad','b']);
assert.deepEqual(lineSelection(c,'column',new Set([1])),['pad']);
const moved=groupedLayout(c,['pad','a'],0,1);
assert(validLayout(moved));assert.equal(moved.buttons[0].slot,4);assert.equal(moved.buttons[1].slot,6);
assert.equal(moved.buttons.find(b=>b.id==='c').slot,12);
assert.equal(moved.buttons.find(b=>b.id==='b').slot,2);
assert.deepEqual(c,original);
assert.deepEqual(groupedLayout(c,['pad','a'],0,1),moved);
assert.deepEqual(groupedLayout(c,['pad','a'],0,0),c);
assert.equal(groupedLayout(c,['pad'],-1,0),null);
assert.equal(groupedLayout(c,['pad'],0,3),null);
const full={columns:3,rows:2,buttons:[b('a',0,2,2),b('b',2,1,2)]};
assert.equal(groupedLayout(full,['b'],-1,0),null);
for(let dx=-4;dx<=4;dx++)for(let dy=-4;dy<=4;dy++){
 const next=groupedLayout(c,['pad','a'],dx,dy);if(next){assert(validLayout(next));assert.equal(next.buttons.length,c.buttons.length);assert.equal(next.buttons[1].slot-next.buttons[0].slot,2);}
}
console.log('Group: spans, rows/columns, rigid motion, deterministic nearest reflow, invalid/full, immutable source OK');
