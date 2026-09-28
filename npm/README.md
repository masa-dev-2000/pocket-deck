# Pocket Deck

スマホをWindows PCのショートカットキーボード・タッチパッドにするアプリです。Windows x64、Node.js 22.12以上が必要です。

## 導入（1.0.4以降）

```powershell
npm install -g @masadev/pocket-deck
```

GitHub Releasesから対応するexeを取得し、固定SHA-256を検証して、現在のWindowsユーザー用に画面を出さずインストールします。導入結果を確認し、Pocket Deckを起動します。スタートメニュー・デスクトップのショートカットからも起動できます。スマホのQR読み取り、Windowsの通信許可、Chrome拡張の追加は本人操作です。

npmの導入スクリプト実行許可が必要です。`--ignore-scripts`や実行許可制のnpm設定では、自動導入されません。npmが実行許可を要求する場合は、このパッケージだけを許可してください。進捗を見る場合は`--foreground-scripts`を付けます。ローカル導入やnpxによる取得では自動導入しません。

## 更新

PCアプリは起動時に新版を確認し、「更新する」を選んだ場合だけ取得・更新・再起動します。「後で」ならそのまま使えます。メニューの「更新を確認」から再確認できます。無断の更新・再起動は行いません。1.0.3からの初回更新はnpmまたは新版インストーラーで行います。

npmから更新する場合は、先にPocket Deckを通知領域の「終了」から完全終了します。

```powershell
npm update -g @masadev/pocket-deck
```

新しいnpm版が導入されると、PCアプリ本体も更新します。同じ版・既に新しい版が入っている場合は再導入せず起動します。配置・画像・Chrome設定は保持します。起動中のアプリは強制終了しません。全ユーザー用の導入はnpmで更新せず、Windowsインストーラーで行ってください。

## 手動導入・取得のみ

```powershell
npx @masadev/pocket-deck install
npx @masadev/pocket-deck download
```

installは通常のインストーラー画面を開き、downloadは取得と検証だけです。検証済みファイルは通常`%LOCALAPPDATA%\Pocket Deck\downloads`に保存します。

## 削除・配布内容

PCアプリはWindowsの「インストールされているアプリ」から削除します。`npm uninstall -g @masadev/pocket-deck`はnpmの導入コマンドを削除するだけで、PCアプリや設定は削除しません。

npmには小さな導入コマンドを公開し、約136MBのPCアプリは[GitHub Releases](https://github.com/masa-dev-2000/pocket-deck/releases)に置きます。exeを直接使う人には追加のNode.js/Pythonは不要です。チェックサムはコード署名とは別です。

現在は未署名のローカルネットワーク用MVPです。スマホ接続はHTTP・認証なしで、信頼できるネットワーク専用です。ファイル移動・ウィンドウサイズ変更のダブルタップ保持ドラッグには既知の問題があります。他OS・Windows ARM64は未対応です。

詳細は[GitHubのREADME](https://github.com/masa-dev-2000/pocket-deck)を参照してください。MITライセンスです。
