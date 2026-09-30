# npmで配布する仕組みと実行手順

## npmに何を置くか

`npm/` に導入用の小さなNode.jsコマンドを置きます。約136MBのElectronアプリ本体はGitHub Releasesで配布します。1.0.4以降は`npm install -g @masadev/pocket-deck`で、GitHubからexeを取得・SHA-256検証し、現在のユーザー用にサイレント導入して起動します。

グローバル導入のpostinstallがPCアプリを導入・起動します。ローカル導入やnpxのパッケージ取得だけでは自動導入しません。引数なしはヘルプ、`download`は取得と検証だけ、`install`は通常のインストーラーを開きます。npmコマンドを使う人にはWindows x64・Node.js 22.12以上が必要ですが、直接インストーラーを利用する人には追加のNode.jsやPythonは不要です。

npm更新時も新しい版が入ればPCアプリを導入します。同じ版・新版の既存アプリは再導入せず起動します。起動中のアプリや全ユーザー用の導入は置き換えません。導入スクリプトを禁止するnpm設定では実行許可が必要です。`npm uninstall`だけではPCアプリは消えず、Windowsから削除します。

1.1.0以降はUbuntu x64にも対応します。通常ユーザーの`npm install -g --prefix "$HOME/.local" --foreground-scripts @masadev/pocket-deck`から検証済みdebを取得し、OSの管理者認証後に導入・起動します。npm全体をsudoで実行しません。`release.json`の`linux`にdebの版・URL・SHA-256・bytesを固定し、Windowsの配布情報を維持します。Ubuntu本体の削除は`sudo apt remove pocket-deck-desktop`です。

公開するのは `bin/`、`release.json`、`package.json`、README、MITライセンスです。テスト、Git履歴、個人設定、トークン、PCアプリ本体はnpmへ送りません。`files`の許可リストで配布対象を固定します。1.2.0-beta.1は`npm publish --tag beta --access public`で試験公開し、既存の`latest`を変更しません。

## 1. ログインを確認する

```powershell
npm whoami
```

npmの認証済みユーザー名を確認します。401が出た場合、アカウントが存在しないという意味ではなく、このPCの認証が無効な状態です。

```powershell
npm login --auth-type=web --registry=https://registry.npmjs.org/
```

表示されたブラウザーで本人がログインし、必要な二段階認証を完了します。パスワードや認証コードをソース・チャット・文書へ記載しないでください。npmユーザー名とGitHubユーザー名は同じとは限りません。公開前に `npm/package.json` のスコープ名と、READMEのコマンドを実際のnpmユーザー名へ合わせます。

## 2. 公開名と依存するReleaseを確認する

```powershell
npm view @masadev/pocket-deck version
```

未公開なら404です。公開済みの名前・バージョンの組み合わせは再利用できません。初回の候補名が使えるかは、実際のnpmユーザーで再確認します。

GitHub Releaseを先に公開し、`npm/release.json` に記載したURLからインストーラーを取得できることを確認します。ファイルを作り直した場合、SHA-256とbytesも更新してください。後から同じバージョンの配布ファイルを差し替えると、固定チェックサムに一致せず導入が失敗します。更新は新しいバージョンで行います。

## 3. npmパッケージを作り、送信内容を確認する

リポジトリ直下から実行します。

```powershell
cd npm
npm test
npm pack --dry-run --json
npm pack
npm publish --dry-run --access public
```

`npm test`は取得失敗・チェックサム不一致・キャッシュの再検証・未対応環境・実行順序を検証します。実際のインストーラーは起動しません。

`npm pack`は配布する `.tgz` をローカルに作成します。`--dry-run`はファイル一覧だけを確認し、公開しません。`npm publish --dry-run`もレジストリへ公開せず、公開対象の形を確認します。

## 4. 公開する

確認した公開名・バージョン・配布内容で、必要な公開承認を得てから実行します。

```powershell
npm publish --access public
```

実行場所は `npm/` です。`app/desktop/` はPCアプリのビルド用で `private: true` のため、ここから公開しません。公開時にブラウザー認証・二段階認証が追加で求められる場合は本人が完了します。

公開コマンドが成功しても、取得可能になるまで時間がかかる場合があります。npmは公開時にパッケージをスキャンするため、通常約5分、混雑時は15分以上の遅延も案内しています。直後の`npm view`が404でも再公開せず、npmサイトのバージョン状態とregistryへの反映を確認します。[公式案内](https://github.blog/changelog/2026-07-28-npm-publish-time-malware-scanning-and-dual-use-metadata/)。本人認証の完了待ちURLで発生する404とは別の確認です。

## 5. 公開結果を確認する

```powershell
npm view @masadev/pocket-deck version dist.tarball
npx @masadev/pocket-deck@1.1.0 --version
npx @masadev/pocket-deck@1.1.0 download
```

レジストリ上の版・配布URL、npxの実行、実インストーラーの取得とSHA-256を確認します。`download`はアプリの更新・再インストールを行いません。新規導入・更新・初回起動は隔離したWindows環境で別途検証します。PCアプリの更新にはGitHub Releaseのexe・blockmap・latest.ymlが必要です。既存利用者のデータとアプリを検証のために変更しません。

初回は手動公開です。GitHub Actionsからのnpm自動公開やTrusted Publishingの設定は行いません。必要になった段階で別途設定できます。


## Mac対応の公開準備（まだ実行しない）

Mac向けの作業版はnpm `1.2.0-beta.1`。既存Win／Ubuntu 1.1.0配布情報を維持し、Macだけ別バージョンのCPU別ZIPを追加できる形式にした。`release.json.macos.arm64` と `.x64` はそれぞれ `version`・`filename`・`url`・`sha256`・`bytes` を持つ。現在はActions artifactのみで公開URLがないため、これらの値はまだ登録していない。架空のチェックサムや期限付きActions URLを配布metadataとして使用しない。

実ZIPが確定したら、リポジトリ直下で次を実行して候補JSONを確認する。このコマンドはファイルのSHA-256／サイズを計算するだけで、署名や中身の正当性、公開URLの存在を証明しない。ソースや公開状態を変更しない。

```powershell
node npm/scripts/prepare-macos-manifest.cjs arm64 <Apple-Silicon版ZIPの絶対パス>
node npm/scripts/prepare-macos-manifest.cjs x64 <Intel版ZIPの絶対パス>
```

公開前に両CPU Mac runnerでnpm単体試験と実ZIPの隔離展開試験を実行する。追加したCIステップは版／CPU／codesign／Electron framework symlink／quarantineの保持、同じ版の再導入回避、ユーザーデータ保持を確認し、実アプリは起動しない。Windows上の単体試験だけではMacのditto・codesign・初回起動・OS許可を検証したことにならない。

その後、必要な承認を得てGitHub ReleaseにZIPを公開し、認証不要の実ダウンロードとハッシュ一致を確認してから両CPU情報をrelease.jsonへ登録する。npmは既存1.1.0を再公開せず、試験版は `npm publish --tag beta --access public` を使用する。正式な署名・公証がない場合、その制約を明記して実Mac上のGatekeeper導線を確認する。公開・CI起動・mergeは今回のローカル実装では行っていない。
