const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');
const {startServer}=require('../desktop/server.cjs');
(async()=>{const {server,origin}=await startServer(path.resolve('desktop-dist'));try{
 const page=await fetch(origin);assert.equal(page.status,200);assert((await page.text()).includes('/assets/'));
 assert.equal((await fetch(origin+'/pdf.worker.min.mjs')).status,200);
 const jbig2=await fetch(origin+'/wasm/jbig2.wasm');assert.equal(jbig2.status,200);assert.equal(jbig2.headers.get('content-type'),'application/wasm');assert(jbig2.headers.get('content-security-policy').includes("'wasm-unsafe-eval'"),'PDF.js may compile its image decoders');
 const state=await fetch(origin+'/api/speech').then(r=>r.json());assert(!/sk[-_]|AIza/.test(JSON.stringify(state)),'no key reaches the reader');
 assert.deepEqual(state.providers.map(p=>p.id),['speechify','gemini','openai'],'engines are listed in fallback order');
 const [speechify,gemini,openai]=state.providers;
 assert.equal(speechify.model,'simba-3.5');assert.equal(speechify.voices[0].id,'harper_32');assert.equal(gemini.model,'gemini-3.8-flash-tts');assert.equal(gemini.voices[0].id,'Kore');assert.equal(openai.model,'gpt-4o-mini-tts');assert(openai.voices.some(v=>v.id==='marin'));
 for(const p of state.providers)assert(p.voices.length>=6&&p.voices.every(v=>v.id&&v.name&&typeof v.gender==='string'),p.id);
 const post=body=>fetch(origin+'/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await fetch(origin+'/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"text":"Hello","voice":"invalid"}'})).status,400);
 assert.equal((await post({text:'Hello',voice:'marin'})).status,400,'an OpenAI voice is rejected by the default Speechify engine');
 assert.equal((await post({provider:'elevenlabs',text:'Hello',voice:'EXAVITQu4vr4xnSDxMaL'})).status,400,'ElevenLabs is retired');
 assert.equal((await fetch(origin+'/api/speech',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:'{"text":"Hello"}'})).status,403);
 // Live speech from every configured engine, in the format the reader expects.
 const types={speechify:'audio/mpeg',gemini:'audio/wav',openai:'audio/mpeg'},live=[];
 for(const p of state.providers){if(!p.configured){console.log(`SKIP: ${p.name} has no key in ~/.env.`);continue;}
  const started=Date.now();const r=await post({provider:p.id,text:'Paper Voice is ready to read.',voice:p.voices[0].id});const bytes=(await r.arrayBuffer()).byteLength;
  assert.equal(r.status,200,p.id);assert.equal(r.headers.get('content-type'),types[p.id]);assert(bytes>1000,p.id);live.push(`${p.name} ${Date.now()-started} ms`);}
 assert(speechify.configured,'the primary engine needs SPEECHIFY in ~/.env');
 // Playback asks for up to five passages at once; the server queues them under Speechify's concurrency cap instead of surfacing 429s.
 const burst=await Promise.all([0,1,2,3,4].map(i=>post({provider:'speechify',text:`Concurrent passage number ${i+1}.`,voice:'harper_32'}).then(async r=>{const bytes=(await r.arrayBuffer()).byteLength;return r.status===200&&bytes>1000?200:r.status;})));assert.deepEqual(burst,[200,200,200,200,200]);
 assert(!fs.existsSync('work/desktop-package/.env'));assert(!fs.existsSync('work/desktop-package/desktop-dist/examples'));assert.equal((await fetch(origin+'/examples/manuscript.pdf')).status,404,'no document is served from the home folder');
 console.log(`PASS: packaged assets and image decoders, Speechify, Gemini and OpenAI key lookup in fallback order, request validation, foreign origin protection, live speech (${live.join(', ')}), Speechify concurrency queueing, no bundled or home-folder manuscript.`);
}finally{server.close();server.closeAllConnections();}})().catch(e=>{console.error(e);process.exitCode=1;});
