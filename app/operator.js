const active=new Map(),releasing=new Set(),padControllers=new Set(),embeddedPads=new Set();
let sequence=0,navigating=false,configRevision=-1,polling=false,mode='deck',switching=false;
const client=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const owner=()=>client+'-'+(++sequence);
const action=data=>api('action',data,{keepalive:true});
let deckConfig=null,selectedDeck=readPreference('deck-selected-layout','main'),executionOwner=null,executionPending=null,executionBusy=false,sequencePolling=false,lastSequenceId='';
function stop(pointer){
 const a=active.get(pointer);if(!a)return Promise.resolve();active.delete(pointer);a.el.classList.remove('pressed');
 const task=(async()=>{try{await a.pending;await action({action:'up',owner:a.owner});}catch(e){message(e.message+' 通信断では約2秒で自動解除します');}})();
 releasing.add(task);task.finally(()=>releasing.delete(task));return task;
}
async function stopAll(){const sequenceRelease=cancelSequence();const mouseRelease=Promise.all([...padControllers].map(p=>p.cancel()));for(const p of [...active.keys()])stop(p);await Promise.all([...releasing,mouseRelease,sequenceRelease]);}
function render(root){
 deckConfig=root;const config=root.layouts.find(l=>l.id===selectedDeck)||root.layouts[0];selectedDeck=config.id;writePreference('deck-selected-layout',selectedDeck);$('deckMode').title=config.name;

 for(const p of embeddedPads){p.cancel();padControllers.delete(p);}embeddedPads.clear();
 $('deck').replaceChildren();fitDeck(config);configRevision=root.revision;
 for(const b of config.buttons){
  const el=keyElement(b);applyGridStyle(el,b,config.columns);
  el.oncontextmenu=e=>e.preventDefault();
  if(b.type==='wheel'){el.classList.add('embedded-pad','wheel-region');embeddedPads.add(attachPad(el,()=>mode==='deck',true,true));}else if(b.type==='touchpad'){el.classList.add('embedded-pad');embeddedPads.add(attachPad(el,()=>mode==='deck',true));}else if(b.type==='navigate'){el.onclick=()=>{if(!navigating&&!switching){if(b.target==='layout')selectDeck(b.layoutId);else setMode(b.target);}};}else if(b.type==='macro'||b.type==='profile'){el.onclick=()=>executeButton(b);}else if(b.type==='text'){
   el.onclick=()=>{if(navigating||switching||executionBusy)return;el.classList.add('pressed');action({action:'text',id:b.id,owner:owner()}).catch(e=>message(e.message)).finally(()=>el.classList.remove('pressed'));};
  }else{
   bindKey(el,{action:'down',id:b.id},{action:'tap',id:b.id});
  }
  $('deck').append(el);
 }
 if(!config.buttons.length)message('メニューの「配置を編集」から追加できます');
}
for(const link of document.querySelectorAll('a[data-navigation]'))link.addEventListener('click',async e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();navigating=true;await stopAll();location.assign(link.href);});
$('release').onclick=async()=>{await stopAll();try{await action({action:'release_all'});message('全キーを解除しました');}catch(e){message(e.message);}};
for(const event of ['blur','deck:viewchange','orientationchange','pagehide'])window.addEventListener(event,stopAll);
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAll();});
setInterval(()=>{for(const a of active.values())a.pending.then(()=>{if([...active.values()].includes(a))return action({action:'heartbeat',owner:a.owner});}).catch(()=>{});},500);
async function refresh(){if(polling||navigating||document.hidden)return;polling=true;try{const c=await api('config');if(!executionBusy&&!active.size&&!releasing.size&&![...padControllers].some(p=>p.points.size||p.dragOwner||p.outstanding||p.pending)&&c.revision!==configRevision)render(c);}catch(e){message(e.message);}finally{polling=false;}}
refresh();setInterval(refresh,1500);

function bindKey(el,down,tap){
 el.oncontextmenu=e=>e.preventDefault();
 el.onpointerdown=e=>{
  if(navigating||switching||executionBusy||e.button!==0)return;
  e.preventDefault();el.setPointerCapture(e.pointerId);const o=owner();el.classList.add('pressed');
  const pending=action({...down,owner:o});active.set(e.pointerId,{owner:o,el,pending});pending.catch(e=>{message(e.message);stop(e.pointerId);});
 };
 el.onpointerup=el.onpointercancel=el.onlostpointercapture=e=>stop(e.pointerId);
 el.onclick=e=>{if(e.detail===0&&!navigating&&!switching&&!executionBusy)action({...tap,owner:owner()}).catch(e=>message(e.message));};
}
const keyboardRows=[
 ['ESC','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'],
 ['1','2','3','4','5','6','7','8','9','0','BACKSPACE'],
 ['TAB','Q','W','E','R','T','Y','U','I','O','P'],
 ['A','S','D','F','G','H','J','K','L','ENTER'],
 ['SHIFT','Z','X','C','V','B','N','M','DELETE','UP'],
 ['CTRL','ALT','WIN','SPACE','LEFT','DOWN','RIGHT']
];
const keyLabels={ESC:'Esc',TAB:'Tab',BACKSPACE:'⌫',ENTER:'Enter',SHIFT:'Shift',DELETE:'Del',CTRL:'Ctrl',ALT:'Alt',WIN:'Win',SPACE:'Space',LEFT:'←',RIGHT:'→',UP:'↑',DOWN:'↓'};
for(const keys of keyboardRows){
 const row=document.createElement('div');row.className='keyboard-row';if(keys.includes('SHIFT')||keys.includes('SPACE'))row.classList.add('bottom-keys');
 for(const key of keys){const el=document.createElement('button');el.className='key keyboard-key';if(['CTRL','SHIFT','ALT','WIN'].includes(key))el.classList.add('modifier-key');else if(key.length>1)el.classList.add('function-key');el.textContent=keyLabels[key]||key;el.setAttribute('aria-label',key);if(key==='SPACE')el.style.flex='3';if(['ENTER','BACKSPACE','TAB'].includes(key))el.style.flex='1.5';if(key==='UP'){el.style.gridColumn='11';}if(key==='SPACE'){el.style.gridColumn='4 / 10';}if(['LEFT','DOWN','RIGHT'].includes(key))el.style.gridColumn=String(10+['LEFT','DOWN','RIGHT'].indexOf(key));bindKey(el,{action:'key_down',key},{action:'key_tap',key});row.append(el);}
 $('keyboardPanel').append(row);
}
const keyboardBack=document.createElement('button');keyboardBack.className='keyboard-back';keyboardBack.textContent='配置へ戻る';keyboardBack.onclick=()=>setMode('deck');$('keyboardPanel').append(keyboardBack);
// Label keys from the connected PC, never from the phone's operating system.
api('keys').then(catalog=>{for(const key of ['WIN','ALT']){const label=catalog.find(item=>item.key===key)?.label;if(label)for(const button of $('keyboardPanel').querySelectorAll('button'))if(button.getAttribute('aria-label')===key){button.textContent=label;button.setAttribute('aria-label',label);}}}).catch(()=>{});
async function setMode(next){
 if(switching||next===mode)return;switching=true;
 try{await stopAll();mode=next;for(const [id,value] of [['deck','deck'],['keyboardPanel','keyboard'],['padPanel','pad']])$(id).hidden=mode!==value;
 for(const [id,value] of [['deckMode','deck'],['keyboardMode','keyboard'],['padMode','pad']])$(id).setAttribute('aria-pressed',String(mode===value));
 $('deckMode').textContent=mode==='deck'?'配置':'← 配置';if(mode==='deck')resizeDeck();
 }finally{switching=false;}
}
$('deckMode').onclick=async()=>{if(mode!=='deck'){await setMode('deck');return;}if(!deckConfig)return;await stopAll();const id=await choiceDialog('配置を選択',deckConfig.layouts.map(l=>({value:l.id,label:l.name})));if(id)await selectDeck(id);};$('keyboardMode').onclick=()=>setMode('keyboard');$('padMode').onclick=()=>setMode('pad');
function attachPad(pad,inMode,compact=false,wheel=false){
 const enabled=()=>inMode()&&!switching&&!navigating&&!executionBusy&&!document.hidden;
 const controller=new (wheel?WheelController:PadController)({send:action,owner,enabled,
  onError:e=>message(e.message),onState:state=>{
   pad.classList.toggle('tracking',state==='move'||state==='scroll');pad.classList.toggle('dragging',state==='drag');
   pad.querySelector('span').textContent=wheel?'↕ ↔ 1本指でスクロール':state==='drag'?'ドラッグ中 · 離すと解除':state==='scroll'?'2本指でスクロール':compact?'タップでクリック · 2本指スクロール':'1本指で移動 · タップでクリック\n2本指でスクロール\nタップ→2回目を押したままドラッグ';
  }
 });
 pad.setAttribute('aria-label',wheel?pad.title+'。マウスホイール。1本指で縦横スクロール':(compact?pad.title+'。':'')+'タッチパッド。1本指で移動、タップでクリック、2本指でスクロール、ダブルタップ保持でドラッグ');
 pad.oncontextmenu=e=>e.preventDefault();
 pad.onpointerdown=e=>{if(!enabled()||e.button!==0)return;e.preventDefault();pad.setPointerCapture(e.pointerId);controller.down(e.pointerId,e.clientX,e.clientY);};
 pad.onpointermove=e=>{if(controller.points.has(e.pointerId)){e.preventDefault();controller.move(e.pointerId,e.clientX,e.clientY);}};
 pad.onpointerup=e=>{e.preventDefault();controller.up(e.pointerId);};
 pad.onpointercancel=()=>controller.cancel();pad.onlostpointercapture=e=>{if(controller.points.has(e.pointerId))controller.cancel();};
 pad.onkeydown=e=>{if(wheel)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)controller.click();}};
 pad.onclick=e=>{if(wheel)return;if(e.detail===0)controller.click();};
 padControllers.add(controller);controller.state();return controller;
}
const padController=attachPad($('touchpad'),()=>mode==='pad');
$('padClick').onclick=()=>padController.click();
setInterval(()=>{for(const p of padControllers)p.heartbeat();},500);

async function selectDeck(id){if(!deckConfig?.layouts.some(l=>l.id===id))return;await stopAll();selectedDeck=id;await setMode('deck');render(deckConfig);}
async function executeButton(b){
 if(executionBusy||navigating||switching||active.size||[...padControllers].some(p=>p.points.size||p.dragOwner)){message('保持しているキーとパッドを離してから実行してください');return;}
 executionOwner=owner();executionBusy=true;updateExecution({state:'running',label:b.label,index:0,total:b.steps?.length||1});
 const thisOwner=executionOwner;
 executionPending=action({action:'execute',id:b.id,owner:thisOwner});
 try{await executionPending;}catch(e){if(executionOwner===thisOwner){executionOwner=null;executionBusy=false;$('sequenceBar').hidden=true;}message(e.message);}
 finally{executionPending=null;pollSequence();}
}
async function cancelSequence(){
 if(!executionBusy&&!executionOwner)return;
 const pending=executionPending,cancelledOwner=executionOwner;executionOwner=null;
 try{if(pending)await pending;await action({action:'macro_cancel',owner:owner(),targetOwner:cancelledOwner});}catch(e){message(e.message+' 通信断では約2秒で自動停止します');}
}
function updateExecution(s){
 executionBusy=s.state==='running';$('sequenceBar').hidden=!executionBusy;
 $('sequenceText').textContent=(s.label||'連続操作')+' '+(s.index||0)+' / '+(s.total||0);
 if(!executionBusy){executionOwner=null;if(s.id&&s.id!==lastSequenceId){lastSequenceId=s.id;if(s.state==='error')message(s.error);else if(s.state==='cancelled')message('連続操作を停止しました');else if(s.state==='done')message('操作の送信を完了しました');}}
}
async function pollSequence(){
 if(sequencePolling||document.hidden||executionPending)return;sequencePolling=true;
 try{const s=await api('sequence');updateExecution(s);}catch(e){if(executionBusy)message(e.message);}finally{sequencePolling=false;}
}
const sequenceBar=document.createElement('div');sequenceBar.id='sequenceBar';sequenceBar.className='sequence-bar';sequenceBar.hidden=true;
const sequenceText=document.createElement('span');sequenceText.id='sequenceText';const sequenceStop=document.createElement('button');sequenceStop.textContent='停止';sequenceStop.onclick=cancelSequence;sequenceBar.append(sequenceText,sequenceStop);document.querySelector('.shell').append(sequenceBar);
setInterval(()=>{if(executionOwner&&!document.hidden)action({action:'heartbeat',owner:executionOwner}).catch(()=>{});pollSequence();},500);
