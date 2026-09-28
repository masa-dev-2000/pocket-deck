'use strict';
const { execFile, spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');
const execute = promisify(execFile);

async function inspect() {
  const script = `$ErrorActionPreference='Stop'; $id='3ae32cde-c490-519a-b196-532e925bccdf'; $apps=@(Get-ItemProperty ('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\'+$id),('HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\'+$id) -ErrorAction SilentlyContinue); $running=@(Get-Process -Name 'Pocket Deck' -ErrorAction SilentlyContinue).Count -gt 0; if($apps.Count -gt 1){throw 'Pocket Deck has multiple installations'}; if($apps.Count -eq 0){@{running=$running}|ConvertTo-Json -Compress}else{$a=$apps[0]; $directory=$a.InstallLocation; if(!$directory){$m=[regex]::Match($a.UninstallString,'^"([^"\\r\\n]+)"'); if(!$m.Success -or (Split-Path -Leaf $m.Groups[1].Value) -ne 'Uninstall Pocket Deck.exe'){throw 'Invalid installation path'}; $directory=Split-Path -Parent $m.Groups[1].Value}; @{version=$a.DisplayVersion;directory=$directory;running=$running;machine=$a.PSPath -like '*HKEY_LOCAL_MACHINE*'}|ConvertTo-Json -Compress}`;
  const { stdout } = await execute(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 20000 });
  const result = JSON.parse(stdout.replace(/^\uFEFF/, ''));
  if (result.version) {
    if (!result.directory || !path.win32.isAbsolute(result.directory)) throw new Error('既存アプリの導入先を確認できません。');
    result.executable = path.join(result.directory, 'Pocket Deck.exe');
    await fs.access(result.executable);
  }
  return result;
}
function compare(a, b) {
  const parse = value => {
    if (!/^\d+\.\d+\.\d+$/.test(value)) throw new Error('アプリのバージョンを確認できません。');
    return value.split('.').map(Number);
  };
  const left = parse(a), right = parse(b);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}
function runInstaller(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, ['/S', '/currentuser'], { windowsHide: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`導入に失敗しました（コード ${code}）。`)));
  });
}
function openApplication(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, [], { windowsHide: true, detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}
async function install({ version, inspectImpl = inspect, downloadImpl, runImpl = runInstaller, openImpl = openApplication, log = console.log }) {
  let current = await inspectImpl();
  if (current.version && compare(current.version, version) >= 0) {
    log(`Pocket Deck ${current.version} は導入済みです。`);
    await openImpl(current.executable);
    return;
  }
  if (current.machine) throw new Error('全ユーザー用の導入はnpmでは更新しません。Windowsインストーラーを使用してください。');
  if (current.running) throw new Error('Pocket Deckを通知領域の「終了」から完全に終了し、再実行してください。');
  const installer = await downloadImpl();
  current = await inspectImpl();
  if (current.version && compare(current.version, version) >= 0) { await openImpl(current.executable); return; }
  if (current.running || current.machine) throw new Error('導入中にアプリの状態が変わりました。Pocket Deckを終了し、再実行してください。');
  log('Pocket Deckを現在のユーザー用にインストールしています…');
  await runImpl(installer);
  const installed = await inspectImpl();
  if (!installed.version || compare(installed.version, version) < 0) throw new Error('PCアプリの導入完了を確認できませんでした。');
  log(`Pocket Deck ${installed.version} の導入が完了しました。アプリを開きます。`);
  await openImpl(installed.executable);
}
module.exports = { inspect, compare, install, runInstaller, openApplication };
