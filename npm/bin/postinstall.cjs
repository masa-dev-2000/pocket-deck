'use strict';
const { download } = require('./pocket-deck.cjs');
const { install } = require('./windows-install.cjs');
const { install:linuxInstall } = require('./linux-install.cjs');
const release = require('../release.json');
async function postinstall({ env = process.env, platform = process.platform, arch = process.arch, installImpl, log = console.log } = {}) {
  if (env.npm_config_global !== 'true') {
    log('PCアプリの自動導入には npm install -g @masadev/pocket-deck を使用してください。');
    return;
  }
  if (!['win32','linux'].includes(platform) || arch !== 'x64') throw new Error('Windows / Ubuntu x64用です。');
  const manifest=platform==='linux'?release.linux:release;
  if(!manifest)throw new Error('このnpm版にはLinux配布ファイルがまだありません。');
  await (installImpl||(platform==='linux'?linuxInstall:install))({ version:manifest.version,downloadImpl:()=>download({manifest}),log });
}
if (require.main === module) postinstall().catch(error => { console.error(`Pocket Deck: ${error.message}`); process.exitCode = 1; });
module.exports = { postinstall };
