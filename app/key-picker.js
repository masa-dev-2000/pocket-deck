// The server supplies exactly the keys that its input validator supports.
let pickerCallback=null,pickerSingle=false;
let keyCatalog = null, pickerKeys = [], pickerLoading = false;
const normalizeKeySearch = value => value.normalize('NFKC').toLowerCase().trim();
function filterKeyCatalog(catalog, query) {
  const terms = normalizeKeySearch(query).split(/\s+/).filter(Boolean);
  return catalog.filter(k => terms.every(term => normalizeKeySearch(k.key+' '+k.label+' '+k.search).includes(term)))
    .sort((a,b) => Number(normalizeKeySearch(b.key)===normalizeKeySearch(query))-Number(normalizeKeySearch(a.key)===normalizeKeySearch(query)));
}
function displayKey(key) { return keyCatalog?.find(k=>k.key===key)?.label || key; }
function updateKeySummary() {
  $('keysSummary').textContent = $('keys').value.split('+').filter(Boolean).map(displayKey).join(' + ') || 'キーを選択 ▾';
  $('keysSummary').title = $('keys').value;
}
function renderKeyPicker() {
  if (!$('keyPicker').open) return;
  const text = pickerKeys.map(displayKey).join(' + ') || '未選択';
  $('selectedKeys').textContent = text; $('selectedKeys').title = text;
  $('keyUndo').disabled = !pickerKeys.length; $('keyClear').disabled = !pickerKeys.length;
  $('keyDone').disabled = pickerLoading || !pickerKeys.length;
  const scroll=$('keyOptions').scrollTop;
  $('keyOptions').replaceChildren();
  if (pickerLoading) { $('keyCount').textContent = '読込中'; return; }
  if (!keyCatalog) { $('keyCount').textContent = '取得失敗'; return; }
  const matches = filterKeyCatalog(keyCatalog, $('keySearch').value);
  $('keyCount').textContent = matches.length ? `${matches.length}件` : '候補なし';
  for (const key of matches) {
    const button = document.createElement('button'); button.type='button'; button.className='key-option';
    const selected=pickerKeys.includes(key.key);
    button.setAttribute('role','option'); button.setAttribute('aria-selected',String(selected));
    button.textContent=(selected?'✓ ':'')+key.label;
    button.onclick=()=>{
      if (selected) pickerKeys=pickerKeys.filter(k=>k!==key.key);
      else if(pickerSingle)pickerKeys=[key.key];
      else if (pickerKeys.length<8) pickerKeys.push(key.key);
      else { $('keyCount').textContent='最大8キーです'; return; }
      renderKeyPicker();
    };
    $('keyOptions').append(button);
  }
  $('keyOptions').scrollTop=scroll;
}
async function openKeyPicker(value=$('keys').value,callback=null,single=false) {
  pickerCallback=callback;pickerSingle=single;
  pickerKeys=[...new Set(value.split('+').map(k=>k.trim().toUpperCase()).map(k=>({'CMD':'WIN','COMMAND':'WIN','OPTION':'ALT'})[k]||k).filter(Boolean))];
  $('keyOptions').scrollTop=0; $('keySearch').value=''; document.activeElement?.blur();
  $('keyPicker').showModal(); pickerLoading=!keyCatalog; renderKeyPicker();
  if (!keyCatalog) {
    try { keyCatalog=await api('keys'); }
    catch(e) { message(e.message+' キー選択を開き直してください。'); }
    finally { pickerLoading=false; updateKeySummary(); renderKeyPicker(); }
  }
}
$('keysSummary').onclick=()=>openKeyPicker();
$('keySearch').oninput=()=>{$('keyOptions').scrollTop=0;renderKeyPicker();};
$('keySearch').onkeydown=e=>{
  if (e.isComposing) return;
  if (e.key==='ArrowDown') { e.preventDefault();$('keyOptions').querySelector('button')?.focus(); }
  if (e.key==='Enter') { e.preventDefault();$('keyOptions').querySelector('button')?.click(); }
};
$('keyOptions').onkeydown=e=>{
  const buttons=[...$('keyOptions').children],index=buttons.indexOf(document.activeElement);
  if(e.key==='ArrowDown'||e.key==='ArrowUp') {e.preventDefault();buttons[Math.max(0,Math.min(buttons.length-1,index+(e.key==='ArrowDown'?1:-1)))]?.focus();}
};
$('keyUndo').onclick=()=>{pickerKeys.pop();renderKeyPicker();};
$('keyClear').onclick=()=>{pickerKeys=[];renderKeyPicker();};
$('keyCancel').onclick=()=>{$('keyPicker').close();};
$('keyDone').onclick=()=>{
  // Modifier keys precede the ordinary keys, regardless of selection order.
  const modifiers=['CTRL','SHIFT','ALT','WIN'];
  const ordered=[...modifiers.filter(k=>pickerKeys.includes(k)),...pickerKeys.filter(k=>!modifiers.includes(k))];
  if(pickerCallback){const done=pickerCallback;pickerCallback=null;$('keyPicker').close();done(ordered.join('+'));return;}
  $('keys').value=ordered.join('+');
  updateKeySummary();$('keyPicker').close();$('keys').dispatchEvent(new Event('change',{bubbles:true}));
};
