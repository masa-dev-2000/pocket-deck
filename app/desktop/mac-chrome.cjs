const path=require('node:path'),os=require('node:os');
const {linuxRegistration}=require('./linux-chrome.cjs');
function registrationDirectories(home=os.homedir()){
 const support=path.join(home,'Library','Application Support');
 return [path.join(support,'Google','Chrome','NativeMessagingHosts'),
         path.join(support,'Google','Chrome for Testing','NativeMessagingHosts'),
         path.join(support,'Chromium','NativeMessagingHosts')];
}
// Same owned-symlink checks as Linux, but never use Linux XDG or Windows registry.
function macRegistration(manifest,directories=registrationDirectories()){
 return linuxRegistration(manifest,directories);
}
module.exports={registrationDirectories,macRegistration};
