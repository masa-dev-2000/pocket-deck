// Pure grid geometry shared by the editor and its tests.
function buttonCells(config,b){
 const w=b.width??1,h=b.height??1,col=b.slot%config.columns,row=Math.floor(b.slot/config.columns);
 if(!Number.isInteger(b.slot)||b.slot<0||!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||col+w>config.columns||row+h>config.rows)return null;
 const cells=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)cells.push((row+y)*config.columns+col+x);return cells;
}
function validLayout(config){const used=new Set();for(const b of config.buttons){const cells=buttonCells(config,b);if(!cells||cells.some(i=>used.has(i)))return false;cells.forEach(i=>used.add(i));}return true;}
function placeButton(config,button,preferred=new Map()){
 const next=structuredClone(config),used=new Set(),primary={...button},cells=buttonCells(config,primary);
 if(!cells)return null;cells.forEach(i=>used.add(i));
 const others=next.buttons.filter(b=>b.id!==button.id).sort((a,b)=>a.slot-b.slot),displaced=[];
 const fits=b=>{const c=buttonCells(next,b);return c&&!c.some(i=>used.has(i))?c:null;};
 for(const b of others){const c=fits(b);if(c)c.forEach(i=>used.add(i));else displaced.push(b);}
 for(const b of displaced){let placed=false;const slots=[...(preferred.has(b.id)?[preferred.get(b.id)]:[]),...Array.from({length:next.rows*next.columns},(_,i)=>i)];
  for(const slot of slots){const c=fits({...b,slot});if(c){b.slot=slot;c.forEach(i=>used.add(i));placed=true;break;}}
  if(!placed)return null;
 }
 const map=new Map(others.map(b=>[b.id,b]));map.set(primary.id,primary);
 next.buttons=next.buttons.map(b=>map.get(b.id));if(!config.buttons.some(b=>b.id===primary.id))next.buttons.push(primary);return next;
}
function movedLayout(config,from,to){
 const a=config.buttons.find(b=>b.slot===from);if(!a||from===to)return null;
 const b=config.buttons.find(b=>buttonCells(config,b)?.includes(to));
 const exchanged=structuredClone(config);exchanged.buttons.find(x=>x.id===a.id).slot=to;
 if(b&&b.id!==a.id)exchanged.buttons.find(x=>x.id===b.id).slot=from;
 if(validLayout(exchanged))return exchanged;
 return placeButton(config,{...a,slot:to},b&&b.id!==a.id?new Map([[b.id,from]]):new Map());
}
function applyGridStyle(el,b,columns){const title=el.querySelector('strong');if(title&&(b.width??1)*(b.height??1)>1)title.style.fontSize=`min(32px,calc(var(--key-font,15px) * ${Math.min(2,Math.sqrt(b.width*b.height))}))`;el.style.gridColumn=`${b.slot%columns+1} / span ${b.width??1}`;el.style.gridRow=`${Math.floor(b.slot/columns)+1} / span ${b.height??1}`;}
if(typeof module!=='undefined')module.exports={buttonCells,validLayout,placeButton,movedLayout};

function groupedLayout(config,ids,dx,dy){
 const selected=new Set(ids),next=structuredClone(config),used=new Set(),displaced=[];
 if(!selected.size||!Number.isInteger(dx)||!Number.isInteger(dy))return null;
 const reserve=b=>{const cells=buttonCells(next,b);if(!cells||cells.some(c=>used.has(c)))return false;cells.forEach(c=>used.add(c));return true;};
 for(const b of next.buttons.filter(b=>selected.has(b.id))){
  const x=b.slot%next.columns+dx,y=Math.floor(b.slot/next.columns)+dy;
  if(x<0||y<0||x+(b.width||1)>next.columns||y+(b.height||1)>next.rows)return null;
  b.slot=y*next.columns+x;if(!reserve(b))return null;
 }
 for(const b of next.buttons.filter(b=>!selected.has(b.id)))if(!reserve(b))displaced.push(b);
 displaced.sort((a,b)=>(b.width||1)*(b.height||1)-(a.width||1)*(a.height||1)||a.slot-b.slot);
 for(const b of displaced){
  const x=b.slot%next.columns,y=Math.floor(b.slot/next.columns);
  const slots=Array.from({length:next.columns*next.rows},(_,i)=>i);
  const distance=s=>Math.abs(s%next.columns-x)+Math.abs(Math.floor(s/next.columns)-y);
  slots.sort((a,b)=>distance(a)-distance(b)||a-b);
  let placed=false;for(const slot of slots){if(reserve({...b,slot})){b.slot=slot;placed=true;break;}}if(!placed)return null;
 }
 return validLayout(next)?next:null;
}
function lineSelection(config,axis,lines){
 return config.buttons.filter(b=>(buttonCells(config,b)||[]).some(s=>lines.has(axis==='row'?Math.floor(s/config.columns):s%config.columns))).map(b=>b.id);
}
if(typeof module!=='undefined')Object.assign(module.exports,{groupedLayout,lineSelection});

function resizedGrid(config,columns,rows){
 if(!Number.isInteger(columns)||!Number.isInteger(rows)||columns<1||columns>12||rows<1||rows>200)return null;
 const next=structuredClone(config);next.columns=columns;next.rows=rows;
 for(const b of next.buttons){const x=b.slot%config.columns,y=Math.floor(b.slot/config.columns);if(x+(b.width||1)>columns||y+(b.height||1)>rows)return null;b.slot=y*columns+x;}
 return validLayout(next)?next:null;
}
function editGridLine(config,axis,operation,index){
 if(!['row','column'].includes(axis)||!['add','delete'].includes(operation))return null;
 const vertical=axis==='row',count=vertical?config.rows:config.columns,max=vertical?200:12,adding=operation==='add';
 if(!Number.isInteger(index)||index<0||index>(adding?count:count-1)||(adding?count>=max:count<=1))return null;
 const next=structuredClone(config),removed=[],resized=[];next[vertical?'rows':'columns']+=adding?1:-1;
 next.buttons=next.buttons.filter(b=>{
  let x=b.slot%config.columns,y=Math.floor(b.slot/config.columns),start=vertical?y:x,size=vertical?(b.height||1):(b.width||1);
  if(adding){if(start>=index)start++;else if(start+size>index){size++;resized.push(b.id);}}
  else if(start>index)start--;else if(start<=index&&start+size>index){if(size===1){removed.push(structuredClone(b));return false;}size--;resized.push(b.id);}
  if(vertical){y=start;b.height=size;}else{x=start;b.width=size;}b.slot=y*next.columns+x;return true;
 });
 return validLayout(next)?{layout:next,removed,resized}:null;
}
if(typeof module!=='undefined')Object.assign(module.exports,{resizedGrid,editGridLine});
