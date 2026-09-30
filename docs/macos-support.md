# macOS対応の実装・検証正本

公開済みWindows／Ubuntu版1.1.0を保持し、macOS 13以降のApple SiliconとIntel向けに1.2.0-beta.1の試験版を作る。既存スマホUI・config v4・編集機能を共有する。

| 範囲 | 状況 |
| --- | --- |
| Quartzキー・Command／Option・保持／反復・未対応キーのエラー | 実装済み。両CPUのMac CIで許可なし／失効／解除再試行の単体試験と実Quartz APIでのイベント生成・型・flags・drag delta確認が成功。実OSへの入力は送信していない |
| マウス・保持ドラッグ・二本指／ホイール・小移動の蓄積 | 実装済み。保持を維持したドラッグイベントと解除失敗の保持記録を単体試験。実入力先の受信は未確認 |
| 日本語・絵文字・改行 | 既存デスクトップ接続＋Command+V。転送と押下解除を単体試験。実入力先は未確認 |
| OS許可とアプリ導線 | 送信権限を実APIで確認し、未許可は入力停止。「入力を許可」からOS要求と設定への導線。実画面は未確認 |
| Chrome Native Messaging | Mac用Libraryパス、所有済み登録のみ修復、更新後も使えるホストコピーと相対symlink保持。両CPUのMac CIで登録・修復・模擬ホスト起動・データ保持の試験が成功。実Chrome切り替えは未確認 |
| デスクトップ・Dock・編集メニュー・保存・終了 | Mac用導線を追加。起動・メニュー・終了の実画面は未確認 |
| Python不要のDMG／ZIP、両CPUビルド | 両CPUでDMG／ZIP生成、同梱backendのPython不要起動・保存・排他的listen・再起動、同梱依存の読み込み、ad-hoc署名検証が成功 |
| 署名・公証・更新・配布 | ad-hoc試験版。Developer ID署名／公証は未実施。自動更新を停止。既存npm 1.1.0とGitHub Releaseは変更しない |

全体を完了とは扱わない。CIで作成した試験版と、ユーザーのMacでの許可・実操作確認を区別する。許可失効中はOSで保持解除が受理されない可能性があるため、解除未確認の記録を捨てずにエラーを返す。OSの権限を迂回しない。

実装：`app/input_backend/macos.py`、`app/desktop/mac-chrome.cjs`、既存OS分岐・ビルド設定。ユーザー向け手順は[macOS試験版](macos.md)。

## 2026-09-29の試験版作成結果

[CI 36511000860](https://github.com/masa-dev-2000/pocket-deck/actions/runs/36511000860)はソース`365d8aa7671bfad9c0b2a35427908586b35599bb`を対象に、macOS 15のApple Silicon／Intel両runnerで成功。共有Python40件（Windows専用1件除外）、desktop Node32件（30成功・Linux専用2件除外）、共有JavaScript、同梱backendの起動・保持、DMG／ZIP生成と署名検証まで成功した。

配布artifactのcentral directory・SHA256SUMS・署名情報を実HTTPで取得した。署名は`Signature=adhoc`、TeamIdentifierなしで、Developer IDや公証ではない。大容量のローカル再取得は遅いため中止しており、手元でバイナリ全体のSHA-256を再計算した証拠とは区別する。記録は[macos-1.2.0-beta.1-ci.json](verification/macos-1.2.0-beta.1-ci.json)。GitHub Release／npmへは公開せず、Actionsの14日保存の試験版として提供する。


## Mac npm導入の追加実装（ローカル・未公開）

`npm/bin/macos-install.cjs` にCPU別ZIPのユーザー用導入を追加した。署名／版／CPUを検証して `~/Applications/Pocket Deck.app` を置換し、起動中の更新を拒否する。置換前の失敗では旧版を保持し、復旧不能時はバックアップの場所を通知して保持する。Node経由の取得でもGatekeeperの初回判定が省略されないよう隔離属性を付け、TCC権限を自動付与しない。

npm作業版は1.2.0-beta.1。公開済みWin／Ubuntu 1.1.0のmetadataは変更していない。Macの公開ZIP URLと確定ハッシュがないため、Mac metadataは未登録で、導入コマンドは未配布のエラーで停止する。詳細は[npm公開準備](npm.md)。Windowsでの単体試験は確認済みだが、追加Mac CIはまだ実行していない。実Macの初回起動・権限・更新確認は未確認で、全体完了とは扱わない。
