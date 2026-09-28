'use strict';
const {promisify}=require('node:util');
const {execFile,spawn}=require('node:child_process');
const fs=require('node:fs/promises');
const {compare}=require('./windows-install.cjs');
const execute=promisify(execFile);
const executable='/opt/Pocket Deck/pocket-deck-desktop';
async function inspect({executeImpl=execute,runningImpl=()=>require('./linux-install.cjs').running(require('./linux-install.cjs').locations().directory)}={}){
 let version;
 try{
  const {stdout}=await executeImpl('dpkg-query',['-W','-f=${db:Status-Status}\n${Version}','pocket-deck-desktop'],{timeout:10000});
  const [status,installedVersion]=stdout.trim().split('\n');
  if(status==='installed'){
   version=installedVersion;
   if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('既存のdeb版の版番号を確認できません。自動で置き換えません。');
  }else if(!['config-files','not-installed'].includes(status))throw Error('deb版の導入が未完了です。OSのパッケージ管理で状態を確認してください。');
 }catch(error){if(error.code!==1)throw error;}
 return {version,executable,running:await runningImpl()};
}
function open(file){return new Promise((resolve,reject)=>{
 const child=spawn(file,[],{detached:true,stdio:'ignore'});
 child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});
});}
function installPackage(file){return new Promise((resolve,reject)=>{
 const child=spawn('pkexec',['/usr/bin/apt-get','install','-y',file],{stdio:'inherit'});
 child.once('error',error=>reject(Error('OSのインストール確認を開始できません。pkexecを確認してください。'+error.message)));
 child.once('exit',code=>code===0?resolve():reject(Error('OSのインストール確認がキャンセルされたか、導入に失敗しました（コード '+code+'）。')));
});}
async function install({version,downloadImpl,inspectImpl=inspect,installImpl=installPackage,openImpl=open,uid=process.getuid?.(),log=console.log}){
 if(uid===0)throw Error('一般ユーザーで実行してください。npmの保存先に書き込めない場合はユーザー用prefixを設定してください。debの導入時だけOSが管理者の認証を行います。');
 let state=await inspectImpl();
 if(state.version&&compare(state.version,version)>=0){log('導入済みのPocket Deckを開きます。');await openImpl(state.executable);return;}
 if(state.running)throw Error('Pocket Deckを完全に終了してから更新してください。強制終了はしません。');
 const file=await downloadImpl();
 if(!file.endsWith('.deb'))throw Error('Ubuntu用のdebファイルが必要です。');
 state=await inspectImpl();
 if(state.version&&compare(state.version,version)>=0){await openImpl(state.executable);return;}
 if(state.running)throw Error('導入中にアプリが起動しました。終了して再実行してください。');
 log('Ubuntuの導入確認を開きます。OSの認証を完了してください。');
 await installImpl(file);
 state=await inspectImpl();
 if(!state.version||compare(state.version,version)<0)throw Error('deb版の導入完了を確認できません。アプリは起動しません。');
 // The package manager owns this executable, launcher and AppArmor profile.
 if(openImpl===open)await fs.access(state.executable);
 log('Pocket Deckの導入を確認しました。アプリを開きます。');
 await openImpl(state.executable);
}
module.exports={install,inspect,installPackage};
