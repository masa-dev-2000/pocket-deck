# 開発とパッケージ作成

## 構成・パッケージ

`app/*.html`・`*.js`・`style.css` はスマホUI、`server.py` はHTTPとWindowsのSendInputによる入力、`features.py` は連続操作などです。`app/desktop/` のElectronがPythonバックエンドを起動します。Node.js統合を無効化し、contextIsolation・sandboxを有効にしています。PythonバックエンドはPyInstallerで同梱し、ChromeのNative MessagingホストはC#ランチャーから起動します。

| パッケージ | 役割 | 管理場所 |
| --- | --- | --- |
| Pillow 12.2.0 | 画像変換・アイコン生成 | `app/requirements.txt` |
| qrcode 8.2 | 接続QR | `app/vendor/` にソースとライセンス同梱 |
| PyInstaller 6.19.0 | バックエンドの実行ファイル化 | `app/desktop/requirements-build.txt` |
| Electron 44.4.5 | PCアプリUI | `app/desktop/package.json`・ロックファイル |
| electron-builder 26.15.3 | NSISインストーラー | 同上 |

Windows x64、Python 3.13、Node.js 22.12以上、npm、Gitが必要です。C#ビルドは `%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe` を使用します。依存の変更時にはロックファイルとライセンスも更新してください。

## 準備と検証

PowerShellで実行します。仮想環境の有効化は不要です。

```powershell
git clone https://github.com/masa-dev-2000/pocket-deck.git
cd pocket-deck
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r app\desktop\requirements-build.txt
cd app\desktop
npm ci
npm test
cd ..
..\.venv\Scripts\python.exe run_checks.py
cd ..
```

検証ログは `app/checks.log`、失敗時は終了コード1です。模擬入力・一時データで検証し、Chromeランチャーを生成します。本番データをテストに使わないでください。

## ソース版

リポジトリ直下で実行します。

```powershell
.\.venv\Scripts\python.exe app\server.py --host 127.0.0.1 --port 8766 --data-dir .\local-data
```

ブラウザーで `http://127.0.0.1:8766/` を開きます。実際のPC入力を行うので、確認用メモ帳などで試してください。UIだけの検証には `app/test_fixture.py --port 8766` を使用します。スマホ接続の検証は信頼できるネットワークで明示的にLAN待受を指定し、ファイアウォールを確認してください。

引数なしのソース版は `app/config.json`、Electron開発版・配布版は `%APPDATA%\Pocket Deck\data` を使用します。`npm start` も本番データを使うため、既存アプリと同時起動しないでください。

## インストーラー

依存導入後、リポジトリ直下から実行します。

```powershell
cd app\desktop
..\..\.venv\Scripts\python.exe build_backend.py
..\..\.venv\Scripts\python.exe test_packaged.py
..\..\.venv\Scripts\python.exe test_packaged_chrome.py
npm run package
cd ..\..
```

生成先は `app/desktop-dist/Pocket Deck Setup <version>.exe`。`win-unpacked` は展開済みの確認用アプリ、`.blockmap` は補助生成物です。自動更新未対応のため、利用者へはインストーラーを配布します。Electron開発起動の前にもバックエンドをビルドしてください。

## Git管理

個人設定、画像、トークン、ホスト登録、ログ、バックアップ、実行ファイル、ビルド成果物、Python/Node環境は `.gitignore` で除外します。ロックファイル、qrcodeのソースとライセンス、アイコンは追跡します。Chrome拡張のmanifestにある `key` はID固定用の公開鍵であり、秘密鍵ではありません。

## CI

ActionsはWindows上でソース検証を行います。手動実行ではバックエンド・インストーラーをビルドし、インストーラー、チェックサム、ライセンス案内をArtifactsへ保存します。CI成功は別PCやスマホの実機確認の代わりではありません。[配布手順](release.md)も確認してください。
