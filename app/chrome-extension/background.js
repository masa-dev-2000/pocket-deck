let port=null,connecting=false,lastWindow=null,config=null;
const handled=new Map();
async function settings(){
 const stored=await chrome.storage.local.get(['id','name']);
 if(!stored.id){stored.id=crypto.randomUUID();await chrome.storage.local.set({id:stored.id});}
 return stored;
}
async function connect(){
 if(port||connecting)return;connecting=true;
 try{
  config=await settings();if(!config.name)return;
  const connection=chrome.runtime.connectNative('local.pocket_deck');port=connection;
  connection.onMessage.addListener(message=>{if(port!==connection)return;if(message.action==='focus')focus(message);else if(message.status)chrome.storage.session.set({bridgeStatus:message.status});});
  connection.onDisconnect.addListener(()=>{const error=chrome.runtime.lastError?.message||'未接続';if(port!==connection)return;port=null;chrome.storage.session.set({bridgeStatus:error});});
  connection.postMessage({action:'register',id:config.id,name:config.name});
 }catch(e){port=null;await chrome.storage.session.set({bridgeStatus:String(e)});}
 finally{connecting=false;}
}
async function focus(command){
 const now=Date.now();for(const [id,time] of handled)if(now-time>300000)handled.delete(id);
 if(handled.has(command.id))return;handled.set(command.id,now);
 const result={id:command.id,ok:false};
 try{
  if(!Number.isFinite(command.expires)||now/1000>command.expires)throw Error('切り替え要求の期限が切れました');
  const windows=(await chrome.windows.getAll({windowTypes:['normal']})).filter(w=>!w.incognito);
  if(!windows.length)throw Error('このプロフィールのウィンドウが開いていません');
  const previous=(await chrome.storage.session.get('lastWindow')).lastWindow;
  let target=windows.find(w=>w.id===(lastWindow||previous));
  if(!target){const recent=await chrome.windows.getLastFocused({windowTypes:['normal']});target=windows.find(w=>w.id===recent.id)||windows[0];}
  if(Date.now()/1000>command.expires)throw Error('切り替え要求の期限が切れました');
  if(target.state==='minimized')await chrome.windows.update(target.id,{state:'normal'});
  await chrome.windows.update(target.id,{focused:true});
  // Wayland activation is asynchronous: update() can return before the
  // compositor reports focus. Observe its result without re-sending activation.
  const until=Math.min(command.expires*1000,Date.now()+1200);
  let actual=await chrome.windows.get(target.id);
  while(!actual.focused&&Date.now()<until){
   await new Promise(resolve=>setTimeout(resolve,50));
   actual=await chrome.windows.get(target.id);
  }
  if(!actual.focused)throw Error('Chromeを前面に出せませんでした');
  result.ok=true;
 }catch(e){result.error=e.message;}
 try{port?.postMessage({action:'result',...result});}catch{}
}
chrome.windows.onFocusChanged.addListener(async id=>{
 if(id===chrome.windows.WINDOW_ID_NONE)return;
 try{const w=await chrome.windows.get(id);if(w.type==='normal'&&!w.incognito){lastWindow=id;await chrome.storage.session.set({lastWindow:id});}}catch{}
 connect();
});
chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(()=>{chrome.alarms.create('reconnect',{periodInMinutes:1});connect();});
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='reconnect')connect();});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(message.action!=='configure')return;
 (async()=>{const name=String(message.name||'').trim();if(!name||name.length>60)throw Error('名前は1〜60文字です');await chrome.storage.local.set({name});port?.disconnect();port=null;await connect();return {ok:true};})().then(respond,e=>respond({error:e.message}));return true;
});
connect();
