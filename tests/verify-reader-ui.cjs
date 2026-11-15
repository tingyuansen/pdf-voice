const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {startServer}=require('../desktop/server.cjs');
const userData=fs.mkdtempSync(path.join(os.tmpdir(),'paper-voice-ui-'));
app.setPath('userData',userData);app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
function pdf(){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];const pages=[];
 for(let p=1;p<=5;p++){
  const content=`BT /F1 12 Tf 60 650 Td (Page ${p} begins with a distinct passage about reading science clearly and following the argument.) Tj 0 -40 Td (Another paragraph on page ${p} provides enough text to verify a continuous reading transition.) Tj ET`;
  const id=objects.length+1;pages.push(id);objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id+1} 0 R >>`,`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
 }
 objects[1]=`<< /Type /Pages /Kids [${pages.map(n=>`${n} 0 R`).join(' ')}] /Count 5 >>`;
 let out='%PDF-1.4\n';const offsets=[0];objects.forEach((s,i)=>{offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${s}\nendobj\n`;});const xref=Buffer.byteLength(out);out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(out).toString('base64');
}
let server,win;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function js(code){return win.webContents.executeJavaScript(code,true);}
async function until(code,timeout=12000){const start=Date.now();while(Date.now()-start<timeout){if(await js(code))return;await pause(50);}throw Error('Timed out: '+code);}
async function click(text){await js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);await pause(100);}
async function navigate(n){
 for(let i=0;i<10;i++){const current=Number(await js("document.querySelector('[aria-label=\"Page number\"]').value"));if(current===n)break;await js(`document.querySelector('[aria-label="${current<n?'Next page':'Previous page'}"]').click()`);await pause(100);}
 await pause(750);
}
app.whenReady().then(async()=>{
 const backend=await startServer(path.resolve('desktop-dist'));server=backend.server;
 win=new BrowserWindow({show:false,width:1280,height:920,webPreferences:{contextIsolation:true,nodeIntegration:false}});win.webContents.setAudioMuted(true);
 await win.loadURL(backend.origin);await until("document.querySelectorAll('select option').length>4");
 await js(`(()=>{
 window.testPlayers=[];const NativeAudio=window.Audio;window.Audio=function(...args){const player=new NativeAudio(...args);window.testPlayers.push(player);if(window.stallNextAudio){window.stallNextAudio--;Object.defineProperty(player,'currentTime',{get:()=>.3,set:()=>{},configurable:true});Object.defineProperty(player,'paused',{get:()=>false,configurable:true});player.play=()=>Promise.resolve();}return player;};
 window.testRequests=[];const original=window.fetch;window.fetch=async(url,options)=>{
  if(url!=='/api/speech'||options?.method!=='POST')return original(url,options);
  const payload=JSON.parse(options.body);window.testRequests.push(payload);
  if(window.hangPrimary&&payload.provider==='speechify')return new Promise(()=>{});
  if(window.failPrimary&&payload.provider==='speechify')throw TypeError('simulated connection failure');
  const bytes=new Uint8Array(44+16000*2*1.5),v=new DataView(bytes.buffer);const word=(i,s)=>{for(let j=0;j<s.length;j++)bytes[i+j]=s.charCodeAt(j);};
  word(0,'RIFF');v.setUint32(4,bytes.length-8,true);word(8,'WAVE');word(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,bytes.length-44,true);
  return new Response(bytes,{headers:{'Content-Type':'audio/wav'}});
 };
 const bytes=Uint8Array.from(atob('${pdf()}'),c=>c.charCodeAt(0));const file=new File([bytes],'test-pages.pdf',{type:'application/pdf'});const transfer=new DataTransfer();transfer.items.add(file);const input=document.querySelector('input[type=file]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 })()`);
 await until("document.querySelectorAll('.sharp-paper').length===5");
 await click('Exit clean mode').catch(async()=>{await js("document.querySelector('[aria-label=\"Exit clean mode\"]')?.click()");});
 await navigate(3);
 const anchor=()=>js(`(()=>{const root=document.querySelector('.paperwrap'),r=root.getBoundingClientRect(),p=document.querySelector('.sharp-paper[data-page="3"]').getBoundingClientRect();return {fraction:(r.top+root.clientHeight*.22-p.top)/p.height,page:document.querySelector('[aria-label="Page number"]').value};})()`);
 const before=await anchor();assert.equal(before.page,'3');
 for(const delta of [-10,-10,-10,-10,-10,10,10,10,10,10]){await js(`document.querySelector('.paperwrap').dispatchEvent(new WheelEvent('wheel',{deltaY:${delta},ctrlKey:true,bubbles:true,cancelable:true}))`);await pause(70);}
 await pause(350);const after=await anchor();assert.equal(after.page,'3');assert(Math.abs(after.fraction-before.fraction)<.003,JSON.stringify({before,after}));
 await js("document.querySelector('[aria-label=\"Zoom in\"]').click()");await pause(400);assert.equal((await anchor()).page,'3');assert(Math.abs((await anchor()).fraction-before.fraction)<.003,JSON.stringify({before,button:await anchor()}));
 console.log('PASS: trackpad zoom in/out and button zoom preserve page 3 and its reading position.');
 await click('Follow reading: On');assert.equal(await js("JSON.parse(localStorage.getItem('paper-voice-reading')).followReading"),false);
 await js('window.hangPrimary=true');await click('From this page to the end');
 await until("document.querySelector('.transport').textContent.includes('Reading aloud')",20000);
 const requests=await js('window.testRequests');assert(requests[0].text.includes('Page 3'));assert(requests.some(r=>r.provider==='gemini'));assert(requests.filter(r=>r.provider==='gemini').every(r=>r.voice==='Kore'),'the backup keeps the female default voice');assert(!requests.some(r=>r.provider==='openai'),'OpenAI is not used while Gemini answers');assert.equal(requests.filter(r=>r.provider==='speechify'&&r.text===requests[0].text).length,1);assert(!requests.some(r=>/Page [12] |page [12] /.test(r.text)));
 await js("document.querySelector('.sharp-paper[data-page=\"5\"]').scrollIntoView({block:'start'})");await pause(100);const freeScroll=await js("document.querySelector('.paperwrap').scrollTop");
 await until("document.querySelector('[aria-label=\"Page number\"]').value==='4'",20000);
 assert(Math.abs(await js("document.querySelector('.paperwrap').scrollTop")-freeScroll)<2);
 assert(await js("document.querySelector('.transport').textContent.includes('Gemini backup')"));
 await click('Follow reading: Off');await pause(450);assert(Math.abs(await js("document.querySelector('.paperwrap').scrollTop")-freeScroll)>100);
 console.log('PASS: reading starts on page 3, continues to page 4, fails over from Speechify to Gemini, and follows only when enabled.');
 await until("document.querySelector('.transport').textContent.includes('Ready when you are')",45000);
 console.log('PASS: continuous playback reaches the last page and stops.');
 await navigate(2);await click('Reading view');await click('Follow reading: On');
 await js('window.hangPrimary=false;window.failPrimary=false');await click('From this page to the end');
 await until("document.querySelector('.transport').textContent.includes('Reading aloud')");
 await js("document.querySelector('.reflow-page[data-page=\"5\"]').scrollIntoView({block:'start'})");await pause(100);
 const readingScroll=await js("document.querySelector('.reflow-scroll').scrollTop");
 await until("document.querySelector('[aria-label=\"Page number\"]').value==='3'");
 assert(Math.abs(await js("document.querySelector('.reflow-scroll').scrollTop")-readingScroll)<2);
 console.log('PASS: Reading view also allows independent scrolling across playback page transitions.');

 await navigate(5);
 await js('window.stallNextAudio=true');
 const playersBefore=await js('window.testPlayers.length');
 await click('Read page');
 await until("document.querySelector('.transport').textContent.includes('Reading aloud')");
 const requestsBefore=await js('window.testRequests.length');
 await until(`window.testPlayers.length>${playersBefore+1}`,12000);
 assert.equal(await js('window.testRequests.length'),requestsBefore,'Recovery must reuse downloaded speech');
 await until("document.querySelector('.transport').textContent.includes('Ready when you are')",10000);
 assert.equal(await js("window.testPlayers.filter(p=>p.hasAttribute('src')).length"),0,'Finished players must release decoders and blob URLs');
 console.log('PASS: a frozen audio clock recovers automatically without another paid request; finished players are released.');
 await js('window.stallNextAudio=2');const beforePersistent=await js('window.testPlayers.length');await click('Read page');
 await until("document.body.textContent.includes('Audio stopped advancing after recovery')",22000);
 assert.equal(await js('window.testPlayers.length'),beforePersistent+2);
 assert.equal(await js("window.testPlayers.filter(p=>p.hasAttribute('src')).length"),0);
 await click('Clean mode');
 assert(await js("document.querySelector('.clean-notice').textContent.includes('Audio stopped advancing')"));
 console.log('PASS: persistent stalls terminate after one recovery and show an actionable error even in clean mode.');

}).catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{win?.destroy();server?.close();server?.closeAllConnections();app.exit(process.exitCode||0);});
