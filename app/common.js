const $ = id => document.getElementById(id);
async function api(path, data, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || 3000);
  try {
    const response = await fetch('/api/' + path, {
      signal: controller.signal, ...options,
      ...(data ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)} : {})
    });
    const result = await response.json();
    if (!response.ok) { const error = Error(result.error || '操作に失敗しました'); error.status=response.status; throw error; }
    $('status').textContent = '●'; $('status').title='PCに接続中'; $('status').setAttribute('aria-label','PCに接続中');
    return result;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) {
      $('status').textContent = '○'; $('status').title='PCとの接続を確認してください';
      throw Error('PCと通信できません。接続を確認してください。');
    }
    throw error;
  } finally { clearTimeout(timer); }
}
let lastMessage = '';
function message(text) {
  lastMessage = String(text);
  $('message').textContent = lastMessage;
  $('message').disabled = !lastMessage;
}
function keyElement(button) {
  const el = document.createElement('button');el.className='key';
  const types={touchpad:'タッチパッド',wheel:'マウスホイール',navigate:'画面切り替え',macro:'連続操作',profile:'Chromeプロフィール',text:'文字列'};
  const description=types[button.type]||button.keys||'';
  el.setAttribute('aria-label',button.label+' '+description);el.title=button.label+' / '+description;el.style.background=button.color;
  const title=document.createElement('strong');title.textContent=button.label;
  const hint=document.createElement('span');hint.className='key-hint';hint.textContent=description;
  const a=button.appearance||{};
  if(a.mode!=='label'&&(a.asset||a.icon)){
    const visual=document.createElement(a.asset?'img':'div');visual.className='key-visual';visual.setAttribute('aria-hidden','true');
    if(a.asset){visual.src='/assets/'+a.asset+'.png';visual.alt='';visual.draggable=false;visual.onerror=()=>{visual.hidden=true;title.hidden=false;};}else visual.textContent=a.icon;
    el.append(visual);el.classList.add('has-visual');if(a.mode==='visual')title.hidden=true;
  }
  el.append(title,hint);return el;
}
setInterval(() => api('health').catch(() => {}), 4000);

// Keep normal-scale UI within the visible area, including the on-screen keyboard.
// Pinch zoom retains the existing layout so native zoom/pan is not counteracted.
function updateViewport() {
  const v = window.visualViewport;
  if (v && Math.abs(v.scale - 1) > .02) return;
  document.documentElement.style.setProperty('--view-height', (v?.height || innerHeight) + 'px');
  document.documentElement.style.setProperty('--view-top', (v?.offsetTop || 0) + 'px');
}
window.addEventListener('resize', updateViewport);
window.visualViewport?.addEventListener('resize', updateViewport);
window.visualViewport?.addEventListener('scroll', updateViewport);
updateViewport();

function fitDeck(config) {
  const deck = $('deck');
  const rows = config.rows || Math.max(1, Math.ceil(config.buttons.length / config.columns));
  deck.style.setProperty('--cols', config.columns);
  deck.style.setProperty('--rows', rows);
  deck.dataset.columns = config.columns;
  deck.dataset.rows = rows;
  resizeDeck();
}
function resizeDeck() {
  const deck = $('deck');
  if (!deck || !deck.dataset.rows || !deck.clientHeight) return;
  const rows = Number(deck.dataset.rows), columns = Number(deck.dataset.columns);
  const gap = Math.min(6, Math.max(0, Math.floor(Math.min(deck.clientHeight / rows, deck.clientWidth / columns) / 12)));
  const height = (deck.clientHeight - gap * (rows - 1)) / rows;
  const width = (deck.clientWidth - gap * (columns - 1)) / columns;
  const unit = Math.min(height, width);
  deck.style.setProperty('--key-gap', gap + 'px');
  deck.style.setProperty('--key-pad', Math.min(6, Math.max(0, unit / 16)) + 'px');
  deck.style.setProperty('--key-font', Math.min(20, Math.max(1, Math.min(unit / 4.3, (height - 2) / 2.5))) + 'px');
  deck.classList.toggle('compact', height < 64 || width < 72);
  if ($('density')) $('density').textContent = unit < 44 ? '小さい配置です' : '';
}
if ($('deck')) new ResizeObserver(resizeDeck).observe($('deck'));

let noticeResolve = null, noticeBody = '', noticeIndex = 0, noticeConfirm = false;
function noticeChunks() {
  const chars = Array.from(noticeBody);
  const v = window.visualViewport;
  const height = v?.height || innerHeight;
  const width = v?.width || innerWidth;
  const lines = Math.max(1, Math.floor((height - 130) / 26));
  const perLine = Math.max(8, Math.floor((width - 32) / 17));
  const size = Math.max(8, Math.min(100, lines * perLine));
  const chunks = [];
  for (let i = 0; i < chars.length; i += size) chunks.push(chars.slice(i, i + size).join(''));
  return chunks.length ? chunks : [''];
}
function renderNotice() {
  const pages = noticeChunks(); noticeIndex = Math.min(noticeIndex, pages.length - 1);
  $('noticeText').textContent = pages[noticeIndex];
  $('noticePage').textContent = `${noticeIndex + 1} / ${pages.length}`;
  $('noticePrev').disabled = noticeIndex === 0;
  $('noticeNext').disabled = noticeIndex === pages.length - 1;
  $('noticeCancel').hidden = !noticeConfirm;
  $('noticeAccept').textContent = noticeConfirm ? '実行' : '閉じる';
}
function showNotice(text, confirmation = false) {
  window.dispatchEvent(new Event('deck:viewchange'));
  if (noticeResolve) noticeResolve(false);
  noticeBody = String(text).replace(/[\r\n]+/g, ' '); noticeIndex = 0; noticeConfirm = confirmation;
  $('noticeTitle').textContent = confirmation ? '確認' : 'お知らせ';
  document.activeElement?.blur();
  renderNotice();
  if (!$('noticeDialog').open) $('noticeDialog').showModal();
  return new Promise(resolve => { noticeResolve = resolve; });
}
function closeNotice(value) {
  $('noticeDialog').close();
  const resolve = noticeResolve; noticeResolve = null;
  resolve?.(value);
}
$('noticePrev').onclick = () => { noticeIndex--; renderNotice(); };
$('noticeNext').onclick = () => { noticeIndex++; renderNotice(); };
$('noticeCancel').onclick = () => closeNotice(false);
$('noticeAccept').onclick = () => closeNotice(true);
$('noticeDialog').addEventListener('cancel', e => { e.preventDefault(); closeNotice(false); });
window.visualViewport?.addEventListener('resize', () => { if ($('noticeDialog').open) renderNotice(); });
window.addEventListener('resize', () => { if ($('noticeDialog').open) renderNotice(); });
$('message').onclick = () => showNotice(lastMessage);
$('menuOpen').onclick = () => {
  window.dispatchEvent(new Event('deck:viewchange'));
  document.activeElement?.blur(); $('menuDialog').showModal();
};
$('menuClose').onclick = () => $('menuDialog').close();
