const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {install,locations}=require('../bin/linux-install.cjs');
const {spawn}=require('node:child_process'),{once}=require('node:events');

test('Linux tracks an actual process after its environment is cleared and rejects stale identities',{skip:process.platform!=='linux'},async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'deck-process-'));
 let child;
 try{
  const image=path.join(dir,'fixture.AppImage');await fs.writeFile(image,'fixture');
  const manifest=path.join(dir,'installation.json');await fs.writeFile(manifest,JSON.stringify({version:'1.0.4',file:path.basename(image)}));
  const recorder=path.resolve(__dirname,'../../app/desktop/linux-install-state.cjs');
  child=spawn(process.execPath,['-e',`process.title='pocket-deck-desktop'; if(!require(process.argv[1]).recordLinuxInstall({directory:process.argv[2],currentImage:process.argv[3],version:'1.0.4'}))process.exit(1); process.stdout.write('ready\\n'); setInterval(()=>{},1000);`,recorder,dir,image],{stdio:['ignore','pipe','pipe']});
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('process fixture exited before recording its identity');})]);
  const state=JSON.parse(await fs.readFile(manifest));
  const {running,processActive}=require('../bin/linux-install.cjs');
  assert.equal(await running(dir,state),true);
  assert.equal(await processActive({...state.process,startTime:'0'}),false);
  const ended=once(child,'exit');child.kill();await ended;child=null;
  assert.equal(await processActive(state.process),false);
 }finally{if(child){const ended=once(child,'exit');child.kill();await ended;}await fs.rm(dir,{recursive:true,force:true});}
});
test('Linux installation copies an executable AppImage and creates a desktop entry without touching config',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'deck-linux-install-'));try{
  const paths=locations({XDG_DATA_HOME:dir},'/unused'),source=path.join(dir,'verified.AppImage'),config=path.join(dir,'config','Pocket Deck','config.json');
  await fs.writeFile(source,'verified fixture');await fs.mkdir(path.dirname(config),{recursive:true});await fs.writeFile(config,'preserve');
  const events=[];await install({version:'1.0.4',paths,inspectImpl:async()=>({}),downloadImpl:async()=>{events.push('download');return source;},openImpl:async file=>{events.push('open');assert.equal(await fs.readFile(file,'utf8'),'verified fixture');},log(){}});
  assert.deepEqual(events,['download','open']);assert.equal(await fs.readFile(config,'utf8'),'preserve');
  assert.equal(JSON.parse(await fs.readFile(paths.state)).version,'1.0.4');assert.match(await fs.readFile(paths.wrapper,'utf8'),/APPIMAGE_EXTRACT_AND_RUN=1/);assert.match(await fs.readFile(paths.desktop,'utf8'),/Terminal=false/);
  assert.equal(JSON.parse(await fs.readFile(paths.state)).file,'Pocket-Deck.AppImage','in-app updates must preserve the launch path');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('Linux installation refuses an active app before download and rechecks after download',async()=>{
 for(const states of [[{running:true}],[{},{running:true}]]){
  const expectedDownloads=states.length-1;
  let downloaded=0,opened=0;await assert.rejects(install({version:'1.0.4',inspectImpl:async()=>states.shift(),downloadImpl:async()=>{downloaded++;return 'never-run';},openImpl:async()=>opened++,log(){}}),/終了/);
  assert.equal(opened,0);assert.equal(downloaded,expectedDownloads);
 }
});
test('Linux installer never downgrades a newer app',async()=>{
 let opened=false;await install({version:'1.0.4',inspectImpl:async()=>({version:'1.2.0',executable:'already-installed'}),downloadImpl:async()=>assert.fail('downgrade'),openImpl:async file=>{assert.equal(file,'already-installed');opened=true;},log(){}});assert(opened);
});
