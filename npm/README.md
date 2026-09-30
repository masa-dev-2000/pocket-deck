# Pocket Deck

スマホをWindows／Ubuntu／macOSのショートカットキーボード・タッチパッドにするアプリです。Windows／Ubuntu x64、macOS x64／arm64、Node.js 22.12以上が対象です。Ubuntu対応は1.1.0以降、macOS対応は1.2.0以降です。macOS版は正式な配布署名・公証と実機入力確認が未完了です。

通常の`npm install -g @masadev/pocket-deck`で1.2.0を導入します。複数配置、まとめボタン、連続操作の左クリックが含まれます。

## 導入（1.0.4以降）

```powershell
npm install -g @masadev/pocket-deck
```

GitHub Releasesから対応するexeを取得し、固定SHA-256を検証して、現在のWindowsユーザー用に画面を出さずインストールします。導入結果を確認し、Pocket Deckを起動します。スタートメニュー・デスクトップのショートカットからも起動できます。スマホのQR読み取り、Windowsの通信許可、Chrome拡張の追加は本人操作です。

Ubuntuでは、通常ユーザーで次のコマンドを実行します。

```sh
npm install -g --prefix "$HOME/.local" --foreground-scripts @masadev/pocket-deck
```

debを取得してSHA-256を検証し、Ubuntuの管理者認証を開きます。認証を完了するとOSのパッケージ管理でPCアプリを導入し、起動します。取消や導入確認の失敗時は起動しません。npm全体をsudoで実行しません。導入後はアプリ一覧から起動できます。`--prefix`はnpmの小さな導入コマンドの保存先で、PCアプリ本体は`/opt/Pocket Deck`へ入ります。

npmの導入スクリプト実行許可が必要です。`--ignore-scripts`や実行許可制のnpm設定では、自動導入されません。npmが実行許可を要求する場合は、このパッケージだけを許可してください。進捗を見る場合は`--foreground-scripts`を付けます。ローカル導入やnpxによる取得では自動導入しません。

## 更新

PCアプリは起動時に新版を確認し、「更新する」を選んだ場合だけ取得・更新・再起動します。「後で」ならそのまま使えます。メニューの「更新を確認」から再確認できます。無断の更新・再起動は行いません。1.0.3からの初回更新はnpmまたは新版インストーラーで行います。

npmから更新する場合は、先にPocket Deckを通知領域の「終了」から完全終了します。

```powershell
npm update -g @masadev/pocket-deck
```

新しいnpm版が導入されると、PCアプリ本体も更新します。同じ版・既に新しい版が入っている場合は再導入せず起動します。配置・画像・Chrome設定は保持します。起動中のアプリは強制終了しません。全ユーザー用の導入はnpmで更新せず、Windowsインストーラーで行ってください。

Ubuntuのnpm更新にも同じ`--prefix "$HOME/.local"`を付けます。debの更新時はOSの認証が必要で、取消後に修復コマンドを自動実行しません。導入版を確認してから再起動します。

## 手動導入・取得のみ

```powershell
npx @masadev/pocket-deck install
npx @masadev/pocket-deck download
```

installはWindowsでは通常のインストーラー画面、Ubuntuではdeb導入のOS認証を開きます。downloadは取得と検証だけです。検証済みファイルはWindowsの`%LOCALAPPDATA%\Pocket Deck\downloads`、Ubuntuの`~/.cache/Pocket Deck/downloads`（`XDG_CACHE_HOME`指定時はその配下）へ保存します。

## 削除・配布内容

PCアプリはWindowsの「インストールされているアプリ」から削除します。`npm uninstall -g @masadev/pocket-deck`はnpmの導入コマンドを削除するだけで、PCアプリや設定は削除しません。

UbuntuのPCアプリは`sudo apt remove pocket-deck-desktop`で削除します。配置などのユーザー設定は残ります。npmの導入コマンドを削除する場合は、導入時と同じprefixを使います。

npmには小さな導入コマンドを公開し、約136MBのPCアプリは[GitHub Releases](https://github.com/masa-dev-2000/pocket-deck/releases)に置きます。exeを直接使う人には追加のNode.js/Pythonは不要です。チェックサムはコード署名とは別です。

現在はローカルネットワーク用MVPです。スマホ接続はHTTP・認証なしで、信頼できるネットワーク専用です。ファイル移動・ウィンドウサイズ変更のダブルタップ保持ドラッグには既知の問題があります。Windows／Ubuntuはx64、macOSはx64／arm64に対応します。macOS試験版はad-hoc署名で、Developer ID署名・公証はありません。

Ubuntuの入力許可、端末向け貼り付け、Wayland上のChrome切り替えと保持中の許可サービス失効の制限は[Ubuntuガイド](https://github.com/masa-dev-2000/pocket-deck/blob/main/docs/ubuntu.md)を参照してください。

詳細は[GitHubのREADME](https://github.com/masa-dev-2000/pocket-deck)を参照してください。MITライセンスです。


## macOS試験版の導入

`npm install -g --foreground-scripts @masadev/pocket-deck`で、CPUに合うZIPをGitHub Releaseから取得します。固定SHA-256とサイズを照合してから `~/Applications/Pocket Deck.app` に導入します。アプリを完全終了してから実行してください。

Apple Siliconにはarm64、Intelにはx64のZIPを自動選択します。起動中のアプリは置き換えません。Windows／Ubuntuの配布情報とともに各OSのアプリ版を固定しています。

macOS 13以上・Node.js 22.12以上が必要です。Apple Siliconではarm64版Nodeを推奨します。Rosetta上のx64版NodeではIntel版を選びます。`npm install -g` ではOS確認が表示される場合があるため `--foreground-scripts` を推奨し、npm全体をsudoで実行しません。一般ユーザーが書き込めるnpm prefixを使用してください。

この導入コードはGatekeeper隔離属性を保持し、署名の検証を行います。ad-hoc試験版を正式なDeveloper ID署名・公証済みとして扱いません。初回起動のOS確認やアクセシビリティ入力許可は本人が設定します。npm導入だけで無条件に利用可能になる保証はありません。`npm uninstall`ではMacアプリを消しません。アプリを終了してFinderから `~/Applications/Pocket Deck.app` を削除してください。設定データはそのまま保持します。

導入が強制終了して `.pocket-deck-install.lock` が残った場合は、導入処理が動作していないことを確認し、`~/Applications/.pocket-deck-install.lock` の空フォルダーだけを削除します。復旧エラーが出たときは表示された `previous.app` を保持し、削除しないでください。
