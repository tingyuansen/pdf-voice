// Cache blobs, not live media decoders. Only the current passage owns a player.
export function releaseAudio(player:HTMLAudioElement){
 player.onended=null;player.onerror=null;player.pause();
 URL.revokeObjectURL(player.src);player.removeAttribute('src');player.load();
}

export function watchAudio(player:HTMLAudioElement,onStall:()=>void,intervalMs=1000,limitMs=8000){
 let position=player.currentTime,lastProgress=Date.now();
 const timer=setInterval(()=>{
  if(player.paused||player.currentTime!==position){position=player.currentTime;lastProgress=Date.now();return;}
  if(Date.now()-lastProgress>=limitMs){clearInterval(timer);onStall();}
 },intervalMs);
 return ()=>clearInterval(timer);
}

export async function startAudio(player:HTMLAudioElement,timeoutMs=10000){
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{await Promise.race([player.play(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Audio did not start. Press play to retry this passage.')),timeoutMs);})]);}
 finally{clearTimeout(timer);}
}
