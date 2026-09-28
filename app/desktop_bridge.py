"""Bounded request/response channel to the owning Electron process over its pipes."""
import json
import threading
import uuid

class DesktopBridge:
    def __init__(self,output):
        self.output=output;self.lock=threading.RLock();self.pending={};self.closed=False
    def clipboard(self,text):
        request_id=uuid.uuid4().hex;event=threading.Event();result={}
        with self.lock:
            if self.closed:raise RuntimeError('PCアプリとの接続が終了しています。')
            self.pending[request_id]=(event,result)
        try:
            with self.lock:
                if self.closed:raise RuntimeError('PCアプリとの接続が終了しています。')
                self.output.write(json.dumps({'deck':'clipboard','id':request_id,'text':text},ensure_ascii=False)+'\n')
                self.output.flush()
            if not event.wait(10):raise RuntimeError('文字入力の準備を確認できませんでした。自動再送は行いません。')
            if not result.get('ok'):raise RuntimeError('文字入力の準備に失敗しました。')
        finally:
            with self.lock:self.pending.pop(request_id,None)
    def receive(self,line):
        try:data=json.loads(line)
        except (ValueError,TypeError):return
        if not isinstance(data,dict) or data.get('deck')!='clipboard-result' or not isinstance(data.get('id'),str):return
        with self.lock:
            record=self.pending.get(data.get('id'))
            if record:
                record[1]['ok']=data.get('ok') is True;record[0].set()
    def close(self):
        with self.lock:
            self.closed=True
            for event,result in self.pending.values():result['ok']=False;event.set()
