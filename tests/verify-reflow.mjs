import assert from 'node:assert/strict';import fs from 'node:fs';import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';import {reflowItems} from '../lib/reflow.ts';import {SAMPLE,requireSample} from './sample.mjs';
if(!requireSample('reflow retention check'))process.exit(0);
const task=getDocument({data:new Uint8Array(fs.readFileSync(SAMPLE))});const doc=await task.promise;let blocks=0;const vocab=new Set();for(let n=1;n<=doc.numPages;n++){const c=await(await doc.getPage(n)).getTextContent();for(const i of c.items)if(i.str)for(const w of i.str.toLowerCase().match(/[a-z]{3,}/g)||[])vocab.add(w);}
for(let n=1;n<=doc.numPages;n++){
 const content=await(await doc.getPage(n)).getTextContent();const items=content.items.filter(i=>'str' in i);const result=reflowItems(items,vocab);const covered=new Set(result.passages.flatMap(p=>p.indices));
 items.forEach((item,i)=>{if(item.str.trim())assert(covered.has(i),`Missing item ${i} page ${n}`);});
 assert(result.passages.every(p=>p.text.length<=2400));assert.equal(new Set(result.blocks.flatMap(b=>b.passages)).size,result.passages.length);blocks+=result.blocks.length;
 if(n===1){const text=result.passages.map(p=>p.text).join(' ');assert(text.includes('0.076'));assert(text.includes('[α/M]'));assert(text.includes('Ménard'));}
}
console.log(`PASS: every nonempty text item retained across ${doc.numPages} pages; ${blocks} layout blocks; decimals, accents and symbols preserved.`);await task.destroy();
