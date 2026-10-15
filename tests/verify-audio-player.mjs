import assert from 'node:assert/strict';
import {watchAudio,startAudio,releaseAudio} from '../lib/audio-player.ts';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const player={currentTime:0,paused:false};
let stalls=0;
let stop=watchAudio(player,()=>stalls++,2,15);
await wait(30);assert.equal(stalls,1);await wait(20);assert.equal(stalls,1);stop();
stalls=0;player.paused=true;stop=watchAudio(player,()=>stalls++,2,15);
await wait(25);assert.equal(stalls,0);player.paused=false;
for(let i=0;i<10;i++){player.currentTime++;await wait(5);}
assert.equal(stalls,0);stop();await wait(25);assert.equal(stalls,0);
await assert.rejects(startAudio({play:()=>new Promise(()=>{})},10),/did not start/);
await assert.rejects(startAudio({play:()=>Promise.reject(Error('decode failed'))},10),/decode failed/);
await startAudio({play:()=>Promise.resolve()},10);
const calls=[];const url=URL.createObjectURL(new Blob(['audio']));
const disposable={src:url,onended:()=>{},onerror:()=>{},pause:()=>calls.push('pause'),removeAttribute:name=>calls.push(name),load:()=>calls.push('load')};
releaseAudio(disposable);assert.equal(disposable.onended,null);assert.equal(disposable.onerror,null);assert.deepEqual(calls,['pause','src','load']);
await assert.rejects(fetch(url));
console.log('PASS: stopped media clock detection, pause/progress/cancellation, bounded play promise, and decoder/blob URL cleanup.');
