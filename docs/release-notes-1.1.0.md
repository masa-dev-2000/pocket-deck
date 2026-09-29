# Pocket Deck 1.1.0 リリースノート

Ubuntu x64で、スマホの配置・キーボード・パッド・ホイールからPCを操作できるようになります。Windows版と同じ配置編集・自動保存・文字列・連続操作を使い、X11／Waylandの入力方式は自動検出します。

## 導入

- Windows：`Pocket-Deck-Setup-1.1.0.exe`を実行します。
- Ubuntu：`sudo apt install ./Pocket-Deck-1.1.0-amd64.deb`。追加のPython／Node.jsは不要です。
- npm：Node.js 22.12以上。Windowsは`npm install -g @masadev/pocket-deck`。Ubuntuは通常ユーザーで`npm install -g --prefix "$HOME/.local" --foreground-scripts @masadev/pocket-deck`を実行し、OS認証を完了します。

Ubuntuの入力許可はPCアプリから案内します。拒否した場合は入力せず、後から再試行できます。Linux端末への文字列入力には、ボタン・連続操作の「貼り付け先」で「Linuxの端末」を選べます。

## 更新

起動時または「更新を確認」で新版を確認し、「更新する」を選んだ場合だけ更新します。Ubuntuのdeb更新にはOS認証が必要です。取消した場合は導入せず接続を復帰し、導入版を確認した場合だけ再起動します。配置データはインストール先とは別に保持します。

## 検証と制限

Ubuntu 22.04／24.04の隔離環境でX11・Wayland入力を検証しました。通常起動した24.04 GNOME VMでは、sandbox有効のdeb、実npm導入・更新・認証取消、Unicode文字列、保持・ホイール、連続操作の受信を確認しています。個々の検証範囲は[Linux対応記録](linux-support.md)に記載しています。

- 初回対象はWindows／Ubuntu x64です。ARM64は含みません。
- GNOME Wayland上のnative Wayland Chromeでは、別プロフィールの前面化をOSに拒否される場合があります。ChromeのX11モードを選ぶ手順は[Ubuntu案内](ubuntu.md)を参照してください。
- OSのportalサービス自体が保持中に失効した場合、押下状態が残ることがあります。自動復旧は保証しません。
- AppImageがsandbox無効で起動する環境では停止してdeb導入を案内します。
- 既存の保持ドラッグ問題は残っています。連続操作の待ち時間は入力先とPCの負荷に合わせて設定してください。
- 配布物は未署名です。スマホ接続は信頼できるLAN向けのHTTP・認証なしMVPです。

MITライセンス。開発者の配置・画像・Chromeトークンは配布物に含みません。

Windows・Ubuntu 22.04／24.04のGitHub Actionsと、Windowsインストーラー／Ubuntu deb・AppImageのCI生成を確認しています。公開配布URLとnpmの確認結果はLinux対応記録へ追記します。
