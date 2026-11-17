export class ConverterWorker {
  constructor(){this.worker=null;this.requests=new Map();this.serial=0;}
  start(){
    if(this.worker)return;
    this.worker=new Worker(new URL('./worker.js',import.meta.url));
    this.worker.onmessage=({data})=>{
      const pending=this.requests.get(data.id);if(!pending)return;
      if(data.event==='progress'){pending.progress?.(data);return;}
      if(data.fatal){this.cancel(new Error(data.message));return;}
      clearTimeout(pending.timer);this.requests.delete(data.id);
      if(data.event==='error')pending.reject(new Error(data.message));else pending.resolve(data.result);
    };
    this.worker.onerror=()=>this.cancel(new Error('The conversion worker stopped. The file may exceed your device’s memory. Try a smaller file.'));
  }
  call(action,payload={},progress){
    this.start();const id=++this.serial;
    return new Promise((resolve,reject)=>{
      const media=action==='convert'&&payload.options?.engine==='media';
      const timer=media?null:setTimeout(()=>this.cancel(new Error('Processing took too long. Try a smaller file or a shorter clip.')),240000);
      this.requests.set(id,{resolve,reject,progress,timer});
      this.worker.postMessage({id,action,...payload});
    });
  }
  cancel(error=new DOMException('Conversion canceled.','AbortError')){
    this.worker?.terminate();this.worker=null;
    for(const pending of this.requests.values()){clearTimeout(pending.timer);pending.reject(error);}
    this.requests.clear();
  }
}
