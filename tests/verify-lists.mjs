import assert from 'node:assert/strict';import {reflowItems} from '../lib/reflow.ts';
// A wrapped itemize: bullet and enumerated items whose continuation lines are
// indented like new paragraphs. Each item stays one spoken block; a marker
// always starts a new item; the paragraph after the list stays separate.
const item=(str,x,y,w,h=10)=>({str,transform:[h,0,0,h,x,y],width:w,height:h,hasEOL:true});
const items=[
 item('A paragraph of ordinary running text sits above the list and',50,712,300),
 item('ends with a period on a full line of its own.',50,700,240),
 item('\u2022 The first item begins at the margin of the list and its text',64,688,286),
 item('wraps onto a second indented line that continues the item.',84,676,246),
 item('\u2022 The second item is short and ends here.',64,664,200),
 item('(i) An enumerated item also wraps its own text onto a further',64,652,280),
 item('indented line so that the same rule applies to it.',84,640,230),
 item('The closing paragraph returns to the margin and ends the page.',50,628,310),
];
const r=reflowItems(items,new Set(['paragraph','item','list']));
const blocks=r.blocks.map(b=>b.passages.map(i=>r.passages[i].text).join(' '));
assert.equal(blocks.length,5,`five blocks, found ${blocks.length}: ${JSON.stringify(blocks)}`);
assert(blocks[1].startsWith('\u2022 The first item')&&blocks[1].includes('wraps onto a second'),'a wrapped bullet item is one block');
assert.equal(blocks[2],'\u2022 The second item is short and ends here.','each marker starts its own item');
assert(blocks[3].startsWith('(i) An enumerated')&&blocks[3].includes('indented line'),'a wrapped enumerated item is one block');
assert(blocks[4].startsWith('The closing paragraph'),'the paragraph after the list stays separate');
assert.equal(new Set(r.passages.flatMap(p=>p.indices)).size,items.length,'every item mapped');
console.log('PASS: wrapped itemize and enumerate items stay single speech blocks; markers always start a new item.');
