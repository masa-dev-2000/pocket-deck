# Linux対応の実装・検証正本

目的は、Windows版の設定と操作を維持しながら、Ubuntuで同じスマホUI・編集画面・入力機能を使えるようにすること。ユーザーによるUbuntuの版や画面制御方式の事前調査を導入条件にしない。OS、CPU、X11/Wayland、APIと権限をアプリが確認する。

## 完了条件

| 段階 | 完了に必要な内容 | 現状 |
|---|---|---|
| L1 | OS共通キーと入力API、Windows入力の分離、既存設定の互換性、Windows回帰テスト | 実装・自動回帰検証済み |
| L2 | 環境・機能の実検出、利用可能/許可待ち/未対応のアプリ内表示と設定導線 | 検出APIとPCホームの表示を実装。許可導線と画面検証は未完了 |
| L3 | X11とWaylandでキー、保持、反復、クリック、ドラッグ、二本指/ホイール、切断と終了時の解除 | X11の実入力検証済み。Waylandと長時間反復は未完了 |
| L4 | 日本語/改行/絵文字の入力、連続操作とキャンセル、OS依存キーの対応、重複再送の防止 | 未着手 |
| L5 | Linux Native Messagingホスト、アプリ内登録と修復、Chromeプロファイル切り替えと結果確認 | 未着手 |
| L6 | AppImageとdeb、Python不要のバックエンド同梱、npmのOS別導入、確認付き更新とデータ保持、複数Ubuntuでのデスクトップ検証、配布文書 | 未着手 |

初回配布はWindows/Ubuntu x64。ARM64は別の追加段階。Ubuntuの複数LTSでX11/Waylandを検証し、環境ごとの確認結果を残す。未検証の組み合わせや制限を対応済みと表示しない。

## 方式

- 配置・自動保存・操作HTTP APIは共通。保存済みのキー名とconfig v4を保持し、内部入力はキー名で渡す。既存のWINは内部SUPERに対応させる。
- WindowsはSendInput。X11は常駐XTest接続。WaylandはRemoteDesktop portalの許可セッションと利用可能な入力API。XWaylandの存在だけを根拠にWayland対応と判定しない。
- OSの入力許可はアプリで案内する。許可の拒否を別方式で迂回しない。uinputを追加する場合は明示的な別設定とし、権限を黙って変更しない。
- 入力の失敗を成功扱いしない。保持解除に失敗した記録は再試行に必要な状態として残す。文字列と連続操作の自動再送を避ける。
- LinuxビルドはLinuxで行う。単体テストや模擬portalだけではWayland実機検証を完了扱いしない。

## 作業環境・安全境界

作業ブランチは`feat/linux-support`。既存のWindowsインストールやデータをテスト対象にしない。WSL Ubuntu-22.04をビルド・自動テストに利用する。X11入力は隔離したXvfbで検証し、WSLgの普段の画面には入力しない。Waylandの実際の許可・入力は別のデスクトップ環境で確認が必要。

公開はレビュー可能なソースと生成物、検証結果を揃えた後に承認を得る。1.0.4の公開承認をLinux版の新規公開承認として流用しない。

## 検証記録（2026-09-28）

- Windows：`python app/run_checks.py`成功。共有設定・HTTP・保持・キャンセル・画像・ChromeブリッジのPythonテスト25件と既存のJS検証を通過。WindowsのSendInputイベント構造の検証を維持。普段のPCへの実入力は行っていない。
- Windows：`app/desktop`の`npm test`で16件成功。既存プロセスを停止しないこと、Chrome登録の保護、確認付き更新とOS別実行ファイルパスを検証。
- Ubuntu 22.04 / Python 3.10：Linux用一時venvで`run_checks.py`成功。Windows GUIランチャーの試験1件だけを対象OSの理由で除外。
- Ubuntu 22.04 / Xvfb：`DECK_XVFB_TEST=1`、`WAYLAND_DISPLAY`を除外し、`xvfb-run -a ... -m unittest -v test_x11_integration.py`成功。別のX接続のウィンドウが実際に受け取ったキー、Ctrl同時押し、保持したマウス移動、部分ホイール量の蓄積、終了時のキーとボタンの解除を検証。
- この記録はWayland、文字入力、LinuxのElectron画面、パッケージや更新の完成を証明するものではない。それぞれ後続段階で実装・検証する。
