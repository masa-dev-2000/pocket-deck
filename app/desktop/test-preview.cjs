const test=require('node:test'),assert=require('node:assert/strict');
const {previewDimensions,previewScale}=require('./preview.js');
test('device selection preserves logical screen size and orientation independently of display scaling',()=>{
 assert.deepEqual(previewDimensions({device:'se'}),{width:375,height:667});
 assert.deepEqual(previewDimensions({device:'iphone16',landscape:true}),{width:852,height:393});
 assert.deepEqual(previewDimensions({device:'custom',width:430,height:900}),{width:430,height:900});
 for(const width of [0,239,1441,NaN,375.5])assert.equal(previewDimensions({device:'custom',width,height:667}),null);
 const phone={width:412,height:915},scale=previewScale(phone,480,440);
 assert(scale>0&&scale<1);assert(phone.width*scale+12<=480);assert(phone.height*scale+12<=440);
 assert.equal(previewScale({width:375,height:667},1000,1000),1);
});
