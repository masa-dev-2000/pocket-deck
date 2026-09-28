function assertSandbox({platform,packaged,noSandbox}){
 if(platform==='linux'&&packaged&&noSandbox){
  throw new Error('この環境ではAppImageの起動処理がsandboxを無効にしました。安全な状態を確認できないため起動を停止しました。Ubuntuではdeb版を導入してください。OS全体の制限を解除する必要はありません。');
 }
}
module.exports={assertSandbox};
