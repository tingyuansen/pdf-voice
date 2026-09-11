import assert from 'node:assert/strict';
import {rasterSize} from '../lib/reader.ts';
assert.deepEqual(rasterSize(1000,1400,2),{ratio:2,width:2000,height:2800});
assert.deepEqual(rasterSize(1500,2100,2),{ratio:2,width:3000,height:4200});
const huge=rasterSize(5000,7000,3);assert(huge.width*huge.height<32_020_000);
console.log('PASS: Retina resolution follows display zoom, with a bounded canvas allocation.');
