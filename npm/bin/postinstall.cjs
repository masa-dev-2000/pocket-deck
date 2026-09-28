'use strict';
const { download } = require('./pocket-deck.cjs');
const { install } = require('./windows-install.cjs');
const release = require('../release.json');
async function postinstall({ env = process.env, platform = process.platform, arch = process.arch, installImpl = install, log = console.log } = {}) {
  if (env.npm_config_global !== 'true') {
    log('PCアプリの自動導入には npm install -g @masadev/pocket-deck を使用してください。');
    return;
  }
  if (platform !== 'win32' || arch !== 'x64') throw new Error('Windows x64専用です。');
  await installImpl({ version: release.version, downloadImpl: download, log });
}
if (require.main === module) postinstall().catch(error => { console.error(`Pocket Deck: ${error.message}`); process.exitCode = 1; });
module.exports = { postinstall };
