let appearance={},macroSteps=[],profiles=[],extraGeneration=0,imagePending=false;
function readExtraForm(){return {appearance:{...appearance,mode:$('appearanceMode').value},...($('type').value==='text'?{pasteMode:$('pasteMode').value}:{}),...($('type').value==='macro'?{steps:structuredClone(macroSteps)}:{}),...($('type').value==='profile'?{profileId:$('profileTarget').value}:{})};}
function showExtraFields(){
 $('macroField').hidden=$('type').value!=='macro';$('profileField').hidden=$('type').value!=='profile';
 $('layoutTargetField').hidden=$('type').value!=='navigate'||$('target').value!=='layout';
}
function openExtras(b){
 extraGeneration++;imagePending=false;appearance=structuredClone(b?.appearance||{mode:'label'});macroSteps=structuredClone(b?.steps||[]);
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
 else if(b.type==='navigate'&&b.target==='layout'&&!b.layoutId)error='移動先の配置を選択してください';
 else if(b.type==='macro'){
  if(!b.steps.length||b.steps.length>50)error='連続操作は1〜50手順です';
  const held=new Set();
  for(const s of b.steps){
   if(s.kind==='press')held.add(s.key);if(s.kind==='release')held.delete(s.key);
   if((s.kind==='shortcut'&&!s.keys)||(['press','release'].includes(s.kind)&&!s.key))error='各手順のキーを選択してください';
   if(s.kind==='text'&&(!s.text||Array.from(s.text).length>1000))error='各文字列は1〜1000文字です';
   if(s.kind==='wait'&&(!Number.isInteger(s.ms)||s.ms<0||s.ms>10000))error='待ち時間は0〜10000ミリ秒です';
   if(s.kind==='profile'&&!s.profileId)error='プロフィールを選択してください';
   if(['text','profile'].includes(s.kind)&&held.size)error='文字列・画面切り替えの前に保持キーを離してください';
  }
 }
 if(error){$('formError').textContent=error;state('入力途中');return false;}return true;
}
function previewAppearance(){const b={label:$('label').value||'プレビュー',color:$('color').value,type:$('type').value,appearance:{...appearance,mode:$('appearanceMode').value}};$('appearancePreview').replaceChildren(keyElement(b));}
function extrasChanged(){previewAppearance();applyForm();}
for(const id of ['appearanceMode','layoutTarget','profileTarget','pasteMode'])$(id).onchange=extrasChanged;
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
 if(!applyForm())return;const source=currentLayout().buttons.find(b=>b.id===current),copy=copyButton(currentLayout(),source);
 if(!copy){message('同じサイズで入る空き枠がありません。行・列を増やしてください');return;}
 currentLayout().buttons.push(copy);undoLayout=null;$('undoLayout').hidden=true;openButton(copy,copy.slot);persist();store.flush();
};

const stepLabels={shortcut:'ショートカット',text:'文字列',wait:'待ち時間',press:'キーを押す',release:'キーを離す',profile:'Chromeへ移動'};
function stepSummary(s){return stepLabels[s.kind]+'：'+(s.keys||s.key||s.text||(s.kind==='wait'?s.ms+' ms':profiles.find(p=>p.id===s.profileId)?.name||'プロフィールを選択'));}
function saveSteps(){persist();applyForm();}
function renderSteps(){
 const container=$('steps');container.replaceChildren();
 macroSteps.forEach((step,index)=>{
  const row=make('div','','step-row');row.dataset.index=index;
  const head=make('div','','step-head'),handle=make('button','↕');handle.type='button';handle.className='step-handle';handle.setAttribute('aria-label',`手順${index+1}を移動`);head.append(handle,make('b',`${index+1}. ${stepLabels[step.kind]}`));
  const edit=make('div','','step-content');
  if(['shortcut','press','release'].includes(step.kind)){
   const field=step.kind==='shortcut'?'keys':'key',button=make('button',step[field]||'キーを選択 ▾');button.type='button';
   button.onclick=()=>openKeyPicker(step[field]||'',value=>{step[field]=value;renderSteps();saveSteps();},step.kind!=='shortcut');edit.append(button);
  }else if(step.kind==='text'||step.kind==='wait'){
   const input=make(step.kind==='text'?'textarea':'input');input.setAttribute('aria-label',`手順${index+1}の${stepLabels[step.kind]}`);
   if(step.kind==='wait'){input.type='number';input.min=0;input.max=10000;input.step=100;input.value=step.ms;edit.append(input,make('small','ミリ秒（1000 = 1秒）'));}else{
    input.rows=2;input.value=step.text;input.maxLength=2000;edit.append(input);
    const paste=make('select');paste.setAttribute('aria-label',`手順${index+1}の貼り付け先`);
    for(const [value,label] of [['standard','通常の入力欄'],['terminal','Linuxの端末（Ctrl＋Shift＋V）']]){const option=make('option',label);option.value=value;paste.append(option);}
    paste.value=step.pasteMode||'standard';paste.onchange=()=>{step.pasteMode=paste.value;saveSteps();};edit.append(paste);
   }
   let composingStep=false;input.oncompositionstart=()=>{composingStep=true;clearTimeout(timer);};input.oncompositionend=()=>{composingStep=false;input.oninput();};
   input.oninput=()=>{step[step.kind==='wait'?'ms':'text']=step.kind==='wait'?Number(input.value):input.value;persist();state('入力中');clearTimeout(timer);if(!composingStep)timer=setTimeout(saveSteps,600);};input.onblur=()=>{if(!composingStep)saveSteps();};
  }else{
   const button=make('button',profiles.find(p=>p.id===step.profileId)?.name||'プロフィールを選択');button.type='button';button.onclick=async()=>{await loadProfiles();const id=await choiceDialog('Chromeプロフィール',profiles.map(p=>({value:p.id,label:p.name+(p.online?'':'（未接続）')})));if(id){step.profileId=id;renderSteps();saveSteps();}};edit.append(button);
  }
  const actions=make('div','','step-actions');
  for(const [label,fn] of [['↑',()=>moveStep(index,index-1)],['↓',()=>moveStep(index,index+1)],['複製',()=>{if(macroSteps.length>=50)return;macroSteps.splice(index+1,0,structuredClone(step));renderSteps();saveSteps();}],['削除',()=>{macroSteps.splice(index,1);renderSteps();saveSteps();}]]){
   const b=make('button',label);b.type='button';b.setAttribute('aria-label',`手順${index+1} ${label}`);b.onclick=fn;actions.append(b);
  }
  let pointer=null,destination=index;
  handle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();pointer=e.pointerId;handle.setPointerCapture(pointer);row.classList.add('step-dragging');};
  handle.onpointermove=e=>{if(e.pointerId!==pointer)return;e.preventDefault();const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.step-row');if(target){destination=Number(target.dataset.index);for(const r of container.children)r.classList.toggle('drop-target',r===target);}
   const bounds=container.getBoundingClientRect();if(e.clientY<bounds.top+30)container.scrollTop-=12;if(e.clientY>bounds.bottom-30)container.scrollTop+=12;};
  handle.onpointerup=e=>{if(e.pointerId!==pointer)return;pointer=null;moveStep(index,destination);};
  handle.onpointercancel=handle.onlostpointercapture=()=>{if(pointer!==null){pointer=null;renderSteps();}};
  row.append(head,edit,actions);container.append(row);
 });
}
function moveStep(from,to){if(to<0||to>=macroSteps.length||from===to){renderSteps();return;}macroSteps.splice(to,0,macroSteps.splice(from,1)[0]);renderSteps();saveSteps();}
$('stepAdd').onclick=async()=>{if(macroSteps.length>=50){message('手順は50個までです');return;}const kind=await choiceDialog('追加する手順',Object.entries(stepLabels).map(([value,label])=>({value,label})));if(!kind)return;macroSteps.push(kind==='wait'?{kind,ms:500}:kind==='text'?{kind,text:''}:kind==='shortcut'?{kind,keys:''}:kind==='profile'?{kind,profileId:''}:{kind,key:''});renderSteps();saveSteps();};
$('stepFrom').onclick=async()=>{if(macroSteps.length>=50)return;const choices=store.value.layouts.flatMap(l=>l.buttons.filter(b=>buttonSteps(b).length).map(b=>({value:b.id,label:l.name+' / '+b.label})));const id=await choiceDialog('ボタンの操作をコピー',choices);const b=store.value.layouts.flatMap(l=>l.buttons).find(b=>b.id===id);if(b){macroSteps.push(...buttonSteps(b));renderSteps();saveSteps();}};
$('stepTemplate').onclick=async()=>{
 const value=await choiceDialog('テンプレートを末尾に追加',[{value:'launch',label:'アプリ名で起動'},{value:'previous',label:'2つ前のウィンドウ'}]);if(!value)return;
 const steps=value==='launch'?[{kind:'shortcut',keys:'WIN'},{kind:'wait',ms:500},{kind:'text',text:'notepad'},{kind:'wait',ms:500},{kind:'shortcut',keys:'ENTER'}]:[{kind:'press',key:'ALT'},{kind:'shortcut',keys:'TAB'},{kind:'wait',ms:150},{kind:'shortcut',keys:'TAB'},{kind:'release',key:'ALT'}];
 if(macroSteps.length+steps.length>50){message('手順は50個までです');return;}macroSteps.push(...steps);renderSteps();saveSteps();
};

$('layouts').onclick=async()=>{
 const dialog=make('dialog','','sheet layout-manager'),head=make('div','','sheet-head'),body=make('div','','choice-list'),close=make('button','戻る');head.append(make('h2','配置を管理'),close);dialog.append(head,body);
 const done=()=>{dialog.close();dialog.remove();render();};close.onclick=done;dialog.oncancel=e=>{e.preventDefault();done();};
 const commit=()=>{undoLayout=null;$('undoLayout').hidden=true;persist();store.flush();};
 const select=id=>{selectedLayout=id;writePreference('deck-editor-layout',id);undoLayout=null;$('undoLayout').hidden=true;moving=false;moveFrom=null;$('move').textContent='移動';recoveryForm=null;done();};
 const draw=()=>{
  body.replaceChildren();
  for(const l of store.value.layouts){
   const row=make('div','','layout-item'),name=make('input');name.value=l.name;name.maxLength=60;name.setAttribute('aria-label','配置名 '+l.name);
   let nameTimer,ime=false;const save=()=>{clearTimeout(nameTimer);if(ime)return;if(name.value.trim()){l.name=name.value.trim();commit();}else{name.value=l.name;}};
   name.oncompositionstart=()=>{ime=true;clearTimeout(nameTimer);};name.oncompositionend=()=>{ime=false;name.oninput();};name.oninput=()=>{clearTimeout(nameTimer);if(!ime)nameTimer=setTimeout(save,600);};name.onblur=save;
   const actions=make('div','','inline-actions');for(const [label,fn] of [['開く',()=>{save();select(l.id);}],['複製',()=>{save();if(store.value.layouts.length>=20){message('配置は20個までです');return;}const copy=copyLayout(l);store.value.layouts.push(copy);commit();select(copy.id);}],['削除',async()=>{
    if(store.value.layouts.length===1){await showNotice('最後の配置は削除できません');return;}
    const refs=store.value.layouts.filter(x=>x.id!==l.id).flatMap(x=>x.buttons.filter(b=>b.type==='navigate'&&b.target==='layout'&&b.layoutId===l.id).map(b=>x.name+' / '+b.label));
    if(refs.length){await showNotice('先に移動先を変更してください：'+refs.join('、'));return;}
    if(await showNotice('「'+l.name+'」と、その配置内のボタンを削除しますか？',true)){store.value.layouts=store.value.layouts.filter(x=>x.id!==l.id);if(selectedLayout===l.id)selectedLayout=store.value.layouts[0].id;undoLayout=null;commit();draw();}
   }]]){const b=make('button',label);b.onclick=fn;actions.append(b);}row.append(name,actions);body.append(row);
  }
  const add=make('button','＋配置を追加');add.onclick=()=>{if(store.value.layouts.length>=20)return;const layout={id:newId(),name:'新しい配置',columns:4,rows:4,buttons:[]};store.value.layouts.push(layout);commit();select(layout.id);};body.append(add);
 };
 draw();document.body.append(dialog);dialog.showModal();
};
