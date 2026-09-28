# 配布とリリース

Gitにはソース、テスト、文書、ライセンスを入れます。実行ファイルはコミットせずReleasesへ添付します。個人設定・画像・トークン・PC固有のファイアウォールスクリプトは配布しません。

## 添付ファイル

- `Pocket Deck Setup <version>.exe`：Windows x64インストーラー。
- `SHA256SUMS.txt`：インストーラーのSHA-256。
- `LICENSE`、`THIRD_PARTY_NOTICES.md`：本体・依存ライセンス案内。原文はインストール先の `resources/license-notices/` にも同梱。

## 手順

1. `app/desktop/package.json` とロックファイルのバージョンを一致させます。
2. [開発ガイド](development.md)の検証とビルド、またはActionsの手動ビルドを実行します。
3. 新規導入、更新時のデータ保持、QR接続、スマホ入力、終了、任意のChrome連携を確認します。未確認項目はリリースノートに記載します。
4. 個人データを含まないこと、依存ライセンスが同梱されていることを確認します。
5. チェックサム、Gitタグ `v<version>`、GitHub Releaseを作成し成果物を添付します。

PowerShellでのチェックサム作成例：

```powershell
$deckInstaller = 'app\desktop-dist\Pocket Deck Setup 1.0.3.exe'
$deckHash = (Get-FileHash -LiteralPath $deckInstaller -Algorithm SHA256).Hash.ToLowerInvariant()
"$deckHash  $(Split-Path -Leaf $deckInstaller)" | Set-Content -LiteralPath 'app\desktop-dist\SHA256SUMS.txt' -Encoding ASCII
```

チェックサムはコード署名とは別です。現在は未署名、自動更新なし、スマホ接続は認証・HTTPSなしのMVPです。別PCでの新規導入・全機能確認は未実施で、保持ドラッグにも既知の問題があります。広い配布には実機確認・接続認証・コード署名・更新方法を別途整備してください。
