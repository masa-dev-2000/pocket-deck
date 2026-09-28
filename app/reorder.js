function swapSlots(config,from,to){
 const a=config.buttons.find(b=>b.slot===from),b=config.buttons.find(b=>b.slot===to);
 if(!a||from===to)return false;
 a.slot=to;if(b)b.slot=from;return true;
}
function installReorder(deck,options){
 if(options.commit)return installPreviewReorder(deck,options);
 let drag=null,ignoreClick=false;
 function target(e){
  const c=options.config?.();if(c){const r=deck.getBoundingClientRect();if(e.clientX<r.left||e.clientX>=r.right||e.clientY<r.top||e.clientY>=r.bottom)return null;const col=Math.floor((e.clientX-r.left)/r.width*c.columns)-(drag?.offsetCol||0),row=Math.floor((e.clientY-r.top)/r.height*c.rows)-(drag?.offsetRow||0);return col<0||col>=c.columns||row<0||row>=c.rows?null:row*c.columns+col;}
  const node=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-slot]');return node&&deck.contains(node)?Number(node.dataset.slot):null;}
 function cleanup(){
  if(!drag)return;
  clearTimeout(drag.timer);drag.ghost?.remove();drag.overlay?.remove();
  deck.querySelectorAll('.drop-target,.drag-source').forEach(n=>n.classList.remove('drop-target','drag-source'));
  drag=null;
 }
 deck.addEventListener('contextmenu',e=>e.preventDefault());
 deck.addEventListener('pointerdown',e=>{
  const el=e.target.closest('[data-slot]');
  if(!el||!el.dataset.button||e.button!==0||drag)return;
  const d=drag={el,pointer:e.pointerId,x:e.clientX,y:e.clientY,from:Number(el.dataset.slot),to:null,started:false};
  const cfg=options.config?.();if(cfg){const r=deck.getBoundingClientRect();d.offsetCol=Math.floor((e.clientX-r.left)/r.width*cfg.columns)-d.from%cfg.columns;d.offsetRow=Math.floor((e.clientY-r.top)/r.height*cfg.rows)-Math.floor(d.from/cfg.columns);}
  const start=()=>{if(drag!==d)return;d.started=true;ignoreClick=true;el.setPointerCapture(e.pointerId);el.classList.add('drag-source');d.ghost=el.cloneNode(true);d.ghost.removeAttribute('id');d.ghost.classList.add('drag-ghost');d.ghost.setAttribute('aria-hidden','true');const r=el.getBoundingClientRect();Object.assign(d.ghost.style,{width:r.width+'px',height:r.height+'px',left:d.x-r.width/2+'px',top:d.y-r.height/2+'px'});document.body.append(d.ghost);};
  d.start=start;d.timer=setTimeout(start,400);
 });
 deck.addEventListener('pointermove',e=>{
  if(!drag||drag.pointer!==e.pointerId)return;
  if(!drag.started){if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>10){if(options.armed?.()){clearTimeout(drag.timer);drag.start();}else cleanup();}if(!drag?.started)return;}
  e.preventDefault();const r=drag.ghost.getBoundingClientRect();drag.ghost.style.left=e.clientX-r.width/2+'px';drag.ghost.style.top=e.clientY-r.height/2+'px';
  drag.to=target(e);deck.querySelectorAll('.drop-target').forEach(n=>n.classList.remove('drop-target'));
  const c=options.config?.();
  if(c){if(!drag.overlay){drag.overlay=document.createElement('div');drag.overlay.className='drop-footprint';deck.append(drag.overlay);}const b=c.buttons.find(b=>b.slot===drag.from);if(b&&drag.to!==null){const r=deck.getBoundingClientRect();Object.assign(drag.overlay.style,{display:'block',left:(drag.to%c.columns)*r.width/c.columns+'px',top:Math.floor(drag.to/c.columns)*r.height/c.rows+'px',width:b.width*r.width/c.columns+'px',height:b.height*r.height/c.rows+'px'});drag.overlay.classList.toggle('invalid',!movedLayout(c,drag.from,drag.to));}else drag.overlay.style.display='none';}
  if(drag.to!==null)deck.querySelector(`[data-slot="${drag.to}"]`)?.classList.add('drop-target');
 });
 deck.addEventListener('pointerup',e=>{
  if(!drag||drag.pointer!==e.pointerId)return;
  const d=drag,to=target(e);cleanup();
  if(d.started){e.preventDefault();if(to!==null)options.move(d.from,to);setTimeout(()=>ignoreClick=false,0);}
 });
 for(const event of ['pointercancel','lostpointercapture'])deck.addEventListener(event,()=>{cleanup();setTimeout(()=>ignoreClick=false,0);});
 deck.addEventListener('click',e=>{if(ignoreClick){e.preventDefault();e.stopImmediatePropagation();ignoreClick=false;}},true);
 for(const event of ['blur','deck:viewchange','orientationchange'])window.addEventListener(event,cleanup);
 return {cancel:cleanup};
}
if(typeof module!=='undefined')module.exports={swapSlots};

function installPreviewReorder(deck,options){
 let drag=null,suppress=false;
 const fingerprint=c=>JSON.stringify(c);
 function restore(){if(!drag)return;for(const el of deck.querySelectorAll('[data-button]')){const b=drag.base.buttons.find(b=>b.id===el.dataset.button);if(b)applyGridStyle(el,b,drag.base.columns);el.classList.remove('preview-shifted');el.classList.toggle('group-selected',drag.originalSelected.includes(el.dataset.button));}deck.querySelectorAll('.empty').forEach(el=>el.style.visibility='');deck.classList.remove('preview-active','preview-invalid');}
 function cancel(){if(!drag)return;clearTimeout(drag.timer);restore();drag=null;}
 function preview(e){
  if(!drag?.started)return;
  if(fingerprint(options.config())!==drag.signature){cancel();return;}
  const r=deck.getBoundingClientRect(),c=drag.base;
  const x=Math.floor((e.clientX-r.left)/r.width*c.columns),y=Math.floor((e.clientY-r.top)/r.height*c.rows);
  const inside=e.clientX>=r.left&&e.clientX<r.right&&e.clientY>=r.top&&e.clientY<r.bottom;
  const key=`${x},${y},${inside}`;if(key===drag.key)return;drag.key=key;
  drag.next=inside?groupedLayout(c,drag.ids,x-drag.x,y-drag.y):null;
  restore();deck.classList.add('preview-active');deck.classList.toggle('preview-invalid',!drag.next);
  if(!drag.next){message('ここには収まりません · 離すとキャンセル');return;}
  deck.querySelectorAll('.empty').forEach(el=>el.style.visibility='hidden');
  for(const el of deck.querySelectorAll('[data-button]')){const b=drag.next.buttons.find(b=>b.id===el.dataset.button),old=c.buttons.find(b=>b.id===el.dataset.button);applyGridStyle(el,b,c.columns);el.classList.toggle('group-selected',drag.ids.includes(b.id));el.classList.toggle('preview-shifted',!drag.ids.includes(b.id)&&b.slot!==old.slot);}
  message('移動後の配置 · 黄色の枠も移動します · 離して確定');
 }
 deck.addEventListener('contextmenu',e=>e.preventDefault());
 deck.addEventListener('pointerdown',e=>{
  if(drag||e.button!==0)return;const el=e.target.closest('[data-button]');if(!el)return;
  const base=structuredClone(options.config()),b=base.buttons.find(b=>b.id===el.dataset.button),ids=options.ids(b);
  if(!ids.includes(b.id))return;
  const r=deck.getBoundingClientRect();drag={base,signature:fingerprint(options.config()),ids,x:Math.floor((e.clientX-r.left)/r.width*base.columns),y:Math.floor((e.clientY-r.top)/r.height*base.rows),px:e.clientX,py:e.clientY,pointer:e.pointerId,originalSelected:[...deck.querySelectorAll('.group-selected')].map(el=>el.dataset.button),started:false,next:null};
  const d=drag;d.start=()=>{if(drag!==d)return;clearTimeout(d.timer);d.started=true;suppress=true;deck.setPointerCapture(e.pointerId);preview(e);};d.timer=setTimeout(d.start,400);
 });
 deck.addEventListener('pointermove',e=>{if(!drag||drag.pointer!==e.pointerId)return;if(!drag.started){if(Math.hypot(e.clientX-drag.px,e.clientY-drag.py)>10){if(options.armed?.())drag.start();else cancel();}if(!drag?.started)return;}e.preventDefault();preview(e);});
 deck.addEventListener('pointerup',e=>{if(!drag||drag.pointer!==e.pointerId)return;const d=drag;const r=deck.getBoundingClientRect();const valid=fingerprint(options.config())===d.signature&&e.clientX>=r.left&&e.clientX<r.right&&e.clientY>=r.top&&e.clientY<r.bottom;const next=d.next;cancel();if(d.started){e.preventDefault();if(valid&&next&&fingerprint(next)!==fingerprint(d.base))options.commit(next);setTimeout(()=>suppress=false,0);}});
 deck.addEventListener('click',e=>{if(suppress){e.preventDefault();e.stopImmediatePropagation();suppress=false;}},true);
 for(const name of ['pointercancel','lostpointercapture'])deck.addEventListener(name,()=>{cancel();setTimeout(()=>suppress=false,0);});
 for(const name of ['blur','deck:viewchange','orientationchange'])window.addEventListener(name,cancel);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
 return {cancel};
}
