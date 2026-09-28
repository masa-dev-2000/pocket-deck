const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const BASE='http://127.0.0.1:8765';
async function request(route,body){
 const response=await fetch(BASE+route,{signal:AbortSignal.timeout(1800),...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 if(!response.ok)throw new Error(`通信エラー (${response.status})`);return response.json();
}
function isConfig(c){return c?.version===4&&Array.isArray(c.layouts)&&c.layouts.every(l=>Array.isArray(l.buttons));}
class Backend{
 constructor(settings,{fetchConfig=()=>request('/api/config'),launch=spawn,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){Object.assign(this,{settings,fetchConfig,launch,wait});this.child=null;this.pending=null;this.error='';this.stopping=false;}
 async ensure(){
  if(this.pending)return this.pending;
  this.pending=this.start();try{return await this.pending;}finally{this.pending=null;}
 }
 async start(){
  let existing;try{existing=await this.fetchConfig();}catch(e){if(!e.cause?.code&&e.name!=='TimeoutError')throw e;}
  if(existing){if(!isConfig(existing))throw new Error('ポート8765で別のサービスが動いています。');return existing;}
  const {executable,dataDir}=this.settings;
  if(!fs.existsSync(executable))throw new Error('接続サーバーが見つかりません。アプリを再インストールしてください。');
  if(!this.child){
   this.error='';const child=this.launch(executable,['--data-dir',dataDir,'--managed-stdio'],{cwd:path.dirname(executable),windowsHide:true,stdio:['pipe','pipe','pipe']});this.child=child;
   child.stderr.on('data',b=>{this.error=(this.error+b.toString()).slice(-3000);});child.stdout.resume();
   child.on('error',e=>{this.error=e.message;});child.on('exit',()=>{if(this.child===child)this.child=null;});
  }
  for(let i=0;i<40;i++){
   await this.wait(250);if(this.stopping)throw new Error('終了中です');
   if(!this.child)throw new Error(this.error||'接続サーバーを起動できませんでした。');
   try{const c=await this.fetchConfig();if(isConfig(c))return c;}catch{}
  }
  if(this.child){this.child.kill();this.child=null;}throw new Error('起動が時間内に完了しませんでした。再試行してください。');
 }
 async stop(){this.stopping=true;if(this.pending)await this.pending.catch(()=>{});if(this.child){const child=this.child;await request('/api/action',{action:'release_all'}).catch(()=>{});child.stdin.on('error',()=>{});child.stdin.end('shutdown\n');await Promise.race([new Promise(r=>child.once('exit',r)),this.wait(3000)]);if(this.child===child){child.kill();this.child=null;}}}
}
module.exports={Backend,request,isConfig,BASE};
