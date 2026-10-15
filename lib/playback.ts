export type ReadingScope='selection'|'page'|'document';
// Target roughly 30 seconds ahead, with a small cap on speculative generation.
export function speechLookahead<T extends {text:string}>(queue:T[],index:number,speed:number):T[]{
 const ahead:T[]=[];let seconds=0;
 for(const passage of queue.slice(index+1,index+7)){
  ahead.push(passage);seconds+=passage.text.trim().split(/\s+/).length/(2.5*Math.max(.5,speed));
  if(ahead.length>=2&&seconds>=30)break;
 }
 return ahead;
}
export async function warmSpeech<T>(items:T[],load:(item:T)=>Promise<unknown>,active:()=>boolean):Promise<void>{
 let next=0;
 const worker=async()=>{while(active()&&next<items.length){const item=items[next++];try{await load(item);}catch{/* Foreground playback reports errors and can retry. */}}};
 await Promise.all([worker(),worker()]);
}
export async function waitForRunway(ready:Promise<unknown>,ms=1200):Promise<void>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{await Promise.race([ready.catch(()=>{}),new Promise<void>(resolve=>{timer=setTimeout(resolve,ms);})]);}
 finally{clearTimeout(timer);}
}
export function nextPlayback(scope:ReadingScope,index:number,count:number,page:number,totalPages:number):'passage'|'page'|'stop'{
 if(index+1<count)return 'passage';
 return scope==='document'&&page<totalPages?'page':'stop';
}
