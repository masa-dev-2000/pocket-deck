const fs=require('node:fs'),crypto=require('node:crypto');
const {ChromeSetup}=require('../../chrome-setup.cjs');
if(process.getuid()===0||!fs.existsSync('/tmp/deck-session.env'))throw Error('Disposable GNOME session user required');
const root='/tmp/deck-test-config/Pocket Deck';
const setup=new ChromeSetup({userDir:root,extensionSource:'/source/app/chrome-extension',launcher:'/tmp/pocket-deck-backend/PocketDeckServer'});
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
(async()=>{
 const before=await setup.status();if(!before.prepared)throw Error('Existing registration must be prepared');
 const token=hash(root+'/data/chrome-bridge.token'),config=hash(root+'/data/config.json');
 const profile=hash(root+'/data/chrome-profiles.json');
 const link='/tmp/deck-test-config/google-chrome-for-testing/NativeMessagingHosts/local.pocket_deck.json';
 if(fs.realpathSync(link)!==fs.realpathSync(setup.manifest))throw Error('Foreign host is protected');
 fs.unlinkSync(link);fs.unlinkSync(root+'/chrome-extension/popup.js');
 if((await setup.status()).prepared)throw Error('Missing registration must be detected');
 const after=await setup.prepare();if(!after.prepared)throw Error(after.issue);
 if(token!==hash(root+'/data/chrome-bridge.token')||config!==hash(root+'/data/config.json')||profile!==hash(root+'/data/chrome-profiles.json'))throw Error('Repair modified saved data');
 if(before.extensionId!==after.extensionId)throw Error('Extension identity changed');
 console.log(JSON.stringify({realOwnedRegistrationRepaired:true,extensionFileRestored:true,tokenConfigurationProfilesPreserved:true}));
})().catch(error=>{console.error(error.message);process.exitCode=1});
