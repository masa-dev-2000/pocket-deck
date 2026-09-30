// Shared v4 model helpers. Button IDs remain globally unique across layouts.
const newId=()=> 'b-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
function copyButton(layout,button){
 if(layout.buttons.length>=200)return null;
 const copy=structuredClone(button);copy.id=newId();copy.label=(copy.label+' コピー').slice(0,60);if(copy.type==='group')for(const item of copy.items)item.id=newId();
 const used=new Set(layout.buttons.flatMap(b=>buttonCells(layout,b)||[]));
 for(let slot=0;slot<layout.rows*layout.columns;slot++){
  copy.slot=slot;const cells=buttonCells(layout,copy);
  if(cells&&!cells.some(i=>used.has(i)))return copy;
 }
 return null;
}
function copyLayout(layout){const copy=structuredClone(layout);copy.id=newId();copy.name=(copy.name+' コピー').slice(0,60);for(const b of copy.buttons){b.id=newId();if(b.type==='navigate'&&b.target==='layout'&&b.layoutId===layout.id)b.layoutId=copy.id;if(b.type==='group')for(const item of b.items){item.id=newId();if(item.type==='navigate'&&item.layoutId===layout.id)item.layoutId=copy.id;}}return copy;}
function allButtons(layout){return layout.buttons.flatMap(b=>b.type==='group'?[b,...b.items]:[b]);}
function groupedButtons(layout,ids){
 const chosen=layout.buttons.filter(b=>ids.includes(b.id)).sort((a,b)=>a.slot-b.slot);
 if(chosen.length<2||chosen.some(b=>!['shortcut','text','macro','profile','navigate'].includes(b.type))||allButtons(layout).length>=200)return null;
 const next=structuredClone(layout),selected=new Set(chosen.map(b=>b.id));
 const items=chosen.map(b=>{const item=structuredClone(b);delete item.slot;delete item.width;delete item.height;return item;});
 const group={id:newId(),label:'まとめ',type:'group',slot:chosen[0].slot,width:1,height:1,color:'#294b68',items};
 next.buttons=next.buttons.filter(b=>!selected.has(b.id));next.buttons.push(group);return next;
}
function buttonSteps(b){
 if(b.type==='shortcut')return [{kind:'shortcut',keys:b.keys}];
 if(b.type==='text')return [{kind:'text',text:b.text,...(b.pasteMode?{pasteMode:b.pasteMode}:{})}];
 if(b.type==='profile')return [{kind:'profile',profileId:b.profileId}];
 return [];
}
function readPreference(key,fallback){try{return localStorage.getItem(key)||fallback;}catch{return fallback;}}
function writePreference(key,value){try{localStorage.setItem(key,value);}catch{}}
function make(tag,text='',className=''){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
function choiceDialog(title,choices){
 return new Promise(resolve=>{
  const dialog=make('dialog','','sheet choice-sheet'),head=make('div','','sheet-head'),body=make('div','','choice-list');
  head.append(make('h2',title));const cancel=make('button','戻る');cancel.type='button';head.append(cancel);const search=make('input');search.type='search';search.placeholder='検索';search.setAttribute('aria-label','候補を検索');dialog.append(head,search,body);search.oninput=()=>{const q=search.value.normalize('NFKC').toLowerCase();for(const b of body.children)b.hidden=!b.textContent.normalize('NFKC').toLowerCase().includes(q);};
  const close=value=>{dialog.close();dialog.remove();resolve(value);};cancel.onclick=()=>close(null);dialog.oncancel=e=>{e.preventDefault();close(null);};
  for(const c of choices){const b=make('button',c.label);b.type='button';b.disabled=!!c.disabled;b.onclick=()=>close(c.value);body.append(b);}
  document.body.append(dialog);dialog.showModal();
 });
}
function sameButtonForm(form,saved){
 if(!saved)return false;
 const project=b=>({id:b.id,label:b.label.trim(),type:b.type,color:b.color,width:b.width,height:b.height,
  appearance:{mode:b.appearance?.mode||'label',icon:b.appearance?.icon||'',asset:b.appearance?.asset||''},invertY:b.type==='wheel'?(b.invertY===true):undefined,
  keys:b.type==='shortcut'?b.keys:undefined,text:b.type==='text'?b.text:undefined,pasteMode:b.type==='text'?(b.pasteMode||'standard'):undefined,steps:b.type==='macro'?b.steps:undefined,
  profileId:b.type==='profile'?b.profileId:undefined,target:b.type==='navigate'?b.target:undefined,layoutId:b.type==='navigate'&&b.target==='layout'?b.layoutId:undefined,
  items:b.type==='group'?b.items:undefined});
 return JSON.stringify(project(form))===JSON.stringify(project(saved));
}
if(typeof module!=='undefined')module.exports={copyButton,copyLayout,allButtons,groupedButtons,buttonSteps,sameButtonForm};
