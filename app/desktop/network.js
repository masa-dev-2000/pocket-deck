let networkState=null,networkBusy=false,networkInspection=null;
function chosenNetwork(){return networkState?.networks.find(n=>n.address===document.getElementById('networkChoice').value);}
function managedNetwork(){return networkInspection?.managedRules?.[Number($('managedNetwork').value)];}
function paintNetwork(){
 const s=networkState;if(!s)return;
 const selected=chosenNetwork();
 if(view==='connect')$('workspace').hidden=s.networks.length>1&&!selected;
 const managed=$('managedNetwork'),oldManaged=managed.value;managed.replaceChildren();
 for(const [index,n] of (networkInspection?.managedRules||[]).entries()){const option=document.createElement('option');option.value=String(index);option.textContent=n.network+' · '+n.interface+' · '+n.address;managed.append(option);}if([...managed.options].some(o=>o.value===oldManaged))managed.value=oldManaged;managed.disabled=networkBusy||!managed.options.length;
 const lines=['サーバー: '+(state.ready?'起動中（スマホからの通信は未確認）':'未接続'),'入力: '+(state.input?.keyboard&&state.input?.pointer?'利用可能':state.input?.reason||'PCで入力許可を確認してください')];
 lines.push(!s.ufwInstalled?'UFW: 未導入':s.ufwEnabled===false?'UFW: 無効（変更しません）':networkInspection?'UFW: 詳細確認済み。ルール設定と通信到達は別々に確認してください。':'UFW: '+(s.ufwEnabled===true?'有効。許可ルールは未確認':'状態不明'));
 if(s.reason)lines.push(s.reason);
 if(!s.networks.length)lines.push('自動設定できるIPv4のLANがありません。IPv6・VPN・別のファイアウォールは手順を確認してください。');
 $('networkStatus').textContent=lines.join('\n');
 for(const id of ['networkInspect','networkAllow','networkRemove'])$(id).disabled=networkBusy||!s.canConfigure||(id!=='networkInspect'&&(!(id==='networkRemove'?managedNetwork():selected)||s.ufwEnabled===false));
 $('networkChoice').disabled=networkBusy;
 $('networkFallback').hidden=s.canConfigure;
 $('networkFallback').textContent=s.canConfigure?'':'アプリからの設定にはdeb版・UFW・pkexecが必要です。確認は sudo ufw status verbose。許可・解除の手順をUbuntuガイドで確認してください。';
 $('networkCommands').textContent=selected?'許可: sudo ufw allow in on '+selected.interface+' from '+selected.network+' to '+selected.address+' port 8765 proto tcp\n解除: sudo ufw delete allow in on '+selected.interface+' from '+selected.network+' to '+selected.address+' port 8765 proto tcp':'';
}
async function refreshNetwork(){
 if(networkBusy)return;
 try{
  networkState=await window.deckDesktop.networkStatus();$('networkTools').hidden=!networkState.supported;if(!networkState.supported)return;
  const choice=$('networkChoice');const previous=choice.value;choice.replaceChildren();
  const prompt=document.createElement('option');prompt.value='';prompt.textContent='接続するLANを選択';choice.append(prompt);
  for(const n of networkState.networks){const option=document.createElement('option');option.value=n.address;option.textContent=n.address+' · '+n.interface+' · '+n.network;choice.append(option);}
  choice.value=networkState.networks.some(n=>n.address===previous)?previous:networkState.selected?.address||'';
  if(!choice.value&&networkState.networks.length===1){choice.value=networkState.networks[0].address;await selectNetwork();}
  paintNetwork();
 }catch(e){$('networkStatus').textContent=e.message;}
}
async function selectNetwork(){
 const n=chosenNetwork();if(!n)return;
 try{await window.deckDesktop.networkSelect({interface:n.interface,address:n.address,network:n.network});networkInspection=null;if(view==='connect')$('workspace').src=routes.connect;paintNetwork();}catch(e){notify(e.message);}
}
async function configureNetwork(operation){
 const n=operation==='remove'?managedNetwork():chosenNetwork();
 if(operation!=='inspect'&&(!n||!confirm((operation==='allow'?'接続を許可しますか？':'Pocket Deckが追加した許可を解除しますか？')+'\nLAN: '+n.network+'\nインターフェース: '+n.interface+'\nPC: '+n.address+'\n8765/TCP\nOSの管理者認証へ進みます。')))return;
 networkBusy=true;paintNetwork();
 try{const result=await window.deckDesktop.firewall(operation,n);if(result.managedRules)networkInspection=result;notify(result.message||'UFWの状態を確認しました。');}
 catch(e){notify(e.message);}finally{networkBusy=false;await refreshNetwork();}
}
document.addEventListener('DOMContentLoaded',()=>{
 $('networkChoice').onchange=selectNetwork;$('managedNetwork').onchange=paintNetwork;$('networkRefresh').onclick=()=>{networkInspection=null;refreshNetwork();};
 for(const [id,op] of [['networkInspect','inspect'],['networkAllow','allow'],['networkRemove','remove']])$(id).onclick=()=>configureNetwork(op);
});
