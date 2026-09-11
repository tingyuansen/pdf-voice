import fs from 'node:fs';
import assert from 'node:assert/strict';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {passagesFromItems} from '../lib/passages.ts';
import {SAMPLE,requireSample} from './sample.mjs';
assert.deepEqual(passagesFromItems([]),[]);
if(!requireSample('PDF extraction check'))process.exit(0);
const task=getDocument({data:new Uint8Array(fs.readFileSync(SAMPLE)),standardFontDataUrl:process.cwd()+'/public/standard_fonts/'});
const pdf=await task.promise;let total=0;
for(let n=1;n<=pdf.numPages;n++){
 const page=await pdf.getPage(n);const content=await page.getTextContent();const items=content.items.filter(i=>'str' in i);const passages=passagesFromItems(items);assert(passages.length>0);for(const p of passages){assert(p.text.length<=4096);assert(p.indices.every(i=>i>=0&&i<items.length));}total+=passages.length;
 if(n===1){const v=page.getViewport({scale:1});const factory=pdf.canvasFactory;const target=factory.create(v.width,v.height);await page.render({canvasContext:target.context,viewport:v}).promise;factory.destroy(target);}
}
await task.destroy();console.log(`PASS: ${pdf.numPages} pages, ${total} mapped passages; first page rendered; empty page handling.`);
