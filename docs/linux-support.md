# Linux対応の実装・検証正本

目的は、Windows版の設定と操作を維持しながら、Ubuntuで同じスマホUI・編集画面・入力機能を使えるようにすること。ユーザーによるUbuntuの版や画面制御方式の事前調査を導入条件にしない。OS、CPU、X11/Wayland、APIと権限をアプリが確認する。

## 完了条件

| 段階 | 完了に必要な内容 | 現状 |
|---|---|---|
| L1 | OS共通キーと入力API、Windows入力の分離、既存設定の互換性、Windows回帰テスト | 実装・自動回帰検証済み |
| L2 | 環境・機能の実検出、利用可能/許可待ち/未対応のアプリ内表示と設定導線 | Ubuntu 24.04のPCホームで許可待ち→OS確認→利用可を実操作検証。別環境と拒否時の画面検証が残る |
| L3 | X11とWaylandでキー、保持、反復、クリック、ドラッグ、二本指/ホイール、切断と終了時の解除 | X11の実入力検証済み。両Ubuntuのnative Waylandでキー・保持ドラッグ・1.2秒反復・終了解除を確認。22.04のホイールも確認。24.04のホイールと切断失効時の実確認が残る |
| L4 | 日本語/改行/絵文字の入力、連続操作とキャンセル、OS依存キーの対応、重複再送の防止 | 両Ubuntuのnative WaylandでUnicode初回受信と連続操作・キャンセルを確認。端末への貼り付けと実再送抑止確認が残る |
| L5 | Linux Native Messagingホスト、アプリ内登録と修復、Chromeプロファイル切り替えと結果確認 | 実Chromeの2プロファイル接続、X11とWayland上のXWayland Chromeで相互切り替えを確認。native Wayland Chromeは別ウィンドウへのフォーカス拒否を検出。22.04側と修復の実確認が残る |
| L6 | AppImageとdeb、Python不要のバックエンド同梱、npmのOS別導入、確認付き更新とデータ保持、複数Ubuntuでのデスクトップ検証、配布文書 | AppImage/deb生成、Pythonなしの実バックエンド再起動と設定維持、sandbox有効のAppImage起動と実更新・設定保持を確認。deb/npm実導入、複数デスクトップの最終確認、公開用メタデータは未完了 |

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

### 追加検証

- Ubuntu 24.04 / GNOME 46.2：Docker内でXvfb上にnested Wayland compositorを起動。ホストの画面・入力・ユーザーデータとは分離。noVNCは127.0.0.1限定の検証用アクセス。GNOMEのRemoteDesktop確認画面を操作し、native GTK Waylandアプリのキー押下・解除、Button1Mask付きの移動を確認した。
- 同環境のPCアプリホーム：「入力を許可」から実OS確認を開始し、キー・マウス・文字入力が利用可へ変わることを確認。検証コンテナのElectronだけに`--no-sandbox`を指定しているため、この検証は製品のsandboxを有効にした通常導入の証明にはならない。製品にはその設定を追加していない。
- 通常のElectron clipboard.writeTextでは、native Waylandの背面アプリからの貼り付けが届かない事例を実テストで検出。RemoteDesktopセッションにClipboard portalを追加し、OSが許可した選択データをUnix FDで渡す方式へ修正。
- `docs/verification/ubuntu-24-wayland-input.jsonl`：実GTKアプリが日本語、改行、絵文字を受け取った文字列を記録。絵文字はラボのフォントにより四角表示だが、バッファ中のコードポイントは一致した。
- 旧デスクトップでClipboard portalが存在しない場合だけ、常駐X11 clipboard ownerを利用する。キーは引き続き許可済みWayland portalから送る。Clipboard portalが存在して許可を拒否された場合は迂回しない。Xvfb上の実xclipへのUTF-8転送を検証済み。
- Ubuntu 22.04 / GNOME 42.9：別の隔離コンテナでnative GTK Waylandアプリへのキー、保持ドラッグ、ホイール、初回Unicode貼り付け、1.2秒保持時のOS反復と解除を確認。旧MutterのXWayland選択データ通知より先に貼り付けてしまう問題を検出し、TARGETS要求への応答を待つよう修正。初回操作での日本語・改行・絵文字受信まで再検証した。
- private D-Bus上の模擬portalで6件成功。確認画面の前後、早着Response、許可拒否、部分許可、失効、終了時解除、Clipboard準備順序を検証。これを実compositor入力検証の代用にしない。
- Linuxのdesktopテスト21件成功。Windowsは19件成功、Linux専用2件除外。npmテスト14件成功。
- Ubuntu 22.04でPyInstallerのLinuxバックエンドを生成し、`PATH=/nonexistent`で`--help`を実行できた。Linux filesystem上でelectron-builder 26.15.3からAppImageとdeb、latest-linux.ymlを生成。これらはローカル検証用1.0.4であり、新規公開済みLinuxリリースではない。
- `.github/workflows/linux.yml`はUbuntu 22.04/24.04で共有・X11・模擬portal・同梱バックエンドを検証する定義。まだGitHubへpushしておらず、Actionsで実行済みとは扱わない。

### 2026-09-29の追加検証

- Ubuntu 22.04 / WSLの隔離Xvfbで、sandboxを無効化せずAppImageを起動。実rendererのSeccomp有効状態とアプリホーム、同梱入力バックエンドの利用可を確認。これは通常の物理デスクトップ全組み合わせの検証ではない。
- 同環境で、ローカル更新feedから検証専用AppImage 1.0.4→1.0.5の確認ダイアログを操作。更新ファイルのSHA-256一致、旧ファイルの置き換え、起動中app.asarの版番号1.0.5、保存済み配置JSONの完全一致を確認。`verify-update-fixture.py`の結果：SHA-256 `312a46ae56904538f539ad0124ce94ec4f6811e48544dbcc8a3ecebdd7037676`、再起動PID 9333。公開版の更新配信を検証したものではない。
- 実同梱バックエンドの試験で、PythonをPATHから除いて起動・設定保存・終了・同じポートへの即時再起動・保存データ維持を確認。生きている別インスタンスとの同時bindは拒否。Linuxの終了後TIME_WAITで再起動を妨げないようSO_REUSEADDRを使用し、Windowsの排他設定は保持。
- Chrome for Testing 154.0.8037.57の隔離2プロファイルでNative Messaging接続を確認。X11のプロファイルUへの切り替え要求が実際にdoneとなった。再起動だけではunpacked拡張機能の変更が反映されない事例を検出し、管理画面の再読み込みを実施。古いコードでのWayland失敗を最新版の検証結果として採用しない。
- 通常の修正版を両プロファイルで再読み込みして比較：X11/OpenboxでU→BとB→Uがdone。GNOME 46.2 Wayland上のXWayland Chrome（`--ozone-platform=x11`）でも両方向done。native Wayland Chrome（`--ozone-platform=wayland`）では、背面のUへの要求がフォーカス未取得でerror、現在のBへの要求がdone。フォーカス要求を一度だけ送った後、期限内で実状態を確認する。拒否時の成功扱いや自動再送は行わない。
- 両Ubuntuのnative GTK Waylandアプリで、実製品のApp/Keyboard/Runtimeを許可済みportalへ接続し、Ctrl+A→日本語/絵文字→待機→Enter→文字入力を実行。受信結果は`連続操作🙂\n完了`。Shift保持→待機→文字入力の途中キャンセルでShift解除を受信、状態cancelled、保持キー空、後続文字は未受信。backend.close時のShiftとマウスボタン解除も実受信。`docs/verification/ubuntu-{22,24}-wayland-macro-close.jsonl`に記録。24.04の1.2秒保持では25個のaとキー解除を受信した。
- Ubuntu 22.04の隔離コンテナにdebをaptで実インストール。旧生成物の即時再起動失敗を検出し、修正済みソースからバックエンドとdebを再生成してdpkgで更新。インストール先`/opt/Pocket Deck/resources/backend/PocketDeckServer`を対象に、PythonをPATHから除いた起動、排他的bind、即時再起動、配置保存維持の試験が成功。deb版デスクトップの画面とアンインストール時のデータ保持はまだ未検証。
- インストールしたdeb版のホームと接続可能表示を実画面で確認。コンテナだけの`--no-sandbox`指定なので、sandbox有効の証拠とは分ける。実アプリのHTTP経由で配置を変更・保存し、検証アプリを終了後に`dpkg -r pocket-deck-desktop`を実行。実行ファイルの削除と、`/tmp/deck-deb-check/Pocket Deck/data/config.json`の保存データ完全一致を確認。手順は`verify-deb-lifecycle.py`。

## Chromeの実検証で確認した制限

Native Messagingが接続中でも、Chromeが入力フォーカスを取得できるとは限らない。確認したGNOME Wayland環境では、native Wayland Chromeの別プロファイルを前面化して入力先にする要求が拒否された。同じデスクトップでChromeだけをX11モードで起動すると、XWayland経由で両プロファイルへの切り替えが成功した。これはキーボード・マウス入力をX11へ迂回する変更ではない。Pocket DeckのWayland入力は許可済みRemoteDesktop portalを維持する。

切り替えが必要な利用者向けの選択肢はChromeの`--ozone-platform=x11`起動。既存のChromeを自動で終了・再起動したり、プロファイル設定を書き換えたりしない。拡張を更新・修復した場合は、各プロファイルの`chrome://extensions`でPocket Deckの再読み込みを行う。Chromeの再起動だけを更新の証拠にしない。

## 作業再開用の検証環境

- Ubuntu 24.04コンテナ：`pocket-deck-lab-24`。noVNC `http://127.0.0.1:6084/vnc.html?autoconnect=1`。ラボのセッション変数は`/tmp/deck-session.env`。ソースは`/source`へread-only mount。検証専用データは`/tmp/deck-test-config/Pocket Deck`。
- Ubuntu 22.04コンテナ：`pocket-deck-lab-22`。noVNC `http://127.0.0.1:6085/vnc.html?autoconnect=1&resize=scale`。初回起動時のXWayland検出待ちを修正する前に作ったイメージなので、このコンテナの`/tmp/deck-session.env`だけにDISPLAY=:0とXAUTHORITYを追記してある。次回ビルドでは修正済みスクリプトを使う。
- 22.04のイメージ生成は`docker build --build-arg UBUNTU_VERSION=22.04 -t pocket-deck-linux-lab:22.04 app/desktop/integration/linux-lab`。デスクトップ用スクリプトをリポジトリに保存してある。
- WSLのビルドコピー：`/tmp/pocket-deck-package`。生成物は`app/desktop-dist`。最後の生成物には後から追加したClipboard portalなどをまだ反映していないため、最終検証前にソースを同期し、バックエンドとデスクトップを再ビルドする。
- 残る実動作：24.04のWaylandホイール/反復と両環境の終了解除、連続操作・キャンセルと端末貼り付け、22.04のChrome連携と実修復、deb/npm実導入と複数環境の最終パッケージ確認。公開版番号とLinux配布ハッシュは全生成物の確定後に決める。
