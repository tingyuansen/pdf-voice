import { env } from 'cloudflare:workers';
// Three speech engines, listed in fallback order: Speechify Simba 3.5 (key SPEECHIFY), Google Gemini 3.8 Flash TTS
// (key GOOGLE_API_KEY) and OpenAI gpt-4o-mini-tts (key OPENAI). The reader picks one; when a passage fails there,
// it is sent to the next engine with a key. Each voice carries a gender so a backup can keep the listener's choice.
// The tables are mirrored in desktop/server.cjs, which ships standalone inside the macOS app.
const providers={
 speechify:{name:'Speechify',model:'simba-3.5',variable:'SPEECHIFY',type:'audio/mpeg',voices:[['harper_32','Harper · US','f'],['wyatt_32','Wyatt · US','m'],['geffen_32','Geffen · US','f'],['dominic_32','Dominic · US','m'],['carly','Carly · US','f'],['george','George · US','m'],['henry','Henry · US','m'],['oliver','Oliver · US','m'],['beatrice_32','Beatrice · UK','f'],['edmund_32','Edmund · UK','m'],['imogen_32','Imogen · UK','f'],['hugh_32','Hugh · UK','m']]},
 gemini:{name:'Gemini',model:'gemini-3.8-flash-tts',variable:'GOOGLE_API_KEY',type:'audio/wav',voices:[['Kore','Kore · firm','f'],['Charon','Charon · informative','m'],['Aoede','Aoede · breezy','f'],['Iapetus','Iapetus · clear','m'],['Sulafat','Sulafat · warm','f'],['Orus','Orus · firm','m'],['Zephyr','Zephyr · bright','f'],['Puck','Puck · upbeat','m']]},
 openai:{name:'OpenAI',model:'gpt-4o-mini-tts',variable:'OPENAI',type:'audio/mpeg',voices:[['marin','Marin','f'],['cedar','Cedar','m'],['coral','Coral','f'],['alloy','Alloy',''],['ash','Ash','m'],['ballad','Ballad','m'],['echo','Echo','m'],['fable','Fable','m'],['nova','Nova','f'],['onyx','Onyx','m'],['sage','Sage','f'],['shimmer','Shimmer','f'],['verse','Verse','m']]},
} as const;
type Provider=keyof typeof providers;
const instructions='Read the supplied text faithfully in a clear, calm, natural voice. Do not add commentary.';
function configuredKey(provider:Provider){const value=(env as Record<string,unknown>)[providers[provider].variable];return typeof value==='string'&&value.trim()?value.trim():'';}
async function synthesize(provider:Provider,apiKey:string,text:string,voice:string,signal:AbortSignal):Promise<Response>{
 const model=providers[provider].model;
 if(provider==='speechify'){
  // The streaming endpoint accepts 20,000 characters (the JSON one 2,000) and returns MP3 bytes directly.
  for(let attempt=0;;attempt++){
   const response=await fetch('https://api.speechify.ai/v1/audio/stream',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json',Accept:'audio/mpeg'},body:JSON.stringify({input:text,voice_id:voice,model,options:{text_normalization:true}}),signal});
   // The plan caps simultaneous requests per account: wait briefly for a slot rather than failing over.
   if(response.status!==429||attempt>=2)return response;
   await response.body?.cancel();await new Promise(resolve=>setTimeout(resolve,Math.min(2000,1000*(Number(response.headers.get('retry-after'))||.5))));
  }
 }
 if(provider==='gemini'){
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json'},body:JSON.stringify({model,input:text,response_format:{type:'audio',mime_type:'audio/wav'},generation_config:{speech_config:[{voice}]}}),signal});
  if(!response.ok)return response;
  const result=await response.json() as {steps?:{content?:{type?:string;data?:string}[]}[]};
  const audio=result.steps?.flatMap(step=>step.content||[]).find(part=>part.type==='audio'&&part.data)?.data;
  return audio?new Response(Uint8Array.from(atob(audio),c=>c.charCodeAt(0))):new Response(null,{status:502});
 }
 return fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,voice,input:text,response_format:'mp3',instructions}),signal});
}
export async function GET(){return Response.json({providers:(Object.keys(providers) as Provider[]).map(id=>({id,name:providers[id].name,model:providers[id].model,configured:Boolean(configuredKey(id)),voices:providers[id].voices.map(([value,name,gender])=>({id:value,name,gender}))}))});}
export async function POST(request:Request){
 const origin=request.headers.get('origin');
 if(origin && origin!==new URL(request.url).origin)return Response.json({error:'Request origin not allowed.'},{status:403});
 try{
  if(Number(request.headers.get('content-length'))>16000)return Response.json({error:'Passage too large.'},{status:413});
  const {provider='speechify',text,voice,key}=await request.json() as {provider?:unknown;text:unknown;voice?:unknown;key?:unknown};
  if(typeof provider!=='string'||!Object.hasOwn(providers,provider))return Response.json({error:'Unknown speech engine.'},{status:400});
  const engine=providers[provider as Provider],name=engine.name;
  const apiKey=configuredKey(provider as Provider)||(typeof key==='string'?key.trim():'');
  if(!apiKey)return Response.json({error:`Add your ${name} API key to begin listening.`},{status:401});
  if(typeof text!=='string'||!text.trim()||text.length>4096||typeof voice!=='string'||!engine.voices.some(([id])=>id===voice))return Response.json({error:'Provide a passage of 1–4096 characters and a supported voice.'},{status:400});
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(90000)]);
  const response=await synthesize(provider as Provider,apiKey,text,voice,signal);
  if(!response.ok){const status=response.status;return Response.json({error:status===401?`${name} rejected the API key.`:status===402?`${name} credits are used up. Check the plan, then try again.`:status===429?`${name} quota, concurrency or rate limit reached. Check the plan, then try again.`:`${name} speech request failed (${status}). Try again.`},{status});}
  return new Response(response.body,{headers:{'Content-Type':engine.type,'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Speech generation failed or timed out. Please try again.'},{status:502});}
}
