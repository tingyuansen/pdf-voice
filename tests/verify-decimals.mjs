import assert from 'node:assert/strict';import {reflowItems} from '../lib/reflow.ts';import {numberRuns} from '../lib/number-runs.ts';
const item=(str,x,w,e=false)=>({str,transform:[10,0,0,10,x,100],width:w,height:10,hasEOL:e});
for(const end of [false,true]){
 const r=reflowItems([item('Precision is 0',0,65,end),item('.',65,3,end),item('076 dex.',68,40)]);
 assert.equal(r.passages.map(p=>p.text).join(' '),'Precision is 0.076 dex.');assert.equal(r.blocks.length,1);
 assert.deepEqual([...new Set(r.passages.flatMap(p=>p.indices))],[0,1,2]);
}
const sample='Precision 0.076, uncertainty −1.25e−3. Section 3.1 follows.';const runs=numberRuns(sample);assert.equal(runs.map(r=>r.text).join(''),sample);assert.deepEqual(runs.filter(r=>r.number).map(r=>r.text),['0.076','−1.25e−3','3.1']);
assert.equal(numberRuns('End of sentence. Next sentence.').filter(r=>r.number).length,0);
console.log('PASS: decimal fragment joining, erroneous line flags, selection mappings, nonbreaking number runs, unchanged punctuation.');
