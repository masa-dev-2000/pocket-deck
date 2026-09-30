// The iframe keeps the phone's layout size; only its presentation is scaled.
const previewDevices={se:{width:375,height:667},iphone16:{width:393,height:852},android:{width:360,height:800},androidLarge:{width:412,height:915}};
function previewDimensions(preference){
 const size=preference.device==='custom'?preference:previewDevices[preference.device]||previewDevices.se;
 if(!Number.isInteger(size.width)||!Number.isInteger(size.height)||size.width<240||size.height<240||size.width>1440||size.height>1440)return null;
 return preference.landscape?{width:size.height,height:size.width}:{width:size.width,height:size.height};
}
function previewScale(size,width,height){return Math.max(.01,Math.min(1,(width-36)/size.width,(height-36)/size.height));}
let previewPreference={device:'se',width:375,height:667,landscape:false},previewInstalled=false;
function installPreview(){
 if(previewInstalled)return;previewInstalled=true;
 try{const saved=JSON.parse(localStorage.getItem('pocket-deck-preview')||'null');if(saved&&previewDimensions(saved))previewPreference={...previewPreference,...saved};}catch{}
 $('previewDevice').value=previewDevices[previewPreference.device]||previewPreference.device==='custom'?previewPreference.device:'se';
 $('previewWidth').value=previewPreference.width;$('previewHeight').value=previewPreference.height;
 $('previewDevice').onchange=()=>{previewPreference.device=$('previewDevice').value;savePreview();};
 const customChange=(silent=false)=>{const next={...previewPreference,width:Number($('previewWidth').value),height:Number($('previewHeight').value)};if(!previewDimensions({...next,device:'custom'})){if(!silent)notify('幅と高さは240〜1440の整数で指定してください。');return;}previewPreference=next;savePreview();};
 for(const id of ['previewWidth','previewHeight']){$(id).oninput=()=>customChange(true);$(id).onchange=()=>customChange();}
 $('previewRotate').onclick=()=>{previewPreference.landscape=!previewPreference.landscape;savePreview();};
 new ResizeObserver(()=>updatePreview()).observe($('workspaceHost'));
}
function savePreview(){try{localStorage.setItem('pocket-deck-preview',JSON.stringify(previewPreference));}catch{}updatePreview();}
function updatePreview(){
 installPreview();const editing=view==='editor';$('previewTools').hidden=!editing;
 $('workspaceHost').classList.toggle('phone-preview',editing);$('previewCustom').hidden=previewPreference.device!=='custom';
 const frame=$('previewFrame'),iframe=$('workspace');
 if(view!=='connect')iframe.hidden=false;
 if(!editing){frame.style.width='100%';frame.style.height='100%';iframe.style.width='100%';iframe.style.height='100%';iframe.style.transform='none';return;}
 const size=previewDimensions(previewPreference)||previewDevices.se;
 const host=$('workspaceHost'),scale=previewScale(size,host.clientWidth,host.clientHeight);
 frame.style.width=(size.width*scale+12)+'px';frame.style.height=(size.height*scale+12)+'px';
 iframe.style.width=size.width+'px';iframe.style.height=size.height+'px';iframe.style.transform='scale('+scale+')';
 $('previewRotate').textContent=previewPreference.landscape?'縦向きにする':'横向きにする';
 $('previewSize').textContent=size.width+' × '+size.height;
}
if(typeof module!=='undefined')module.exports={previewDevices,previewDimensions,previewScale};
