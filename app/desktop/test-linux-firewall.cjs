const test=require('node:test'),assert=require('node:assert/strict');
const {configure,BACKEND}=require('./linux-firewall.cjs');
test('privileged action uses fixed executable and argument array',async()=>{
 let call;await configure('allow',{interface:'wlan0',address:'192.168.1.5',network:'192.168.1.0/24'},async(...args)=>{call=args;return {stdout:'{"changed":true}'};});
 assert.equal(call[0],'/usr/bin/pkexec');assert.equal(call[1][0],BACKEND);assert.equal(call[1][1],'--firewall-helper');assert.equal(call[2].shell,undefined);
});
test('cancelled authentication does not retry',async()=>{
 let calls=0;await assert.rejects(configure('inspect',null,async()=>{calls++;throw Error('cancel');}));assert.equal(calls,1);
});
test('shell syntax and arbitrary operations are rejected before execution',async()=>{
 const run=async()=>{throw Error('must not launch');};await assert.rejects(configure('disable',{},run),/不正/);await assert.rejects(configure('allow',{interface:'wlan0;id',address:'1.2.3.4',network:'1.2.3.0/24'},run),/対象LAN/);
});
