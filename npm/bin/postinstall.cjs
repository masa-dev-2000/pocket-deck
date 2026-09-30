'use strict';
const { download, selectManifest } = require('./pocket-deck.cjs');
const { install } = require('./windows-install.cjs');
const { install:linuxInstall } = require('./linux-install.cjs');
const release = require('../release.json');
async function postinstall({ env = process.env, platform = process.platform, arch = process.arch, installImpl, releaseManifest = release, log = console.log } = {}) {
  if (env.npm_config_global !== 'true') {
    log('PCアプリの自動導入には npm install -g @masadev/pocket-deck を使用してください。');
    return;
  }
  const manifest=selectManifest(platform,arch,releaseManifest);
  const selected=platform==='darwin'?require('./macos-install.cjs').install:platform==='linux'?linuxInstall:install;
  await (installImpl||selected)({ version:manifest.version,...(platform==='darwin'?{arch}:platform==='linux'?{format:manifest.filename?.endsWith('.deb')?'deb':'AppImage'}:{}),downloadImpl:()=>download({manifest}),log });
}
if (require.main === module) postinstall().catch(error => { console.error(`Pocket Deck: ${error.message}`); process.exitCode = 1; });
module.exports = { postinstall };
