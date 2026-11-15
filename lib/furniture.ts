import type {Item} from './passages';
// Running heads and page numbers: text repeated in the top or bottom row of
// many pages, or integers there that track the page index with one offset.
// A repeated text must contain a word: a lone "." or "=" also recurs on the
// last line of most pages (LaTeX sets the point of 0.16 in the math font, as its
// own text item) and silencing it would turn 0.16 into 016.
export function detectFurniture(sources:Map<number,{items:Item[]}>):Map<number,Set<number>>{
 const rows=new Map<number,{index:number;text:string}[]>();
 for(const [n,{items}] of sources){
  const real=items.map((item,index)=>({item,index})).filter(({item})=>item.str.trim());if(!real.length)continue;
  const ys=real.map(({item})=>item.transform[5]),top=Math.max(...ys),bottom=Math.min(...ys);
  const heights=real.map(({item})=>item.height).sort((a,b)=>a-b),body=heights[Math.floor(heights.length/2)]||10;
  rows.set(n,real.filter(({item})=>item.transform[5]>=top-body*1.5||item.transform[5]<=bottom+body*1.5).map(({item,index})=>({index,text:item.str.trim().replace(/\s+/g,' ')})));
 }
 const threshold=Math.max(3,Math.ceil(sources.size*.3)),counts=new Map<string,number>(),offsets=new Map<number,number>();
 for(const [n,row] of rows){for(const text of new Set(row.map(r=>r.text)))if(/\p{L}{2}/u.test(text))counts.set(text,(counts.get(text)||0)+1);for(const r of row)if(/^\d{1,4}$/.test(r.text)){const offset=Number(r.text)-n;offsets.set(offset,(offsets.get(offset)||0)+1);}}
 const result=new Map<number,Set<number>>();
 for(const [n,row] of rows){const set=new Set<number>();for(const r of row)if((counts.get(r.text)||0)>=threshold||/^\d{1,4}$/.test(r.text)&&(offsets.get(Number(r.text)-n)||0)>=threshold)set.add(r.index);if(set.size)result.set(n,set);}
 return result;
}
