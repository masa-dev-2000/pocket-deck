const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const events={},messages=[],updates=[],stored={id:'profile-work',name:'仕事用'};
const windows=[{id:1,type:'normal',state:'normal',focused:false},{id:2,type:'normal',state:'minimized',focused:false}];
const listener=name=>({addListener:fn=>events[name]=fn});
const chrome={storage:{local:{get:async()=>({...stored}),set:async data=>Object.assign(stored,data)},session:{get:async()=>({lastWindow:2}),set:async()=>{} }},
 runtime:{connectNative:()=>({onMessage:listener('nativeMessage'),onDisconnect:listener('disconnect'),postMessage:m=>messages.push(m),disconnect(){}}),onStartup:listener('startup'),onInstalled:listener('installed'),onMessage:listener('message')},
 alarms:{create(){},onAlarm:listener('alarm')},windows:{WINDOW_ID_NONE:-1,onFocusChanged:listener('focus'),getAll:async()=>windows,getLastFocused:async()=>windows[0],get:async id=>windows.find(w=>w.id===id),update:async(id,data)=>{updates.push([id,data]);Object.assign(windows.find(w=>w.id===id),data);}}};
const sandbox={chrome,crypto:{randomUUID:()=> 'generated'},Date,Map,console};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('chrome-extension/background.js','utf8'),sandbox);
(async()=>{
 await new Promise(r=>setImmediate(r));assert.equal(messages[0].id,'profile-work');
 await vm.runInContext("focus({id:'first',expires:Date.now()/1000+3})",sandbox);
 assert.equal(updates[0][0],2);assert.equal(updates[0][1].state,'normal');assert.equal(updates[1][1].focused,true);assert.equal(messages.at(-1).ok,true);
 await vm.runInContext("focus({id:'first',expires:Date.now()/1000+3})",sandbox);assert.equal(updates.length,2);
 await vm.runInContext("focus({id:'expired',expires:0})",sandbox);assert.equal(messages.at(-1).ok,false);assert.equal(updates.length,2);
 windows.length=0;await vm.runInContext("focus({id:'closed',expires:Date.now()/1000+3})",sandbox);assert.equal(messages.at(-1).ok,false);
 console.log('Chrome bridge: persistent profile registration, last-window selection, restore/focus verification, expired/duplicate/missing-window requests OK');
})().catch(e=>{console.error(e);process.exitCode=1});
