const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFile}=require('node:child_process');
const {linuxRegistration,prepareLauncher}=require('./linux-chrome.cjs');
const {macRegistration}=require('./mac-chrome.cjs');
const REGKEY='HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\local.pocket_deck';
const run=(exe,args)=>new Promise((resolve,reject)=>execFile(exe,args,{windowsHide:true,timeout:10000},(error,stdout)=>error?reject(error):resolve(stdout)));
const registry={async read(){try{const text=await run('reg.exe',['query',REGKEY,'/ve']);return text.match(/REG_SZ\s+(.+)/)?.[1].trim()||null;}catch(e){if(e.code===1)return null;throw e;}},async write(file){await run('reg.exe',['add',REGKEY,'/ve','/t','REG_SZ','/d',file,'/f']);}};
function extensionId(key){return [...crypto.createHash('sha256').update(Buffer.from(key,'base64')).digest().subarray(0,16)].map(n=>String.fromCharCode(97+(n>>4),97+(n&15))).join('');}
class ChromeSetup{
 constructor({userDir,extensionSource,launcher,legacyManifest,platform=process.platform},{registration}={}){Object.assign(this,{userDir,extensionSource,launcher,legacyManifest,platform});this.sourceLauncher=launcher;this.folder=path.join(userDir,'chrome-extension');this.dataDir=path.join(userDir,'data');this.manifest=path.join(userDir,'chrome-native-host.json');this.registration=registration||(platform==='linux'?linuxRegistration(this.manifest):platform==='darwin'?macRegistration(this.manifest):registry);if(platform==='linux'||platform==='darwin')this.launcher=path.join(userDir,'chrome-host');this.pending=null;}
 source(){const m=JSON.parse(fs.readFileSync(path.join(this.extensionSource,'manifest.json'),'utf8'));if(!m.key)throw Error('拡張ファイルが不完全です。アプリを再インストールしてください。');return {id:extensionId(m.key),version:m.version};}
 async status(){
  const source=this.source(),registered=await this.registration.read();let m=null,installed=null;
  try{m=JSON.parse(fs.readFileSync(this.manifest,'utf8'));}catch{}
  try{installed=JSON.parse(fs.readFileSync(path.join(this.folder,'manifest.json'),'utf8'));}catch{}
  const token=path.join(this.dataDir,'chrome-bridge.token');
  const files=['manifest.json','background.js','popup.html','popup.js'].every(name=>fs.existsSync(path.join(this.folder,name)));
  const prepared=registered===this.manifest&&m?.path===this.launcher&&m?.allowed_origins?.includes('chrome-extension://'+source.id+'/')&&fs.existsSync(this.launcher)&&fs.existsSync(token)&&files&&installed?.key&&extensionId(installed.key)===source.id&&installed.version===source.version;
  return {prepared:!!prepared,folder:this.folder,extensionId:source.id,issue:prepared?'':registered&&registered!==this.manifest?'旧ホストまたは別の登録が見つかりました。「連携を準備」で確認します。':'「連携を準備」を押してください。'};
 }
 async prepare(){if(this.pending)return this.pending;this.pending=this.install();try{return await this.pending;}finally{this.pending=null;}}
 async install(){
  const source=this.source();if(!fs.existsSync(this.platform==='linux'||this.platform==='darwin'?this.sourceLauncher:this.launcher))throw Error('連携ホストが見つかりません。アプリを再インストールしてください。');
  const old=await this.registration.read();
  if(old&&old!==this.manifest){
   if(!this.legacyManifest||path.resolve(old)!==path.resolve(this.legacyManifest))throw Error('別の連携ホストが登録されています。自動では上書きしません。');
   const legacy=JSON.parse(fs.readFileSync(old,'utf8'));if(legacy.name!=='local.pocket_deck'||path.basename(legacy.path)!=='chrome_launcher.exe')throw Error('旧ホストの内容を確認できません。');
  }
  fs.mkdirSync(this.dataDir,{recursive:true});
  if(this.platform==='linux'||this.platform==='darwin')this.launcher=prepareLauncher({userDir:this.userDir,source:this.sourceLauncher,dataDir:this.dataDir});
  if(old&&old!==this.manifest&&!fs.existsSync(path.join(this.userDir,'chrome-native-host.previous.json')))fs.copyFileSync(old,path.join(this.userDir,'chrome-native-host.previous.json'));
  fs.mkdirSync(this.folder,{recursive:true});
  for(const name of ['manifest.json','background.js','popup.html','popup.js'])fs.copyFileSync(path.join(this.extensionSource,name),path.join(this.folder,name));
  const token=path.join(this.dataDir,'chrome-bridge.token');if(!fs.existsSync(token))fs.writeFileSync(token,crypto.randomBytes(32).toString('hex'),{flag:'wx'});
  const manifest={name:'local.pocket_deck',description:'Pocket Deck profile bridge',path:this.launcher,type:'stdio',allowed_origins:['chrome-extension://'+source.id+'/']};
  fs.writeFileSync(this.manifest+'.tmp',JSON.stringify(manifest,null,2));fs.renameSync(this.manifest+'.tmp',this.manifest);await this.registration.write(this.manifest);
  return this.status();
 }
}
module.exports={ChromeSetup,extensionId};
