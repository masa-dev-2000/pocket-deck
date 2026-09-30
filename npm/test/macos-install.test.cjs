const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { install, locations, compare, prepare } = require('../bin/macos-install.cjs');
const { main, download } = require('../bin/pocket-deck.cjs');
const { postinstall } = require('../bin/postinstall.cjs');
const { createHash } = require('node:crypto');

async function fixture(states) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'deck-mac-npm-'));
  const paths = locations(root), events = [];
  const options = { version:'1.2.0-beta.1', arch:'arm64', paths, log(){},
    inspectImpl:async()=>states.shift(), downloadImpl:async()=>{events.push('download');return 'verified.zip';},
    prepareImpl:async(_archive, staging)=>{events.push('prepare');const app=path.join(staging,'Pocket Deck.app');await fs.mkdir(app);await fs.writeFile(path.join(app,'new'),'new');return app;},
    openImpl:async()=>events.push('open') };
  return { root, paths, options, events, cleanup:()=>fs.rm(root,{recursive:true,force:true}) };
}
test('macOS install stages verified app, replaces old bundle and keeps user data',async()=>{
  const f=await fixture([{version:'1.1.0'}, {version:'1.1.0'}]);
  try {
    await fs.mkdir(f.paths.app,{recursive:true});await fs.writeFile(path.join(f.paths.app,'old'),'old');
    await fs.writeFile(path.join(f.root,'user-data'),'retained');
    await install(f.options);
    assert.deepEqual(f.events,['download','prepare','open']);
    assert.equal(await fs.readFile(path.join(f.paths.app,'new'),'utf8'),'new');
    assert.equal(await fs.readFile(path.join(f.root,'user-data'),'utf8'),'retained');
    assert.deepEqual(await fs.readdir(f.paths.directory),['Pocket Deck.app']);
  } finally { await f.cleanup(); }
});
test('macOS running app and preparation failure preserve previous bundle',async()=>{
  for (const scenario of ['running','prepare','race']) {
    const f=await fixture(scenario==='running'?[{running:true}]:scenario==='race'?[{}, {running:true}]:[{}]);
    try {
      await fs.mkdir(f.paths.app,{recursive:true});await fs.writeFile(path.join(f.paths.app,'old'),'old');
      if(scenario==='prepare')f.options.prepareImpl=async()=>{throw Error('signature');};
      await assert.rejects(install(f.options));
      assert.equal(await fs.readFile(path.join(f.paths.app,'old'),'utf8'),'old');
      assert(!f.events.includes('open'));
      assert.deepEqual(await fs.readdir(f.paths.directory),['Pocket Deck.app']);
    } finally { await f.cleanup(); }
  }
});
test('macOS same/newer app opens without download; prerelease ordering is respected',async()=>{
  assert(compare('1.2.0','1.2.0-beta.9')>0);assert(compare('1.2.0-beta.10','1.2.0-beta.2')>0);
  assert.throws(()=>compare('garbage','1.2.0'));
  const f=await fixture([{version:'1.2.0'}]);
  try { await install(f.options);assert.deepEqual(f.events,['open']); } finally { await f.cleanup(); }
});
test('macOS refused launch keeps installed app, lock refuses competing install',async()=>{
  const f=await fixture([{},{}]);
  try {
    f.options.openImpl=async()=>{throw Error('Gatekeeper');};
    await assert.rejects(install(f.options),/Gatekeeper/);
    await fs.access(path.join(f.paths.app,'new'));
    await fs.mkdir(f.paths.lock);
    await assert.rejects(install(f.options),/別の導入/);
    await fs.access(f.paths.lock);
  } finally { await f.cleanup(); }
});
test('macOS CPU-specific CLI and global lifecycle select the same manifest',async()=>{
  for(const arch of ['x64','arm64']) {
    const manifest={version:'1.2.0-beta.1',filename:`Pocket-Deck-1.2.0-beta.1-${arch}.zip`};
    const source={macos:{[arch]:manifest}},events=[];
    const options={platform:'darwin',arch,releaseManifest:source,log(){},
      downloadImpl:async({manifest:value})=>{assert.equal(value,manifest);events.push('download');return 'verified.zip';},
      macInstallImpl:async opts=>{assert.equal(opts.arch,arch);await opts.downloadImpl();events.push('install');}};
    await main(['install'],options);assert.deepEqual(events,['download','install']);
    events.length=0;await main(['download'],options);assert.deepEqual(events,['download']);
    let calls=0;
    const post={platform:'darwin',arch,releaseManifest:source,log(){},installImpl:async opts=>{calls++;assert.equal(opts.arch,arch);assert.equal(opts.version,manifest.version);}};
    await postinstall({...post,env:{}});assert.equal(calls,0);
    await postinstall({...post,env:{npm_config_global:'true'}});assert.equal(calls,1);
    await assert.rejects(main(['install'],{...options,arch:'ia32'}),/用です/);
  }
});
test('macOS archive download preserves zip extension and verifies hash',async()=>{
  const cacheDir=await fs.mkdtemp(path.join(os.tmpdir(),'deck-mac-cache-')),bytes=Buffer.from('mock zip');
  try {
    const manifest={version:'1.2.0-beta.1',filename:'mac.zip',url:'https://github.com/masa-dev-2000/pocket-deck/releases/download/v1.2.0-beta.1/mac.zip',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
    const file=await download({manifest,cacheDir,fetchImpl:async()=>new Response(bytes),log(){}});
    assert.equal(path.extname(file),'.zip');assert.deepEqual(await fs.readFile(file),bytes);
  } finally { await fs.rm(cacheDir,{recursive:true,force:true}); }
});
test('macOS preparation checks identity, version, signature and CPU before quarantine',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'deck-mac-prepare-')),app=path.join(root,'Pocket Deck.app'),calls=[];
  try {
    await fs.mkdir(app);
    const run=async(file,args)=>{
      calls.push([file,args]);
      if(file.endsWith('plutil'))return {stdout:{CFBundleIdentifier:'local.pocket-deck.desktop',CFBundleExecutable:'Pocket Deck',CFBundleShortVersionString:'1.2.0-beta.1'}[args[1]]};
      return {stdout:file.endsWith('lipo')?'arm64\n':''};
    };
    assert.equal(await prepare('verified.zip',root,'1.2.0-beta.1','arm64',run),app);
    assert(calls.some(([file])=>file.endsWith('codesign')));
    const xattr=calls.find(([file])=>file.endsWith('xattr'));
    assert.deepEqual(xattr[1].slice(0,2),['-w','com.apple.quarantine']);
    await assert.rejects(prepare('zip',root,'1.2.0-beta.1','x64',run),/CPU/);
    await assert.rejects(prepare('zip',root,'1.2.0-beta.2','arm64',run),/バージョン/);
    await assert.rejects(prepare('zip',root,'1.2.0-beta.1','arm64',async(file,args)=>{
      if(file.endsWith('plutil')&&args[1]==='CFBundleIdentifier')return {stdout:'other.app'};
      return run(file,args);
    }),/以外/);
    await assert.rejects(prepare('zip',root,'1.2.0-beta.1','arm64',async(file,args)=>{
      if(file.endsWith('codesign'))throw Error('invalid signature');
      return run(file,args);
    }),/signature/);
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});
