const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {parseEnv}=require('node:util');
const {Readable}=require('node:stream');
// Two speech engines, chosen per request by the reader: ElevenLabs Flash v2.5 (key ELEVENLABS) and OpenAI gpt-4o-mini-tts (key OPENAI).
// The tables mirror app/api/speech/route.ts; this file ships standalone inside the macOS app.
const providers={
 openai:{name:'OpenAI',model:'gpt-4o-mini-tts',variable:'OPENAI',voices:['marin','cedar','coral','alloy','ash','ballad','echo','fable','nova','onyx','sage','shimmer','verse'].map(v=>[v,v[0].toUpperCase()+v.slice(1)])},
 elevenlabs:{name:'ElevenLabs',model:'eleven_flash_v2_5',variable:'ELEVENLABS',voices:[['EXAVITQu4vr4xnSDxMaL','Sarah · US'],['XrExE9yKIg1WjnnlVkGX','Matilda · US'],['nPczCjzI2devNBz1zQrb','Brian · US'],['JBFqnCBsd6RMkjVDRZzb','George'],['Xb7hH8MSUJpSbSDYk0k2','Alice'],['onwK4e9ZLuTAKqWW03F9','Daniel']]},
};
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.pdf':'application/pdf','.bcmap':'application/octet-stream','.ttf':'font/ttf','.pfb':'application/octet-stream','.wasm':'application/wasm'};
function configuredKey(provider){try{const value=parseEnv(fs.readFileSync(path.join(os.homedir(),'.env'),'utf8'))[providers[provider].variable];return typeof value==='string'?value.trim():'';}catch{return '';}}
// Limit ElevenLabs to two concurrent generations, holding each slot until its audio finishes streaming.
let active=0;const waiting=[];
async function acquire(limit,signal){
 signal.throwIfAborted();
 if(active>=limit)await new Promise((resolve,reject)=>{
  const next=()=>{signal.removeEventListener('abort',cancel);resolve();};
  const cancel=()=>{const i=waiting.indexOf(next);if(i>=0)waiting.splice(i,1);reject(signal.reason);};
  waiting.push(next);signal.addEventListener('abort',cancel,{once:true});
 });else active++;
 // Transfer the reserved slot to a waiter rather than opening a race for it.
 let released=false;return ()=>{if(released)return;released=true;const next=waiting.shift();if(next)next();else active--;};
}
async function startServer(root,preferredPort=0){
 let origin;
 const server=http.createServer(async(req,res)=>{
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
   if(req.headers.host!==new URL(origin).host)return json(403,{error:'Invalid host.'});
   if(req.headers.origin&&req.headers.origin!==origin)return json(403,{error:'Invalid origin.'});
   const pathname=new URL(req.url,origin).pathname;
   if(pathname==='/api/speech'){
    if(req.method==='GET')return json(200,{providers:Object.keys(providers).map(id=>({id,name:providers[id].name,model:providers[id].model,configured:Boolean(configuredKey(id)),voices:providers[id].voices.map(([value,name])=>({id:value,name}))}))});
    if(req.method!=='POST')return json(405,{error:'Method not allowed.'});
    let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>16000)return json(413,{error:'Passage too large.'});body+=chunk;}
    let payload;try{payload=JSON.parse(body);}catch{return json(400,{error:'Invalid request.'});}
    const {provider='openai',text,voice,key}=payload||{};
    if(typeof provider!=='string'||!Object.hasOwn(providers,provider))return json(400,{error:'Unknown speech engine.'});
    const engine=providers[provider],name=engine.name;
    const apiKey=configuredKey(provider)||(typeof key==='string'?key.trim():'');
    if(!apiKey)return json(401,{error:`Add your ${name} API key to begin listening.`});
    if(typeof text!=='string'||!text.trim()||text.length>4096||typeof voice!=='string'||!engine.voices.some(([id])=>id===voice))return json(400,{error:'Invalid text or voice.'});
    const abort=new AbortController();res.on('close',()=>abort.abort());
    const signal=AbortSignal.any([abort.signal,AbortSignal.timeout(90000)]);
    const release=provider==='elevenlabs'?await acquire(2,signal):()=>{};
    let response;
    try{response=provider==='elevenlabs'
     ?await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,{method:'POST',headers:{'xi-api-key':apiKey,'Content-Type':'application/json'},body:JSON.stringify({model_id:engine.model,text}),signal})
     :await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:engine.model,voice,input:text,response_format:'mp3',instructions:'Read the supplied text faithfully in a clear, calm, natural voice. Do not add commentary.'}),signal});}
    catch(error){release();throw error;}
    if(!response.ok){await response.body?.cancel();release();const status=response.status;return json(status,{error:status===401?`${name} rejected the API key.`:status===402?`${name} credits are used up. Check the plan, then try again.`:status===429?`${name} quota, concurrency or rate limit reached. Check the plan, then try again.`:`${name} speech request failed (${status}).`});}
    res.on('close',release);res.writeHead(200,{'Content-Type':'audio/mpeg','Cache-Control':'no-store'});Readable.fromWeb(response.body).on('error',()=>res.destroy()).pipe(res);return;
   }
   if(req.method!=='GET'&&req.method!=='HEAD')return json(405,{error:'Method not allowed.'});
   const file=path.resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep))return json(403,{error:'Invalid path.'});
   const stat=await fs.promises.stat(file).catch(()=>null);if(!stat?.isFile())return json(404,{error:'File not found.'});
   res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self' data: blob:; object-src 'none'; frame-ancestors 'none'"});
   if(req.method==='HEAD')return res.end();fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  }catch{if(!res.headersSent)json(500,{error:'The request failed. Please try again.'});else res.destroy();}
 });
 await new Promise((resolve,reject)=>{server.once('error',error=>{if(error.code==='EADDRINUSE'&&preferredPort){server.once('error',reject);server.listen(0,'127.0.0.1',resolve);}else reject(error);});server.listen(preferredPort,'127.0.0.1',resolve);});origin=`http://127.0.0.1:${server.address().port}`;return {server,origin};
}
module.exports={startServer};
