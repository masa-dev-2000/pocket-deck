"""Regression checks against an isolated mock server, never the user's data."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent
BASE = 'http://127.0.0.1:18766'

def check(page, width, height):
    page.set_viewport_size(dict(width=width, height=height))
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE + '/editor')
    expect(page.locator('#add')).to_be_visible()
    page.locator('#add').click()
    page.locator('#type').select_option('group')
    page.locator('#label').fill('Empty group')
    page.locator('#saveButton').click()
    expect(page.locator('#layoutView')).to_be_visible()
    page.locator('#deck button').filter(has_text='Empty group').click()
    page.locator('#groupOpen').click()
    manager = page.locator('.group-manager')
    expect(manager).to_contain_text('候補はまだありません')
    manager.get_by_role('button', name='＋ 候補を追加').click()
    page.locator('#label').fill('Screenshot')
    page.locator('#keysSummary').click()
    page.locator('#keySearch').fill('F14')
    page.locator('#keyOptions').get_by_role('option').first.click()
    page.locator('#keyDone').click()
    page.locator('#saveButton').click()
    expect(manager).to_be_visible()
    expect(manager).to_contain_text('Screenshot')
    manager.get_by_role('button', name='編集', exact=True).click()
    expect(page.locator('#cancel')).to_have_text('候補一覧へ戻る')
    page.locator('#label').fill('Screenshot renamed')
    page.locator('#cancel').click()
    expect(manager).to_contain_text('Screenshot renamed')
    manager.get_by_role('button', name='＋ 候補を追加').click()
    page.locator('#cancel').click()
    expect(manager).to_be_visible()
    expect(manager.locator('.layout-item')).to_have_count(1)
    manager.get_by_role('button', name='ボタン設定へ戻る').click()
    page.locator('#cancel').click()
    # Seed a macro through the same validated API, then exercise its nested UI.
    config = page.request.get(BASE + '/api/config').json()
    group = next(b for b in config['layouts'][0]['buttons'] if b['label'] == 'Empty group')
    group['items'].append(dict(id='macro-'+str(width), label='Wait macro', type='macro',
                               color='#294b68', steps=[dict(kind='wait', ms=100)]))
    assert page.request.post(BASE + '/api/config', data=config).ok
    page.evaluate('localStorage.clear()')
    page.reload()
    page.locator('#noticeAccept').click()
    page.locator('#deck button').filter(has_text='Empty group').click()
    page.locator('#groupOpen').click()
    manager.locator('.layout-item').filter(has_text='Wait macro').get_by_role('button', name='編集', exact=True).click()
    expect(page.locator('#macroEditor')).to_be_visible()
    expect(page.locator('#macroBack')).to_have_text('候補一覧へ戻る')
    page.locator('#macroName').fill('Wait renamed')
    page.locator('#macroBack').click()
    expect(manager).to_be_visible()
    expect(manager).to_contain_text('Wait renamed')
    manager.locator('.layout-item').filter(has_text='Screenshot renamed').get_by_role('button', name='編集', exact=True).click()
    page.locator('#delete').click()
    page.locator('#noticeAccept').click()
    expect(manager).to_be_visible()
    expect(manager.locator('.layout-item')).to_have_count(1)
    manager.get_by_role('button', name='ボタン設定へ戻る').click()
    page.locator('#cancel').click()
    page.locator('#menuOpen').click()
    page.get_by_role('button', name='PCの便利操作', exact=True).click()
    expect(page.get_by_text('登録されている操作はありません。')).to_be_visible()
    assert not errors, errors
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    print(json.dumps(dict(viewport=[width, height], result='PASS', checks=[
        'empty group creation', 'F14 selection', 'child save/back returns to list',
        'blank child cancel', 'macro back returns to list', 'child delete returns to list',
        'local actions empty state', 'no horizontal overflow', 'no JavaScript errors'])))

if __name__ == '__main__':
    temporary = tempfile.TemporaryDirectory()
    command = ([sys.argv[1], '--host', '127.0.0.1', '--port', '18766', '--data-dir', temporary.name]
               if len(sys.argv)>1 else [sys.executable, str(ROOT/'test_fixture.py'), '--port', '18766'])
    server = subprocess.Popen(command,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                              creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(BASE+'/api/config', timeout=1).close()
                break
            except OSError:
                time.sleep(.1)
        with sync_playwright() as p:
            browser = p.chromium.launch(channel='chrome', headless=True)
            for width, height in [(1120, 800), (375, 667)]:
                context = browser.new_context()
                page = context.new_page()
                # Each viewport starts with a fresh, empty layout on the mock server.
                config = page.request.get(BASE+'/api/config').json()
                config['layouts'][0]['buttons'] = []
                assert page.request.post(BASE+'/api/config', data=config).ok
                check(page, width, height)
                context.close()
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=10)
        temporary.cleanup()
