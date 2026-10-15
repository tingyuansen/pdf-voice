import { env } from 'cloudflare:workers';
// Two speech engines, chosen per request by the reader: ElevenLabs Flash v2.5 (key ELEVENLABS) and OpenAI gpt-4o-mini-tts (key OPENAI).
// The tables are mirrored in desktop/server.cjs, which ships standalone inside the macOS app.
const providers={
 openai:{name:'OpenAI',model:'gpt-4o-mini-tts',variable:'OPENAI',voices:['marin','cedar','coral','alloy','ash','ballad','echo','fable','nova','onyx','sage','shimmer','verse'].map(v=>[v,v[0].toUpperCase()+v.slice(1)])},
 elevenlabs:{name:'ElevenLabs',model:'eleven_flash_v2_5',variable:'ELEVENLABS',voices:[['EXAVITQu4vr4xnSDxMaL','Sarah · US'],['XrExE9yKIg1WjnnlVkGX','Matilda · US'],['nPczCjzI2devNBz1zQrb','Brian · US'],['JBFqnCBsd6RMkjVDRZzb','George'],['Xb7hH8MSUJpSbSDYk0k2','Alice'],['onwK4e9ZLuTAKqWW03F9','Daniel']]},
} as const;
type Provider=keyof typeof providers;
function configuredKey(provider:Provider){const value=(env as Record<string,unknown>)[providers[provider].variable];return typeof value==='string'&&value.trim()?value.trim():'';}
export async function GET(){return Response.json({providers:(Object.keys(providers) as Provider[]).map(id=>({id,name:providers[id].name,model:providers[id].model,configured:Boolean(configuredKey(id)),voices:providers[id].voices.map(([value,name])=>({id:value,name}))}))});}
export async function POST(request:Request){
 const origin=request.headers.get('origin');
 if(origin && origin!==new URL(request.url).origin)return Response.json({error:'Request origin not allowed.'},{status:403});
 try{
  if(Number(request.headers.get('content-length'))>16000)return Response.json({error:'Passage too large.'},{status:413});
  const {provider='openai',text,voice,key}=await request.json() as {provider?:unknown;text:unknown;voice?:unknown;key?:unknown};
  if(typeof provider!=='string'||!Object.hasOwn(providers,provider))return Response.json({error:'Unknown speech engine.'},{status:400});
  const engine=providers[provider as Provider],name=engine.name;
  const apiKey=configuredKey(provider as Provider)||(typeof key==='string'?key.trim():'');
  if(!apiKey)return Response.json({error:`Add your ${name} API key to begin listening.`},{status:401});
  if(typeof text!=='string'||!text.trim()||text.length>4096||typeof voice!=='string'||!engine.voices.some(([id])=>id===voice))return Response.json({error:'Provide a passage of 1–4096 characters and a supported voice.'},{status:400});
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(90000)]);
  const response=provider==='elevenlabs'
   ?await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,{method:'POST',headers:{'xi-api-key':apiKey,'Content-Type':'application/json'},body:JSON.stringify({model_id:engine.model,text}),signal})
   :await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:engine.model,voice,input:text,response_format:'mp3',instructions:'Read the supplied text faithfully in a clear, calm, natural voice. Do not add commentary.'}),signal});
  if(!response.ok){const status=response.status;return Response.json({error:status===401?`${name} rejected the API key.`:status===402?`${name} credits are used up. Check the plan, then try again.`:status===429?`${name} quota, concurrency or rate limit reached. Check the plan, then try again.`:`${name} speech request failed (${status}). Try again.`},{status});}
  return new Response(response.body,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Speech generation failed or timed out. Please try again.'},{status:502});}
}
