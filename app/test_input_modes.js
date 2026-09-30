const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const elements=new Map(),calls=[],events={};
function el(){return {hidden:false,style:{},dataset:{},children:[],classList:{add(){},remove(){},toggle(){}},querySelector(){return {textContent:""}},append(c){this.children.push(c)},replaceChildren(){this.children=[]},setAttribute(){},setPointerCapture(){},click(){this.onclick?.({detail:0})}};}
function $(id){if(!elements.has(id))elements.set(id,el());return elements.get(id);}
const sandbox={console,Map,Set,Date,Math,Promise,readPreference:(key,fallback)=>fallback,writePreference(){},choiceDialog:async()=>null,setTimeout,clearTimeout,setInterval(){},performance:{now:()=>100},document:{querySelector:()=>el(),hidden:false,createElement:el,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener:(n,f)=>events[n]=f},location:{reload(){}},$,fitDeck(){},resizeDeck(){},applyGridStyle(){},keyElement:el,message(){},api:async(path,data)=>{if(data){calls.push(data);return {ok:true}}return {version:4,revision:0,layouts:[{id:'main',rows:1,columns:1,buttons:[]}]}}};
sandbox.inputCapabilities={keyboard:true,pointer:true,text:true};sandbox.sensitivity={cursor:1,scroll:1};sandbox.inputActionAllowed=()=>true;sandbox.paintInputPermission=()=>{};sandbox.setupOperatorSettings=()=>{};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('input-policy.js','utf8')+'\n'+fs.readFileSync('pad.js','utf8')+'\n'+fs.readFileSync('operator.js','utf8'),sandbox);
const run=code=>vm.runInContext(code,sandbox);
const pointer={pointerId:1,button:0,clientX:10,clientY:10,preventDefault(){}};
(async()=>{
 await new Promise(r=>setImmediate(r));await run("setMode('keyboard')");
 const a=$('keyboardPanel').children[3].children[0];a.onpointerdown(pointer);
 await run("setMode('pad')");assert.equal(calls[0].action,'key_down');assert.equal(calls[0].key,'A');assert.equal(calls[1].action,'up');assert.equal(calls[1].owner,calls[0].owner);
 const pad=$('touchpad');pad.onpointerdown(pointer);pad.onpointerup(pointer);await run('padController.tail');assert.equal(calls.at(-1).action,'mouse_click');await run('padController.cancel()');
 const before=calls.length;pad.onpointerdown(pointer);pad.onpointermove({...pointer,clientX:80});pad.onpointercancel();pad.onpointerup(pointer);await run('padController.tail');assert.equal(calls.length,before);
 pad.onpointerdown(pointer);pad.onpointerdown({...pointer,pointerId:2});pad.onpointerup(pointer);await run('padController.tail');assert.equal(calls.length,before);
 await run("setMode('deck')");await run("render({revision:1,layouts:[{id:'main',columns:6,rows:6,buttons:[{id:'pad',type:'touchpad',width:4,height:4},{id:'key',type:'shortcut'}]}]})");
 const embedded=$('deck').children[0],key=$('deck').children[1];
 embedded.onpointerdown(pointer);embedded.onpointerup(pointer);await run('[...embeddedPads][0].tail');assert.equal(calls.at(-1).action,'mouse_click');
 embedded.onpointerdown(pointer);await run('[...embeddedPads][0].tail');assert.equal(calls.at(-1).action,'mouse_down');
 key.onpointerdown({...pointer,pointerId:3});assert.equal(calls.at(-1).id,'key');
 await run('refresh()');assert.equal($('deck').children[0],embedded,'config refresh must defer while pad is held');
 await run("setMode('keyboard')");assert(calls.slice(-3).some(c=>c.action==='mouse_up'));assert(calls.slice(-3).some(c=>c.action==='up'));
 assert.equal(run('[...embeddedPads][0].points.size'),0);
 await run("render({revision:2,layouts:[{id:'main',columns:1,rows:1,buttons:[]}]})");assert.equal(run('padControllers.size'),1);
 $('keyboardPanel').children.at(-1).click();await new Promise(r=>setImmediate(r));assert.equal(run('mode'),'deck');
 await run("render({revision:3,layouts:[{id:'main',columns:2,rows:2,buttons:[{id:'wheel',type:'wheel',width:2,height:2}]}]})");
 const wheel=$('deck').children[0],count=calls.length;
 wheel.onpointerdown(pointer);wheel.onpointerup(pointer);wheel.click();
 await run('[...embeddedPads][0].tail');assert.equal(calls.length,count);
 wheel.onpointerdown(pointer);wheel.onpointermove({...pointer,clientX:30,clientY:50});wheel.onpointerup(pointer);
 await run('[...embeddedPads][0].tail');assert.equal(calls.at(-1).action,'mouse_scroll');assert.equal(calls.at(-1).dx,-30);assert.equal(calls.at(-1).dy,60);
 wheel.onpointerdown(pointer);wheel.onpointermove({...pointer,clientY:90});await run("setMode('pad')");assert.equal(calls.length,count+1);
 console.log('Embedded wheel: no tap/click, diagonal scroll and mode cancellation OK');
 console.log('Embedded pad: tap, drag, adjacent key, refresh deferral, mode release and cleanup OK');
 console.log('Modes: switching releases held key; tap clicks once; canceled and multitouch gestures do not click OK');
})().catch(e=>{console.error(e);process.exitCode=1});
