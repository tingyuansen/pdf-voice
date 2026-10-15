// Retry the complete download: a connection can fail after HTTP 200 headers.
// Completed clips are cached by SpeechBuffer; only failed downloads repeat.
export async function withSpeechBackup<T>(primary:()=>Promise<T>,backup?:()=>Promise<T>):Promise<T>{
 try{return await primary();}catch(error){if(!backup)throw error;return backup();}
}
export const SPEECH_TIMEOUT_MS=12000;
export const BACKUP_TIMEOUT_MS=20000;
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
