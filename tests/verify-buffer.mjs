import assert from 'node:assert/strict';
import {SpeechBuffer} from '../lib/speech-buffer.ts';
import {passagesFromItems} from '../lib/passages.ts';
const disposed=[];const cache=new SpeechBuffer(v=>disposed.push(v),v=>v.length,20);
let calls=0,resolve;
const loader=()=>{calls++;return new Promise(r=>resolve=r);};
const prefetch=cache.get('one',loader);
const foreground=cache.get('one',loader);
assert.equal(calls,1);resolve('decoded-one');
assert.equal(await prefetch,'decoded-one');assert.equal(await foreground,'decoded-one');
assert.equal(await cache.get('one',()=>{throw Error('Must reuse');}),'decoded-one');
// A prefetch the listener skipped past still completes into the cache, and a
// later request for the same passage joins it rather than sending it again.
let slowResolve;const slow=cache.get('skipped',()=>new Promise(r=>slowResolve=r));
const rejoined=cache.get('skipped',()=>{throw Error('Must join the pending request');});
slowResolve('kept');assert.equal(await slow,'kept');assert.equal(await rejoined,'kept');assert(cache.has('skipped'));
await assert.rejects(cache.get('failure',async()=>{throw Error('network');}));
assert.equal(await cache.get('failure',async()=>'retry'),'retry');
// Least-recently-used eviction by bytes: 'one' (11) + 'kept' (4) + 'retry' (5) = 20 fills the budget exactly.
assert.equal(cache.bytes,20);assert.deepEqual(disposed,[]);
await cache.get('one',()=>{throw Error('Must reuse');});// touch 'one' so 'kept' is now the oldest
await cache.get('more',async()=>'eight ch');
assert.deepEqual(disposed,['kept','retry']);assert.equal(cache.bytes,19);assert(cache.has('one')&&cache.has('more'));
// A single clip larger than the budget is still kept, and it evicts everything else.
await cache.get('huge',async()=>'x'.repeat(30));assert.equal(cache.size,1);assert(cache.has('huge'));assert.equal(cache.bytes,30);
cache.clear();assert(disposed.includes('x'.repeat(30)));assert.equal(cache.bytes,0);assert.equal(cache.size,0);
const selected=['This selected passage has enough text to form a complete first spoken passage with its own highlight.','This is the second selected passage and it must advance to a different set of selected text rectangles.'];
const passages=passagesFromItems(selected.map(str=>({str,transform:[],width:0,height:0})));
assert.equal(passages.length,2);assert.deepEqual(passages[0].indices,[0]);assert.deepEqual(passages[1].indices,[1]);assert.equal(passages.map(p=>p.text).join(' '),selected.join(' '));
console.log('PASS: prefetch deduplication, decoded cache reuse, skipped prefetches kept, retry, byte-budget LRU eviction, disposal, and per-passage selected-text mapping.');
