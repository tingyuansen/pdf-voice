import {passagesFromItems,type Item,type Passage} from './passages';
import {reflowItems} from './reflow';
// One selected piece of a rendered span: a whole page passage in Reading view,
// a text-layer line in PDF view. `source.str` is the dragged text only.
export type SelectedFragment={page:number;index:number;whole:boolean;source:Item};
// What a selection passage highlights: the fragment as dragged, or the whole
// page passage the drag snapped to.
export type SelectionUnit={fragment:number;whole:boolean;page:number;passage:number};
export type PageLookup=(page:number)=>{passages:Passage[];items:Item[]}|null;
// Snap a drag to the passages the page already reads. A passage the drag
// covers by at least half is read verbatim, so its clip is the one "Read page"
// or an earlier selection generated; only pieces that stop short of that are
// spoken as dragged. Passages keep their order along the drag.
export function snapSelection(fragments:SelectedFragment[],lookup:PageLookup,view:'reader'|'pdf',words:ReadonlySet<string>=new Set()):{passages:Passage[];units:SelectionUnit[]}{
 const owner=fragments.map(f=>{const data=lookup(f.page);if(!data)return -1;return view==='reader'?(f.index<data.passages.length?f.index:-1):data.passages.findIndex(p=>p.indices.includes(f.index));});
 const key=(k:number)=>fragments[k].page+':'+owner[k];
 const coverage=new Map<string,{selected:number;total:number}>();
 fragments.forEach((f,k)=>{
  if(owner[k]<0)return;const data=lookup(f.page)!,passage=data.passages[owner[k]];
  const entry=coverage.get(key(k))||{selected:0,total:view==='reader'?passage.text.length:passage.indices.reduce((sum,i)=>sum+(data.items[i]?.str.trim().length||0),0)};
  entry.selected+=f.source.str.trim().length;coverage.set(key(k),entry);
 });
 const snapped=(k:number)=>{if(owner[k]<0)return false;const c=coverage.get(key(k))!;return c.selected*2>=c.total;};
 const passages:Passage[]=[],units:SelectionUnit[]=[],emitted=new Set<string>();let run:number[]=[];
 const flush=()=>{
  if(!run.length)return;const base=units.length;
  for(const k of run)units.push({fragment:k,whole:false,page:fragments[k].page,passage:owner[k]});
  const items=run.map(k=>fragments[k].source),made=view==='pdf'?reflowItems(items,words).passages:passagesFromItems(items);
  for(const p of made)passages.push({...p,indices:p.indices.map(i=>base+i)});run=[];
 };
 fragments.forEach((f,k)=>{
  if(!snapped(k)){run.push(k);return;}
  flush();if(emitted.has(key(k)))return;emitted.add(key(k));
  passages.push({...lookup(f.page)!.passages[owner[k]],indices:[units.length]});units.push({fragment:k,whole:true,page:f.page,passage:owner[k]});
 });
 flush();return {passages,units};
}
