'use strict';
class Updates {
  constructor({ updater, currentVersion, packaged, ask, inform, prepare, publish = () => {}, log = () => {} }) {
    Object.assign(this, { updater, currentVersion, packaged, ask, inform, prepare, publish, log });
    this.busy = false;
    this.closed = false;
    this.deferred = new Set();
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    this.progress = progress => { if (!this.closed) this.publish({ phase: 'downloading', percent: Math.round(progress.percent) }); };
    this.error = error => this.log(error.message);
    updater.on('download-progress', this.progress);
    updater.on('error', this.error);
  }
  async check(manual = false) {
    if (this.busy || this.closed) return;
    if (!this.packaged) { if (manual) await this.inform('開発版では更新しません。インストールしたアプリで確認してください。'); return; }
    this.busy = true;
    let downloading = false, failed = false;
    this.publish({ phase: 'checking' });
    try {
      const result = await this.updater.checkForUpdates();
      if (this.closed) return;
      const version = result?.updateInfo?.version;
      // checkForUpdates returns metadata even when no newer version is available.
      const { compare } = require('semver');
      if (!version || compare(version, this.currentVersion) <= 0) {
        if (manual) await this.inform('最新版を使用しています。');
        return;
      }
      if (!manual && this.deferred.has(version)) return;
      const accepted = await this.ask(`Pocket Deck ${version} が利用できます。\n現在のバージョン: ${this.currentVersion}\n\n更新するとPCアプリとスマホ接続が一度終了し、再起動します。編集内容が保存済みであることを確認してください。`);
      if (!accepted) { this.deferred.add(version); return; }
      if (this.closed) return;
      downloading = true;
      this.publish({ phase: 'downloading', percent: 0 });
      await this.updater.downloadUpdate();
      if (this.closed) return;
      this.publish({ phase: 'installing' });
      await this.prepare();
      if (this.closed) return;
      this.updater.quitAndInstall(true, true);
    } catch (error) {
      failed = true;
      this.log(error.message);
      this.publish({ phase: 'error', message: '更新できませんでした。通信を確認し、「更新を確認」から再試行してください。' });
      if (!this.closed && (manual || downloading)) await this.inform('更新できませんでした。通信を確認し、再試行してください。');
    } finally {
      this.busy = false;
      if (!this.closed && !failed) this.publish({ phase: 'idle' });
    }
  }
  dispose() {
    this.closed = true;
    this.updater.removeListener('download-progress', this.progress);
    // Keep the error listener while any in-flight network operation settles.
  }
}
module.exports = { Updates };
