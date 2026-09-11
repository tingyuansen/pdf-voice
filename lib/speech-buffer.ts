// Share foreground/prefetch work without retaining failed or cancelled requests.
export class SpeechBuffer<T> {
 private ready=new Map<string,T>();
 private pending=new Map<string,Promise<T>>();
 private dispose:(value:T)=>void;
 private limit:number;
 constructor(dispose:(value:T)=>void,limit=100){this.dispose=dispose;this.limit=limit;}
 get(key:string,signal:AbortSignal,load:()=>Promise<T>):Promise<T>{
  const value=this.ready.get(key);
  if(value!==undefined){this.ready.delete(key);this.ready.set(key,value);return Promise.resolve(value);}
  const pending=this.pending.get(key);if(pending)return pending;
  const request=load().then(value=>{
   if(signal.aborted){this.dispose(value);throw new DOMException('Cancelled','AbortError');}
   this.ready.set(key,value);
   if(this.ready.size>this.limit){const first=this.ready.keys().next().value!;this.dispose(this.ready.get(first)!);this.ready.delete(first);}
   return value;
  }).finally(()=>{if(this.pending.get(key)===request)this.pending.delete(key);});
  this.pending.set(key,request);return request;
 }
 cancelPending(){this.pending.clear();}
 clear(){this.cancelPending();this.ready.forEach(this.dispose);this.ready.clear();}
}
