'use strict';
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const fs=require('node:fs/promises'),path=require('node:path');
const execute=promisify(execFile);
function install(file){return new Promise((resolve,reject)=>{
 const child=spawn('pkexec',['/usr/bin/apt-get','install','-y',file],{stdio:'ignore'});
 child.once('error',reject);
 child.once('exit',code=>code===0?resolve():reject(Error('OSの更新確認がキャンセルされたか、導入に失敗しました（コード '+code+'）。')));
});}
async function apply({files,version,relaunch,installImpl=install,executeImpl=execute,accessImpl=fs.access,uid=process.getuid?.()}){
 if(uid===0)throw Error('Ubuntu版は通常ユーザーで起動してください。');
 if(!Array.isArray(files)||files.length!==1||typeof files[0]!=='string'||!path.isAbsolute(files[0])||!files[0].endsWith('.deb'))throw Error('検証済みのdeb更新ファイルを確認できません。');
 const {valid,compare}=require('semver');
 if(!valid(version))throw Error('更新の版番号を確認できません。');
 await accessImpl(files[0]);
 // A cancelled authorization must not run apt repair, retry, or relaunch.
 await installImpl(files[0]);
 const {stdout}=await executeImpl('dpkg-query',['-W','-f=${db:Status-Status}\n${Version}','pocket-deck-desktop'],{timeout:10000});
 const [status,installedVersion]=stdout.trim().split('\n');
 if(status!=='installed'||!valid(installedVersion)||compare(installedVersion,version)<0)throw Error('更新版の導入を確認できません。再起動しません。');
 await relaunch();
}
module.exports={apply,install};
