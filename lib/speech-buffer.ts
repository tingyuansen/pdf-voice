// Share foreground/prefetch work and keep every finished clip for the session.
// A request that has been sent is already billed, so a clip is never discarded
// for being cancelled: it lands in the cache and replays, or resumes a jump to
// the passage the listener skipped to, for free. Entries live in memory only
// and are evicted least-recently-used once their bytes exceed the budget.
export class SpeechBuffer<T> {
 private ready=new Map<string,{value:T;bytes:number}>();
 private pending=new Map<string,Promise<T>>();
 private held=0;
 private dispose:(value:T)=>void;
 private measure:(value:T)=>number;
 private budget:number;
 constructor(dispose:(value:T)=>void,measure:(value:T)=>number,budget:number){this.dispose=dispose;this.measure=measure;this.budget=budget;}
 get(key:string,load:()=>Promise<T>):Promise<T>{
  const entry=this.ready.get(key);
  if(entry){this.ready.delete(key);this.ready.set(key,entry);return Promise.resolve(entry.value);}
  const pending=this.pending.get(key);if(pending)return pending;
  const request=load().then(value=>{
   const bytes=this.measure(value);this.ready.set(key,{value,bytes});this.held+=bytes;
   for(const [oldest,old] of this.ready){if(this.held<=this.budget||oldest===key)break;this.dispose(old.value);this.ready.delete(oldest);this.held-=old.bytes;}
   return value;
  }).finally(()=>{if(this.pending.get(key)===request)this.pending.delete(key);});
  this.pending.set(key,request);return request;
 }
 has(key:string){return this.ready.has(key);}
 get bytes(){return this.held;}
 get size(){return this.ready.size;}
 clear(){this.ready.forEach(entry=>this.dispose(entry.value));this.ready.clear();this.held=0;}
}
