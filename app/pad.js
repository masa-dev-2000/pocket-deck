// Pointer gestures and ordered mouse transport. No DOM dependency: tested with synthetic pointers.
class PadController {
 constructor({send,owner,enabled,onState=()=>{},onError=()=>{},now=()=>performance.now(),sensitivity=()=>({cursor:1,scroll:1})}){
  Object.assign(this,{send,owner,enabled,onState,onError,now,sensitivity});this.points=new Map();this.phase='idle';this.lastTap=null;this.dragOwner=null;this.generation=0;this.tail=Promise.resolve();this.outstanding=0;this.pending=null;this.timer=null;this.remainder={};
 }
 queue(data,force=false){this.outstanding++;const generation=this.generation;const task=this.tail.then(()=>{if(force||generation===this.generation)return this.send(data);});this.tail=task.catch(e=>{this.onError(e);this.cancel();}).finally(()=>{this.outstanding--;});return this.tail;}
 drain(force=false){
  clearTimeout(this.timer);this.timer=null;if(!this.pending)return this.tail;
  if(this.outstanding&&!force){this.timer=setTimeout(()=>this.drain(),16);return this.tail;}
  const p=this.pending;this.pending=null;const r=this.remainder[p.kind]||{x:0,y:0};p.x+=r.x;p.y+=r.y;
  let dx=Math.round(p.x),dy=Math.round(p.y);this.remainder[p.kind]={x:p.x-dx,y:p.y-dy};
  while(dx||dy){const x=Math.max(-2048,Math.min(2048,dx)),y=Math.max(-2048,Math.min(2048,dy));this.queue({action:p.kind,owner:this.owner(),dx:x,dy:y});dx-=x;dy-=y;}
  return this.tail;
 }
 motion(kind,x,y){const gain=this.sensitivity()[kind==='mouse_move'?'cursor':'scroll']??1;x*=gain;y*=gain;if(this.pending?.kind!==kind)this.drain(true);if(!this.pending)this.pending={kind,x:0,y:0};this.pending.x+=x;this.pending.y+=y;if(!this.timer)this.timer=setTimeout(()=>this.drain(),16);}
 state(){this.onState(this.phase);}
 down(id,x,y){
  if(!this.enabled())return;
  this.points.set(id,{x,y});
  if(this.points.size>2||this.phase==='blocked'){this.block();return;}
  if(this.points.size===2){this.lastTap=null;if(this.dragOwner){this.block();return;}this.drain(true);this.phase='scroll';this.state();return;}
  this.start={x,y,time:this.now(),travel:0};
  if(this.lastTap&&this.now()-this.lastTap.time<=300&&Math.hypot(x-this.lastTap.x,y-this.lastTap.y)<=24){
   this.phase='drag';this.dragOwner=this.owner();this.queue({action:'mouse_down',owner:this.dragOwner});
  }else this.phase='move';
  this.lastTap=null;this.state();
 }
 move(id,x,y){
  const p=this.points.get(id);if(!p)return;const dx=x-p.x,dy=y-p.y;p.x=x;p.y=y;
  if(this.phase==='scroll'){this.motion('mouse_scroll',-dx*3/2,dy*3/2);return;}
  if(this.phase==='move'||this.phase==='drag'){this.start.travel+=Math.hypot(dx,dy);this.motion('mouse_move',dx,dy);}
 }
 up(id){
  const point=this.points.get(id);if(!point)return this.tail;this.points.delete(id);
  if(this.phase==='scroll'){this.drain(true);this.phase=this.points.size?'blocked':'idle';this.state();return this.tail;}
  if(this.phase==='blocked'){if(!this.points.size){this.phase='idle';this.state();}return this.tail;}
  this.drain(true);
  if(this.phase==='drag')this.release();
  else if(this.phase==='move'&&this.start.travel<8&&this.now()-this.start.time<350){
   this.queue({action:'mouse_click',owner:this.owner()});this.lastTap={...point,time:this.now()};
  }
  this.phase='idle';this.state();return this.tail;
 }
 release(){const o=this.dragOwner;this.dragOwner=null;if(o)this.queue({action:'mouse_up',owner:o},true);}
 block(){this.generation++;this.remainder={};this.pending=null;clearTimeout(this.timer);this.timer=null;this.release();this.lastTap=null;this.phase='blocked';this.state();}
 cancel(){this.block();this.points.clear();this.phase='idle';this.state();return this.tail;}
 heartbeat(){if(this.dragOwner)this.queue({action:'heartbeat',owner:this.dragOwner});}
 click(){if(this.enabled()&&!this.dragOwner&&!this.points.size)this.queue({action:'mouse_click',owner:this.owner()});}
}
if(typeof module!=='undefined')module.exports=PadController;

// A dedicated one-finger wheel: never emits cursor or button events.
class WheelController extends PadController {
 constructor(options){
  super(options);this.schedule=options.schedule||((callback,delay)=>setTimeout(callback,delay));this.unschedule=options.unschedule||(timer=>clearTimeout(timer));
  this.holdTimer=null;this.wheelTimer=null;this.origin=null;this.verticalDirection=options.invertY===true?-1:1;
 }
 stopTimers(){this.unschedule(this.holdTimer);this.unschedule(this.wheelTimer);this.holdTimer=null;this.wheelTimer=null;}
 state(){this.onState(this.phase,{origin:this.origin,point:this.points.values().next().value});}
 clearMotion(){this.pending=null;this.remainder={};clearTimeout(this.timer);this.timer=null;}
 armHold(){
  this.unschedule(this.holdTimer);
  this.holdTimer=this.schedule(()=>{
   this.holdTimer=null;
   if(!this.enabled()){this.cancel();return;}
   if(this.phase!=='scroll'||this.points.size!==1||!this.origin)return;
   const p=this.points.values().next().value;
   if(Math.hypot(p.x-this.origin.x,p.y-this.origin.y)<10)return;
   this.clearMotion();this.phase='continuous';this.tickAt=this.now();this.state();this.tick();
  },Math.max(0,400-(this.now()-this.pauseAt)));
 }
 speed(distance){return Math.sign(distance)*Math.min(1800,Math.max(0,Math.abs(distance)-10)*22.5);}
 tick(){
  if(this.phase!=='continuous')return;
  if(!this.enabled()||this.points.size!==1){this.cancel();return;}
  const now=this.now(),elapsed=Math.max(0,Math.min(32,now-this.tickAt));this.tickAt=now;
  const p=this.points.values().next().value;
  if(!this.outstanding){
   this.motion('mouse_scroll',-this.speed(p.x-this.origin.x)*elapsed/1000,this.verticalDirection*this.speed(p.y-this.origin.y)*elapsed/1000);
   this.drain(true);
  }else this.remainder={};
  this.wheelTimer=this.schedule(()=>{this.wheelTimer=null;this.tick();},16);
 }
 down(id,x,y){
  if(!this.enabled())return;this.points.set(id,{x,y});
  if(this.points.size!==1||this.phase==='blocked'){this.block();return;}
  this.origin={x,y};this.pauseAnchor={x,y};this.pauseAt=this.now();this.phase='scroll';this.armHold();this.state();
 }
 move(id,x,y){
  if(!this.enabled()){this.cancel();return;}
  const p=this.points.get(id);if(!p)return;const dx=x-p.x,dy=y-p.y;p.x=x;p.y=y;
  if(this.phase==='continuous'){this.state();return;}
  if(this.phase==='scroll'){
   this.motion('mouse_scroll',-dx*1.5,this.verticalDirection*dy*1.5);
   if(Math.hypot(x-this.pauseAnchor.x,y-this.pauseAnchor.y)>4){this.pauseAnchor={x,y};this.pauseAt=this.now();this.armHold();}
   else if(this.holdTimer===null)this.armHold();
   this.state();
  }
 }
 up(id){
  if(!this.points.has(id))return this.tail;this.points.delete(id);
  this.stopTimers();if(this.phase==='continuous'){this.generation++;this.clearMotion();}
  else if(this.phase==='scroll')this.drain(true);
  this.origin=null;
  this.phase=this.points.size?'blocked':'idle';this.state();return this.tail;
 }
 block(){this.stopTimers();this.origin=null;super.block();}
 click(){}
}
if(typeof module!=='undefined')module.exports.WheelController=WheelController;
