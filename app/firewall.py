"""Ubuntu-only diagnostics and a narrow, deb-owned privileged helper."""
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import tempfile

BACKEND = '/opt/Pocket Deck/resources/backend/PocketDeckServer'
STATE = Path('/var/lib/pocket-deck/firewall.json')
PRIVATE = [ipaddress.ip_network(n) for n in ('10.0.0.0/8','172.16.0.0/12','192.168.0.0/16')]

def execute(args):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=20, env={'PATH':'/usr/sbin:/usr/bin:/sbin:/bin','LC_ALL':'C'}) .stdout

def ip_binary():
    return next((p for p in ('/usr/sbin/ip','/usr/bin/ip','/sbin/ip') if Path(p).is_file()), None)

def candidates(addresses):
    result=[]
    for item in addresses:
        interface=item.get('ifname','')
        if not re.fullmatch(r'[A-Za-z0-9_.:-]{1,32}',interface) or interface.startswith(('lo','docker','br-','veth','virbr','tun','tap','wg')) or 'POINTOPOINT' in item.get('flags',[]) or 'UP' not in item.get('flags',[]):continue
        for addr in item.get('addr_info',[]):
            if addr.get('family')!='inet' or addr.get('scope')!='global':continue
            try:net=ipaddress.ip_interface(str(addr['local'])+'/'+str(addr['prefixlen']))
            except (KeyError,ValueError):continue
            if not any(net.network.subnet_of(p) for p in PRIVATE):continue
            result.append({'interface':interface,'address':str(net.ip),'network':str(net.network),'url':f'http://{net.ip}:8765/'})
    return result

def networks():
    binary=ip_binary()
    return candidates(json.loads(execute([binary,'-j','-4','address','show']))) if binary else []

def diagnostic():
    if sys.platform!='linux':return {'supported':False,'networks':[],'reason':'Ubuntuの接続診断です。'}
    try:
        result={'supported':True,'networks':networks(),'ufwInstalled':Path('/usr/sbin/ufw').is_file(),'ufwEnabled':None,'rules':'unknown','canConfigure':False}
        config=Path('/etc/ufw/ufw.conf')
        if config.is_file():
            match=re.search(r'^ENABLED=(yes|no)\s*$',config.read_text(),re.M)
            if match:result['ufwEnabled']=match[1]=='yes'
        try:trusted_backend();result['canConfigure']=result['ufwInstalled'] and Path('/usr/bin/pkexec').is_file()
        except (ValueError,OSError):pass
        return result
    except (OSError,ValueError,subprocess.SubprocessError) as error:
        return {'supported':True,'networks':[],'canConfigure':False,'reason':'接続状態を確認できません。'+str(error)}

def trusted_backend(path=Path(BACKEND)):
    if path.is_symlink() or not path.is_file():raise ValueError('deb版を導入するとアプリから許可を設定できます。')
    for item in (path,*path.parents):
        stat=item.stat()
        if stat.st_uid!=0 or stat.st_mode&0o022:raise ValueError('権限操作用プログラムの所有権を確認できません。')
    internal=path.parent/'_internal'
    if internal.is_symlink() or not internal.is_dir():raise ValueError('入力サーバーの依存ファイルがありません。')
    for item in (internal,*internal.rglob('*')):
        stat=item.lstat()
        if item.is_symlink():
            resolved=item.resolve()
            if not resolved.is_relative_to(internal.resolve()):raise ValueError('依存ファイルのリンク先が不正です。')
            stat=resolved.stat()
        if stat.st_uid!=0 or stat.st_mode&0o022:raise ValueError('権限操作用の依存ファイルを確認できません。')

def selected(interface,address,network,current):
    match=next((n for n in current if n['interface']==interface and n['address']==address and n['network']==network),None)
    if not match:raise ValueError('ネットワークが変わりました。対象LANを確認し直してください。')
    return match

def rule_args(n):
    return ['allow','in','on',n['interface'],'from',n['network'],'to',n['address'],'port','8765','proto','tcp']

def signature(args):
    try:
        fields={key:args[args.index(key)+1] for key in ('on','from','to','port','proto')}
        return fields if args[:2]==['allow','in'] else None
    except (ValueError,IndexError):return None

def added_rules(run=execute):
    return [shlex.split(line)[1:] for line in run(['/usr/sbin/ufw','show','added']).splitlines() if line.startswith('ufw ')]

def privileged(operation,interface='',address='',network='',run=execute,state=STATE,current=None):
    if operation not in ('inspect','allow','remove'):raise ValueError('許可されていない操作です。')
    status=run(['/usr/sbin/ufw','status'])
    enabled=status.startswith('Status: active')
    if operation!='inspect' and not enabled:raise ValueError('UFWは無効です。Pocket Deckは有効化しません。')
    rules=added_rules(run)
    record=json.loads(state.read_text()) if state.exists() else {}
    if operation=='inspect':return {'ufwEnabled':enabled,'rules':'checked','managedRules':list(record.values())}
    if operation=='remove' and not any(n['interface']==interface and n['address']==address and n['network']==network for n in record.values()):return {'changed':False,'message':'Pocket Deckが追加した許可はありません。'}
    n=selected(interface,address,network,list(record.values()) if operation=='remove' else networks() if current is None else current)
    key=hashlib.sha256(json.dumps(n,sort_keys=True).encode()).hexdigest()[:16]
    comment='Pocket Deck managed '+key
    args=rule_args(n)
    existing=[r for r in rules if signature(r)==signature(args)]
    owned=[r for r in existing if 'comment' in r and r[r.index('comment')+1]==comment]
    if operation=='allow':
        if existing and not owned:return {'changed':False,'message':'既存の許可ルールがあります。変更していません。'}
        if owned:return {'changed':False,'message':'Pocket Deckの許可は設定済みです。'}
        run(['/usr/sbin/ufw',*args,'comment',comment])
        if not any(signature(r)==signature(args) and 'comment' in r and r[r.index('comment')+1]==comment for r in added_rules(run)):raise ValueError('追加したルールを確認できません。')
        record[key]=n
    else:
        if key not in record or not owned:return {'changed':False,'message':'Pocket Deckが追加した許可はありません。'}
        run(['/usr/sbin/ufw','--force','delete',*args])
        if any(signature(r)==signature(args) for r in added_rules(run)):raise ValueError('ルールの解除を確認できません。')
        record.pop(key,None)
    try:
        state.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
        fd,tmp=tempfile.mkstemp(dir=state.parent)
        try:
            with os.fdopen(fd,'w') as out:json.dump(record,out)
            os.replace(tmp,state)
        finally:
            if Path(tmp).exists():Path(tmp).unlink()
    except Exception:
        if operation=='allow':run(['/usr/sbin/ufw','--force','delete',*args])
        raise
    return {'changed':True,'ufwEnabled':enabled,'rules':'checked','managedRules':list(record.values()),'message':'許可を追加しました。スマホからの接続は未確認です。' if operation=='allow' else '追加した許可を解除しました。'}

def main(args):
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument('operation',choices=['inspect','allow','remove'])
    for name in ('interface','address','network'):parser.add_argument('--'+name,default='')
    options=parser.parse_args(args)
    try:
        if sys.platform!='linux' or os.geteuid()!=0 or not os.environ.get('PKEXEC_UID','').isdigit() or int(os.environ['PKEXEC_UID'])==0:raise ValueError('PCアプリからOSの管理者認証を行ってください。')
        trusted_backend()
        if Path(sys.executable).resolve()!=Path(BACKEND):raise ValueError('導入済みdebのプログラムを使用してください。')
        if STATE.parent.exists():
            st=STATE.parent.lstat()
            if STATE.parent.is_symlink() or st.st_uid!=0 or st.st_mode&0o022:raise ValueError('許可設定の保存先が不正です。')
        if STATE.exists() or STATE.is_symlink():
            st=STATE.lstat()
            if STATE.is_symlink() or st.st_uid!=0 or st.st_mode&0o022:raise ValueError('許可設定の記録が不正です。')
        STATE.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
        import fcntl
        lock_fd=os.open(STATE.parent/'firewall.lock',os.O_CREAT|os.O_RDWR|os.O_NOFOLLOW,0o600)
        with os.fdopen(lock_fd,'w') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX)
            result=privileged(options.operation,options.interface,options.address,options.network)
        print(json.dumps(result,ensure_ascii=True))
    except Exception as error:
        print(json.dumps({'error':str(error)},ensure_ascii=True));raise SystemExit(1)
