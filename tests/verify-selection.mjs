import assert from 'node:assert/strict';
import {snapSelection} from '../lib/selection.ts';
const item=(str)=>({str,transform:[1,0,0,1,0,0],width:str.length*5,height:10});
// Reading view: fragments are page passages; a drag that covers most of a passage reads it verbatim.
const heading='2. Methods',first='The first sentence of the method section runs on for a while so that it is clearly longer than seventy characters.',second='A second sentence follows it and is also comfortably long enough to stand as its own passage.';
const reader=n=>n===1?{passages:[{text:heading,indices:[0]},{text:first,indices:[1],scripts:[{start:4,end:9,kind:'sup'}]},{text:second,indices:[2]}],items:[item(heading),item(first),item(second)]}:null;
let out=snapSelection([{page:1,index:0,whole:true,source:item(heading)},{page:1,index:1,whole:true,source:item(first)},{page:1,index:2,whole:false,source:item(second.slice(0,60))}],reader,'reader');
assert.deepEqual(out.passages.map(p=>p.text),[heading,first,second],'whole and mostly covered passages are read as the page reads them');
assert.deepEqual(out.passages.map(p=>p.indices),[[0],[1],[2]]);assert.deepEqual(out.units.map(u=>u.whole),[true,true,true]);
assert.deepEqual(out.passages[1].scripts,[{start:4,end:9,kind:'sup'}],'page passage metadata travels with the snapped text');
out=snapSelection([{page:1,index:1,whole:false,source:item(first.slice(-20))},{page:1,index:2,whole:true,source:item(second)}],reader,'reader');
assert.deepEqual(out.passages.map(p=>p.text),[first.slice(-20).trim(),second],'a small tail is read as dragged, the rest snaps');
assert.deepEqual(out.units.map(u=>u.whole),[false,true]);assert.deepEqual(out.passages.map(p=>p.indices),[[0],[1]]);
out=snapSelection([{page:1,index:1,whole:false,source:item('first sentence')}],reader,'reader');
assert.deepEqual(out.passages.map(p=>p.text),['first sentence'],'a short phrase inside a passage is read as dragged');
assert.deepEqual(out.units,[{fragment:0,whole:false,page:1,passage:1}]);
// Drags across a page boundary keep each page's passages.
const two=n=>n===1?reader(1):n===2?{passages:[{text:'Page two opens with its own sentence that is long enough to be a passage in its own right.',indices:[0]}],items:[item('Page two opens with its own sentence that is long enough to be a passage in its own right.')]}:null;
out=snapSelection([{page:1,index:2,whole:true,source:item(second)},{page:2,index:0,whole:true,source:item(two(2).passages[0].text)}],two,'reader');
assert.deepEqual(out.passages.map(p=>p.text),[second,two(2).passages[0].text]);assert.deepEqual(out.units.map(u=>u.page),[1,2]);
// PDF view: fragments are text-layer lines; a passage spans several lines.
const lines=['The layout analysis is geometric, using column edges from clusters of long','lines and the modal line end as the margin.','Glyph size and baseline offsets give the scripts.'];
const pdf=n=>n===1?{passages:[{text:lines[0]+' '+lines[1],indices:[0,1]},{text:lines[2],indices:[2]}],items:lines.map(item)}:null;
out=snapSelection([{page:1,index:1,whole:true,source:item(lines[1])},{page:1,index:2,whole:true,source:item(lines[2])}],pdf,'pdf');
assert.equal(out.passages.length,2);
assert.equal(out.passages.at(-1).text,lines[2],'a fully selected passage snaps');
assert.equal(out.passages[0].text,lines[1],'one short line of a two-line passage (under half) is read as dragged');
assert.deepEqual(out.units.map(u=>u.whole),[false,true]);
out=snapSelection([{page:1,index:0,whole:false,source:item(lines[0].slice(10))},{page:1,index:1,whole:true,source:item(lines[1])}],pdf,'pdf');
assert.deepEqual(out.passages.map(p=>p.text),[lines[0]+' '+lines[1]],'most of a two-line passage snaps to the whole passage');
assert.deepEqual(out.units,[{fragment:0,whole:true,page:1,passage:0}]);
console.log('PASS: selections snap to page passages they mostly cover, in both views and across pages, while short pieces are read as dragged.');
