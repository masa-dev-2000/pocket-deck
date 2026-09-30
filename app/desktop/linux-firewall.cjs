'use strict';
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const execute=promisify(execFile);
const BACKEND='/opt/Pocket Deck/resources/backend/PocketDeckServer';
async function configure(operation,network,run=execute){
 if(!['inspect','allow','remove'].includes(operation))throw Error('接続診断の操作が不正です。');
 const args=[BACKEND,'--firewall-helper',operation];
 if(operation!=='inspect'){
  if(!network||!/^[-A-Za-z0-9_.:]{1,32}$/.test(network.interface)||!/^\d{1,3}(\.\d{1,3}){3}$/.test(network.address)||!/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(network.network))throw Error('対象LANを確認してください。');
  args.push('--interface',network.interface,'--address',network.address,'--network',network.network);
 }
 let result;
 try{result=await run('/usr/bin/pkexec',args,{timeout:120000,maxBuffer:262144,env:{PATH:'/usr/sbin:/usr/bin:/sbin:/bin'}});}
 catch(error){let detail;try{detail=JSON.parse(error.stdout).error;}catch{}throw Error(detail||'OSの確認が取り消されたか、設定できませんでした。変更結果を再確認してください。');}
 const value=JSON.parse(result.stdout);if(value.error)throw Error(value.error);return value;
}
module.exports={configure,BACKEND};
