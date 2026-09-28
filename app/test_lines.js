const assert=require('node:assert/strict'),{editGridLine,resizedGrid,validLayout}=require('./layout');
const c={id:'main',columns:4,rows:4,buttons:[{id:'pad',label:'pad',slot:0,width:2,height:2,type:'touchpad'},{id:'text',label:'text',slot:6,width:1,height:1,type:'text',text:'keep me'},{id:'macro',slot:15,width:1,height:1,steps:[{kind:'text',text:'nested'}]}]};
for(const axis of ['row','column']){
 for(let index=0;index<=4;index++){
  const added=editGridLine(c,axis,'add',index);assert(validLayout(added.layout));assert.equal(added.layout.buttons.length,3);
  const restored=editGridLine(added.layout,axis,'delete',index);assert.deepEqual(restored.layout,c);
 }
 const middle=editGridLine(c,axis,'delete',1);assert(validLayout(middle.layout));assert.equal(middle.layout.buttons[0][axis==='row'?'height':'width'],1);
}
const deleted=editGridLine(c,'row','delete',1);assert.deepEqual(deleted.removed.map(b=>b.id),['text']);assert.equal(deleted.removed[0].text,'keep me');
const resized=resizedGrid(c,5,4);assert.equal(resized.buttons[2].slot,18);assert.equal(resized.buttons[1].slot,7);assert.equal(resizedGrid(c,3,4),null);
assert.equal(editGridLine({...c,columns:12},'column','add',0),null);
assert.equal(editGridLine({...c,rows:200},'row','add',0),null);
assert.equal(editGridLine({columns:1,rows:1,buttons:[]},'row','delete',0),null);
const snapshot=structuredClone(c);editGridLine(c,'row','delete',1);assert.deepEqual(c,snapshot);
assert.equal(editGridLine(c,'row','delete',4),null);
console.log('Lines: all insertion boundaries, span growth/shrink, removed content, roundtrip restoration, coordinate-preserving resize, limits OK');
