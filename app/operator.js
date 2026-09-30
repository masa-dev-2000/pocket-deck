const active=new Map(),releasing=new Set(),padControllers=new Set(),embeddedPads=new Set();
let sequence=0,navigating=false,configRevision=-1,polling=false,mode='deck',switching=false;
const client=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const owner=()=>client+'-'+(++sequence);
const action=data=>inputActionAllowed(data)?api('action',data,{keepalive:true}):Promise.reject(Error(inputCapabilities?.reason||'PC側Pocket Deckで入力を許可してください。'));
let deckConfig=null,selectedDeck=readPreference('deck-selected-layout','main'),executionOwner=null,executionPending=null,executionBusy=false,sequencePolling=false,lastSequenceId='';
function stop(pointer){
 const a=active.get(pointer);if(!a)return Promise.resolve();active.delete(pointer);a.el.classList.remove('pressed');
 const task=(async()=>{try{await a.pending;await action({action:'up',owner:a.owner});}catch(e){message(e.message+' 通信断では約2秒で自動解除します');}})();
 releasing.add(task);task.finally(()=>releasing.delete(task));return task;
}
async function stopAll(){closeGroup();const sequenceRelease=cancelSequence();const mouseRelease=Promise.all([...padControllers].map(p=>p.cancel()));for(const p of [...active.keys()])stop(p);await Promise.all([...releasing,mouseRelease,sequenceRelease]);}
function render(root){
 closeGroup();
 deckConfig=root;const config=root.layouts.find(l=>l.id===selectedDeck)||root.layouts[0];selectedDeck=config.id;writePreference('deck-selected-layout',selectedDeck);renderTabs();

 for(const p of embeddedPads){p.cancel();padControllers.delete(p);}embeddedPads.clear();
 $('deck').replaceChildren();$('deck').classList.toggle('keyboard-page',config.template==='keyboard');fitDeck(config);configRevision=root.revision;
 for(const b of config.buttons){
  const el=keyElement(b);el.dataset.buttonId=b.id;applyGridStyle(el,b,config.columns);
  el.oncontextmenu=e=>e.preventDefault();
  if(b.type==='wheel'){el.classList.add('embedded-pad','wheel-region');embeddedPads.add(attachPad(el,()=>true,true,true,b.invertY));}else if(b.type==='touchpad'){el.classList.add('embedded-pad');embeddedPads.add(attachPad(el,()=>true,true));}else if(b.type==='navigate'){el.onclick=()=>{if(!navigating&&!switching)selectDeck(b.layoutId);};}else if(b.type==='group'){el.onclick=()=>openGroup(b,el);}else if(b.type==='click'){el.onclick=()=>action({action:'mouse_click',dx:0,dy:0,owner:owner()}).catch(e=>message(e.message));}else if(b.type==='macro'||b.type==='profile'){el.onclick=()=>executeButton(b);}else if(b.type==='text'){
   el.onclick=()=>{if(navigating||switching||executionBusy)return;el.classList.add('pressed');action({action:'text',id:b.id,owner:owner()}).catch(e=>message(e.message)).finally(()=>el.classList.remove('pressed'));};
  }else{
   bindKey(el,{action:'down',id:b.id},{action:'tap',id:b.id});
  }
  $('deck').append(el);
 }
 paintInputPermission();if(!config.buttons.length)message('メニューの「配置を編集」から追加できます');
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
function renderTabs(){
 const strip=$('pageTabs');strip.replaceChildren();
 for(const page of deckConfig.layouts){
  const tab=document.createElement('button');tab.className='page-tab';tab.type='button';tab.textContent=page.name;
  tab.title=page.name;tab.setAttribute('aria-label',page.name);tab.setAttribute('aria-current',String(page.id===selectedDeck));
  tab.onclick=()=>selectDeck(page.id);strip.append(tab);
  if(page.id===selectedDeck)requestAnimationFrame(()=>{const x=tab.getBoundingClientRect().left-strip.getBoundingClientRect().left;strip.scrollTo({left:strip.scrollLeft+x-(strip.clientWidth-tab.clientWidth)/2,behavior:'smooth'});});
 }
}
let groupPopup=null;
function closeGroup(){
 if(!groupPopup)return;
 document.removeEventListener('pointerdown',groupPopup.outside,true);
 document.removeEventListener('keydown',groupPopup.escape);
 groupPopup.panel.remove();groupPopup=null;
}
function openGroup(group,anchor){
 if(navigating||switching||executionBusy)return;
 if(groupPopup?.id===group.id){closeGroup();return;}
 closeGroup();
 const panel=document.createElement('div');panel.className='group-popup';panel.setAttribute('role','menu');
 const heading=document.createElement('strong');heading.textContent=group.label;panel.append(heading);
 for(const item of group.items){
  const choice=document.createElement('button');choice.type='button';choice.className='group-choice';choice.textContent=item.label;
  choice.setAttribute('role','menuitem');choice.disabled=!inputAllowed(inputCapabilities,inputRequirements(item));
  choice.onclick=()=>{closeGroup();if(item.type==='navigate')selectDeck(item.layoutId);else if(item.type==='macro'||item.type==='profile')executeButton(item);else action({action:item.type==='text'?'text':'tap',id:item.id,owner:owner()}).catch(e=>message(e.message));};
  panel.append(choice);
 }
 document.body.append(panel);
 const rect=anchor.getBoundingClientRect(),width=Math.min(300,innerWidth-16),height=panel.getBoundingClientRect().height;
 panel.style.width=width+'px';panel.style.left=Math.max(8,Math.min(rect.left,innerWidth-width-8))+'px';
 panel.style.top=(innerHeight-rect.bottom>=Math.min(height,innerHeight*.55)+8?rect.bottom+4:Math.max(8,rect.top-Math.min(height,innerHeight*.55)-4))+'px';
 const outside=e=>{if(!panel.contains(e.target)&&!anchor.contains(e.target))closeGroup();};
 const escape=e=>{if(e.key==='Escape'){e.preventDefault();closeGroup();}};
 groupPopup={id:group.id,panel,outside,escape};
 document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape);
}
function attachPad(pad,inMode,compact=false,wheel=false,invertY=false){
 const enabled=()=>inputAllowed(inputCapabilities,['pointer'])&&inMode()&&!switching&&!navigating&&!executionBusy&&!document.hidden;
 const controller=new (wheel?WheelController:PadController)({send:action,owner,enabled,invertY,sensitivity:()=>sensitivity,
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
setInterval(()=>{for(const p of padControllers)p.heartbeat();},500);

async function selectDeck(id){if(!deckConfig?.layouts.some(l=>l.id===id)||id===selectedDeck)return;closeGroup();await stopAll();selectedDeck=id;render(deckConfig);}
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
setupOperatorSettings();
setInterval(()=>{if(executionOwner&&!document.hidden)action({action:'heartbeat',owner:executionOwner}).catch(()=>{});pollSequence();},500);
