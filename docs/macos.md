# macOS試験版

対象はmacOS 13以降、Apple Silicon（arm64）とIntel（x64）。Electron 44の最低要件に合わせています。[Electronの公式案内](https://www.electronjs.org/docs/latest/breaking-changes/#removed-macos-12-support)。Mac App Store版ではありません。

macOS向けは`1.2.0`から通常の`latest`タグで導入できます。Developer ID署名・公証と実機入力確認は未完了で、自動更新は無効です。

1.2.0は両CPUのDMG／ZIP生成と同梱backendの起動・保存・再起動、ad-hoc署名検証をCIで確認してから公開します。配布物は[1.2.0の通常リリース](https://github.com/masa-dev-2000/pocket-deck/releases/tag/v1.2.0)から取得できます。

## 導入

GitHub Releaseから、Apple Siliconなら`Pocket-Deck-1.2.0-arm64.dmg`、Intelなら`Pocket-Deck-1.2.0-x64.dmg`を取得して開き、Pocket Deck.appをApplicationsへコピーします。ZIPは同じアプリの別形式です。直接導入ならPython／Node.jsの追加は不要です。npmから導入する場合はNode.js 22.12以上で`npm install -g --foreground-scripts @masadev/pocket-deck`を実行します。

macOS版にはad-hoc署名を使用します。Developer IDによる発行元の証明やAppleの公証はなく、Gatekeeperの通常配布チェックを通過する製品版とは区別します。OSが起動を拒否した場合、警告を自動解除したりquarantineを削除する処理はありません。一般配布前に正式な署名・公証が必要です。

## スマホ接続と入力許可

1. Pocket Deckを起動し、スマホとMacを同じWi-Fiにつなぎます。
2. ホームの「入力を許可」を押します。システム設定の「プライバシーとセキュリティ → アクセシビリティ」で、Pocket DeckまたはPocketDeckServerを許可します。許可されるまではキー・マウス入力を送信しません。表示される対象名と許可反映は実機確認が必要です。
3. ホームの入力状態が「利用可」になったことを確認します。反映されない場合はアプリを完全終了して開き直します。
4. 「スマホを接続」のQRから接続します。macOSのローカルネットワークやファイアウォールの確認が出た場合は、家庭内など信頼できるネットワークでのみ許可してください。アプリはOSの許可を自動変更しません。

スマホへの接続は既存MVPと同じHTTP・認証なしです。外部公開やポート転送をしないでください。

## キーの扱い

- 検索候補とキー配列の`Cmd`がCommand、`Option`がOptionです。保存データでは既存名`WIN`／`ALT`を保ちます。`CTRL`はMacでもControlで、既存配置のCtrlを勝手にCommandへ変換しません。
- 新規データの初期配置だけはCommand+C／VなどMac用にします。移行した配置は、必要なボタンをCmdへ変更してください。
- F1〜F20に対応します。F21〜F24とメディアキーは現時点で未対応で、候補から除外し、既存配置で送信された場合も明示エラーにします。
- 文字列はデスクトップのクリップボードへ転送してCommand+Vで貼り付けます。Terminal.appも同じ方式です。クリップボードは登録文字列に置き換わります。
- アルファベットと数字のキーはANSIの物理キーコードを使います。JISの英数キーも共通の位置ですが、フランス語配列などで文字と位置が異なる組み合わせは未検証です。任意の文字を確実に入力したい場合は文字列ボタンを使います。

タッチパッドは移動・クリック・保持ドラッグ、二本指スクロールとホイール領域を同じスマホUIから利用する実装です。保持中はQuartzのドラッグイベントを生成し、離すとマウスアップを送ります。操作感と入力先での受信は実機確認が残ります。

## Chrome連携

PCアプリの「Chrome連携」から準備し、各Chromeプロフィールの`chrome://extensions`で表示されたフォルダーを読み込みます。手順は[Chrome連携](chrome-profiles.md)と共通です。Native Messagingは現在のユーザーの`~/Library/Application Support/Google/Chrome/NativeMessagingHosts`等へ登録し、WindowsのレジストリやLinuxのXDGパスを使いません。別のホスト登録を自動上書きしません。実Chromeのプロフィール切り替えとOSのフォーカス取得は実機で別途確認します。

## 終了・保存・更新

ウィンドウを閉じるとバックグラウンドへ格納します。Dockのアイコンから開き直せます。完全終了はアプリ内の終了、メニューバーの終了、またはCommand+Qです。

保存先は`~/Library/Application Support/Pocket Deck/data`です。アプリ本体とは別なので、Applications内の.appを置き換えても配置は残ります。削除時も登録内容を自動消去しません。

試験版は手動更新です。正式な署名・公証とMac更新試験が済むまで自動更新を停止し、「更新を確認」で手動更新の案内を出します。Windows／Ubuntuの更新経路は維持します。

## 開発・検証

Mac上で`python -m pip install -r app/desktop/requirements-build.txt`、`npm ci --prefix app/desktop`、`python app/desktop/build_backend.py`、`npm run package:mac --prefix app/desktop -- --arm64`または`--x64`を実行します。PythonバックエンドとElectronは同じCPUのMacでビルドします。

[macOSビルド](../.github/workflows/macos.yml)は両CPUのネイティブrunnerで、共有テスト、Quartzの実APIによるイベント生成（OSへの送信なし）、同梱Pythonの起動・排他的listen・保存と再起動、DMG／ZIP生成、ad-hoc署名検証、同梱依存読み込みを行います。対話的なOS許可、実キー受信、ファイルドラッグ、実Chrome切り替え、一般ユーザーのGatekeeper起動、署名付き自動更新を検証済みとは扱いません。
