# Linux対応の実装・検証正本

目的は、Windows版の設定と操作を維持しながら、Ubuntuで同じスマホUI・編集画面・入力機能を使えるようにすること。ユーザーによるUbuntuの版や画面制御方式の事前調査を導入条件にしない。OS、CPU、X11/Wayland、APIと権限をアプリが確認する。

## 完了条件

| 段階 | 完了に必要な内容 | 現状 |
|---|---|---|
| L1 | OS共通キーと入力API、Windows入力の分離、既存設定の互換性、Windows回帰テスト | 実装・自動回帰検証済み |
| L2 | 環境・機能の実検出、利用可能/許可待ち/未対応のアプリ内表示と設定導線 | Ubuntu 24.04のPCホームで許可待ち→OS確認→利用可を実操作検証。別環境と拒否時の画面検証が残る |
| L3 | X11とWaylandでキー、保持、反復、クリック、ドラッグ、二本指/ホイール、切断と終了時の解除 | X11と両Ubuntuのnative Waylandでキー・保持ドラッグ・反復・終了解除・ホイールを確認。24.04の通常失効と明示再許可も確認。brokerの異常終了ではOSに保持が残る制限を記録し、解除未確認を表示する |
| L4 | 日本語/改行/絵文字の入力、連続操作とキャンセル、OS依存キーの対応、重複再送の防止 | 両UbuntuでUnicode初回受信・連続操作・キャンセルを確認。24.04の実debで端末貼り付け、1500ms待機付き連続操作の完全一致、3回の再送抑止を確認。待ち時間は受信アプリの負荷に合わせて調整する |
| L5 | Linux Native Messagingホスト、アプリ内登録と修復、Chromeプロファイル切り替えと結果確認 | 両Ubuntuで実Chromeの2プロファイル接続と相互切り替え、22.04で修復後の再接続も確認。native Wayland Chromeは別ウィンドウへのフォーカス拒否を検出して案内する |
| L6 | AppImageとdeb、Python不要のバックエンド同梱、npmのOS別導入、確認付き更新とデータ保持、複数Ubuntuでのデスクトップ検証、配布文書 | ローカルの生成物・検証・配布文書は準備済み。両OS1.1.0のハッシュ・更新情報・npm tgzを照合しdry-run成功。24.04の実npm 1.1.0更新とアプリ内deb更新・認証取消・再試行・配置保持を確認。公開承認、Actionsと公開URLの確認が残る |

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

- Ubuntu 22.04 / WSLの隔離Xvfbで、検証用npm tarballを実際の`npm install -g --offline --foreground-scripts`で導入。AppImage、ラッパー、デスクトップ項目をユーザー用XDG領域に配置し、sandboxを有効にしたPCアプリの起動を確認。公開前のLinux配布ファイルは検証用キャッシュから取得しており、公開サーバーからの導入確認ではない。
- 同npm版のアプリ起動中に新しい版を導入すると拒否し、AppImageのハッシュ、導入記録、保存配置が変化しないことを実確認。Chromiumが元の環境変数を消すため、環境変数だけでは起動検出できない事例を発見。PID・起動時刻・boot IDと同一ユーザーの実行ファイルを確認する方式へ修正した。
- npm版のアプリ内更新で1.0.4→1.0.5を実行し、版番号、更新ファイルのハッシュ、保存配置の完全一致、起動用ラッパーの再利用、rendererのsandboxを確認。AppImageの名前を版番号なしで固定し、更新後もデスクトップ項目と導入記録のパスを維持する。`verify-npm-updated.py`は全条件成功。
- 最新の検証用npm版をグローバル導入し、実CLIの`--version`、`--help`、`install`のLinux分岐を確認。既存の同版アプリを開き、配置と導入記録を変更しないことを確認。Linuxのnpm自動テスト16件も成功。
- Ubuntu 24.04の通常起動したGNOMEを確認するため、公式cloud imageをSHA-256検証して隔離QEMU VMを構築中。nested Waylandの24.04側ではホイールの実受信を確認できていないため、対応済みとは扱わず通常起動の環境で切り分ける。VMのログイン鍵と個別データはリポジトリへ含めない。
- 同VMの通常起動GNOME/WaylandでRemoteDesktopの確認を実操作し、製品のホイール4段分をnative GTK受信側で確認。scroll-event 4件、スクロール位置0→224.2496を記録。製品コードの変更は不要だった。`docs/verification/ubuntu-24-vm-wayland-wheel.jsonl`。仮想GPUのGTK4描画エラーを避けるため、このVMのportal描画だけGSK_RENDERER=cairoを使用。製品のsandboxや入力許可は変更していない。
- 同VMの実HTTPへ連続操作を送り、終了後に同じownerの要求を3回再送しても同じjob ID/stateを維持し、再実行しないことを確認。`ubuntu-24-vm-wayland-replay.jsonl`。ただし受信文字列は期待した`連続操作🙂\n完了`に対し`\n完了`となった。初回文字列の転送タイミングを調査中であり、このVMの連続文字入力を完了とは扱わない。
- 24.04 VMのAppImage通常起動で、生成されたAppRunが`unshare -Ur true`の失敗時に自動で`--no-sandbox`を付けることを発見。実rendererには`--enable-sandbox`と`--no-sandbox`の両方が存在し、前者だけでは有効性の証拠にならない。これはsandbox有効の起動として数えない。Linux製品版は起動時に`--no-sandbox`を検出するとバックエンドを開始する前に停止してdeb導入を案内するよう修正。Windowsの起動条件は変更しない。生成物での停止確認と24.04のdeb起動検証はまだ残る。
- WSL 22.04の実npm更新アプリを、`--no-sandbox`が存在しないことも含めて再確認し成功。従来のSeccompと`--enable-sandbox`の確認に加え、検証スクリプトを強化した。デスクトップ自動テストはLinux23件成功、Windows21件成功・Linux専用2件除外。
- 修正後のAppImageを実際に生成し、隔離Xvfbで`--no-sandbox`付き起動を試験。停止案内が表示され、閉じると終了し、入力バックエンド用データを生成せず、別の隔離アプリの配置も変更しなかった。`verify-sandbox-guard.py`成功。24.04向けdebの通常sandbox起動とnpmの導入方式変更は後続確認が必要。
- 24.04 VMでdebを実インストール。パッケージ標準のアプリ専用AppArmor profileが配置され、OS全体のuser namespace制限は変更していない。`verify-vm-desktop.py deb`で同梱バックエンドPID 27052、renderer PID 26988の`--enable-sandbox`・`--no-sandbox`なし・Seccomp=2とconfig v4を確認。ただしウィンドウは非表示のままだった。ElectronのWaylandでの[ready-to-show不発の報告](https://github.com/electron/electron/issues/48859)と整合するため、Linuxは背景色付きウィンドウを最初から表示する方式へ変更。Windowsの初回描画待ちは維持。修正版の実画面確認を進める。

## 現在の導入方式と最新の確認範囲

- Ubuntu 22.04 / GNOME 42.9のXWayland Chrome for Testingで、実製品HTTPからU→B→Uのプロファイル切り替えを確認（全要求done）。Chrome登録の所有済みsymlinkとpopup.jsを欠損させ、実ChromeSetupで修復。接続token・config・登録プロファイルのハッシュを保ったまま復元でき、各プロファイルの「登録・再接続」後にもU→B→Uがdoneとなった。`prepare-chrome-check.cjs`、`verify-chrome-repair.cjs`、`verify-chrome-check.py`。テストのDBus・Chrome・バックエンドはGNOMEの通常ユーザーで起動する。rootでのラボ起動はスクリプトで拒否する。

- Ubuntuの標準配布はdebを採用する。npmも配布メタデータの`.deb`を識別して、検証済みファイルをOSの`pkexec apt-get install`へ渡す。通常ユーザーで実行し、OSの管理者認証は導入時だけ行う。取消・失敗・導入版番号未確認の場合は起動しない。実npm経由の管理者認証から起動までの通し検証は未完了であり、現時点では22.04の実npm AppImage導入、両環境の実deb導入、deb経路の自動テストを個別の証拠として扱う。
- Linuxの初回ウィンドウ表示を修正したdebを24.04 VMへ更新し、通常のホーム画面を実画面で確認した。再起動後の`verify-vm-desktop.py deb`も成功：同梱backend PID 3590、renderer PID 3485、config v4、`--no-sandbox`なし、Seccomp=2。このVMのデータは`/home/deck/pocket-deck-desktop-check`へ分離している。
- AppImageのextract-and-runで二度目の起動終了時に最初の起動の展開資源が削除される事例を確認。新しいnpmの起動環境とラッパーに`NO_CLEANUP=1`を追加した。`verify-appimage-relaunch.py`で実製品AppImageを新しい導入経路から起動し、ラッパーを2回開き直しても元の実行ファイル・app.asar・PID記録・保存配置が残ることを実確認（private PID 22171）。これは新しいLinux導入関数の検証であり、公開npm導入の証拠とは分ける。
- 24.04 VMのsandbox有効debで、ホーム→OS入力確認→取消→失敗表示→再度OS確認→キー・マウス・文字入力の利用可を実画面で確認。取消後にアプリの再起動は不要だった。
- VMのportal描画は仮想GPUのためcairoへ切り替えて検証する。入力許可要求中にportal実装を再起動するとアプリが失敗を表示した。ただしportal全体のowner変更後の再接続に問題があり、D-BusのNameOwnerChanged監視と明示再接続時の能力・owner再取得を追加。private D-Busの実transport上で新ownerへの再接続、許可を自動再要求しないことを含む7件成功。修正版の実GNOMEと最終生成物での再確認は残る。
- 再生成したsandbox有効debを24.04 VMへ更新して、実portal全体を再起動。ホームが即座に失効表示へ変わり、アプリを再起動せず「入力を許可」→新OS確認→キー・マウス・文字入力の利用可へ戻った。同梱backend PID 10583、sandboxed renderer PID 10496も再確認。保持中のキー・ボタンがサービス失効時に解除されることは別の実受信試験で確認する。
- 保持中の実試験では異なる結果になった。実debのHTTPでShiftとマウスを保持し、heartbeatを送りながら`xdg-desktop-portal.service`だけ再起動すると、失効は検出したが受信側に解除イベントは届かず、次の実キーが`A`（state=257、Shift+Button1）となった。再許可もマウスgrabに妨げられた。GNOME側の`xdg-desktop-portal-gnome.service`を検証用VMで再起動するとButton1/Shift解除を受信し、次の実キーが`a`（state=0）へ戻った。`ubuntu-24-vm-session-loss.jsonl`に記録。通常のユーザー環境のサービスは変更していない。
- この事実に合わせ、broker失効時には解除未確認の保持記録を消さず、OS側のリモート共有停止が必要な案内を追加した。OSの共有停止UIによる回復と、最終パッケージでの表示再検証は未完了。保持中の失効を自動復旧できるとは扱わない。GNOME実装の再起動をアプリが自動実行する方式は採用しない。
- 最新自動テスト：Windows npm 21成功・Linux専用1除外、desktop 21成功・Linux専用2除外。Linux npm主要17件成功。公開用Linuxメタデータと版番号はまだ変更していない。
- 24.04 VMのデスクトップ上のGNOME Terminalから、本物の`npm install -g --offline --foreground-scripts`で非公開の検証tarballを実行し、通常のpkexec/apt-get認証画面を確認。「Cancel」を押すとインストール失敗として終了し、実行ファイルは未導入、保存配置のSHA-256も一致した。`verify-vm-npm.py cancel`成功。SSHセッションにデスクトップ環境変数だけを渡した実行では認証agentへ接続できなかったため、その結果をデスクトップ導入の証拠にはしない。
- 同じ実npmを再実行してOS認証を完了し、apt-getがdebを導入、dpkgの導入済み1.0.4確認後にアプリを起動した。実ホーム画面、同梱backend PID 32343、renderer PID 32073のsandbox有効と保存配置一致を確認。`verify-vm-npm.py installed`成功、`ubuntu-24-vm-npm-deb.json`に記録。VMの合成テストアカウントの認証設定は元のロック状態に復元済み。公開registry/リリースサーバーからのLinux導入試験ではない。低速TCG VMでは初回ホームに接続失敗が表示されることがあり、接続表示の回復も別途確認する。
- 同じ導入アプリで接続可能表示とOSの再許可を確認。GNOME上部バーの共有停止ボタンで通常のSession.Closedとアプリの許可終了表示を確認した。一方、Shiftとマウスの押下を実GTK受信側で確認して保持すると、共有停止へのマウスクリックは届かなかった。Ctrl+Alt+Tabから上部バーを移動することはできたが、保持中の停止完了・両解除は確認できず、その試験を中断した。portalが生きている状態の製品APIによる全解除で検証入力は解除済み。OS停止UIによる保持中の回復を対応済みとは扱わない。

## 端末向け文字入力の追加確認

- 24.04 VMの再生成debで、実GNOME TerminalのPTY受信側へ文字列ボタンから`端末🙂\n改行`を送り、完全一致を確認。`docs/verification/ubuntu-24-vm-terminal-input.json`は受信した結果。端末のシェルとして実行せず、検証用の2行入力で受信した。
- 文字列ボタンと連続操作の文字入力に、通常のCtrl+VとLinux端末向けCtrl+Shift+Vの選択を追加。WindowsのUnicode SendInputは維持。設定は既存config v4で保持し、省略時は従来の通常入力。
- Clipboard portalの転送処理は、非同期FD要求前に今回のデータを固定し、要求待ち中に次の文字列へすり替わらないよう修正。private D-Busの9件で順序と保持解除を確認。ただし受信アプリの貼り付け完了を保証するものではなく、連続操作の待ち時間は必要。
- 編集画面で端末向け選択と自動保存を実確認。今回のChrome viewport overrideは実寸に反映されなかったため、この追加項目のiPhone SE相当サイズの実画面確認としては扱わない。
- 新しいdebを実npm経由で導入した24.04 VMのnative GTK入力先へ、実HTTPでCtrl+A→文字列→1500ms待機→Enter→文字列→1500ms待機を実行。受信結果は`連続操作🙂\n完了`で完全一致。同じownerの要求3回を再送してもjob/stateは変わらなかった。`ubuntu-24-vm-packaged-macro.json`。150msで欠けた過去の結果を取り消すものではなく、低速VMでは待ち時間調整が必要という確認。

## 最終1.1.0の導入・更新確認

- 正確な公開候補npm 1.1.0 tgzから、通常のGNOME Terminal内で実`npm install -g --offline --foreground-scripts`を実行。認証取消時は旧deb 1.0.4と保存配置を維持。再試行でdeb 1.1.0導入・起動、sandboxed rendererと同梱backend、設定のSHA-256一致を確認。`ubuntu-24-vm-final-npm-deb.json`。公開registry取得の検証ではなく、SHA-256検証した公開候補debのオフライン導入。
- 実1.1.0 debのアプリ内更新をprivate localhost feedで検証。「後で」は導入せず継続。OS認証Cancelで1.1.0と設定を保持し、同じrendererのままbackendを再起動してHTTP接続を復帰した。別のapt修復・再認証は起動しなかった。`ubuntu-24-vm-deb-update-cancel.json`。
- 再試行の通常OS認証後、検証専用deb 1.1.1へのapt導入・版確認・自動再起動を実行。sandboxed renderer PID 57033、同梱backend PID 57150、HTTP接続と保存配置一致を確認。`ubuntu-24-vm-deb-update-installed.json`。1.1.1は非公開試験版で、公開候補1.1.0とは別に保管。更新後の公開GitHub feed確認はLinux metadata未公開のため失敗表示となるが、接続は利用可。公開後に別途URL確認する。
- 検証用VMの認証設定は試験後に元の状態へ復元済み。普段のWindows Pocket Deckとデータは変更していない。
- 最新の自動テスト：desktopはWindows27成功・Linux専用2除外／Linux29成功。npmはWindows21成功・Linux専用1除外／Linux22成功。共有チェックは両OS成功、private D-Busのportal試験9成功。両OSの最終同梱依存確認とnpm publish dry-runも成功。GitHub Actionsでの実行は未着手。
- 公開待ちの最終照合では、保存中の全Release添付ファイルをSHA256SUMSと再照合し、npm tgzの9ファイルを現在のソースとバイト単位で比較した。両OSのnpm manifestのサイズ・SHA-256も実インストーラーと一致。`docs/verification/release-1.1.0-local-audit.json`。まだ公開していない。
- 公開承認後、ソース`0c716818588213bf6cf314682214edb24ef3277c`をmainへ反映。Windows追加CI [36504647376](https://github.com/masa-dev-2000/pocket-deck/actions/runs/36504647376)とUbuntu追加CI [36504650150](https://github.com/masa-dev-2000/pocket-deck/actions/runs/36504650150)が成功。Windowsインストーラー、22.04のdeb／AppImage生成、同梱依存確認まで成功。24.04でも共有・入力・同梱backendチェックが成功。公開するのは先に実OS検証したローカル生成物であり、CIで再生成した別ハッシュのファイルへ差し替えない。

## Chromeの実検証で確認した制限

Native Messagingが接続中でも、Chromeが入力フォーカスを取得できるとは限らない。確認したGNOME Wayland環境では、native Wayland Chromeの別プロファイルを前面化して入力先にする要求が拒否された。同じデスクトップでChromeだけをX11モードで起動すると、XWayland経由で両プロファイルへの切り替えが成功した。これはキーボード・マウス入力をX11へ迂回する変更ではない。Pocket DeckのWayland入力は許可済みRemoteDesktop portalを維持する。

切り替えが必要な利用者向けの選択肢はChromeの`--ozone-platform=x11`起動。既存のChromeを自動で終了・再起動したり、プロファイル設定を書き換えたりしない。拡張を更新・修復した場合は、各プロファイルの`chrome://extensions`でPocket Deckの再読み込みを行う。Chromeの再起動だけを更新の証拠にしない。

## 作業再開用の検証環境

- Ubuntu 24.04コンテナ：`pocket-deck-lab-24`。noVNC `http://127.0.0.1:6084/vnc.html?autoconnect=1`。ラボのセッション変数は`/tmp/deck-session.env`。ソースは`/source`へread-only mount。検証専用データは`/tmp/deck-test-config/Pocket Deck`。
- Ubuntu 22.04コンテナ：`pocket-deck-lab-22`。noVNC `http://127.0.0.1:6085/vnc.html?autoconnect=1&resize=scale`。初回起動時のXWayland検出待ちを修正する前に作ったイメージなので、このコンテナの`/tmp/deck-session.env`だけにDISPLAY=:0とXAUTHORITYを追記してある。次回ビルドでは修正済みスクリプトを使う。
- 22.04のイメージ生成は`docker build --build-arg UBUNTU_VERSION=22.04 -t pocket-deck-linux-lab:22.04 app/desktop/integration/linux-lab`。デスクトップ用スクリプトをリポジトリに保存してある。
- WSLのビルドコピー：`/tmp/pocket-deck-package`。Windowsの独立ビルドコピー：隣接する`pocket-deck-release-work`。最終1.1.0生成物には端末向け入力、Clipboard転送、修正版deb更新を反映済み。両OSの同梱依存を実ElectronバイナリのNodeモードで確認した。
- 公開用生成物：隣接する`pocket-deck-release-staging/1.1.0`。Windows exe・blockmap・latest.yml、Ubuntu deb・AppImage・latest-linux.yml、ライセンス・SHA256SUMSと正確なnpm tgzを保管。リポジトリにバイナリやVM個別データは入れない。
- 端末貼り付け、24.04 VMの連続文字入力、22.04のChrome連携・修復、実npmによる最終1.1.0更新は確認済み。OS失効中の保持解除とnative Wayland Chrome前面化は既知の制限として記載し、未確認の全環境対応を主張しない。公開承認とGitHub Actions・公開配布URLの確認は残る。
