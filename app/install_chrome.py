"""Explicit, per-user Native Messaging registration (never run automatically)."""
import argparse
import json
from pathlib import Path
import re
import secrets
import sys

ROOT=Path(__file__).resolve().parent
KEY=r'Software\Google\Chrome\NativeMessagingHosts\local.pocket_deck'

def manifest(extension_id):
    if not re.fullmatch('[a-p]{32}',extension_id):raise ValueError('Chrome拡張IDはa〜pの32文字です')
    return {'name':'local.pocket_deck','description':'Pocket Deck profile bridge','path':str(ROOT/'chrome_launcher.exe'),'type':'stdio','allowed_origins':['chrome-extension://'+extension_id+'/']}

def main():
    import winreg
    parser=argparse.ArgumentParser();parser.add_argument('--extension-id');parser.add_argument('--uninstall',action='store_true');parser.add_argument('--dry-run',action='store_true');args=parser.parse_args()
    path=ROOT/'chrome-native-host.json'
    if args.uninstall:
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER,KEY) as key:current=winreg.QueryValueEx(key,None)[0]
        except FileNotFoundError:print('未登録です');return
        if Path(current).resolve()!=path.resolve():raise RuntimeError('別の登録先です。変更しません')
        if args.dry_run:print('削除対象: HKCU\\'+KEY);return
        winreg.DeleteKey(winreg.HKEY_CURRENT_USER,KEY);print('連携ホストの登録を解除しました。配置データは保持しています。');return
    data=manifest(args.extension_id or '')
    if args.dry_run:print(json.dumps(data,ensure_ascii=False,indent=2));print('登録先: HKCU\\'+KEY);return
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER,KEY) as key:current=winreg.QueryValueEx(key,None)[0]
        if Path(current).resolve()!=path.resolve():raise RuntimeError('別の登録先があります。上書きしません')
    except FileNotFoundError:pass
    from build_chrome import build
    if not (ROOT/'chrome_launcher.exe').exists():build()
    (ROOT/'chrome-python.txt').write_text(sys.executable,encoding='utf-8')
    path.write_text(json.dumps(data,indent=2),encoding='utf-8')
    token=ROOT/'chrome-bridge.token'
    if not token.exists():token.write_text(secrets.token_hex(32),encoding='ascii')
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER,KEY) as key:winreg.SetValueEx(key,None,0,winreg.REG_SZ,str(path))
    print('連携ホストを登録しました。各プロフィールの拡張で名前を登録してください。')

if __name__=='__main__':main()
