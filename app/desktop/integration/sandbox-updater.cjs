// Copied to a temporary Electron test app inside Windows Sandbox.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {app}=require('electron');
const {autoUpdater}=require('C:/deck-test/app/desktop/node_modules/electron-updater');
const {Updates}=require('C:/deck-test/app/desktop/updates.cjs');
const fixture='C:/deck-test/app/desktop-test-dist';
const events=[];
function record(event){events.push(event);fs.writeFileSync('C:/deck-results/update-events.json',JSON.stringify(events));}
app.whenReady().then(async()=>{
 const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1);
  if(!['latest.yml','Pocket-Deck-Setup-1.0.5.exe','Pocket-Deck-Setup-1.0.5.exe.blockmap'].includes(name)){res.writeHead(404);res.end();return;}
  const file=path.join(fixture,name);res.setHeader('Content-Length',fs.statSync(file).size);fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(18765,'127.0.0.1',resolve));
 autoUpdater.forceDevUpdateConfig=true;
 autoUpdater.disableDifferentialDownload=true;
 autoUpdater.logger={info:record,warn:record,error:record,debug:()=>{}};
 const updates=new Updates({updater:autoUpdater,currentVersion:'1.0.4',packaged:true,
  ask:async()=>{record('consent');return true;},inform:async message=>{record(message);throw Error(message);},
  prepare:async()=>record('backend-stopped'),publish:state=>record(state.phase),log:record});
 await updates.check(true);
 if(events.includes('error')){app.exit(1);}
}).catch(error=>{record(error.message);app.exit(1);});
