let store,current=null,slot=0,timer,composing=false,moving=false,moveFrom=null,recoveryForm=null,gridTimer,allowUnload=false,undoLayout=null;
let openedForm=null;
let moveAxis='single',selectedButtons=new Set(),lineEdit=null,groupContext=null;
const recoveryKey='pocket-deck-v5-editor';
let selectedLayout=readPreference('deck-editor-layout','main');
function currentLayout(config=store.value){return config.layouts.find(l=>l.id===selectedLayout)||config.layouts[0];}
function replaceLayout(next){const index=store.value.layouts.findIndex(l=>l.id===currentLayout().id);store.value.layouts[index]=next;}

function persist(){
 if(!store)return;
 if(!$('form').hidden)recoveryForm=readForm();
 try{localStorage.setItem(recoveryKey,JSON.stringify({config:store.value,form:recoveryForm,layoutId:selectedLayout,groupId:groupContext}));}catch{message('端末への一時保存ができません。画面を閉じずに保存状態を確認してください。');}
}
function state(text){
 if(text==='保存済み'&&!$('form').hidden&&store){
  const form=readForm(),saved=groupContext?currentLayout(store.saved).buttons.find(b=>b.id===groupContext)?.items.find(b=>b.id===current):currentLayout(store.saved).buttons.find(b=>b.id===current);
  if(!sameButtonForm(form,groupContext&&saved?{...saved,slot:form.slot,width:form.width,height:form.height}:saved))text='入力途中';
 }
 $('saveState').textContent=text;persist();
}
function view(name){document.activeElement?.blur();document.body.dataset.view=name;for(const n of ['layoutView','form','pageView'])$(n).hidden=n!==name;window.dispatchEvent(new Event('deck:viewchange'));}
function render(){
 window.dispatchEvent(new Event('deck:viewchange'));
 selectedButtons.clear();
 $('moveTools').hidden=!moving||!!lineEdit;$('moveHint').hidden=!moving||!!lineEdit;
 if(!store)return;
 const config=lineEdit?.result?.layout||currentLayout();$('layouts').textContent=config.name;$('layouts').title='配置を管理';const occupied=new Set(config.buttons.flatMap(b=>buttonCells(config,b)||[]));fitDeck(config);$('deck').replaceChildren();$('columns').value=config.columns;$('rows').value=config.rows;
 for(let i=0;i<config.rows*config.columns;i++){
  const b=config.buttons.find(b=>b.slot===i);if(!b&&occupied.has(i))continue;const el=b?keyElement(b):document.createElement('button');applyGridStyle(el,b||{slot:i},config.columns);
  if(!b){el.className='key empty';el.textContent='＋';el.setAttribute('aria-label',`空き枠 ${i+1} に追加`);}
  el.dataset.slot=i;if(b)el.dataset.button=b.id;
  el.onclick=()=>{
   if(lineEdit)return;
   if(moving&&moveAxis!=='single'){if(b){selectedButtons.has(b.id)?selectedButtons.delete(b.id):selectedButtons.add(b.id);paintSelection();}return;}
   if(moving){if(moveFrom===null){if(b){moveFrom=i;el.classList.add('drop-target');message('移動先を選択してください');}}else{move(moveFrom,i);moveFrom=null;}return;}
   openButton(b,i);
  };$('deck').append(el);
 }
}
function selectedIds(){return [...selectedButtons];}
function paintSelection(){const ids=new Set(selectedIds());$('deck').querySelectorAll('[data-button]').forEach(el=>el.classList.toggle('group-selected',ids.has(el.dataset.button)));$('moveHint').textContent=ids.size?`${ids.size}個選択 · 長押しして移動`:'ボタンをタップして複数選択';}
$('moveTools').querySelectorAll('[data-axis]').forEach(b=>b.onclick=()=>{moveAxis=b.dataset.axis;selectedButtons.clear();moveFrom=null;$('moveTools').querySelectorAll('[data-axis]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));paintSelection();});
function commitPreview(next){rememberLayout();replaceLayout(next);selectedButtons.clear();render();persist();store.flush();paintSelection();message('配置を変更しました · 元に戻せます');}
function rememberLayout(){undoLayout=structuredClone(currentLayout());$('undoLayout').hidden=false;}
function move(from,to){const next=movedLayout(currentLayout(),from,to);if(next){rememberLayout();replaceLayout(next);render();persist();store.flush();}else if(from!==to)message('キーが収まりません。行・列を増やすかサイズを小さくしてください');}
$('undoLayout').onclick=()=>{if(!undoLayout||undoLayout.id!==currentLayout().id)return;replaceLayout(structuredClone(undoLayout));undoLayout=null;$('undoLayout').hidden=true;render();persist();store.flush();message('配置を元に戻しました');};
installReorder($('deck'),{move,armed:()=>moving,config:()=>store?currentLayout():null,ids:b=>lineEdit?[]:moving&&moveAxis!=='single'?selectedIds():[b.id],commit:commitPreview});
function readForm(){return {id:current,slot,label:$('label').value,type:$('type').value,keys:$('keys').value,text:$('text').value,color:$('color').value,width:Number($('width').value),height:Number($('height').value),...($('type').value==='navigate'?{target:$('target').value, ...($('target').value==='layout'?{layoutId:$('layoutTarget').value}:{})}:{}),...readExtraForm()};}
function showFields(){showExtraFields();$('targetField').hidden=$('type').value!=='navigate';$('textField').hidden=$('type').value!=='text';$('shortcutField').hidden=$('type').value!=='shortcut';}
function openButton(b,index,groupId=null){
 groupContext=groupId;
 if(!b&&!groupId&&allButtons(currentLayout()).length>=200){message('ボタンと候補は合わせて200個までです');return;}
 current=b?.id||('b-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));slot=index;
 $('label').value=b?.label||'';$('type').value=b?.type||'shortcut';$('type').disabled=b?.type==='group';for(const option of $('type').options)option.disabled=groupId?['touchpad','wheel','click','group'].includes(option.value):option.value==='click'&&b?.type!=='click';$('keys').value=b?.keys||'';$('text').value=b?.text||'';$('color').value=b?.color||'#294b68';
 for(const [id,max] of [['width',currentLayout().columns],['height',currentLayout().rows]]){$(id).replaceChildren();for(let i=1;i<=max;i++){const o=document.createElement('option');o.value=i;o.textContent=i;$(id).append(o);}$(id).value=b?.[id]||1;}$('target').value=b?.target||'layout';
 openExtras(b);
 $('delete').hidden=groupId?!currentLayout().buttons.find(x=>x.id===groupId)?.items.some(x=>x.id===current):!currentLayout().buttons.some(x=>x.id===current);$('formError').textContent='';updateKeySummary();showFields();openedForm=JSON.stringify(readForm());view('form');persist();
 if(b?.type==='macro')openMacroEditor();
}
function applyForm(){
 clearTimeout(timer);if(composing||$('form').hidden||!store)return false;
 const b=readForm();persist();
 if(!b.label.trim()||(b.type==='shortcut'?!b.keys:b.type==='text'?!b.text:false)){$('formError').textContent='名前と入力内容を設定してください';state('入力途中');return false;}
 if(b.type==='text'&&Array.from(b.text).length>1000){$('formError').textContent='文字列は1,000文字までです';state('入力を確認');return false;}
 b.label=b.label.trim();if(b.type!=='text')delete b.text;if(b.type!=='shortcut')delete b.keys;
 if(!validateExtraForm(b))return false;
 if(groupContext){
  if(!['shortcut','text','macro','profile','navigate'].includes(b.type)){$('formError').textContent='この操作はまとめボタンに入れられません';return false;}
  const group=currentLayout().buttons.find(x=>x.id===groupContext);if(!group){message('まとめボタンが見つかりません');return false;}
  delete b.slot;delete b.width;delete b.height;
  const index=group.items.findIndex(x=>x.id===current);if(index<0)group.items.push(b);else group.items[index]=b;
  $('delete').hidden=false;$('formError').textContent='';recoveryForm=null;persist();store.flush();return true;
 }
 const old=currentLayout().buttons.find(x=>x.id===current),next=placeButton(currentLayout(),b);
 if(!next){$('formError').textContent='キーが収まりません。行・列を増やすかサイズを小さくしてください';state('入力を確認');return false;}
 if(JSON.stringify(old)!==JSON.stringify(b)){undoLayout=null;$('undoLayout').hidden=true;}
 replaceLayout(next);
 $('delete').hidden=false;$('formError').textContent='';recoveryForm=null;persist();store.flush();return true;
}
$('form').onsubmit=e=>{e.preventDefault();applyForm();};
for(const id of ['label','text']){
 $(id).addEventListener('compositionstart',()=>{composing=true;clearTimeout(timer);});
 $(id).addEventListener('compositionend',()=>{composing=false;persist();timer=setTimeout(applyForm,600);});
 $(id).addEventListener('input',()=>{state('入力中');clearTimeout(timer);if(!composing)timer=setTimeout(applyForm,600);});
 $(id).addEventListener('blur',()=>{if(!composing)applyForm();});
}
$('type').addEventListener('change',()=>{if($('type').value==='group'&&!$('label').value.trim())$('label').value='まとめ';previewAppearance();});
for(const id of ['type','keys','color','width','height','target','invertY'])$(id).addEventListener('change',()=>{showFields();applyForm();});
function leaveButtonEditor(){
 if(groupContext){const group=currentLayout().buttons.find(b=>b.id===groupContext);if(group){openButton(group,group.slot);return;}}
 view('layoutView');render();
}
$('saveButton').onclick=async()=>{
 if(!applyForm())return;
 if(!(await store.flush())){message('保存できませんでした。入力は保持しています');return;}
 recoveryForm=null;leaveButtonEditor();persist();
};
$('cancel').onclick=async()=>{
 if(!applyForm()){
  if((imagePending||composing||JSON.stringify(readForm())!==openedForm)&&!(await showNotice('入力途中です。保存せずに戻りますか？',true)))return;
  clearTimeout(timer);recoveryForm=null;leaveButtonEditor();persist();return;
 }
 if(!(await store.flush())){
  if(!(await showNotice('保存できませんでした。入力を保持して戻りますか？',true)))return;
  recoveryForm=null;leaveButtonEditor();persist();return;
 }
 recoveryForm=null;leaveButtonEditor();persist();
};
$('delete').onclick=async()=>{if(await showNotice('このボタンを削除しますか？',true)){clearTimeout(timer);recoveryForm=null;undoLayout=null;$('undoLayout').hidden=true;if(groupContext){const group=currentLayout().buttons.find(b=>b.id===groupContext);group.items=group.items.filter(b=>b.id!==current);}else currentLayout().buttons=currentLayout().buttons.filter(b=>b.id!==current);leaveButtonEditor();persist();store.flush();}};
$('add').onclick=()=>{const used=new Set(currentLayout().buttons.flatMap(b=>buttonCells(currentLayout(),b)||[]));let i=0;while(used.has(i))i++;if(i>=currentLayout().columns*currentLayout().rows){message('空き枠がありません。「行・列」で枠を増やしてください');return;}openButton(null,i);};
$('move').onclick=()=>{moving=!moving;moveFrom=null;selectedButtons.clear();$('moveTools').hidden=!moving;$('moveHint').hidden=!moving;$('move').textContent=moving?'移動終了':'移動';render();paintSelection();message(moving?'個別または複数選択で移動できます':'長押しでも配置を移動できます');};
$('makeGroup').onclick=()=>{
 const next=groupedButtons(currentLayout(),selectedIds());if(!next){message('2個以上のショートカット・文字列・連続操作・プロフィール・画面切り替えを選択してください');return;}
 rememberLayout();replaceLayout(next);const group=next.buttons.at(-1);
 moving=false;selectedButtons.clear();$('move').textContent='移動';render();persist();store.flush();openButton(group,group.slot);
};
$('pageSettings').onclick=()=>{$('gridError').textContent='';view('pageView');};$('pageBack').onclick=()=>{clearTimeout(gridTimer);gridChange();if($('gridError').textContent)message($('gridError').textContent+' 行・列の変更は適用していません');view('layoutView');render();};
function gridChange(){
 const columns=Number($('columns').value),rows=Number($('rows').value);
 if(!Number.isInteger(columns)||columns<1||columns>12||!Number.isInteger(rows)||rows<1||rows>200){$('gridError').textContent='列は1〜12、行は1〜200です';return;}
 const resized=resizedGrid(currentLayout(),columns,rows);if(!resized){$('gridError').textContent='枠外になるボタンがあります。先に移動・削除してください';return;}
 $('gridError').textContent='';if(columns===currentLayout().columns&&rows===currentLayout().rows)return;undoLayout=null;$('undoLayout').hidden=true;replaceLayout(resized);persist();store.flush();
}
$('columns').onchange=$('rows').onchange=gridChange;
for(const id of ['columns','rows'])$(id).oninput=()=>{clearTimeout(gridTimer);gridTimer=setTimeout(gridChange,600);};
$('saveState').onclick=async()=>{
 if(store?.error?.status===409){
  if(await showNotice('端末に入力を保持しています。最新設定を読み込みますか？競合した内容は自動で上書きしません。',true)){allowUnload=true;location.reload();}
 }else if(store){
  let conflict=null;try{conflict=JSON.parse(localStorage.getItem(recoveryKey+'-conflict')||'null');}catch{}
  if(conflict){await showNotice('前回の入力：'+(conflict.form?[conflict.form]:conflict.config.layouts.flatMap(l=>l.buttons)).map(b=>b.label+'：'+(b.type==='text'?b.text:b.keys)).join(' ／ '));return;}
  applyForm();await store.flush();
 }
};
for(const link of document.querySelectorAll('a[data-navigation]'))link.addEventListener('click',async e=>{
 if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();applyForm();persist();
 if(store&&!(await store.flush())){message('保存できませんでした。入力は保持しています');return;}location.assign(link.href);
});
window.addEventListener('beforeunload',e=>{persist();if(store?.dirty&&!allowUnload){e.preventDefault();e.returnValue='';}});
api('config').then(async config=>{
 let recovery=null;
 try{
  recovery=JSON.parse(localStorage.getItem(recoveryKey)||localStorage.getItem('pocket-deck-v4-editor')||localStorage.getItem('pocket-deck-v3-editor')||'null');
  if(recovery?.config?.version===3){const old=recovery.config;recovery.config={version:4,revision:old.revision,layouts:[{id:'main',name:'メイン',columns:old.columns,rows:old.rows,buttons:old.buttons}]};recovery.layoutId='main';}
  if(recovery?.config?.version===4&&recovery.config.revision===config.revision){
   const known=new Set(recovery.config.layouts.map(l=>l.id)),templates=config.layouts.filter(l=>!known.has(l.id));
   const keyboard=templates.find(l=>l.name==='キー配列'),pad=templates.find(l=>l.name==='パッド');
   if(keyboard&&pad){for(const l of recovery.config.layouts)for(const b of allButtons(l))if(b.type==='navigate'&&['keyboard','pad'].includes(b.target)){b.layoutId=b.target==='keyboard'?keyboard.id:pad.id;b.target='layout';}recovery.config={...recovery.config,version:5,layouts:[...recovery.config.layouts,...templates]};}
  }
 }catch{}
 store=new AutoSave(config,data=>api('config',data),state);view('layoutView');render();
 if(recovery?.config){
  const sameRevision=recovery.config.revision===config.revision;
  const differs=JSON.stringify(recovery.config)!==JSON.stringify(config);
  const form=recovery.form;
  const savedButton=form&&config.layouts.flatMap(allButtons).find(b=>b.id===form.id);
  const incomplete=form&&!sameButtonForm(form,savedButton);
  if(differs||incomplete){
   if(sameRevision){
    if(await showNotice('この端末に前回の入力が残っています。復元しますか？',true)){
     store.value=recovery.config;selectedLayout=recovery.layoutId||'main';
     if(form){openButton(form,form.slot,recovery.groupId||null);openedForm=null;recoveryForm=form;}else render();
     if(store.dirty)await store.flush();
    }
   }else{
    try{localStorage.setItem(recoveryKey+'-conflict',JSON.stringify(recovery));}catch{}
    await showNotice('別の更新があります。最新設定を表示します。前回の入力は競合データとして端末に残しました。保存状態から内容を確認できます。');
   }
  }
 }
 state(store.error?'保存失敗':store.dirty?'未保存':'保存済み');
}).catch(e=>message(e.message));

function lineIdentity(){return JSON.stringify(currentLayout());}
function closeLineEdit(){lineEdit=null;$('lineTools').hidden=true;$('layoutActions').hidden=false;render();$('undoLayout').hidden=!undoLayout;}
function lineControls(){
 const e=lineEdit;if(!e)return;
 const row=e.axis==='row',adding=e.operation==='add',review=!!e.result;
 $('lineTools').hidden=false;$('layoutActions').hidden=true;$('undoLayout').hidden=true;
 $('lineHint').textContent=review?'変更後の配置を確認してください':e.index===null?`${row?'行':'列'}をタップして選択`:`${e.index+1}${row?'行':'列'}目を選択`;
 $('lineSides').hidden=!adding||review;
 $('lineBefore').textContent=row?'上に追加':'左に追加';$('lineAfter').textContent=row?'下に追加':'右に追加';
 $('lineBefore').setAttribute('aria-pressed',String(!e.after));$('lineAfter').setAttribute('aria-pressed',String(e.after));
 $('lineReview').hidden=review;$('lineReview').disabled=e.index===null;$('lineReselect').hidden=!review;$('lineApply').hidden=!review;$('lineApply').textContent=adding?'追加する':'削除する';
 $('lineEffects').replaceChildren();
 if(review){const summary=document.createElement('p');summary.textContent=`${row?'行':'列'}数 ${row?e.base.rows:e.base.columns} → ${row?e.result.layout.rows:e.result.layout.columns} · ${adding?'拡張':'縮小'} ${e.result.resized.length}個 · 削除 ${e.result.removed.length}個`;$('lineEffects').append(summary);
 for(const b of e.result.removed){const name=document.createElement('div');name.textContent='削除：'+b.label;$('lineEffects').append(name);}}
 const previous=$('deck').querySelector('.line-target');if(previous)previous.remove();
 if(!review&&e.index!==null){const marker=document.createElement('div');marker.className='line-target';marker.style.gridColumn=row?'1 / -1':String(e.index+1);marker.style.gridRow=row?String(e.index+1):'1 / -1';$('deck').append(marker);}
}
document.querySelectorAll('[data-line]').forEach(button=>button.onclick=()=>{
 clearTimeout(gridTimer);gridChange();if($('gridError').textContent)return;
 const [axis,operation]=button.dataset.line.split(':');const base=structuredClone(currentLayout()),count=axis==='row'?base.rows:base.columns;
 if(operation==='delete'&&count===1){message('最後の行・列は削除できません');return;}
 if(operation==='add'&&count===(axis==='row'?200:12)){message('行・列の上限に達しています');return;}
 moving=false;moveFrom=null;$('move').textContent='移動';lineEdit={axis,operation,base,signature:lineIdentity(),index:null,after:false,result:null};view('layoutView');render();lineControls();
});
$('deck').addEventListener('click',event=>{
 if(!lineEdit||lineEdit.result)return;
 const r=$('deck').getBoundingClientRect(),c=lineEdit.base,x=Math.floor((event.clientX-r.left)/r.width*c.columns),y=Math.floor((event.clientY-r.top)/r.height*c.rows);
 if(x<0||x>=c.columns||y<0||y>=c.rows)return;lineEdit.index=lineEdit.axis==='row'?y:x;lineControls();
});
$('lineBefore').onclick=()=>{lineEdit.after=false;lineControls();};$('lineAfter').onclick=()=>{lineEdit.after=true;lineControls();};
$('lineCancel').onclick=closeLineEdit;
$('lineReselect').onclick=()=>{lineEdit.result=null;render();lineControls();};
$('lineReview').onclick=()=>{
 const e=lineEdit;if(!e||e.index===null)return;
 if(lineIdentity()!==e.signature){closeLineEdit();message('配置が変わりました。位置を選び直してください');return;}
 e.result=editGridLine(e.base,e.axis,e.operation,e.index+(e.operation==='add'&&e.after?1:0));
 if(!e.result){message('この変更は適用できません');return;}render();lineControls();
};
$('lineApply').onclick=()=>{
 const e=lineEdit;if(!e?.result)return;
 if(lineIdentity()!==e.signature){closeLineEdit();message('配置が変わりました。位置を選び直してください');return;}
 rememberLayout();replaceLayout(e.result.layout);closeLineEdit();persist();store.flush();message('配置を変更しました · 元に戻せます');
};
window.addEventListener('orientationchange',()=>{if(lineEdit){lineEdit.result=null;render();lineControls();}});
