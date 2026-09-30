#!/usr/bin/env node
'use strict';
// Preparation only: never changes release.json or uploads any file.
const fs=require('node:fs/promises');
const path=require('node:path');
const {hash}=require('../bin/pocket-deck.cjs');
async function main(args=process.argv.slice(2)){
 const [arch,file]=args;
 if(args.length!==2||!['x64','arm64'].includes(arch))throw Error('Usage: node npm/scripts/prepare-macos-manifest.cjs x64|arm64 path/to/Pocket-Deck-VERSION-ARCH.zip');
 const filename=path.basename(file),match=/^Pocket-Deck-(\d+\.\d+\.\d+(?:-beta\.\d+)?)-(x64|arm64)\.zip$/.exec(filename);
 if(!match||match[2]!==arch)throw Error('ZIPのファイル名・CPUを確認してください。');
 const stat=await fs.stat(file);if(!stat.isFile()||stat.size<=0)throw Error('ZIPファイルを確認してください。');
 const version=match[1];
 console.log(JSON.stringify({macos:{[arch]:{version,filename,url:`https://github.com/masa-dev-2000/pocket-deck/releases/download/v${version}/${filename}`,sha256:await hash(file),bytes:stat.size}}},null,2));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={main};
