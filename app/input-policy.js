function inputRequirements(button) {
 if(!button)return ['keyboard'];
 if(['navigate','profile','group'].includes(button.type))return [];
 if(['touchpad','wheel','click'].includes(button.type))return ['pointer'];
 if(button.type==='text')return ['text'];
 if(button.type==='macro')return [...new Set(button.steps.flatMap(s=>s.kind==='text'?['text']:['shortcut','press','release'].includes(s.kind)?['keyboard']:s.kind==='click'?['pointer']:[]))];
 return ['keyboard'];
}
function inputAllowed(status,requirements){return !!status&&requirements.every(key=>status[key]===true);}
function sensitivityValues(value){return Object.fromEntries(['cursor','scroll'].map(key=>[key,typeof value?.[key]==='number'&&Number.isFinite(value[key])&&value[key]>=.25&&value[key]<=3?value[key]:1]));}
if(typeof module!=='undefined')module.exports={inputRequirements,inputAllowed,sensitivityValues};
