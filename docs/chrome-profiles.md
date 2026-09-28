# Chromeプロフィール連携

登録したChromeプロフィールの、最後に使った通常ウィンドウへ移動します。閉じているChromeは起動せず、タブの選択も変更しません。

## PCアプリから設定

1. Pocket Deckの左側で「Chrome連携」を開き、「連携を準備」を押します。専用ホストと認証トークンを自動で準備します。
2. 対象のChromeプロフィールで `chrome://extensions` を開き、デベロッパーモードを有効にします。アプリ内の「フォルダを開く」「コピー」を使い、「パッケージ化されていない拡張機能を読み込む」で表示されたフォルダを選びます。
3. 拡張のポップアップで「仕事用」「個人用」などの呼び名を登録します。使いたいプロフィールごとに手順2、3を繰り返します。
4. Pocket Deckの一覧で接続を確認し、ボタン編集の「Chromeプロフィール」から対象を選びます。連続操作にも登録できます。

拡張IDやPowerShellコマンドの入力、トークンの手動コピーは不要です。Chromeへの拡張読み込みだけはユーザー操作が必要です。以前の拡張から移行するとプロフィール識別IDが変わる場合があるため、既存ボタンの対象を選び直してください。

## 保存先・権限

- 拡張：`%APPDATA%\Pocket Deck\chrome-extension`。公開鍵でIDを固定しています。
- トークン：`%APPDATA%\Pocket Deck\data\chrome-bridge.token`。再準備しても既存の値を保持します。
- ホスト登録：`HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\local.pocket_deck`。管理者権限は不要です。未知の既存登録は上書きしません。
- ホストは同梱プログラムで動作し、Pythonの追加インストールは不要です。ターミナルウィンドウは表示しません。
- 通信先は `http://127.0.0.1:8765/api/bridge`。トークンで認証します。
- 拡張権限は `storage`、`nativeMessaging`、`alarms`。ページ本文、メールアドレス、Cookie、閲覧履歴は取得しません。

## 確認

2つのプロフィールへの切り替え、最小化の復元、Chrome再起動後の再接続は、実際に拡張を読み込んだ後に確認してください。自動テストは模擬Chrome API、準備処理、同梱ホストの通信を検証します。

## 開発版と解除

開発版の従来の登録方法は `python install_chrome.py --extension-id 拡張ID` です。PCアプリの準備ボタンと併用して登録先を上書きしないでください。

解除する場合は各Chromeプロフィールから拡張を削除します。ホスト登録も削除する場合は、登録先を確認したうえで `python install_chrome.py --uninstall --dry-run`、`python install_chrome.py --uninstall` を実行します。配置データと画像は保持されます。
