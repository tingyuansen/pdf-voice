const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');
const {startServer}=require('../desktop/server.cjs');
(async()=>{const {server,origin}=await startServer(path.resolve('desktop-dist'));try{
 const page=await fetch(origin);assert.equal(page.status,200);assert((await page.text()).includes('/assets/'));
 assert.equal((await fetch(origin+'/pdf.worker.min.mjs')).status,200);
 const state=await fetch(origin+'/api/speech').then(r=>r.json());assert.equal(state.configured,true);assert(!JSON.stringify(state).includes('sk-'));
 assert.equal((await fetch(origin+'/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"text":"Hello","voice":"invalid"}'})).status,400);
 assert.equal((await fetch(origin+'/api/speech',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:'{"text":"Hello"}'})).status,403);
 const speech=await fetch(origin+'/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Paper Voice is ready to read.',voice:'marin'})});assert.equal(speech.status,200);assert.equal(speech.headers.get('content-type'),'audio/mpeg');assert((await speech.arrayBuffer()).byteLength>1000);
 assert(!fs.existsSync('work/desktop-package/.env'));assert(!fs.existsSync('work/desktop-package/desktop-dist/examples'));
 console.log('PASS: packaged assets, server key lookup, request validation, foreign origin protection, live speech, no bundled manuscript.');
}finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
