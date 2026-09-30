const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const execute=require('node:util').promisify(require('node:child_process').execFile);
const {install,locations,bundle}=require('../bin/macos-install.cjs');

test('real packaged Mac ZIP installs with signature, CPU, symlinks and quarantine retained; app never starts',
 {skip:process.platform!=='darwin'||!process.env.DECK_MAC_NPM_ZIP},async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'deck-real-npm-'));
  const paths=locations(root),version=require('../../app/desktop/package.json').version;
  let downloads=0,opens=0;
  try{
   await fs.writeFile(path.join(root,'user-data'),'unchanged');
   const options={version,paths,log(){},downloadImpl:async()=>{downloads++;return path.resolve(process.env.DECK_MAC_NPM_ZIP);},openImpl:async app=>{opens++;assert.equal(app,paths.app);}};
   await install(options);
   assert.equal((await bundle(paths.app)).version,version);
   await execute('/usr/bin/codesign',['--verify','--deep','--strict',paths.app]);
   const quarantine=(await execute('/usr/bin/xattr',['-p','com.apple.quarantine',paths.app])).stdout;
   assert.match(quarantine,/Pocket Deck npm/);
   const framework=path.join(paths.app,'Contents','Frameworks','Electron Framework.framework','Versions','Current');
   assert((await fs.lstat(framework)).isSymbolicLink());
   await install(options);assert.equal(downloads,1);assert.equal(opens,2);
   assert.equal(await fs.readFile(path.join(root,'user-data'),'utf8'),'unchanged');
  }finally{await fs.rm(root,{recursive:true,force:true});}
 });
