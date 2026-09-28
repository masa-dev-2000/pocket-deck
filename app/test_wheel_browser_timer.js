// Web browser timers reject a class instance as their receiver; Node timers do not.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
let calls=0;
const context=vm.createContext({module:{exports:{}},performance:{now:()=>0},
 setTimeout:function(callback,delay){'use strict';assert.equal(this,undefined,'timer receiver');calls++;return calls;},
 clearTimeout:function(timer){'use strict';assert.equal(this,undefined,'timer receiver');calls++;}
});
vm.runInContext(fs.readFileSync('pad.js','utf8'),context);
const {WheelController}=context.module.exports;
const wheel=new WheelController({send:async()=>{},owner:()=> 'test',enabled:()=>true});
(async()=>{
 await wheel.cancel();
 wheel.down(1,0,0);wheel.move(1,20,30);await wheel.up(1);
 await wheel.cancel();assert(calls>0);
 console.log('Wheel: browser timer receiver, arm/disarm and navigation cancellation PASS');
})().catch(error=>{console.error(error);process.exitCode=1});
