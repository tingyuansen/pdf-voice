// Retry the complete download: a connection can fail after HTTP 200 headers.
// Completed clips are cached by SpeechBuffer; only failed downloads repeat.
// Each backup runs only after everything before it has failed.
export async function withSpeechBackup<T>(primary:()=>Promise<T>,...backups:(()=>Promise<T>)[]):Promise<T>{
 try{return await primary();}catch(error){const [next,...rest]=backups;if(!next)throw error;return withSpeechBackup(next,...rest);}
}
export const SPEECH_TIMEOUT_MS=12000;
export const BACKUP_TIMEOUT_MS=20000;
// A backup may be slower than the primary (Gemini renders roughly 2.5 s of audio per second),
// so long passages get proportionally more time, staying under the servers' 90-second limit.
export function backupTimeout(characters:number){return Math.min(85000,BACKUP_TIMEOUT_MS+30*Math.max(0,characters-400));}
export async function fetchSpeech(body:string,request:typeof fetch=fetch,timeoutMs=SPEECH_TIMEOUT_MS,delayMs=750,maxAttempts=2):Promise<Blob>{
 for(let attempt=0;;attempt++){
  let retryable=true;
  const controller=new AbortController();
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   return await Promise.race([(async()=>{
   const response=await request('/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body,signal:controller.signal});
   if(!response.ok){
    retryable=[408,500,502,503,504].includes(response.status);
    const data=await response.json().catch(()=>({})) as {error?:string};
    throw Error(data.error||`Speech request failed (${response.status}).`);
   }
   const blob=await response.blob();
   if(!blob.size)throw Error('The speech service returned empty audio.');
   return blob;
   })(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Speech download timed out.'));},timeoutMs);})]);
  }catch(error){
   if(!retryable)throw error;
   if(attempt+1>=maxAttempts)throw Error(maxAttempts===1?'Could not download this passage in time. Press play to retry this passage.':'Could not download this passage after two attempts. Press play to retry this passage.');
   clearTimeout(timer);await new Promise(resolve=>setTimeout(resolve,delayMs));
  }finally{clearTimeout(timer);}
 }
}
