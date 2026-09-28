// Only the disposable GNOME container uses these fixed, private paths.
const fs=require('node:fs');
const {ChromeSetup}=require('../../chrome-setup.cjs');
if(!fs.existsSync('/tmp/deck-session.env'))throw Error('Disposable GNOME lab required');
if(process.getuid()===0)throw Error('Run as the disposable GNOME session user');
const setup=new ChromeSetup({userDir:'/tmp/deck-test-config/Pocket Deck',
 extensionSource:'/source/app/chrome-extension',launcher:'/tmp/pocket-deck-backend/PocketDeckServer'});
setup.prepare().then(result=>{
 if(!result.prepared)throw Error(result.issue);
 console.log(JSON.stringify({prepared:result.prepared,extensionId:result.extensionId}));
}).catch(error=>{console.error(error.message);process.exitCode=1});
