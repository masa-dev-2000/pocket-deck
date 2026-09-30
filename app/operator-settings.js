let inputCapabilities=null,inputChecking=false;
let sensitivity=sensitivityValues(null);
try{sensitivity=sensitivityValues(JSON.parse(localStorage.getItem('deck-sensitivity-v1')));}catch{}
function inputActionAllowed(data){
 if(['up','mouse_up','release_all','heartbeat','macro_cancel'].includes(data.action))return true;
 const required=data.action.startsWith('mouse_')?['pointer']:data.action.startsWith('key_')?['keyboard']:inputRequirements(deckConfig?.layouts.flatMap(l=>l.buttons).find(b=>b.id===data.id));
 return inputAllowed(inputCapabilities,required);
}
function paintInputPermission(){
 const notice=$('inputNotice'),status=inputCapabilities;
 notice.hidden=!!status&&status.keyboard&&status.pointer&&status.text;
 $('inputNoticeText').textContent=!status?'PCの入力許可を確認しています…':status.reason||(status.state==='unsupported'?'このPCの入力方式には対応していません。配置編集は利用できます。':'PC側Pocket Deckで「入力を許可」を押してください。利用できない操作は無効になっています。');
 document.querySelectorAll('.keyboard-key').forEach(el=>el.disabled=!inputAllowed(status,['keyboard']));
 for(const b of deckConfig?.layouts.flatMap(l=>l.buttons)||[]){const el=document.querySelector('[data-button-id="'+b.id+'"]');if(el)el.disabled=!inputAllowed(status,inputRequirements(b));}
 $('padClick').disabled=!inputAllowed(status,['pointer']);
}
async function refreshInputPermission(){
 if(inputChecking||document.hidden)return;inputChecking=true;
 try{
  const next=await api('input-status');
  const lost=inputCapabilities&&['keyboard','pointer','text'].some(k=>inputCapabilities[k]&&!next[k]);
  inputCapabilities=next;if(lost)await stopAll();
 }catch(e){inputCapabilities=null;await stopAll();message(e.message);}finally{inputChecking=false;paintInputPermission();}
}
function setupOperatorSettings(){
 const notice=document.createElement('section');notice.id='inputNotice';notice.className='input-notice';notice.setAttribute('role','status');
 const text=document.createElement('p');text.id='inputNoticeText';const edit=document.createElement('a');edit.className='button';edit.href='/editor';edit.textContent='配置を編集';edit.dataset.navigation='';notice.append(text,edit);document.querySelector('.control-bar').after(notice);
 const opener=document.createElement('button');opener.textContent='操作感';document.querySelector('#menuDialog .menu-links').append(opener);
 const dialog=document.createElement('dialog');dialog.className='sheet sensitivity-sheet';dialog.setAttribute('aria-label','操作感');
 const title=document.createElement('h2');title.textContent='操作感';dialog.append(title);
 for(const [key,label] of [['cursor','カーソル移動'],['scroll','スクロール']]){
  const section=document.createElement('label');section.textContent=label;const output=document.createElement('output');const slider=document.createElement('input');slider.type='range';slider.min='.25';slider.max='3';slider.step='.05';slider.setAttribute('aria-label',label);slider.value=sensitivity[key];output.textContent=sensitivity[key]+'倍';
  slider.oninput=async()=>{await stopAll();sensitivity[key]=Number(slider.value);output.textContent=sensitivity[key]+'倍';try{localStorage.setItem('deck-sensitivity-v1',JSON.stringify(sensitivity));hint.textContent='このスマホのブラウザーに自動保存します。';}catch{hint.textContent='保存できません。このタブを開いている間だけ有効です。';}};
  section.append(output,slider);dialog.append(section);
 }
 const hint=document.createElement('p');hint.className='small';hint.textContent='専用パッド・配置内パッド・ホイールに共通です。このスマホのブラウザーに自動保存します。';dialog.append(hint);
 const footer=document.createElement('div');footer.className='toolbar';const reset=document.createElement('button');reset.textContent='既定値に戻す';reset.onclick=async()=>{await stopAll();sensitivity=sensitivityValues(null);for(const slider of dialog.querySelectorAll('input')){slider.value='1';slider.previousElementSibling.textContent='1倍';}try{localStorage.setItem('deck-sensitivity-v1',JSON.stringify(sensitivity));}catch{hint.textContent='保存できません。このタブを開いている間だけ有効です。';}};
 const back=document.createElement('button');back.textContent='戻る';back.onclick=()=>dialog.close();footer.append(reset,back);dialog.append(footer);document.body.append(dialog);
 opener.onclick=async()=>{await stopAll();$('menuDialog').close();dialog.showModal();};
 paintInputPermission();refreshInputPermission();setInterval(refreshInputPermission,1500);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshInputPermission();});
}
