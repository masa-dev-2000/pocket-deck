api('connect').then(result => {
 $('connectUrl').textContent = result.url; $('connectUrl').href = result.url;
 $('connectQr').src = '/connect.svg'; $('connectQr').hidden = false; message('QRから操作画面を開けます。');
}).catch(e=>message(e.message+' 再読み込みしてください。'));
async function refreshConnectInput(){try{const s=await api('input-status');$('connectInputStatus').textContent=s.keyboard&&s.pointer?'PC入力を利用できます。':s.reason||'PCアプリで入力を許可してください。';}catch(e){$('connectInputStatus').textContent=e.message;}}
refreshConnectInput();setInterval(refreshConnectInput,2000);
$('connectQr').onerror=()=>{ $('connectQr').hidden=true;message('QRを表示できません。「URL」で接続先を確認してください。'); };
$('showQr').onclick=()=>{$('qrView').hidden=false;$('urlView').hidden=true;};
$('showUrl').onclick=()=>{$('qrView').hidden=true;$('urlView').hidden=false;};
$('connectHelp').onclick=()=>showNotice('スマホをPCと同じWi-Fiにつなぎ、カメラでQRを読み取ります。Safariなどの標準ブラウザで開いてください。接続できない場合はPC側の起動とファイアウォールの通信許可を確認してください。');
