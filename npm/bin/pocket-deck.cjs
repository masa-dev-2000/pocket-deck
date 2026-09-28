#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const { createReadStream, createWriteStream } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash, randomUUID } = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { spawn } = require('node:child_process');
const release = require('../release.json');
const metadata = require('../package.json');

async function hash(file) {
  const result = createHash('sha256');
  for await (const chunk of createReadStream(file)) result.update(chunk);
  return result.digest('hex');
}

async function download({ cacheDir, fetchImpl = fetch, manifest = release, log = console.log } = {}) {
  if (!/^https:\/\/github\.com\/masa-dev-2000\/pocket-deck\/releases\/download\//.test(manifest.url)) {
    throw new Error('配布URLが不正です。');
  }
  if (!/^[a-f0-9]{64}$/.test(manifest.sha256) || !Number.isSafeInteger(manifest.bytes) || manifest.bytes <= 0) {
    throw new Error('配布ファイル情報が不正です。');
  }
  cacheDir ||= path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'Pocket Deck', 'downloads');
  await fs.mkdir(cacheDir, { recursive: true });
  const target = path.join(cacheDir, `Pocket-Deck-${manifest.version}-${manifest.sha256.slice(0, 12)}.exe`);
  try {
    if ((await fs.stat(target)).size === manifest.bytes && await hash(target) === manifest.sha256) {
      log('検証済みのインストーラーを使用します。');
      return target;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const temporary = target + '.' + randomUUID() + '.part';
  try {
    log(`Pocket Deck ${manifest.version} を取得します（約${Math.ceil(manifest.bytes / 1000000)}MB）。`);
    const response = await fetchImpl(manifest.url, { signal: AbortSignal.timeout(180000) });
    if (!response.ok || !response.body) {
      throw new Error(`取得に失敗しました（HTTP ${response.status}）。GitHub Releaseが公開済みか確認してください。`);
    }
    let bytes = 0;
    const digest = createHash('sha256');
    const validator = new Transform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > manifest.bytes) return callback(new Error('配布ファイルのサイズが一致しません。'));
        digest.update(chunk);
        callback(null, chunk);
      }
    });
    await pipeline(Readable.fromWeb(response.body), validator, createWriteStream(temporary, { flags: 'wx' }));
    if (bytes !== manifest.bytes || digest.digest('hex') !== manifest.sha256) {
      throw new Error('配布ファイルのチェックサムが一致しません。実行しません。');
    }
    // Preserve a bad cached file as evidence; do not silently overwrite it.
    try { await fs.rename(target, target + '.' + randomUUID() + '.invalid'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await fs.rename(temporary, target);
    log('SHA-256の一致を確認しました。');
    return target;
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

function launch(installer, launchImpl = spawn) {
  return new Promise((resolve, reject) => {
    const child = launchImpl(installer, [], { windowsHide: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`インストーラーが終了しました（コード ${code}）。`)));
  });
}

async function main(args = process.argv.slice(2), {
  platform = process.platform, arch = process.arch, downloadImpl = download, launchImpl = launch,
  log = console.log
} = {}) {
  const command = args[0];
  if (!command || command === '--help' || command === '-h') {
    log(`Pocket Deck ${metadata.version}\n\n使い方:\n  npx ${metadata.name} install   取得・検証後にWindowsインストーラーを開く\n  npx ${metadata.name} download  取得・検証のみ\n  npx ${metadata.name} --version\n\nWindows x64・Node.js 22.12以上が必要です。npm installだけではPCアプリを導入しません。\n同じWi-Fiでスマホから操作するローカル用MVPです。詳細はnpm/GitHubのREADMEをご覧ください。`);
    return;
  }
  if (command === '--version' && args.length === 1) { log(metadata.version); return; }
  if (!['install', 'download'].includes(command) || args.length !== 1) {
    throw new Error('引数が不正です。--helpで使い方を確認してください。');
  }
  if (platform !== 'win32' || arch !== 'x64') throw new Error('Windows x64専用です。');
  const installer = await downloadImpl();
  log(`インストーラー: ${installer}`);
  if (command === 'install') {
    log('インストーラーを開きます。画面の案内に従ってください。');
    await launchImpl(installer);
  }
}

if (require.main === module) {
  main().catch(error => { console.error(`Pocket Deck: ${error.message}`); process.exitCode = 1; });
}
module.exports = { download, main, hash, launch };
