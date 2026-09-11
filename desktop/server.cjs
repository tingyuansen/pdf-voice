const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {parseEnv}=require('node:util');
const {Readable}=require('node:stream');
const voices=new Set(['marin','cedar','alloy','ash','ballad','coral','echo','fable','nova','onyx','sage','shimmer','verse']);
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.pdf':'application/pdf','.bcmap':'application/octet-stream','.ttf':'font/ttf','.pfb':'application/octet-stream'};
function readKey(){try{return parseEnv(fs.readFileSync(path.join(os.homedir(),'.env'),'utf8')).OPENAI||'';}catch{return '';}}
async function startServer(root,preferredPort=0){
 let origin;
 const server=http.createServer(async(req,res)=>{
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
   if(req.headers.host!==new URL(origin).host)return json(403,{error:'Invalid host.'});
   if(req.headers.origin&&req.headers.origin!==origin)return json(403,{error:'Invalid origin.'});
   const pathname=new URL(req.url,origin).pathname;
   if(pathname==='/api/speech'){
    if(req.method==='GET')return json(200,{configured:Boolean(readKey()),model:'gpt-4o-mini-tts'});
    if(req.method!=='POST')return json(405,{error:'Method not allowed.'});
    let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>16000)return json(413,{error:'Passage too large.'});body+=chunk;}
    let payload;try{payload=JSON.parse(body);}catch{return json(400,{error:'Invalid request.'});}
    const {text,voice='marin',key}=payload||{};
    if(typeof text!=='string'||!text.trim()||text.length>4096||!voices.has(voice))return json(400,{error:'Invalid text or voice.'});
    const apiKey=readKey()||key;if(typeof apiKey!=='string'||!apiKey.trim())return json(401,{error:'Add your OpenAI API key to begin listening.'});
    const abort=new AbortController();res.on('close',()=>abort.abort());
    const response=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4o-mini-tts',voice,input:text,response_format:'mp3',instructions:'Read the supplied text faithfully in a clear, calm, natural voice. Do not add commentary.'}),signal:AbortSignal.any([abort.signal,AbortSignal.timeout(90000)])});
    if(!response.ok)return json(response.status,{error:response.status===401?'OpenAI rejected the API key.':response.status===429?'OpenAI quota or rate limit reached. Check API billing, then try again.':`OpenAI speech request failed (${response.status}).`});
    res.writeHead(200,{'Content-Type':'audio/mpeg','Cache-Control':'no-store'});Readable.fromWeb(response.body).pipe(res);return;
   }
   if(req.method!=='GET'&&req.method!=='HEAD')return json(405,{error:'Method not allowed.'});
   let file;
   if(pathname==='/examples/manuscript.pdf')file=path.join(os.homedir(),'manuscript.pdf');
   else {file=path.resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep))return json(403,{error:'Invalid path.'});}
   const stat=await fs.promises.stat(file).catch(()=>null);if(!stat?.isFile())return json(404,{error:'File not found.'});
   res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self' data: blob:; object-src 'none'; frame-ancestors 'none'"});
   if(req.method==='HEAD')return res.end();fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  }catch{if(!res.headersSent)json(500,{error:'The request failed. Please try again.'});else res.destroy();}
 });
 await new Promise((resolve,reject)=>{server.once('error',error=>{if(error.code==='EADDRINUSE'&&preferredPort){server.once('error',reject);server.listen(0,'127.0.0.1',resolve);}else reject(error);});server.listen(preferredPort,'127.0.0.1',resolve);});origin=`http://127.0.0.1:${server.address().port}`;return {server,origin};
}
module.exports={startServer};
