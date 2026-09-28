// Serialize writes; acknowledgements never replace newer local edits.
class AutoSave {
 constructor(config,send,onState) { this.value=structuredClone(config);this.saved=structuredClone(config);this.send=send;this.onState=onState;this.running=null;this.error=null; }
 get dirty(){return JSON.stringify(this.value)!==JSON.stringify(this.saved);}
 async flush(){
  if(this.running)return this.running;
  this.error=null;
  this.running=(async()=>{
   while(this.dirty){
    const sent=structuredClone(this.value);this.onState('保存中');
    try {
     const result=await this.send(sent);this.saved=structuredClone(result);
     this.value.revision=result.revision;
    } catch(e){this.error=e;this.onState(e.status===409?'競合あり':'保存失敗');return false;}
   }
   this.onState('保存済み');return true;
  })();
  try{return await this.running;}finally{this.running=null;}
 }
}
if(typeof module!=='undefined')module.exports=AutoSave;
