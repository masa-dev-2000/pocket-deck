# 配布とリリース

Gitにはソース、テスト、文書、ライセンスを入れます。実行ファイル・個人設定・画像・トークンはコミットしません。

## 成果物

同じGitHub Releaseへ次のファイルを添付します。

- `Pocket-Deck-Setup-<version>.exe`：Windows x64インストーラー。
- `Pocket-Deck-Setup-<version>.exe.blockmap`：更新の差分情報。
- `latest.yml`：更新情報。exeの名前・サイズ・ハッシュと一致する必要があります。
- `Pocket-Deck-<version>-amd64.deb`：Ubuntu x64の標準導入。
- `Pocket-Deck-<version>-x86_64.AppImage`：追加の持ち運び形式。
- `latest-linux.yml`：同じ版のdebとAppImageのサイズ・SHA-512を含むLinux更新情報。
- `Pocket-Deck-<version>-arm64.dmg`／`.zip`：Apple Silicon向け試験版。
- `Pocket-Deck-<version>-x64.dmg`／`.zip`：Intel Mac向け試験版。
- `SHA256SUMS.txt`、`LICENSE`、`THIRD_PARTY_NOTICES.md`。

## 手順

1. Desktopとnpmの版を一致させ、[開発ガイド](development.md)の検証とビルドを実行します。
2. 新規導入、npmによる導入と更新、確認付き更新、データ保持、QR接続、入力、終了を検証します。未確認項目はリリースノートに記載します。
3. 個人データの除外とライセンス同梱を確認します。インストーラーのSHA-256・bytes・取得URLを`npm/release.json`へ反映します。
4. npmのテスト・pack・publish dry-runを実行します。グローバル導入の試験は隔離環境で行い、既存ユーザーのアプリを更新しません。
5. 公開承認後、ソースをpushしてタグ`v<version>`とGitHub Releaseを作成します。下書きへ全成果物を添付してから公開します。通常の更新は正式リリースだけを対象とし、試用版リリースは対象外です。
6. 公開URLの取得・ハッシュを確認してからnpmの確認済みtgzを公開し、レジストリのハッシュ・npxの実行・取得を確認します。

1.0.3には更新機能がありません。1.0.4以降の更新対応版を一度npmまたはexeで導入する必要があります。公開済みの同名・同バージョンの成果物を差し替えず、新しいバージョンで配布します。

WindowsとUbuntuの版番号をそろえ、両方の更新情報を同じ正式Releaseへ載せます。LinuxのみのReleaseを最新版にすると、既存Windowsアプリが`latest.yml`を取得できなくなるため、片方だけの公開を行いません。npmの`release.json`はWindowsを最上位、Ubuntuのdebを`linux`に記載し、各ファイルのURL・SHA-256・bytesを実物へ合わせます。AppImageとdebのSHA-512は更新情報と照合します。

Ubuntuのnpm導入は通常ユーザーで実行し、OSの導入認証を完了した場合だけアプリを起動します。deb更新も認証取消時に中止し、別の修復コマンドを自動実行しません。導入版の確認後に再起動します。実テストは[Ubuntuの記録](linux-support.md)に残し、公開サーバーからの取得試験とは区別します。

チェックサムはコード署名とは別です。現在は未署名、スマホ接続は認証・HTTPSなしのMVPです。保持ドラッグにも既知の問題があります。別PCやスマホの全機能検証は自動チェックとは別に必要です。

macOSの1.2.0-beta.2はad-hoc署名の試験版です。Developer ID署名・公証はなく、自動更新は無効です。Apple Silicon／IntelのZIPをnpm導入用に添付し、対応するDMGを直接導入用に添付します。両CPUのCIで署名と同梱バックエンドを検証しても、実機のGatekeeper初回起動・入力許可・入力先での受信は別途確認が必要です。
