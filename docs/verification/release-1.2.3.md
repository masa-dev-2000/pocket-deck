# Pocket Deck 1.2.3 配布前検証

対象ソース: `7cca4d7e2c8cd51549c36ce975907ded996f4698`。後続変更はREADME・配布手順・npmの実物チェックサムだけで、アプリの実装と版は同一です。

| 検証 | 結果・証跡 |
|---|---|
| Windowsソース・desktop・npm・配布形式・インストーラービルド | [成功](https://github.com/masa-dev-2000/pocket-deck/actions/runs/38839779579) |
| Ubuntu 22.04／24.04、X11／portal、配布形式、deb／AppImage | [成功](https://github.com/masa-dev-2000/pocket-deck/actions/runs/38839779471) |
| macOS arm64／x64、Quartz ABI、ad-hoc署名、配布形式、実ZIPの隔離導入 | [成功](https://github.com/masa-dev-2000/pocket-deck/actions/runs/38839779708) |
| 各OS成果物のチェックサム照合とnpm配布情報の生成 | [成功](https://github.com/masa-dev-2000/pocket-deck/actions/runs/38840463106) |
| ローカルのブラウザーテスト | 1120×800・375×667で空グループ作成、F14選択、候補保存・戻る・削除、連続操作から候補一覧へ戻る、JavaScriptエラーなしを確認 |

個人用スクリプト・設定・画像は配布しません。スマホ実機による今回の変更の確認は未実施です。
macOS版は試験版で、Developer ID署名・公証、実機の初回起動と入力許可は未確認です。
