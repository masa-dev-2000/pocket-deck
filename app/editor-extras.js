let appearance={},macroSteps=[],groupItems=[],profiles=[],extraGeneration=0,imagePending=false,selectedStep=-1;
function buttonSensitivityForm(){
 const keys=$('type').value==='touchpad'?['cursor','scroll']:$('type').value==='wheel'?['scroll']:[];
 const values={};for(const key of keys)if($(key+'SensitivityMode').value==='custom')values[key]=Number($(key+'Sensitivity').value);
 return Object.keys(values).length?{sensitivity:values}:{};
}
function readExtraForm(){return {appearance:{...appearance,mode:$('appearanceMode').value},...($('type').value==='wheel'?{invertY:$('invertY').value==='true'}:{}),...buttonSensitivityForm(),...($('type').value==='text'?{pasteMode:$('pasteMode').value}:{}),...($('type').value==='macro'?{steps:structuredClone(macroSteps)}:{}),...($('type').value==='group'?{items:structuredClone(groupItems)}:{}),...($('type').value==='profile'?{profileId:$('profileTarget').value}:{})};}
function showExtraFields(){
 $('wheelField').hidden=$('type').value!=='wheel';
 $('sensitivityField').hidden=!['touchpad','wheel'].includes($('type').value);
 $('cursorSensitivityField').hidden=$('type').value!=='touchpad';
 $('macroField').hidden=$('type').value!=='macro';$('profileField').hidden=$('type').value!=='profile';
 $('groupField').hidden=$('type').value!=='group';
 $('layoutTargetField').hidden=$('type').value!=='navigate'||$('target').value!=='layout';
}
function openExtras(b){
 selectedStep=-1;
 $('invertY').value=String(b?.invertY===true);
 for(const key of ['cursor','scroll']){
  const value=b?.sensitivity?.[key];$(key+'SensitivityMode').value=value===undefined?'inherit':'custom';
  $(key+'Sensitivity').value=value??1;$(key+'Sensitivity').disabled=value===undefined;
  $(key+'SensitivityValue').textContent=value===undefined?'共通':$(key+'Sensitivity').value+'倍';
 }
 extraGeneration++;imagePending=false;appearance=structuredClone(b?.appearance||{mode:'label'});macroSteps=structuredClone(b?.steps||[]);groupItems=structuredClone(b?.items||[]);
 $('pasteMode').value=b?.pasteMode||'standard';
 $('appearanceMode').value=appearance.mode||'label';$('imageFile').value='';$('imageState').textContent='PNG・JPEG・WebP / 5MBまで';
 $('layoutTarget').replaceChildren();for(const l of store.value.layouts){const o=make('option',l.name);o.value=l.id;$('layoutTarget').append(o);}$('layoutTarget').value=b?.layoutId||currentLayout().id;
 fillProfiles(b?.profileId||'');loadProfiles(b?.profileId||'');renderSteps();previewAppearance();
 $('duplicate').hidden=!b;
}
function fillProfiles(selected=$('profileTarget').value){
 $('profileTarget').replaceChildren();const blank=make('option','選択してください');blank.value='';$('profileTarget').append(blank);
 for(const p of profiles){const o=make('option',p.name+(p.online?'':'（未接続）'));o.value=p.id;$('profileTarget').append(o);}
 if(selected&&!profiles.some(p=>p.id===selected)){const o=make('option','登録先（未接続）');o.value=selected;$('profileTarget').append(o);}
 $('profileTarget').value=selected;
}
async function loadProfiles(selected=$('profileTarget').value){const generation=extraGeneration;try{const next=await api('profiles');if(generation!==extraGeneration)return;profiles=next;fillProfiles(selected);}catch(e){message(e.message);}}
$('refreshProfiles').onclick=()=>loadProfiles();
function validateExtraForm(b){
 let error='';
 if(imagePending)error='画像を保存しています';
 else if(b.type==='profile'&&!b.profileId)error='Chromeプロフィールを選択してください';
 else if(b.type==='navigate'&&b.target!=='layout')error='移動先を選択してください';
 else if(b.type==='navigate'&&!b.layoutId)error='移動先の配置を選択してください';
 else if(b.type==='macro'){
  if(!b.steps.length||b.steps.length>50)error='連続操作は1〜50手順です';
  const held=new Set();
  for(const s of b.steps){
   if(s.kind==='press')held.add(s.key);if(s.kind==='release')held.delete(s.key);
   if((s.kind==='shortcut'&&!s.keys)||(['press','release'].includes(s.kind)&&!s.key))error='各手順のキーを選択してください';
   if(s.kind==='text'&&(!s.text||Array.from(s.text).length>1000))error='各文字列は1〜1000文字です';
   if(s.kind==='wait'&&(!Number.isInteger(s.ms)||s.ms<0||s.ms>10000))error='待ち時間は0〜10秒です';
   if(s.kind==='profile'&&!s.profileId)error='プロフィールを選択してください';
   if(['text','profile','click'].includes(s.kind)&&held.size)error='文字列・クリック・画面切り替えの前に保持キーを離してください';
  }
 }
 if(error){$('formError').textContent=error;state('入力途中');return false;}return true;
}
function previewAppearance(){const b={label:$('label').value||'プレビュー',color:$('color').value,type:$('type').value,appearance:{...appearance,mode:$('appearanceMode').value}};$('appearancePreview').replaceChildren(keyElement(b));}
function extrasChanged(){previewAppearance();applyForm();}
for(const id of ['appearanceMode','layoutTarget','profileTarget','pasteMode'])$(id).onchange=extrasChanged;
for(const key of ['cursor','scroll']){
 const mode=$(key+'SensitivityMode'),slider=$(key+'Sensitivity'),output=$(key+'SensitivityValue');
 mode.onchange=()=>{slider.disabled=mode.value!=='custom';output.textContent=slider.disabled?'共通':slider.value+'倍';extrasChanged();};
 slider.oninput=()=>{output.textContent=slider.value+'倍';};slider.onchange=extrasChanged;
}
$('color').addEventListener('change',previewAppearance);$('label').addEventListener('input',previewAppearance);
$('clearVisual').onclick=()=>{extraGeneration++;imagePending=false;appearance={mode:'label'};$('appearanceMode').value='label';$('imageState').textContent='画像・アイコンを解除しました';extrasChanged();};
const icons=[['📋','コピー クリップボード'],['📄','書類 新規'],['💾','保存'],['↶','元に戻す undo'],['↷','やり直す redo'],['🔍','検索'],['✂️','切り取り'],['📁','フォルダ'],['🏠','ホーム'],['⚙️','設定'],['▶️','再生'],['⏸️','停止 pause'],['🔊','音量'],['🔇','ミュート'],['🎤','マイク'],['🎵','音楽'],['🎬','動画'],['🖼️','画像'],['🎨','デザイン'],['🖱️','マウス パッド'],['⌨️','キーボード'],['🌐','ブラウザ'],['💼','仕事'],['👤','個人'],['✉️','メール'],['⭐','お気に入り'],['🚀','起動'],['🔁','連続操作'],['⬅️','左 戻る'],['➡️','右 進む'],['⬆️','上'],['⬇️','下']];
$('chooseIcon').onclick=async()=>{const generation=extraGeneration;const icon=await choiceDialog('アイコンを選択',icons.map(([value,label])=>({value,label:value+' '+label})));if(!icon||generation!==extraGeneration)return;appearance={mode:'both',icon};$('appearanceMode').value='both';extrasChanged();};
$('imageFile').onchange=async()=>{
 const file=$('imageFile').files[0];if(!file)return;
 if(file.size>5*1024*1024){$('imageState').textContent='画像は5MBまでです';return;}
 const generation=extraGeneration;imagePending=true;$('imageState').textContent='画像を保存中…';state('画像を保存中');
 try{
  const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});
  const result=await api('assets',{base64},{timeout:15000});if(generation!==extraGeneration)return;
  appearance={mode:'both',asset:result.asset};$('appearanceMode').value='both';$('imageState').textContent='画像を設定しました';
 }catch(e){if(generation===extraGeneration)$('imageState').textContent=e.message||'画像を読み込めませんでした';}
 finally{if(generation===extraGeneration){imagePending=false;extrasChanged();}}
};
$('duplicate').onclick=()=>{
 if(!applyForm())return;
 if(groupContext){const group=currentLayout().buttons.find(b=>b.id===groupContext),source=group.items.find(b=>b.id===current);if(allButtons(currentLayout()).length>=200){message('ボタンと候補は合わせて200個までです');return;}const copy=structuredClone(source);copy.id=newId();copy.label=(copy.label+' コピー').slice(0,60);group.items.push(copy);persist();store.flush();openButton(copy,group.slot,group.id);return;}
 const source=currentLayout().buttons.find(b=>b.id===current),copy=copyButton(currentLayout(),source);
 if(!copy){message('同じサイズで入る空き枠がありません。行・列を増やしてください');return;}
 currentLayout().buttons.push(copy);undoLayout=null;$('undoLayout').hidden=true;openButton(copy,copy.slot);persist();store.flush();
};

$('groupOpen').onclick=()=>{
 if(!applyForm())return;
 const id=current,dialog=make('dialog','','sheet group-manager'),head=make('div','','sheet-head'),body=make('div','','choice-list'),add=make('button','＋ 候補を追加'),close=make('button','戻る');
 head.append(make('h2','候補を管理'),close);dialog.append(head,body,add);
 const done=()=>{dialog.close();dialog.remove();const group=currentLayout().buttons.find(b=>b.id===id);if(group)openButton(group,group.slot);};
 close.onclick=done;dialog.oncancel=e=>{e.preventDefault();done();};
 add.type='button';add.onclick=()=>{const group=currentLayout().buttons.find(b=>b.id===id);if(allButtons(currentLayout()).length>=200){message('ボタンと候補は合わせて200個までです');return;}dialog.close();dialog.remove();openButton(null,group.slot,group.id);};
 const commit=()=>{groupItems=structuredClone(currentLayout().buttons.find(b=>b.id===id).items);persist();store.flush();};
 const draw=()=>{
  body.replaceChildren();const group=currentLayout().buttons.find(b=>b.id===id);if(!group)return;
  if(!group.items.length)body.append(make('p','候補はまだありません。「＋ 候補を追加」から登録できます。'));
  group.items.forEach((item,index)=>{
   const row=make('div','','layout-item');row.append(make('span',item.label));const actions=make('div','','inline-actions');
   for(const [label,fn] of [['編集',()=>{dialog.close();dialog.remove();openButton(item,group.slot,group.id);}],['↑',()=>{if(index){[group.items[index-1],group.items[index]]=[group.items[index],group.items[index-1]];commit();draw();}}],['↓',()=>{if(index<group.items.length-1){[group.items[index+1],group.items[index]]=[group.items[index],group.items[index+1]];commit();draw();}}],['取り出す',()=>{
    const used=new Set(currentLayout().buttons.flatMap(b=>buttonCells(currentLayout(),b)||[]));
    let slot=0;while(used.has(slot))slot++;
    if(slot>=currentLayout().columns*currentLayout().rows){message('空き枠がありません。行・列を増やしてください');return;}
    group.items.splice(index,1);currentLayout().buttons.push({...structuredClone(item),slot,width:1,height:1});
    commit();draw();
   }]]){const button=make('button',label);button.onclick=fn;actions.append(button);}row.append(actions);body.append(row);
  });
 };
 draw();document.body.append(dialog);dialog.showModal();
};

const stepLabels={shortcut:'ショートカット',text:'文字列',click:'左クリック',wait:'待ち時間',press:'キーを押す',release:'キーを離す',profile:'Chromeへ移動'};
function stepValue(s){if(s.kind==='click')return '現在のカーソル位置';if(s.kind==='wait')return Number.isFinite(s.ms)?(s.ms/1000)+'秒':'時間を入力';if(s.kind==='text')return s.text||'文字列を入力';if(s.kind==='profile')return profiles.find(p=>p.id===s.profileId)?.name||'プロフィールを選択';return s.keys||s.key||'キーを選択';}
function stepSummary(s){return stepLabels[s.kind]+'：'+stepValue(s);}
function saveSteps(){persist();applyForm();syncMacroState();}
function syncMacroState(){
 $('macroSaveState').textContent=$('saveState').textContent;
 $('macroError').textContent=$('formError').textContent;
 $('macroSummary').textContent=macroSteps.length?macroSteps.length+'手順 · '+macroSteps.map(stepSummary).join(' → '):'手順を追加してください';
}
new MutationObserver(syncMacroState).observe($('saveState'),{childList:true,subtree:true});
new MutationObserver(syncMacroState).observe($('formError'),{childList:true,subtree:true});
const macroWide=matchMedia('(min-width:760px)');
macroWide.addEventListener('change',()=>{if($('macroEditor').open){document.activeElement?.blur();renderSteps();}});
function openMacroEditor(){$('macroName').value=$('label').value;renderSteps();syncMacroState();$('macroEditor').showModal();}
$('macroOpen').onclick=openMacroEditor;
$('macroSettings').onclick=()=>{document.activeElement?.blur();saveSteps();$('macroEditor').close();};
function closeMacroEditor(){document.activeElement?.blur();saveSteps();$('macroEditor').close();view('layoutView');render();}
$('macroBack').onclick=closeMacroEditor;
$('macroEditor').oncancel=e=>{e.preventDefault();closeMacroEditor();};
for(const event of ['input','compositionstart','compositionend','blur'])$('macroName').addEventListener(event,()=>{
 $('label').value=$('macroName').value;$('label').dispatchEvent(new Event(event));
});
function renderSteps(){
 const container=$('steps'),scroll=container.scrollTop;container.replaceChildren();$('stepDetail').replaceChildren();
 if(selectedStep>=macroSteps.length)selectedStep=macroSteps.length-1;
 $('stepAdd').disabled=macroSteps.length>=50;
 if(!macroSteps.length)container.append(make('p','「＋ 手順」から操作を追加してください','macro-empty'));
 macroSteps.forEach((step,index)=>{
  const row=make('div','','step-row');row.dataset.index=index;
  const active=index===selectedStep;row.classList.toggle('selected',active);
  const head=make('div','','step-head'),handle=make('button','⠿');handle.type='button';handle.className='step-handle';handle.setAttribute('aria-label',`手順${index+1}を移動`);
  const select=make('button','','step-select');select.type='button';select.setAttribute('aria-expanded',String(active));select.setAttribute('aria-label',`手順${index+1} ${stepSummary(step)}を編集`);
  select.append(make('b',String(index+1),'step-number'),make('span',({shortcut:'⌨',text:'T',click:'🖱',wait:'◷',press:'↓',release:'↑',profile:'◎'})[step.kind],'step-icon'),make('span',stepLabels[step.kind],'step-kind'),make('span',stepValue(step),'step-value'));
  select.onclick=()=>{document.activeElement?.blur();selectedStep=active&&!macroWide.matches?-1:index;renderSteps();};
  const more=make('button','⋯','step-more');more.type='button';more.setAttribute('aria-label',`手順${index+1}の操作`);
  more.onclick=async()=>{
   document.activeElement?.blur();const value=await choiceDialog(`手順 ${index+1}`, [{value:'up',label:'上へ移動'},{value:'down',label:'下へ移動'},{value:'copy',label:'複製'},{value:'delete',label:'削除'}]);
   if(value==='up')moveStep(index,index-1);else if(value==='down')moveStep(index,index+1);
   else if(value==='copy'){if(macroSteps.length>=50){message('手順は50個までです');return;}macroSteps.splice(index+1,0,structuredClone(step));selectedStep=index+1;renderSteps();saveSteps();}
   else if(value==='delete'){macroSteps.splice(index,1);selectedStep=Math.min(index,macroSteps.length-1);renderSteps();saveSteps();}
  };
  head.append(handle,select,more);row.append(head);container.append(row);
  if(active){
  const edit=make('div','','step-content');edit.append(make('h3',`手順 ${index+1} — ${stepLabels[step.kind]}`));
  if(['shortcut','press','release'].includes(step.kind)){
   const field=step.kind==='shortcut'?'keys':'key',button=make('button',step[field]||'キーを選択 ▾');button.type='button';
   button.onclick=()=>openKeyPicker(step[field]||'',value=>{step[field]=value;renderSteps();saveSteps();},step.kind!=='shortcut');edit.append(button);
  }else if(step.kind==='text'||step.kind==='wait'){
   const input=make(step.kind==='text'?'textarea':'input');input.setAttribute('aria-label',`手順${index+1}の${stepLabels[step.kind]}`);
   if(step.kind==='wait'){
    input.type='number';input.min=0;input.max=10;input.step=.001;input.value=Number.isFinite(step.ms)?step.ms/1000:'';
    const field=make('div','','wait-input');field.append(input,make('span','秒'));edit.append(field);
    const presets=make('div','','wait-presets');for(const seconds of [.1,.5,1]){const preset=make('button',seconds+'秒');preset.type='button';preset.classList.toggle('chosen',step.ms===seconds*1000);preset.onclick=()=>{step.ms=seconds*1000;renderSteps();saveSteps();};presets.append(preset);}edit.append(presets,make('small','次の操作まで待ちます。0〜10秒で設定できます。'));
   }else{
    input.rows=2;input.value=step.text;input.maxLength=2000;edit.append(input);
    const paste=make('select');paste.setAttribute('aria-label',`手順${index+1}の貼り付け先`);
    for(const [value,label] of [['standard','通常の入力欄'],['terminal','Linuxの端末（Ctrl＋Shift＋V）']]){const option=make('option',label);option.value=value;paste.append(option);}
    paste.value=step.pasteMode||'standard';paste.onchange=()=>{step.pasteMode=paste.value;saveSteps();};edit.append(paste);
   }
   let composingStep=false;input.oncompositionstart=()=>{composingStep=true;clearTimeout(timer);};input.oncompositionend=()=>{composingStep=false;input.oninput();};
   input.oninput=()=>{step[step.kind==='wait'?'ms':'text']=step.kind==='wait'?(input.value.trim()?Math.round(Number(input.value)*1000):NaN):input.value;select.querySelector('.step-value').textContent=stepValue(step);select.setAttribute('aria-label',`手順${index+1} ${stepSummary(step)}を編集`);if(step.kind==='wait')edit.querySelectorAll('.wait-presets button').forEach(b=>b.classList.toggle('chosen',Number(b.textContent.replace('秒',''))*1000===step.ms));persist();state('入力中');clearTimeout(timer);if(!composingStep)timer=setTimeout(saveSteps,600);};input.onblur=()=>{if(!composingStep)saveSteps();};
  }else if(step.kind==='click'){
   edit.append(make('p','現在のカーソル位置で左クリックします。'));
  }else{
   const button=make('button',profiles.find(p=>p.id===step.profileId)?.name||'プロフィールを選択');button.type='button';button.onclick=async()=>{await loadProfiles();const id=await choiceDialog('Chromeプロフィール',profiles.map(p=>({value:p.id,label:p.name+(p.online?'':'（未接続）')})));if(id){step.profileId=id;renderSteps();saveSteps();}};edit.append(button);
  }
  (macroWide.matches?$('stepDetail'):row).append(edit);
  }
  let pointer=null,destination=index;
  handle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();pointer=e.pointerId;handle.setPointerCapture(pointer);row.classList.add('step-dragging');};
  handle.onpointermove=e=>{if(e.pointerId!==pointer)return;e.preventDefault();const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.step-row');if(target){destination=Number(target.dataset.index);for(const r of container.children)r.classList.toggle('drop-target',r===target);}
   const bounds=container.getBoundingClientRect();if(e.clientY<bounds.top+30)container.scrollTop-=12;if(e.clientY>bounds.bottom-30)container.scrollTop+=12;};
  handle.onpointerup=e=>{if(e.pointerId!==pointer)return;pointer=null;moveStep(index,destination);};
  handle.onpointercancel=handle.onlostpointercapture=()=>{if(pointer!==null){pointer=null;renderSteps();}};
 });
 if(macroWide.matches&&selectedStep<0)$('stepDetail').append(make('p','一覧から手順を選んで編集します','macro-empty'));
 container.scrollTop=scroll;syncMacroState();
}
function moveStep(from,to){if(to<0||to>=macroSteps.length||from===to){renderSteps();return;}macroSteps.splice(to,0,macroSteps.splice(from,1)[0]);selectedStep=to;renderSteps();saveSteps();}
$('stepAdd').onclick=async()=>{if(macroSteps.length>=50){message('手順は50個までです');return;}const kind=await choiceDialog('追加する手順',Object.entries(stepLabels).map(([value,label])=>({value,label})));if(!kind)return;macroSteps.push(kind==='wait'?{kind,ms:500}:kind==='text'?{kind,text:''}:kind==='click'?{kind}:kind==='shortcut'?{kind,keys:''}:kind==='profile'?{kind,profileId:''}:{kind,key:''});selectedStep=macroSteps.length-1;renderSteps();saveSteps();$('steps').lastElementChild?.scrollIntoView({block:'nearest'});};
$('stepFrom').onclick=async()=>{if(macroSteps.length>=50)return;const choices=store.value.layouts.flatMap(l=>allButtons(l).filter(b=>buttonSteps(b).length).map(b=>({value:b.id,label:l.name+' / '+b.label})));const id=await choiceDialog('ボタンの操作をコピー',choices);const b=store.value.layouts.flatMap(allButtons).find(b=>b.id===id);if(b){macroSteps.push(...buttonSteps(b));renderSteps();saveSteps();}};
$('stepTemplate').onclick=async()=>{
 const value=await choiceDialog('テンプレートを末尾に追加',[{value:'launch',label:'アプリ名で起動'},{value:'previous',label:'2つ前のウィンドウ'}]);if(!value)return;
 const steps=value==='launch'?[{kind:'shortcut',keys:'WIN'},{kind:'wait',ms:500},{kind:'text',text:'notepad'},{kind:'wait',ms:500},{kind:'shortcut',keys:'ENTER'}]:[{kind:'press',key:'ALT'},{kind:'shortcut',keys:'TAB'},{kind:'wait',ms:150},{kind:'shortcut',keys:'TAB'},{kind:'release',key:'ALT'}];
 if(macroSteps.length+steps.length>50){message('手順は50個までです');return;}macroSteps.push(...steps);renderSteps();saveSteps();
};

$('layouts').onclick=async()=>{
 const dialog=make('dialog','','sheet layout-manager'),head=make('div','','sheet-head'),body=make('div','','choice-list'),close=make('button','戻る');head.append(make('h2','ページを管理'),close);dialog.append(head,body);
 const done=()=>{dialog.close();dialog.remove();render();};close.onclick=done;dialog.oncancel=e=>{e.preventDefault();done();};
 const commit=()=>{undoLayout=null;$('undoLayout').hidden=true;persist();store.flush();};
 const select=id=>{selectedLayout=id;writePreference('deck-editor-layout',id);undoLayout=null;$('undoLayout').hidden=true;moving=false;moveFrom=null;$('move').textContent='移動';recoveryForm=null;done();};
 const draw=()=>{
  body.replaceChildren();
  for(const l of store.value.layouts){
   const row=make('div','','layout-item'),name=make('input');name.value=l.name;name.maxLength=60;name.setAttribute('aria-label','配置名 '+l.name);
   let nameTimer,ime=false;const save=()=>{clearTimeout(nameTimer);if(ime)return;if(name.value.trim()){l.name=name.value.trim();commit();}else{name.value=l.name;}};
   name.oncompositionstart=()=>{ime=true;clearTimeout(nameTimer);};name.oncompositionend=()=>{ime=false;name.oninput();};name.oninput=()=>{clearTimeout(nameTimer);if(!ime)nameTimer=setTimeout(save,600);};name.onblur=save;
   const actions=make('div','','inline-actions');for(const [label,fn] of [['開く',()=>{save();select(l.id);}],['↑',()=>{const i=store.value.layouts.indexOf(l);if(i>0){[store.value.layouts[i-1],store.value.layouts[i]]=[l,store.value.layouts[i-1]];commit();draw();}}],['↓',()=>{const i=store.value.layouts.indexOf(l);if(i<store.value.layouts.length-1){[store.value.layouts[i+1],store.value.layouts[i]]=[l,store.value.layouts[i+1]];commit();draw();}}],['複製',()=>{save();if(store.value.layouts.length>=22){message('ページは22個までです');return;}const copy=copyLayout(l);store.value.layouts.push(copy);commit();select(copy.id);}],['削除',async()=>{
    if(store.value.layouts.length===1){await showNotice('最後の配置は削除できません');return;}
    const refs=store.value.layouts.filter(x=>x.id!==l.id).flatMap(x=>allButtons(x).filter(b=>b.type==='navigate'&&b.target==='layout'&&b.layoutId===l.id).map(b=>x.name+' / '+b.label));
    if(refs.length){await showNotice('先に移動先を変更してください：'+refs.join('、'));return;}
    if(await showNotice('「'+l.name+'」と、その配置内のボタンを削除しますか？',true)){store.value.layouts=store.value.layouts.filter(x=>x.id!==l.id);if(selectedLayout===l.id)selectedLayout=store.value.layouts[0].id;undoLayout=null;commit();draw();}
   }]]){const b=make('button',label);b.onclick=fn;actions.append(b);}row.append(name,actions);body.append(row);
  }
  const add=make('button','＋空のページ');add.onclick=()=>{if(store.value.layouts.length>=22){message('ページは22個までです');return;}const layout={id:newId(),name:'新しいページ',columns:4,rows:4,buttons:[]};store.value.layouts.push(layout);commit();select(layout.id);};body.append(add);
  const template=make('button','＋テンプレートから追加');template.onclick=async()=>{if(store.value.layouts.length>=22){message('ページは22個までです');return;}const kind=await choiceDialog('ページのテンプレート',[{value:'keyboard',label:'キー配列'},{value:'pad',label:'パッド'}]);if(!kind)return;try{const pages=await api('templates');store.value.layouts.push(pages[kind]);commit();select(pages[kind].id);}catch(e){message(e.message);}};body.append(template);
 };
 draw();document.body.append(dialog);dialog.showModal();
};
