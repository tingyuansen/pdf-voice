import assert from 'node:assert/strict';
import {nextPlayback,speechLookahead,warmSpeech,waitForRunway} from '../lib/playback.ts';
import {fetchSpeech,withSpeechBackup,backupTimeout,BACKUP_TIMEOUT_MS} from '../lib/speech-request.ts';
import {passagesFromItems} from '../lib/passages.ts';
for(const scope of ['selection','page','document'])assert.equal(nextPlayback(scope,0,2,1,21),'passage');
assert.equal(nextPlayback('selection',1,2,1,21),'stop');
assert.equal(nextPlayback('page',1,2,1,21),'stop');
assert.equal(nextPlayback('document',1,2,1,21),'page');
assert.equal(nextPlayback('document',1,2,21,21),'stop');
const fragments=['Only the selected','part of this sentence.'];
const parts=passagesFromItems(fragments.map(str=>({str,transform:[],width:0,height:0})));
assert.equal(parts.map(p=>p.text).join(' '),fragments.join(' '));
console.log('PASS: selected text only, page boundary, document continuation and final stop.');
const short=Array.from({length:10},()=>({text:'A short sentence.'}));
assert.equal(speechLookahead(short,0,1).length,6);
const long=short.map(()=>({text:'word '.repeat(50)}));
assert.equal(speechLookahead(long,0,1).length,2);
assert.equal(speechLookahead(long,0,2).length,3);
assert.equal(speechLookahead(short,9,1).length,0);
let active=0,peak=0;const loaded=[];
await warmSpeech([1,2,3,4,5],async n=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,1));active--;loaded.push(n);if(n===2)throw Error('transient');},()=>true);
assert.equal(peak,2);assert.deepEqual(loaded,[1,2,3,4,5]);
let valid=true;const started=[];
await warmSpeech([1,2,3,4],async n=>{started.push(n);valid=false;},()=>valid);
assert.deepEqual(started,[1]);
await waitForRunway(new Promise(()=>{}),5); // A stalled future clip cannot block startup.
await waitForRunway(Promise.reject(Error('prefetch failed')),5);
for(const failure of ['network','body',503,401,429]){
 let calls=0;
 const blob=()=>new Response(new Blob(['audio'],{type:'audio/mpeg'}));
 const request=async()=>{calls++;if(calls>1)return blob();if(failure==='network')throw TypeError('Failed to fetch');if(failure==='body')return {ok:true,blob:async()=>{throw TypeError('terminated');}};return new Response(JSON.stringify({error:'provider failure'}),{status:failure});};
 if(failure===401||failure===429){await assert.rejects(fetchSpeech('{}',request,100,0),/provider failure/);assert.equal(calls,1);}
 else{assert.equal((await fetchSpeech('{}',request,100,0)).size,5);assert.equal(calls,2);}
}
let failures=0;await assert.rejects(fetchSpeech('{}',async()=>{failures++;throw TypeError('offline');},100,0),/two attempts/);assert.equal(failures,2);
let backupCalls=0;
assert.equal(await withSpeechBackup(async()=>1,async()=>{backupCalls++;return 2;}),1);assert.equal(backupCalls,0);
assert.equal(await withSpeechBackup(async()=>{throw Error('primary');},async()=>{backupCalls++;return 2;}),2);assert.equal(backupCalls,1);
await assert.rejects(withSpeechBackup(async()=>{throw Error('primary');}),/primary/);
await assert.rejects(withSpeechBackup(async()=>{throw Error('primary');},async()=>{throw Error('backup');}),/backup/);
// Three engines: each backup runs only after everything before it failed, in order.
{const order=[];const fail=name=>async()=>{order.push(name);throw Error(name);},ok=name=>async()=>{order.push(name);return name;};
 assert.equal(await withSpeechBackup(fail('speechify'),ok('gemini'),ok('openai')),'gemini');assert.deepEqual(order,['speechify','gemini']);order.length=0;
 assert.equal(await withSpeechBackup(fail('speechify'),fail('gemini'),ok('openai')),'openai');assert.deepEqual(order,['speechify','gemini','openai']);order.length=0;
 await assert.rejects(withSpeechBackup(fail('speechify'),fail('gemini'),fail('openai')),/openai/);assert.deepEqual(order,['speechify','gemini','openai']);}
// Backups get more time for long passages, but stay under the servers' 90-second limit.
assert.equal(backupTimeout(300),BACKUP_TIMEOUT_MS);assert(backupTimeout(2400)>backupTimeout(800));assert(backupTimeout(4096)<=85000);
console.log('PASS: duration-based lookahead, bounded prefetch concurrency, stale refill cancellation, bounded startup, network/body/server recovery, no auth or quota retry, and finite failures.');
// Deadlines cover missing headers and a response body that never finishes,
// even if the transport does not settle its promise when aborted.
for(const stage of ['headers','body']){
 let primaryCalls=0,backupCalls=0,signal;
 const hung=async(_url,options)=>{primaryCalls++;signal=options.signal;if(stage==='headers')return new Promise(()=>{});return {ok:true,blob:()=>new Promise(()=>{})};};
 const result=await withSpeechBackup(()=>fetchSpeech('{}',hung,15,0,1),()=>{backupCalls++;assert.equal(signal.aborted,true);return Promise.resolve(new Blob(['backup']));});
 assert.equal(result.size,6);assert.equal(primaryCalls,1);assert.equal(backupCalls,1);
}
let stoppedCalls=0;
await assert.rejects(withSpeechBackup(()=>fetchSpeech('{}',async()=>{stoppedCalls++;return new Promise(()=>{});},10,0,1),()=>fetchSpeech('{}',async()=>{stoppedCalls++;return new Promise(()=>{});},10,0,1)),/retry this passage/);
assert.equal(stoppedCalls,2);
console.log('PASS: hung headers/body abort and hand off after one attempt; two unresponsive providers terminate without a retry loop.');
