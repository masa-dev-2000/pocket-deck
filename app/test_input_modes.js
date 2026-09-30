const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const elements=new Map(),calls=[];
function el(){return {hidden:false,style:{},dataset:{},children:[],clientWidth:220,scrollLeft:0,classList:{add(){},remove(){},toggle(){}},
 querySelector(){return {textContent:''}},append(c){this.children.push(c)},replaceChildren(...children){this.children=children},setAttribute(name,value){this[name]=value},
 setPointerCapture(){},scrollTo(){},remove(){},contains(target){return target===this||this.children.includes(target)},getBoundingClientRect(){return {left:10,right:70,top:40,bottom:80,height:40}},
 click(){this.onclick?.({detail:0})}};}
function $(id){if(!elements.has(id))elements.set(id,el());return elements.get(id);}
const root={version:5,revision:1,layouts:[
 {id:'main',name:'メイン',columns:2,rows:2,buttons:[{id:'key',type:'shortcut',slot:0},{id:'pad',type:'touchpad',slot:1}]},
 {id:'other',name:'次のページ',columns:2,rows:2,buttons:[{id:'wheel',type:'wheel',slot:0},{id:'group',type:'group',slot:1,label:'まとめ',items:[{id:'child',type:'text',label:'文字',text:'test'}]}]}
]};
const sandbox={console,Map,Set,Date,Math,Promise,innerWidth:375,innerHeight:667,requestAnimationFrame:f=>f(),
 readPreference:(key,fallback)=>fallback,writePreference(){},setTimeout,clearTimeout,setInterval(){},performance:{now:()=>100},
 document:{querySelector:()=>el(),body:{append(){}},hidden:false,createElement:el,querySelectorAll:()=>[],addEventListener(){},removeEventListener(){}},
 window:{addEventListener(){}},location:{reload(){}},$,fitDeck(){},resizeDeck(){},applyGridStyle(){},keyElement:el,message(){},
 api:async(path,data)=>{if(data){calls.push(data);return {ok:true}}return root}};
sandbox.root=root;sandbox.inputCapabilities={keyboard:true,pointer:true,text:true};sandbox.sensitivity={cursor:1,scroll:1};
sandbox.inputActionAllowed=()=>true;sandbox.paintInputPermission=()=>{};sandbox.setupOperatorSettings=()=>{};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('input-policy.js','utf8')+'\n'+fs.readFileSync('pad.js','utf8')+'\n'+fs.readFileSync('operator.js','utf8'),sandbox);
const run=code=>vm.runInContext(code,sandbox),pointer={pointerId:1,button:0,clientX:10,clientY:10,preventDefault(){}};
(async()=>{
 await new Promise(r=>setImmediate(r));run('render(root)');
 assert.equal($('pageTabs').children.length,2);
 const key=$('deck').children[0],pad=$('deck').children[1];key.onpointerdown(pointer);
 assert.equal(calls.at(-1).action,'down');pad.onpointerdown({...pointer,pointerId:2});
 root.revision=2;await run('refresh()');assert.equal(run('configRevision'),1,'refresh waits while a pad gesture is active');root.revision=1;
 await run("selectDeck('other')");
 assert(calls.some(c=>c.action==='up'),'page switch releases held key');
 assert.equal(run('selectedDeck'),'other');assert.equal(run('padControllers.size'),1);
 assert.equal($('pageTabs').children[1]['aria-current'],'true');
 const group=$('deck').children[1];group.click();assert.equal(run('groupPopup.id'),'group');
 run('groupPopup.panel.children[1].click()');assert.equal(calls.at(-1).action,'text');assert.equal(calls.at(-1).id,'child');
 group.click();const inner=el();group.children.push(inner);sandbox.inner=inner;run('groupPopup.outside({target:inner})');assert.equal(run('groupPopup.id'),'group','tap on group content keeps popup open');group.click();assert.equal(run('groupPopup'),null,'second tap closes the group');
 const wheel=$('deck').children[0],count=calls.length;wheel.onpointerdown(pointer);wheel.onpointermove({...pointer,clientX:30,clientY:50});wheel.onpointerup(pointer);
 await run('[...embeddedPads][0].tail');assert.equal(calls.at(-1).action,'mouse_scroll');
 assert(calls.length>count);await run("selectDeck('main')");assert.equal(run('padControllers.size'),1);
 console.log('Page tabs, held key release, embedded pad cleanup, grouped text and wheel OK');
})().catch(e=>{console.error(e);process.exitCode=1});
