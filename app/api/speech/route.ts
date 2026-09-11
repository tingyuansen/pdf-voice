import { env } from 'cloudflare:workers';
const voices=new Set(['marin','cedar','alloy','ash','ballad','coral','echo','fable','nova','onyx','sage','shimmer','verse']);
export async function GET(){return Response.json({configured:Boolean((env as Record<string,unknown>).OPENAI),model:'gpt-4o-mini-tts'});}
export async function POST(request:Request){
 const origin=request.headers.get('origin');
 if(origin && origin!==new URL(request.url).origin)return Response.json({error:'Request origin not allowed.'},{status:403});
 try{
  if(Number(request.headers.get('content-length'))>16000)return Response.json({error:'Passage too large.'},{status:413});
  const {text,voice='marin',key}=await request.json() as {text:unknown;voice?:string;key?:string};
  if(typeof text!=='string'||!text.trim()||text.length>4096||!voices.has(voice))return Response.json({error:'Provide a passage of 1–4096 characters and a supported voice.'},{status:400});
  const apiKey=(env as Record<string,unknown>).OPENAI || key;
  if(typeof apiKey!=='string'||!apiKey.trim())return Response.json({error:'Add your OpenAI API key to begin listening.'},{status:401});
  const response=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4o-mini-tts',voice,input:text,response_format:'mp3',instructions:'Read the supplied text faithfully in a clear, calm, natural voice. Do not add commentary.'}),signal:AbortSignal.timeout(90000)});
  if(!response.ok){const status=response.status;return Response.json({error:status===401?'OpenAI rejected the API key.':status===429?'OpenAI quota or rate limit reached. Check API billing, then try again.':`OpenAI speech request failed (${status}). Try again.`},{status});}
  return new Response(response.body,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Speech generation failed or timed out. Please try again.'},{status:502});}
}
