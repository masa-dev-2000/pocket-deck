# Pocket Deck — npm installer launcher

スマホをWindows PCのショートカットキーボード・タッチパッドにするPocket Deckの導入用コマンドです。Windows x64、Node.js 22.12以上が必要です。

```powershell
npx @masadev/pocket-deck install
```

このコマンドは、指定バージョンのWindowsインストーラーをGitHub Releasesから取得し、このnpmパッケージに固定されたSHA-256と照合してから開きます。インストーラーの画面に従って導入してください。導入後はPCアプリを起動し、同じWi-Fiのスマホで「スマホを接続」のQRを読み取ります。

`npm install` やパッケージ取得だけではPCアプリをインストールしません。postinstallスクリプトはありません。引数なしの実行は使い方だけを表示します。

## ダウンロードだけ行う

```powershell
npx @masadev/pocket-deck download
```

検証済みファイルは通常 `%LOCALAPPDATA%\Pocket Deck\downloads` に保存し、場所を表示します。同じファイルは再検証して再利用します。バージョン更新時は新しいnpm版を使ってください。npmコマンド自体を使わない人は[GitHub Releases](https://github.com/masa-dev-2000/pocket-deck/releases)からインストーラーを直接取得できます。PCアプリ本体には追加のPython/Node.js導入は不要です。

## 配布内容

npmにはこの小さな導入コマンドだけを公開します。約136MBのPCアプリはGitHub Releasesに置き、npmパッケージに本体や個人設定を含めません。チェックサムはファイルの一致を確認するためのもので、Windowsコード署名とは別です。

現在は未署名のローカルネットワーク用MVPです。スマホ接続はHTTP・認証なしで、信頼できるネットワーク専用です。ファイル移動・ウィンドウサイズ変更のダブルタップ保持ドラッグには既知の問題があります。Windows ARM64・他OSは未対応です。

使い方、制約、更新、Chrome連携、ビルドは[GitHubのREADME](https://github.com/masa-dev-2000/pocket-deck)を参照してください。ライセンスはMITです。
