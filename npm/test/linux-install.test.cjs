const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {install,locations}=require('../bin/linux-install.cjs');
test('Linux installation copies an executable AppImage and creates a desktop entry without touching config',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'deck-linux-install-'));try{
  const paths=locations({XDG_DATA_HOME:dir},'/unused'),source=path.join(dir,'verified.AppImage'),config=path.join(dir,'config','Pocket Deck','config.json');
  await fs.writeFile(source,'verified fixture');await fs.mkdir(path.dirname(config),{recursive:true});await fs.writeFile(config,'preserve');
  const events=[];await install({version:'1.0.4',paths,inspectImpl:async()=>({}),downloadImpl:async()=>{events.push('download');return source;},openImpl:async file=>{events.push('open');assert.equal(await fs.readFile(file,'utf8'),'verified fixture');},log(){}});
  assert.deepEqual(events,['download','open']);assert.equal(await fs.readFile(config,'utf8'),'preserve');
  assert.equal(JSON.parse(await fs.readFile(paths.state)).version,'1.0.4');assert.match(await fs.readFile(paths.wrapper,'utf8'),/APPIMAGE_EXTRACT_AND_RUN=1/);assert.match(await fs.readFile(paths.desktop,'utf8'),/Terminal=false/);
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
