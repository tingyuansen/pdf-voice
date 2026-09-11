import assert from 'node:assert/strict';import {endsSentence,nextSpeechBoundary} from '../lib/phrase-boundaries.ts';import {reflowItems} from '../lib/reflow.ts';
for(const text of ['as shown in Fig.','Baron et al.','for example, e.g.','Dr.','A.','the U.S.'])assert.equal(endsSentence(text),false,text);
assert.equal(endsSentence('A complete sentence.'),true);
const long='The relationship between '+('stellar spectra and their physical parameters, ').repeat(22)+'remains continuous.';
const boundary=nextSpeechBoundary(long+' Next sentence.',0);assert.equal(long.slice(0,boundary).trim(),long);
const huge=('word ').repeat(1000);let i=0;while(i<huge.length){const end=nextSpeechBoundary(huge,i);assert(end>i&&end-i<=2400);i=end;}
const item=(str,x,y,w,e=true)=>({str,transform:[10,0,0,10,x,y],width:w,height:10,hasEOL:e});
const fragments=reflowItems([item('A continuous',0,100,60),item('phrase remains intact.',63,100,110)]);
assert.equal(fragments.passages[0].text,'A continuous phrase remains intact.');assert.equal(fragments.blocks.length,1);
const abbreviation=reflowItems([item('As described by Ting et al.',0,100,110),item('(2025), the results agree with the physical model.',0,87.5,240)]);
assert.equal(abbreviation.blocks.length,1);assert(abbreviation.passages[0].text.includes('et al. (2025)'));
console.log('PASS: phrase fragments, abbreviation continuations, complete long sentences, bounded speech input.');
