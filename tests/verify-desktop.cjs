const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');
const {startServer}=require('../desktop/server.cjs');
(async()=>{const {server,origin}=await startServer(path.resolve('desktop-dist'));try{
 const page=await fetch(origin);assert.equal(page.status,200);assert((await page.text()).includes('/assets/'));
 assert.equal((await fetch(origin+'/pdf.worker.min.mjs')).status,200);
 const jbig2=await fetch(origin+'/wasm/jbig2.wasm');assert.equal(jbig2.status,200);assert.equal(jbig2.headers.get('content-type'),'application/wasm');assert(jbig2.headers.get('content-security-policy').includes("'wasm-unsafe-eval'"),'PDF.js may compile its image decoders');
 const state=await fetch(origin+'/api/speech').then(r=>r.json());assert(!/sk-|xi-/.test(JSON.stringify(state)));
 const elevenlabs=state.providers.find(p=>p.id==='elevenlabs'),openai=state.providers.find(p=>p.id==='openai');
 assert.equal(elevenlabs.voices[0].id,'EXAVITQu4vr4xnSDxMaL');assert.equal(elevenlabs.configured,true);assert.equal(elevenlabs.model,'eleven_flash_v2_5');assert(elevenlabs.voices.length>=6&&elevenlabs.voices.every(v=>v.id&&v.name));
 assert.equal(openai.model,'gpt-4o-mini-tts');assert(openai.voices.some(v=>v.id==='marin'));
 assert.equal((await fetch(origin+'/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"text":"Hello","voice":"invalid"}'})).status,400);
 assert.equal((await fetch(origin+'/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Hello',voice:elevenlabs.voices[0].id})})).status,400,'a ElevenLabs voice is rejected by the default OpenAI engine');
 assert.equal((await fetch(origin+'/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"provider":"other","text":"Hello","voice":"marin"}'})).status,400);
 assert.equal((await fetch(origin+'/api/speech',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:'{"text":"Hello"}'})).status,403);
 const speech=await fetch(origin+'/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'elevenlabs',text:'Paper Voice is ready to read.',voice:elevenlabs.voices[0].id})});assert.equal(speech.status,200);assert.equal(speech.headers.get('content-type'),'audio/mpeg');assert((await speech.arrayBuffer()).byteLength>1000);
 if(openai.configured){const alt=await fetch(origin+'/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'openai',text:'Paper Voice is ready to read.',voice:'marin'})});assert.equal(alt.status,200);assert((await alt.arrayBuffer()).byteLength>1000);}
 // Three passages are requested at once during playback; the server must serialise them under ElevenLabs's concurrency cap instead of surfacing 429s.
 const burst=await Promise.all([0,1,2].map(i=>fetch(origin+'/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'elevenlabs',text:`Concurrent passage number ${i+1}.`,voice:elevenlabs.voices[0].id})}).then(async r=>{const bytes=(await r.arrayBuffer()).byteLength;return r.status===200&&bytes>1000?200:r.status;})));assert.deepEqual(burst,[200,200,200]);
 assert(!fs.existsSync('work/desktop-package/.env'));assert(!fs.existsSync('work/desktop-package/desktop-dist/examples'));assert.equal((await fetch(origin+'/examples/manuscript.pdf')).status,404,'no document is served from the home folder');
 console.log('PASS: packaged assets and image decoders, ElevenLabs and OpenAI key lookup, request validation, foreign origin protection, live speech, concurrency limiting, no bundled or home-folder manuscript.');
}finally{server.close();server.closeAllConnections();}})().catch(e=>{console.error(e);process.exitCode=1;});
