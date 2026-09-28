// Runs only inside the disposable Windows Sandbox; no production endpoint is replaced.
const fs=require('node:fs/promises'),path=require('node:path');
const root='C:/deck-test';
const {postinstall}=require(root+'/npm/bin/postinstall.cjs');
const {install,inspect}=require(root+'/npm/bin/windows-install.cjs');
const {download}=require(root+'/npm/bin/pocket-deck.cjs');
const manifest=require(root+'/npm/release.json');
async function run(){
 await postinstall({env:{npm_config_global:'true'},installImpl:options=>install({...options,downloadImpl:()=>download({manifest,fetchImpl:async()=>new Response(await fs.readFile(root+'/app/desktop-dist/'+manifest.filename))})})});
 const s=await inspect();
 if(s.version!=='1.0.4')throw Error('Unexpected installed version');
 await fs.writeFile('C:/deck-results/install.json',JSON.stringify({version:s.version,executable:s.executable}));
}
run().catch(e=>{console.error(e);process.exitCode=1;});
