"use client";
import {Fragment,useEffect,useRef,useState,type ReactNode} from 'react';
import {Headphones,Upload,Play,Pause,SkipBack,SkipForward,ChevronLeft,ChevronRight,FileText,Moon,Sun,PanelLeft,BookOpen,Minus,Plus,Maximize,Minimize,X} from 'lucide-react';
import {passagesFromItems,type Item,type Passage} from '../lib/passages';
import {PdfSurface} from './pdf-surface';
import {reflowItems,type ReflowBlock} from '../lib/reflow';
import {renderCrop,type CropImage,EQUATION_SCALE,FIGURE_SCALE} from '../lib/page-crop';
import {numberRuns} from '../lib/number-runs';
import {SpeechBuffer} from '../lib/speech-buffer';
import {nextPlayback} from '../lib/playback';
import {endsSentence} from '../lib/phrase-boundaries';
import type {PDFDocumentProxy} from 'pdfjs-dist';
type Scope='selection'|'page'|'document';
type Box={left:number;top:number;width:number;height:number};
type SelectionData={text:string;passages:Passage[];boxes:Box[];itemBoxes:Box[][];ranges:Range[];page:number};
type PageSource={items:Item[];width:number;height:number;boxes:Box[];view:number[]};
type PageData=PageSource&{blocks:ReflowBlock[];passages:Passage[];body:number};
const READER_BATCH=30;
// Running heads and page numbers: text repeated in the top or bottom row of
// many pages, or integers there that track the page index with one offset.
function detectFurniture(sources:Map<number,PageSource>):Map<number,Set<number>>{
 const rows=new Map<number,{index:number;text:string}[]>();
 for(const [n,{items}] of sources){
  const real=items.map((item,index)=>({item,index})).filter(({item})=>item.str.trim());if(!real.length)continue;
  const ys=real.map(({item})=>item.transform[5]),top=Math.max(...ys),bottom=Math.min(...ys);
  const heights=real.map(({item})=>item.height).sort((a,b)=>a-b),body=heights[Math.floor(heights.length/2)]||10;
  rows.set(n,real.filter(({item})=>item.transform[5]>=top-body*1.5||item.transform[5]<=bottom+body*1.5).map(({item,index})=>({index,text:item.str.trim().replace(/\s+/g,' ')})));
 }
 const threshold=Math.max(3,Math.ceil(sources.size*.3)),counts=new Map<string,number>(),offsets=new Map<number,number>();
 for(const [n,row] of rows){for(const text of new Set(row.map(r=>r.text)))counts.set(text,(counts.get(text)||0)+1);for(const r of row)if(/^\d{1,4}$/.test(r.text)){const offset=Number(r.text)-n;offsets.set(offset,(offsets.get(offset)||0)+1);}}
 const result=new Map<number,Set<number>>();
 for(const [n,row] of rows){const set=new Set<number>();for(const r of row)if((counts.get(r.text)||0)>=threshold||/^\d{1,4}$/.test(r.text)&&(offsets.get(Number(r.text)-n)||0)>=threshold)set.add(r.index);if(set.size)result.set(n,set);}
 return result;
}
function passageNodes(passage:Passage,trimHyphen=false):ReactNode[]{
 const runs=(text:string,offset:number)=>numberRuns(text).map((run,r)=>run.number?<span key={offset+r} className="number-run">{run.text}</span>:<Fragment key={offset+r}>{run.text}</Fragment>);
 const text=trimHyphen?passage.text.replace(/-$/,''):passage.text;
 const nodes:ReactNode[]=[];let at=0;
 for(const script of passage.scripts||[]){
  if(script.start>at)nodes.push(...runs(text.slice(at,script.start),nodes.length));
  nodes.push(script.kind==='sup'?<sup key={nodes.length}>{text.slice(script.start,script.end)}</sup>:<sub key={nodes.length}>{text.slice(script.start,script.end)}</sub>);at=script.end;
 }
 if(at<text.length)nodes.push(...runs(text.slice(at),nodes.length));
 return nodes;
}
type SpeechEngine={id:string;name:string;model:string;configured:boolean;voices:{id:string;name:string}[]};
const fallbackEngine:SpeechEngine={id:'cartesia',name:'Cartesia',model:'sonic-3.6',configured:false,voices:[]};
export default function Home(){
 const [doc,setDoc]=useState<PDFDocumentProxy|null>(null),[name,setName]=useState(''),[page,setPage]=useState(1),[data,setData]=useState<PageData|null>(null),[index,setIndex]=useState(0),[mode,setMode]=useState<'idle'|'loading'|'playing'|'paused'>('idle'),[error,setError]=useState(''),[loading,setLoading]=useState(false),[voice,setVoice]=useState(''),[keys,setKeys]=useState<Record<string,string>>({}),[engines,setEngines]=useState<SpeechEngine[]>([]),[engineId,setEngineId]=useState('cartesia'),[speed,setSpeed]=useState(1),[drag,setDrag]=useState(false);
 const [cleanMode,setCleanMode]=useState(false);
 const cleanButton=useRef<HTMLButtonElement>(null),exitCleanButton=useRef<HTMLButtonElement>(null);
 function enterClean(){setCleanMode(true);requestAnimationFrame(()=>exitCleanButton.current?.focus());}
 function exitClean(){setCleanMode(false);requestAnimationFrame(()=>cleanButton.current?.focus());}
 const [sidebar,setSidebar]=useState(false),[view,setView]=useState<'pdf'|'reader'>('pdf'),[fontSize,setFontSize]=useState(24),[zoom,setZoom]=useState(1);
 const readerRoot=useRef<HTMLDivElement>(null),readerActive=useRef<HTMLElement|null>(null),readerScroll=useRef<HTMLDivElement>(null),sections=useRef(new Map<number,HTMLElement|null>()),moreSentinel=useRef<HTMLDivElement>(null);
 // Reading view lays out every page in one column; pages are reflowed on demand
 // from text extracted once at load time, and the toolbar follows the scroll.
 const pageSources=useRef(new Map<number,PageSource>()),pageCache=useRef(new Map<number,PageData>()),furniture=useRef(new Map<number,Set<number>>());
 const [materialized,setMaterialized]=useState(0),[crops,setCrops]=useState(new Map<string,CropImage>()),[pdfJump,setPdfJump]=useState<{page:number;token:number}|null>(null);
 const cropRequests=useRef(new Set<string>()),pendingScroll=useRef<number|null>(null),scrollFrame=useRef(0);
 const setActive=(element:HTMLElement|null)=>{readerActive.current=element;};
 function pageData(n:number):PageData|null{const cached=pageCache.current.get(n);if(cached)return cached;const source=pageSources.current.get(n);if(!source)return null;const next={...source,...reflowItems(source.items,documentWords.current,{furniture:furniture.current.get(n),view:source.view})};pageCache.current.set(n,next);return next;}
 function scrollReaderTo(n:number){pendingScroll.current=n;setMaterialized(m=>Math.max(m,Math.min(docRef.current?.numPages||n,n+10)));}
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('paper-voice-reading')||'{}');setSidebar(saved.sidebar===true);setView(saved.view==='reader'?'reader':'pdf');setFontSize(Math.max(18,Math.min(40,Number(saved.fontSize)||24)));}catch{}},[]);
 function saveReading(next:{sidebar?:boolean;view?:'pdf'|'reader';fontSize?:number}){try{localStorage.setItem('paper-voice-reading',JSON.stringify({sidebar,view,fontSize,...next}));}catch{}}
 function clearSelection(){setSelection(null);selectionRef.current=null;window.getSelection()?.removeAllRanges();if(scopeRef.current==='selection'){stop();auto.current=false;scopeRef.current='page';setScope('page');setIndex(0);}}
 function changeView(next:'pdf'|'reader'){clearSelection();setView(next);saveReading({view:next});if(next==='reader')scrollReaderTo(page);else setPdfJump({page,token:Date.now()});}
 function changeFont(next:number){clearSelection();setFontSize(next);saveReading({fontSize:next});}
 const [dark,setDark]=useState(false);
 useEffect(()=>{let preference:string|null=null;try{preference=localStorage.getItem('paper-voice-theme');}catch{}const enabled=preference?preference==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;setDark(enabled);document.documentElement.dataset.theme=enabled?'dark':'light';},[]);
 function toggleTheme(){const enabled=!dark;setDark(enabled);document.documentElement.dataset.theme=enabled?'dark':'light';try{localStorage.setItem('paper-voice-theme',enabled?'dark':'light');}catch{}}
 const [selection,setSelection]=useState<SelectionData|null>(null),[scope,setScope]=useState<Scope>('page');
 const documentWords=useRef<ReadonlySet<string>>(new Set());
 const scopeRef=useRef<Scope>('page'),selectionRef=useRef<SelectionData|null>(null),textLayer=useRef<HTMLDivElement>(null);
 const audio=useRef<HTMLAudioElement|null>(null),epoch=useRef(0),controller=useRef<AbortController|null>(null),cache=useRef(new SpeechBuffer<HTMLAudioElement>(player=>{player.pause();URL.revokeObjectURL(player.src);player.removeAttribute('src');player.load();})),auto=useRef(false),loadId=useRef(0),activeBox=useRef<HTMLDivElement>(null),speedRef=useRef(1),docRef=useRef<PDFDocumentProxy|null>(null);
 function stop(){epoch.current++;controller.current?.abort();cache.current.cancelPending();audio.current?.pause();audio.current=null;setMode('idle');}
 function clearCache(){cache.current.clear();}
 async function load(source:File|string){
  const id=++loadId.current;stop();auto.current=false;setSelection(null);selectionRef.current=null;setLoading(true);setError('');setData(null);setDoc(null);clearCache();
  try{const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';let bytes:ArrayBuffer;
   if(typeof source==='string'){const res=await fetch(source);if(!res.ok)throw Error('Example PDF could not be loaded. Choose a PDF instead.');bytes=await res.arrayBuffer();}else{if(source.size>100*1024*1024)throw Error('Please choose a PDF smaller than 100 MB.');bytes=await source.arrayBuffer();}
   const next=await pdfjs.getDocument({data:bytes,cMapUrl:'/cmaps/',cMapPacked:true,standardFontDataUrl:'/standard_fonts/'}).promise;
   if(id!==loadId.current){await next.loadingTask.destroy();return;}await docRef.current?.loadingTask.destroy();docRef.current=next;
   const vocabulary=new Set<string>(),sources=new Map<number,PageSource>();
   for(let n=1;n<=next.numPages;n++){
    if(id!==loadId.current)return;
    const pdfpage=await next.getPage(n);const viewport=pdfpage.getViewport({scale:1.5});const content=await pdfpage.getTextContent();
    const items=content.items.filter((x):x is typeof x & Item=>'str' in x) as Item[];
    for(const item of items)for(const word of item.str.toLowerCase().match(/[a-z]{3,}/g)||[])vocabulary.add(word);
    const boxes=items.map(item=>{const t=pdfjs.Util.transform(viewport.transform,item.transform);const h=Math.hypot(t[2],t[3]);return {left:t[4]/viewport.width*100,top:(t[5]-h*.85)/viewport.height*100,width:item.width*viewport.scale/viewport.width*100,height:h/viewport.height*100};});
    sources.set(n,{items,width:viewport.width,height:viewport.height,boxes,view:[...pdfpage.view]});
   }
   documentWords.current=vocabulary;pageSources.current=sources;furniture.current=detectFurniture(sources);pageCache.current=new Map();cropRequests.current=new Set();setCrops(new Map());
   setName(typeof source==='string'?'manuscript.pdf':source.name);setPage(1);setIndex(0);pendingScroll.current=1;setPdfJump({page:1,token:Date.now()});setMaterialized(Math.min(next.numPages,READER_BATCH));setDoc(next);
  }catch(e){if(id===loadId.current)setError(e instanceof Error?e.message:'Could not open this PDF.');}finally{if(id===loadId.current)setLoading(false);}
 }
 useEffect(()=>{fetch('/api/speech').then(r=>r.json() as Promise<{providers:SpeechEngine[]}>).then(d=>{
  let saved:{engine?:string;voice?:string}={};try{saved=JSON.parse(localStorage.getItem('paper-voice-speech')||'{}');}catch{}
  const list=d.providers,chosen=list.find(e=>e.id===saved.engine)||list.find(e=>e.configured)||list[0];if(!chosen)return;
  setEngines(list);setEngineId(chosen.id);setVoice(chosen.voices.some(v=>v.id===saved.voice)?saved.voice!:chosen.voices[0]?.id||'');
 }).catch(()=>{});void load('/examples/manuscript.pdf');return()=>{loadId.current++;epoch.current++;controller.current?.abort();audio.current?.pause();clearCache();void docRef.current?.loadingTask.destroy();};},[]);
 useEffect(()=>{if(!doc)return;setData(pageData(page));setIndex(0);setMaterialized(m=>Math.max(m,Math.min(doc.numPages,page+5)));},[doc,page]);
 useEffect(()=>{if(data&&auto.current){auto.current=false;if(data.passages.length)void speak(0,data.passages,scopeRef.current,epoch.current);else if(doc&&page<doc.numPages){auto.current=true;setPage(page+1);}else setMode('idle');}},[data]);
 useEffect(()=>{(view==='reader'&&scope!=='selection'?readerActive.current:activeBox.current)?.scrollIntoView({block:'nearest',behavior:'smooth'});},[index,mode,view,scope]);
 useEffect(()=>{speedRef.current=speed;if(audio.current)audio.current.playbackRate=speed;},[speed]);
 // Jump to a page section once it exists in the reading column.
 useEffect(()=>{const n=pendingScroll.current;if(n===null||view!=='reader')return;const section=sections.current.get(n);if(!section)return;pendingScroll.current=null;section.scrollIntoView({block:'start'});});
 // Materialise further pages as the reader nears the end of the column, and
 // rasterise the equations of pages near the viewport.
 useEffect(()=>{
  if(view!=='reader'||!doc)return;const scroller=readerScroll.current;if(!scroller)return;
  const more=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))setMaterialized(m=>Math.min(doc.numPages,m+READER_BATCH));},{root:scroller,rootMargin:'120% 0px'});
  if(moreSentinel.current)more.observe(moreSentinel.current);
  const near=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)void ensureCrops(Number((entry.target as HTMLElement).dataset.page));},{root:scroller,rootMargin:'150% 0px'});
  for(const section of sections.current.values())if(section)near.observe(section);
  return()=>{more.disconnect();near.disconnect();};
 },[view,doc,materialized]);
 async function ensureCrops(n:number){
  const current=docRef.current,source=pageData(n);if(!current||!source)return;
  const pending=source.blocks.map((block,b)=>({block,key:`${n}:${b}`})).filter(({block,key})=>block.box&&!cropRequests.current.has(key));
  if(!pending.length)return;pending.forEach(({key})=>cropRequests.current.add(key));
  try{const pdfpage=await current.getPage(n);
   for(const {block,key} of pending){if(docRef.current!==current)return;const image=await renderCrop(pdfpage,block.box!,block.kind==='equation'?EQUATION_SCALE:FIGURE_SCALE);if(image&&docRef.current===current)setCrops(previous=>new Map(previous).set(key,image));}
  }catch{}
 }
 function followPdfPage(n:number){if(mode!=='idle'||n===page)return;setPage(n);}
 function followScroll(){
  if(scrollFrame.current)return;
  scrollFrame.current=requestAnimationFrame(()=>{
   scrollFrame.current=0;const scroller=readerScroll.current;if(!scroller||mode!=='idle'||pendingScroll.current!==null)return;
   const probe=scroller.getBoundingClientRect().top+scroller.clientHeight*.22;
   for(const [n,section] of sections.current){if(!section)continue;const rect=section.getBoundingClientRect();if(rect.top<=probe&&rect.bottom>probe){if(n!==page)setPage(n);return;}}
  });
 }
 const engine=engines.find(e=>e.id===engineId)||fallbackEngine;
 function saveSpeech(next:{engine:string;voice:string}){try{localStorage.setItem('paper-voice-speech',JSON.stringify(next));}catch{}}
 function chooseEngine(id:string){const target=engines.find(e=>e.id===id);if(!target)return;stop();auto.current=false;clearCache();const first=target.voices[0]?.id||'';setEngineId(id);setVoice(first);saveSpeech({engine:id,voice:first});}
 function chooseVoice(id:string){stop();auto.current=false;setVoice(id);saveSpeech({engine:engineId,voice:id});}
 async function prepare(text:string,signal:AbortSignal):Promise<HTMLAudioElement>{
  return cache.current.get(engineId+'|'+voice+'|'+text,signal,async()=>{
   const res=await fetch('/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:engineId,text,voice,...(!engine.configured&&keys[engineId]?{key:keys[engineId]}:{})}),signal});
   if(!res.ok){const e=await res.json() as {error?:string};throw Error(e.error||'Unable to generate speech.');}
   const blob=await res.blob();if(signal.aborted)throw new DOMException('Cancelled','AbortError');
   const url=URL.createObjectURL(blob),player=new Audio();player.preload='auto';player.src=url;
   try{await new Promise<void>((resolve,reject)=>{
    const cleanup=()=>{player.removeEventListener('canplaythrough',ready);player.removeEventListener('error',failed);signal.removeEventListener('abort',aborted);};
    const ready=()=>{cleanup();resolve();},failed=()=>{cleanup();reject(Error('Unable to decode speech audio.'));},aborted=()=>{cleanup();reject(new DOMException('Cancelled','AbortError'));};
    player.addEventListener('canplaythrough',ready,{once:true});player.addEventListener('error',failed,{once:true});signal.addEventListener('abort',aborted,{once:true});player.load();
   });return player;}catch(e){URL.revokeObjectURL(url);player.removeAttribute('src');player.load();throw e;}
  });
 }
 async function speak(i:number,queue:Passage[]=data?.passages||[],readingScope:Scope=scopeRef.current,continuation?:number){
  if(!queue[i])return;
  if(continuation===undefined){stop();controller.current=new AbortController();window.getSelection()?.removeAllRanges();}
  const token=continuation??epoch.current;if(token!==epoch.current)return;
  const signal=controller.current!.signal;setMode('loading');setError('');
  try{
   const current=prepare(queue[i].text,signal);
   const ahead=queue.slice(i+1,i+3).map(p=>prepare(p.text,signal));
   // One clip of runway before starting; later transitions reuse decoded audio.
   const runway=Promise.allSettled(ahead);
   const player=await current;
   if(continuation===undefined)await runway;
   if(epoch.current!==token)return;
   // Prime the next page near this page's end for document playback.
   if(readingScope==='document'&&doc&&page<doc.numPages&&i>=queue.length-2){
    const upcoming=pageData(page+1);if(upcoming)void Promise.allSettled(upcoming.passages.slice(0,2).map(p=>prepare(p.text,signal)));
   }
   audio.current=player;player.currentTime=0;player.playbackRate=speedRef.current;
   player.onended=()=>{if(epoch.current!==token)return;const next=nextPlayback(readingScope,i,queue.length,page,doc?.numPages||page);if(next==='passage')void speak(i+1,queue,readingScope,token);else if(next==='page'){auto.current=true;setMode('loading');setPage(page+1);}else{setMode('idle');audio.current=null;}};
   player.onerror=()=>{if(epoch.current===token){setError('Audio playback failed. Press play to retry.');setMode('idle');audio.current=null;}};
   await player.play();if(epoch.current===token){setIndex(i);setMode('playing');}else player.pause();
  }catch(e){if(epoch.current===token){controller.current?.abort();cache.current.cancelPending();setError(e instanceof Error?e.message:'Speech failed.');setMode('idle');audio.current=null;}}
 }
 function toggle(){if(mode==='loading'){stop();auto.current=false;}else if(mode==='playing'){audio.current?.pause();setMode('paused');}else if(mode==='paused'&&audio.current){void audio.current.play().then(()=>setMode('playing')).catch(()=>{setError('Playback blocked. Press play to try again.');setMode('idle');});}else void speak(index,scopeRef.current==='selection'?selectionRef.current?.passages:data?.passages);}
 function navigate(n:number){if(!doc||!Number.isInteger(n)||n<1||n>doc.numPages)return;stop();auto.current=false;setSelection(null);selectionRef.current=null;setScope('page');scopeRef.current='page';setIndex(0);setPage(n);if(view==='reader')scrollReaderTo(n);else setPdfJump({page:n,token:Date.now()});}
 function selectPassage(i:number){const resume=mode==='playing'||mode==='loading';stop();auto.current=false;setIndex(i);if(resume)void speak(i,scopeRef.current==='selection'?selectionRef.current?.passages:data?.passages);}
 function captureSelection(){
  const selected=window.getSelection(),layer=view==='reader'?readerRoot.current:textLayer.current;
  if(!selected||selected.isCollapsed||!selected.rangeCount||!layer)return;
  const range=selected.getRangeAt(0);if(!layer.contains(range.startContainer)||!layer.contains(range.endContainer))return;
  // In PDF view the selection lives on one page: boxes are measured against that page.
  const startElement=range.startContainer instanceof Element?range.startContainer:range.startContainer.parentElement;
  const sheet=view==='reader'?layer:startElement?.closest<HTMLElement>('[data-page]');if(!sheet)return;
  const rect=sheet.getBoundingClientRect();const boxes:Box[]=[];const itemBoxes:Box[][]=[];const strings:string[]=[];const ranges:Range[]=[];const selectedItems:Item[]=[];
  for(const span of sheet.querySelectorAll<HTMLElement>('span[data-item]')){
   if(!range.intersectsNode(span)||!span.firstChild)continue;
   const part=document.createRange();part.selectNodeContents(span);
   if(span.contains(range.startContainer))part.setStart(range.startContainer,range.startOffset);
   if(span.contains(range.endContainer))part.setEnd(range.endContainer,range.endOffset);
   const text=part.toString();if(!text.trim())continue;strings.push(text);const bounds=part.getBoundingClientRect();selectedItems.push({str:text,transform:[1,0,0,1,bounds.left,-bounds.bottom],width:bounds.width,height:bounds.height});ranges.push(part.cloneRange());const fragmentBoxes:Box[]=[];itemBoxes.push(fragmentBoxes);
   for(const box of part.getClientRects())if(box.width&&box.height)fragmentBoxes.push({left:(box.left-rect.left)/rect.width*100,top:(box.top-rect.top)/rect.height*100,width:box.width/rect.width*100,height:box.height/rect.height*100});
   boxes.push(...fragmentBoxes);
  }
  const text=strings.join(' ').trim();if(!text)return;
  stop();auto.current=false;const next={text,boxes,itemBoxes,ranges,page:view==='pdf'?Number(sheet.dataset.page):page,passages:view==='pdf'?reflowItems(selectedItems,documentWords.current).passages:passagesFromItems(strings.map(str=>({str,transform:[],width:0,height:0})))};
  selectionRef.current=next;setSelection(next);setIndex(0);scopeRef.current='selection';setScope('selection');
 }
 function startReading(nextScope:Scope){
  stop();auto.current=false;scopeRef.current=nextScope;setScope(nextScope);setIndex(0);
  if(nextScope==='selection'){if(selectionRef.current)void speak(0,selectionRef.current.passages,nextScope);return;}
  window.getSelection()?.removeAllRanges();setSelection(null);selectionRef.current=null;
  if(nextScope==='document'&&page!==1){auto.current=true;setMode('loading');setPage(1);}else if(nextScope==='document'&&!data?.passages.length&&doc&&page<doc.numPages){auto.current=true;setMode('loading');setPage(page+1);}else void speak(0,data?.passages,nextScope);
 }
 useEffect(()=>{
  const context=(document as Document & {modelContext?:{registerTool:(tool:unknown,options:unknown)=>void}}).modelContext;if(!context)return;
  const lifecycle=new AbortController();try{context.registerTool({name:'navigate_pdf_page',description:'Navigate to a page in the loaded PDF and stop playback.',inputSchema:{type:'object',properties:{page:{type:'integer',minimum:1}},required:['page'],additionalProperties:false},execute:(input:{page:number})=>{if(!doc||!Number.isInteger(input.page)||input.page<1||input.page>doc.numPages)throw Error('Page out of range');navigate(input.page);return {page:input.page,totalPages:doc.numPages};}}, {signal:lifecycle.signal});}catch{}return()=>lifecycle.abort();
 },[doc]);
 useEffect(()=>{if(view!=='reader'||!selectionRef.current||!readerRoot.current)return;const rect=readerRoot.current.getBoundingClientRect();const previous=selectionRef.current;const itemBoxes=previous.ranges.map(range=>Array.from(range.getClientRects()).filter(r=>r.width&&r.height).map(b=>({left:(b.left-rect.left)/rect.width*100,top:(b.top-rect.top)/rect.height*100,width:b.width/rect.width*100,height:b.height/rect.height*100})));const next={...previous,itemBoxes,boxes:itemBoxes.flat()};selectionRef.current=next;setSelection(next);},[cleanMode,view]);
 useEffect(()=>{if(!cleanMode)return;const onKey=(event:KeyboardEvent)=>{const target=event.target as HTMLElement;if(target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target.tagName))return;if(event.key==='Escape'){event.preventDefault();exitClean();}else if(event.key==='ArrowRight'&&doc){event.preventDefault();navigate(page+1);}else if(event.key==='ArrowLeft'&&doc){event.preventDefault();navigate(page-1);}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[cleanMode,doc,page]);
 const queue=scope==='selection'?selection?.passages:data?.passages;
 const passage=queue?.[index];
 const selectedBoxes=selection ? (mode==='idle' ? selection.boxes : passage?.indices.flatMap(i=>selection.itemBoxes[i]||[])||[]) : [];
 const readerPages=doc?Array.from({length:Math.min(doc.numPages,materialized)},(_,k)=>k+1):[];
 const aspects=doc?Array.from({length:doc.numPages},(_,k)=>{const source=pageSources.current.get(k+1);return source?source.height/source.width:1.3;}):[];
 // A paragraph cut by the page break continues in the same column: the next
 // page's opening block is drawn inside it, a line-end hyphen closed up.
 // Floats at the top of the next page are skipped over to find the continuation.
 function continues(n:number):number{
  const a=pageData(n),b=pageData(n+1);if(!a||!b)return -1;
  const last=a.blocks.at(-1),at=b.blocks.findIndex(x=>x.kind!=='figure'&&x.kind!=='caption'),first=b.blocks[at];
  if(!last||!first||last.kind!=='paragraph'||first.kind!=='paragraph')return -1;
  return !endsSentence(a.passages[last.passages.at(-1)!].text)&&/^[a-z]/.test(b.passages[first.passages[0]].text)?at:-1;
 }
 function paragraphSpans(n:number,block:ReflowBlock,trimHyphen=false){
  const source=pageData(n)!,active=n===page&&scope!=='selection';
  return block.passages.map((i,k)=><span key={`${n}:${i}`}>{k>0?' ':''}<span data-item={i} className={active&&mode!=='idle'&&index===i?'spoken':''} ref={active&&index===i?setActive:undefined}>{passageNodes(source.passages[i],trimHyphen&&k===block.passages.length-1)}</span></span>);
 }
 function renderSection(n:number){
  const source=pageData(n);const active=n===page&&scope!=='selection';
  const joinsNext=continues(n)>=0,joinedBefore=n>1?continues(n-1):-1;
  return <section key={n} data-page={n} className="reflow-page" ref={el=>{sections.current.set(n,el);}}>
   <div className="reflow-pagebreak" role="separator" aria-label={`Page ${n}`}><span>{n}</span></div>
   {source?.blocks.map((block,b)=>{
    if(b===joinedBefore)return null;
    if(b===source.blocks.length-1&&joinsNext){
     const next=pageData(n+1)!;const hyphen=/-$/.test(source.passages[block.passages.at(-1)!].text);
     return <div key={b} className="reflow-p">{paragraphSpans(n,block,hyphen)}{hyphen?'':' '}{paragraphSpans(n+1,next.blocks[continues(n)])}</div>;
    }
    if(block.kind==='equation'){
     const i=block.passages[0],image=crops.get(`${n}:${b}`),spoken=active&&mode!=='idle'&&index===i;
     return <figure key={b} className={spoken?'reflow-eq spoken':'reflow-eq'} ref={active&&index===i?setActive:undefined} aria-label={source.passages[i].text}>
      {image?<img src={image.url} alt={block.alt} draggable={false} style={{width:image.width*fontSize/source.body}}/>:<span className="reflow-eq-text">{block.alt}</span>}
     </figure>;
    }
    if(block.kind==='figure'){
     const i=block.passages[0],image=crops.get(`${n}:${b}`),spoken=active&&mode!=='idle'&&i!==undefined&&index===i;
     return <figure key={b} className={spoken?'reflow-fig spoken':'reflow-fig'} aria-label={block.label}>
      {image?<img src={image.url} alt={block.alt||block.label} draggable={false} style={{width:image.width*fontSize/source.body}}/>:<span className="reflow-fig-pending">{block.label}</span>}
     </figure>;
    }
    return <div key={b} className={block.kind==='heading'?'reflow-p reflow-heading':block.kind==='caption'?'reflow-p reflow-caption':'reflow-p'}>{paragraphSpans(n,block)}</div>;
   })}
   {source&&!source.passages.length&&<p className="reflow-empty">No selectable text on this page.</p>}
  </section>;
 }
 return <main onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDrag(false);}} onDrop={e=>{e.preventDefault();setDrag(false);const file=e.dataTransfer.files[0];if(file)void load(file);}} className={[drag?'drag':'',cleanMode?'clean-mode':''].join(' ')}>
 <header><div className="brand"><button className="sidebar-toggle" aria-label={sidebar?'Hide sidebar':'Show sidebar'} aria-expanded={sidebar} aria-controls="reader-settings" onClick={()=>{clearSelection();setSidebar(!sidebar);saveReading({sidebar:!sidebar});}}><PanelLeft size={20}/></button><Headphones/> Paper / voice</div><span>YOUR READING ROOM</span><div className="header-actions"><button ref={cleanButton} disabled={!doc} title="Hide controls for clean reading" onClick={enterClean}><Maximize size={18}/><span>Clean mode</span></button><button className="theme-toggle" type="button" aria-label="Dark mode" aria-pressed={dark} title={dark?'Switch to light mode':'Switch to dark mode'} onClick={toggleTheme}>{dark?<Sun size={18}/>:<Moon size={18}/>}<span>{dark?'Light mode':'Dark mode'}</span></button><label className="upload" style={{margin:0}}><Upload size={16}/> Open PDF<input aria-label="Open PDF" type="file" accept="application/pdf,.pdf" onChange={e=>{if(e.target.files?.[0])void load(e.target.files[0]);e.target.value='';}}/></label></div></header>
 <div className={sidebar?"workspace reader-workspace":"workspace reader-workspace sidebar-hidden"}><aside id="reader-settings" hidden={!sidebar}><p className="eyebrow">VOICE SETTINGS</p>
 <label>Speech engine<select value={engineId} onChange={e=>chooseEngine(e.target.value)}>{engines.map(e=><option key={e.id} value={e.id}>{e.name} · {e.model}</option>)}</select></label>
 <label>Voice<select value={voice} onChange={e=>chooseVoice(e.target.value)}>{engine.voices.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
 <label>Playback speed<select value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.75,1,1.25,1.5,1.75,2].map(v=><option key={v} value={v}>{v}×{v===1?' · Normal':''}</option>)}</select></label>
 {engine.configured?<div className="status">{engine.name} connected <small>{engine.model} · AI-generated voice</small></div>:<label>{engine.name} API key<input autoComplete="off" type="password" value={keys[engineId]||''} placeholder={engineId==='openai'?'sk-…':'sk_car_…'} onChange={e=>setKeys({...keys,[engineId]:e.target.value})}/><small>Used for this session only.</small></label>}
 <p className="status">Your PDF stays on this computer. When you press play, text is sent to {engine.name} for speech, including up to two upcoming passages to keep playback flowing.</p>
 </aside><section className="desk">
 <div className="toolbar"><div className="controls"><FileText size={18}/><strong>{name||'Your document'}</strong></div>{doc&&<div className="controls"><button aria-label="Previous page" disabled={page===1} onClick={()=>navigate(page-1)}><ChevronLeft size={18}/></button><input key={page} aria-label="Page number" className="pageinput" type="number" min={1} max={doc.numPages} defaultValue={page} onBlur={e=>{navigate(Number(e.target.value));e.target.value=String(page);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><small>of {doc.numPages}</small><button aria-label="Next page" disabled={page===doc.numPages} onClick={()=>navigate(page+1)}><ChevronRight size={18}/></button></div>}</div>
 {doc&&<div className="reader-tools"><div className="view-options" role="group" aria-label="Reading view"><button aria-pressed={view==='pdf'} onClick={()=>changeView('pdf')}><FileText size={16}/>PDF</button><button aria-pressed={view==='reader'} onClick={()=>changeView('reader')}><BookOpen size={16}/>Reading view</button></div>{view==='pdf'?<div className="controls"><button aria-label="Zoom out" disabled={zoom<=.5} onClick={()=>{clearSelection();setZoom(Math.max(.5,zoom-.25));}}><Minus size={16}/></button><button onClick={()=>{clearSelection();setZoom(1);}} title="Fit page width">{zoom===1?'Fit width':`${Math.round(zoom*100)}%`}</button><button aria-label="Zoom in" disabled={zoom>=3} onClick={()=>{clearSelection();setZoom(Math.min(3,zoom+.25));}}><Plus size={16}/></button></div>:<div className="controls"><button aria-label="Smaller text" disabled={fontSize<=18} onClick={()=>changeFont(fontSize-2)}>A−</button><span>{fontSize} px</span><button aria-label="Larger text" disabled={fontSize>=40} onClick={()=>changeFont(fontSize+2)}>A+</button></div>}</div>}
 {doc&&<div className="reading-actions"><button className="primary" disabled={!selection||loading} onClick={()=>startReading('selection')}>Read selection</button><button disabled={!data?.passages.length||loading} onClick={()=>startReading('page')}>Read page</button><button disabled={!doc||loading} onClick={()=>startReading('document')}>Read entire document</button><small>{selection?`${selection.text.length} characters selected`:'Drag across text to select a part to read.'}</small></div>}
 {error&&<p role="alert" className="error">{error}</p>}
 {doc?<>{view==='pdf'?<PdfSurface doc={doc} aspects={aspects} zoom={zoom} textRef={textLayer} onSelect={captureSelection} onVisiblePage={followPdfPage} jump={pdfJump} overlay={n=><>
 {selection?.page===n&&selectedBoxes.map((b,i)=><div ref={i===0?activeBox:undefined} key={'selection'+i} className={mode==='idle'?'highlight selection-highlight':'highlight'} style={{left:b.left+'%',top:b.top+'%',width:b.width+'%',height:b.height+'%'}}/>)}
 {n===page&&scope!=='selection'&&mode!=='idle'&&passage?.indices.map((i,k)=>{const b=data!.boxes[i];return <div ref={k===0?activeBox:undefined} key={i} className="highlight" style={{left:b.left+'%',top:b.top+'%',width:b.width+'%',height:b.height+'%'}}/>;})}
 </>}/>:<div className="reflow-scroll reader-scroll" ref={readerScroll} onScroll={followScroll}><article className="reflow-paper"><small className="reflow-note">Text reflowed from the PDF; equations, figures and tables are shown as set in the paper.</small><div className="reflow-content" ref={readerRoot} style={{fontSize}} onPointerUp={captureSelection} onKeyUp={captureSelection}>
 {readerPages.map(renderSection)}
 {materialized<doc.numPages&&<div ref={moreSentinel} className="reflow-more" role="status">Loading more pages…</div>}
 {selectedBoxes.map((b,i)=><div key={i} ref={i===0?activeBox:undefined} className={mode==='idle'?'highlight selection-highlight':'highlight'} style={{left:b.left+'%',top:b.top+'%',width:b.width+'%',height:b.height+'%'}}/>)}
 </div></article></div>}
 {loading&&<p role="status">Preparing document…</p>}{!loading&&data&&!data.passages.length&&view==='pdf'&&<p>This page has no selectable text. Scanned pages need OCR before they can be read aloud.</p>}
 <div className="transport"><button aria-label="Previous passage" disabled={!queue||index===0} onClick={()=>selectPassage(index-1)}><SkipBack size={18}/></button><button className="primary" onClick={toggle} disabled={mode!=='loading'&&(!passage||loading)}>{mode==='playing'?<Pause size={19}/>:<Play size={19}/>} {mode==='loading'?'Cancel':mode==='playing'?'Pause':mode==='paused'?'Resume':'Listen'}</button><button aria-label="Next passage" disabled={!queue||index>=queue.length-1} onClick={()=>selectPassage(index+1)}><SkipForward size={18}/></button><div role="status">{mode==='loading'?'Preparing your audio…':mode==='playing'?'Reading aloud':mode==='paused'?'Paused':'Ready when you are'}<small>Passage {queue?.length?index+1:0} of {queue?.length||0} · {scope==='selection'?'Selected text':scope==='page'?'This page only':'Entire document'}</small></div></div><div className="progress"><i style={{width:`${queue?.length?(index+1)/queue.length*100:0}%`}}/></div></>:<div className="empty"><Upload size={36}/><h2>{loading?'Opening your document…':'Drop into a good read.'}</h2><p>Drop a PDF anywhere, or use Open PDF above.</p><button onClick={()=>load('/examples/manuscript.pdf')}>Open manuscript.pdf</button></div>}
 </section></div>{cleanMode&&<div className="clean-controls" role="group" aria-label="Reading controls"><button className="clean-voice" disabled={mode!=='loading'&&(!passage||loading)} onClick={toggle} aria-label={mode==='playing'?'Pause voice':mode==='paused'?'Resume voice':mode==='loading'?'Cancel audio preparation':selection?'Read selected text':'Start voice'} title={mode==='playing'?'Pause voice':mode==='paused'?'Resume voice':mode==='loading'?'Cancel audio preparation':selection?'Read selected text':'Start voice'}>{mode==='playing'?<Pause size={20}/>:mode==='loading'?<X size={20}/>:<Play size={20}/>}</button><button ref={exitCleanButton} onClick={exitClean} aria-label="Exit clean mode" title="Show controls (Esc)"><Minimize size={18}/></button><span className="sr-only" role="status">{mode==='loading'?'Preparing audio':mode==='playing'?'Reading aloud':mode==='paused'?'Paused':'Ready'}. Page {page} of {doc?.numPages}. Use left and right arrow keys to change pages.</span></div>}</main>
}
