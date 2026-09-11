import assert from 'node:assert/strict';import fs from 'node:fs';import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';import {reflowItems} from '../lib/reflow.ts';import {SAMPLE,requireSample} from './sample.mjs';
// Synthetic two-column-style page: text, a numbered display with a fraction and
// a sum limit, more text, an inline subscript, and draft line numbers.
const item=(str,x,y,w,h=10,e=false)=>({str,transform:[h,0,0,h,x,y],width:w,height:h,hasEOL:e});
const text=(str,y,x=50)=>item(str,x,y,240,10,true);
const items=[
 text('Every point on a smooth surface is nearly a weighted average',712),text('The weights that reproduce the local geometry of the surface',700),text('are found from the neighbourhood relations, so that',688),
 item('x',100,668,6),item('i',106,666.5,3,7),item('≈',112,668,8),item('X',128,678,14),item('j∈N (i)',124,656,20,7),item('w',150,668,7),item('ij',157,666.5,6,7),item('x',166,668,6),item('j',172,666.5,3,7),item(',',176,668,3),item('(6)',278,668,12),
 item('41',30,712,8,5),item('42',30,668,8,5),item('43',30,700,8,5),item('44',30,688,8,5),item('45',30,640,8,5),item('46',30,628,8,5),
 text('and the weights that do this best depend on the local geometry',640),text('alone. The coordinates C',628),item('iso',160,626.5,9,7),item('hold the global shape.',172,628,110),
];
const r=reflowItems(items,new Set(['weights','geometry','surface','coordinates']));
const equations=r.blocks.filter(b=>b.kind==='equation');
assert.equal(equations.length,1,'one display equation');
assert.equal(equations[0].label,'6');assert.equal(r.passages[equations[0].passages[0]].text,'Equation 6.');
assert(equations[0].alt.includes('wij') && !equations[0].alt.includes('42'),'line numbers silent');
const box=equations[0].box;assert(box.x0<100&&box.x1>290&&box.y0>628&&box.y1<688,'crop stays between the neighbouring text lines');
assert.deepEqual(r.blocks.map(b=>b.kind),['paragraph','equation','paragraph']);
const tail=r.passages[r.blocks[2].passages[0]];assert(tail.scripts?.some(s=>s.kind==='sub'&&tail.text.slice(s.start,s.end)==='iso'),'inline subscript');
assert(r.passages.every(p=>!/\b4[1-6]\b/.test(p.text)),'line numbers add no text');
assert.deepEqual([...new Set(r.passages.flatMap(p=>p.indices))].length,items.length,'every item mapped');
// A column figure: tick labels and a rotated axis title above a caption, text above and below.
const figureItems=[
 text('The recovered lattice is shown against the input grid for three',700),text('metallicities, with every calibrator removed before the fit.',688),
 item('1.0',60,660,12,8),item('0.5',60,640,12,8),item('0.0',60,620,12,8),{str:'normalised flux',transform:[0,9,-9,0,52,612],width:60,height:9},item('513',80,606,14,8),item('514',120,606,14,8),item('515',160,606,14,8),
 item('Figure 1.',50,586,38,9),item('The distance between two spectra, drawn as the',92,586,196,9,true),item('cumulative absorption depth of each chunk.',50,575,180,9,true),
 text('Summing the chunk distances as they stand would let the widest',550),text('or most line-rich chunks dominate the sum.',538),
 item('43',30,700,8,5),item('44',30,688,8,5),item('45',30,550,8,5),item('46',30,538,8,5),item('47',30,586,8,5),
];
const f=reflowItems(figureItems,new Set(['metallicities','calibrator']));
assert.deepEqual(f.blocks.map(b=>b.kind),['paragraph','figure','caption','paragraph'],'figure precedes its caption');
const fig=f.blocks[1];assert.equal(fig.label,'Figure 1');assert.equal(fig.passages[0],f.blocks[2].passages[0],'figure highlights with its caption');
assert(fig.box.y0>586&&fig.box.y0<600&&fig.box.y1>660&&fig.box.y1<688&&fig.box.x0<60&&fig.box.x1>290,'crop spans column between caption and text');
assert(f.passages[fig.passages[0]].text.startsWith('Figure 1. The distance'),'caption spoken as text');
assert(!f.passages.some(p=>/513|normalised flux|^1\.0$/.test(p.text)),'figure text is not read');
assert.equal(new Set(f.passages.flatMap(p=>p.indices)).size,figureItems.length,'every item mapped');
// Running text that merely begins with a figure reference is not a caption.
const mention=[text('The construction is compared with the earlier method in',700),text('Figure 1. The formula resembles a pixel difference, but it',688),text('is not one, because the curves subtracted are cumulative.',676),text('Both are drawn for the same pair of stars in the figure.',664)];
assert(reflowItems(mention).blocks.every(b=>b.kind==='paragraph'),'no caption inside running text');
// The bundled manuscript: ten numbered displays, ten figures and one table, no false positives.
if(requireSample('manuscript equation and figure census')){
const task=getDocument({data:new Uint8Array(fs.readFileSync(SAMPLE))});const doc=await task.promise;const labels=[],figures=[];let unnumbered=0,strays=0;
for(let n=1;n<=doc.numPages;n++){const c=await(await doc.getPage(n)).getTextContent();const r=reflowItems(c.items.filter(i=>'str' in i));for(const b of r.blocks){if(b.kind==='equation'){if(b.label)labels.push(b.label);else unnumbered++;}if(b.kind==='figure')figures.push(b.label);if(b.kind==='paragraph'&&b.passages.every(i=>/^[\d.\s\-−]+$/.test(r.passages[i].text)&&r.passages[i].text.length>1))strays++;}}
assert.deepEqual(labels,['1','2','3','4','5','6','7','8','9','10']);assert.equal(unnumbered,0);
assert.deepEqual(figures,['Figure 1','Figure 2','Figure 3','Figure 4','Figure 5','Table 1','Figure 6','Figure 7','Figure 8','Figure 9']);
assert(strays<=21,`numeric stray blocks beyond page numbers: ${strays}`);await task.destroy();
}
console.log('PASS: display equations and figures detected with labels and crop boxes, fragments and limits absorbed, figure text silenced, line numbers silenced, inline scripts marked.');
