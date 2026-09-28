const nameField=document.getElementById('name'),statusField=document.getElementById('status');
chrome.storage.local.get('name').then(data=>nameField.value=data.name||'');
async function refresh(){const state=await chrome.storage.session.get('bridgeStatus');statusField.textContent=state.bridgeStatus||'名前を登録してください';}
document.getElementById('save').onclick=async()=>{const result=await chrome.runtime.sendMessage({action:'configure',name:nameField.value});statusField.textContent=result.error||'接続を確認中…';};
chrome.storage.onChanged.addListener(refresh);refresh();
