'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { promisify } = require('node:util');
const execute = promisify(require('node:child_process').execFile);
const bundleId = 'local.pocket-deck.desktop';

function locations(home = os.homedir()) {
  const directory = path.join(home, 'Applications');
  return { directory, app: path.join(directory, 'Pocket Deck.app'), lock: path.join(directory, '.pocket-deck-install.lock') };
}
function compare(a, b) {
  const parse = value => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/.exec(value);
    if (!match) throw Error('アプリのバージョンを確認できません。');
    return [...match.slice(1, 4).map(Number), match[4] === undefined ? Infinity : Number(match[4])];
  };
  const left = parse(a), right = parse(b);
  for (let i = 0; i < 4; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}
async function bundle(file, run = execute) {
  const stat = await fs.lstat(file);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('導入先のアプリ形式が不正です。');
  const plist = path.join(file, 'Contents', 'Info.plist');
  const read = async key => (await run('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', plist])).stdout.trim();
  if (await read('CFBundleIdentifier') !== bundleId || await read('CFBundleExecutable') !== 'Pocket Deck') throw Error('Pocket Deck以外のアプリは置き換えません。');
  const version = await read('CFBundleShortVersionString');
  compare(version, version);
  return { version, executable: file };
}
async function inspect(paths, run = execute) {
  let state = {};
  try { state = await bundle(paths.app, run); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  // Detect the main executable even when an app was started from a DMG or another folder.
  const { stdout } = await run('/bin/ps', ['-axo', 'comm=']);
  return { ...state, running: stdout.split('\n').some(line => line.trim().endsWith('/Pocket Deck.app/Contents/MacOS/Pocket Deck')) };
}
async function prepare(archive, directory, version, arch, run = execute) {
  await run('/usr/bin/ditto', ['-x', '-k', archive, directory]);
  const app = path.join(directory, 'Pocket Deck.app');
  const state = await bundle(app, run);
  if (state.version !== version) throw Error('取得したアプリのバージョンが一致しません。');
  await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
  const { stdout } = await run('/usr/bin/lipo', ['-archs', path.join(app, 'Contents', 'MacOS', 'Pocket Deck')]);
  if (!stdout.trim().split(/\s+/).includes(arch === 'x64' ? 'x86_64' : 'arm64')) throw Error('取得したアプリのCPU形式が一致しません。');
  // Node downloads do not add Safari's quarantine attribute. Preserve Gatekeeper's
  // first-launch decision explicitly; never remove quarantine or grant TCC access.
  const quarantine = '0083;' + Math.floor(Date.now() / 1000).toString(16) + ';Pocket Deck npm;';
  await run('/usr/bin/xattr', ['-w', 'com.apple.quarantine', quarantine, app]);
  return app;
}
async function open(app) { await execute('/usr/bin/open', ['-a', app]); }
async function install({ version, arch = process.arch, downloadImpl, paths = locations(), inspectImpl = () => inspect(paths), prepareImpl = prepare, openImpl = open, log = console.log }) {
  if (!['x64', 'arm64'].includes(arch)) throw Error('macOSのCPU形式に対応していません。');
  compare(version, version);
  await fs.mkdir(paths.directory, { recursive: true });
  try { await fs.mkdir(paths.lock); } catch (error) { if (error.code === 'EEXIST') throw Error('別の導入処理が実行中です。中断後のロックはREADMEを確認してください。'); throw error; }
  let staging, preserveStaging = false;
  try {
    let state = await inspectImpl();
    if (state.version && compare(state.version, version) >= 0) { await openImpl(paths.app); return; }
    if (state.running) throw Error('Pocket Deckを完全に終了し、再実行してください。');
    const archive = await downloadImpl();
    staging = await fs.mkdtemp(path.join(paths.directory, '.pocket-deck-staging-'));
    const candidate = await prepareImpl(archive, staging, version, arch);
    if (candidate !== path.join(staging, 'Pocket Deck.app')) throw Error('展開先が不正です。');
    state = await inspectImpl();
    if (state.version && compare(state.version, version) >= 0) { await openImpl(paths.app); return; }
    if (state.running) throw Error('導入中にアプリが起動しました。終了して再実行してください。');
    const backup = path.join(staging, 'previous.app');
    let backedUp = false;
    try { await fs.rename(paths.app, backup); backedUp = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { await fs.rename(candidate, paths.app); }
    catch (error) {
      if (backedUp) {
        try { await fs.rename(backup, paths.app); }
        catch (restoreError) { preserveStaging = true; throw Error(`導入失敗後の復旧に失敗しました。旧版は ${backup} に保持しています。${restoreError.message}`); }
      }
      throw error;
    }
    log('Pocket Deckを ~/Applications に導入しました。macOSの初回起動確認と入力許可は、ご本人が設定してください。');
    // A rejected first launch must not remove the installed application or data.
    await openImpl(paths.app);
  } finally {
    if (staging && !preserveStaging) await fs.rm(staging, { recursive: true, force: true });
    await fs.rmdir(paths.lock);
  }
}
module.exports = { locations, compare, bundle, inspect, prepare, install, open };
