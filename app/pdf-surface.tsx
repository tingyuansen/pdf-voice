"use client";
import {useEffect,useRef,useState,type RefObject,type ReactNode} from 'react';
import type {PDFDocumentProxy,TextLayer} from 'pdfjs-dist';
import {rasterSize} from '../lib/reader';
type Jump={page:number;token:number};
// Every page is laid out at its final size in one scrolling column; only pages
// within about a screen of the viewport hold a rendered canvas and text layer.
export function PdfSurface({doc,aspects,zoom,textRef,onSelect,onVisiblePage,overlay,jump}:{doc:PDFDocumentProxy;aspects:number[];zoom:number;textRef:RefObject<HTMLDivElement|null>;onSelect:()=>void;onVisiblePage:(page:number)=>void;overlay:(page:number)=>ReactNode;jump:Jump|null}){
 const scroller=useRef<HTMLDivElement>(null),frame=useRef(0);
 const [width,setWidth]=useState(800),[near,setNear]=useState<ReadonlySet<number>>(new Set([1]));
 useEffect(()=>{const node=scroller.current;if(!node)return;const update=()=>setWidth(Math.max(200,node.clientWidth-32));update();const observer=new ResizeObserver(update);observer.observe(node);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  const root=scroller.current,host=textRef.current;if(!root||!host)return;
  const observer=new IntersectionObserver(entries=>{setNear(previous=>{const next=new Set(previous);for(const entry of entries){const n=Number((entry.target as HTMLElement).dataset.page);if(entry.isIntersecting)next.add(n);else next.delete(n);}return next;});},{root,rootMargin:'80% 0px'});
  for(const element of host.querySelectorAll<HTMLElement>('[data-page]'))observer.observe(element);
  return()=>observer.disconnect();
 },[doc,aspects.length,textRef]);
 useEffect(()=>{if(jump)textRef.current?.querySelector(`[data-page="${jump.page}"]`)?.scrollIntoView({block:'start'});},[jump,textRef]);
 function followScroll(){
  if(frame.current)return;
  frame.current=requestAnimationFrame(()=>{
   frame.current=0;const root=scroller.current;if(!root)return;
   const probe=root.getBoundingClientRect().top+root.clientHeight*.22;
   for(const element of root.querySelectorAll<HTMLElement>('[data-page]')){const rect=element.getBoundingClientRect();if(rect.top<=probe&&rect.bottom>probe){onVisiblePage(Number(element.dataset.page));return;}}
  });
 }
 return <div className="pdf-frame"><div className="paperwrap reader-scroll" ref={scroller} onScroll={followScroll}><div className="pdf-pages" ref={textRef} onPointerUp={onSelect} onKeyUp={onSelect}>
  {aspects.map((aspect,k)=><PdfPage key={k+1} doc={doc} page={k+1} width={width*zoom} aspect={aspect} active={near.has(k+1)}>{overlay(k+1)}</PdfPage>)}
 </div></div></div>;
}
function PdfPage({doc,page,width,aspect,active,children}:{doc:PDFDocumentProxy;page:number;width:number;aspect:number;active:boolean;children:ReactNode}){
 const canvasHost=useRef<HTMLDivElement>(null),textHost=useRef<HTMLDivElement>(null);
 const [busy,setBusy]=useState(true),[error,setError]=useState('');
 useEffect(()=>{
  if(!active){canvasHost.current?.replaceChildren();textHost.current?.replaceChildren();return;}
  let cancelled=false,task:{cancel:()=>void}|undefined,layer:TextLayer|undefined;
  const timer=setTimeout(()=>{void(async()=>{try{
   const pdfpage=await doc.getPage(page);if(cancelled)return;const base=pdfpage.getViewport({scale:1});const viewport=pdfpage.getViewport({scale:width/base.width});
   const size=rasterSize(viewport.width,viewport.height,window.devicePixelRatio||1),canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;canvas.setAttribute('aria-label',`PDF page ${page}`);
   // Full-colour render; the theme inverts luminance in CSS so figures keep their hues.
   const render=pdfpage.render({canvas,viewport,transform:[size.ratio,0,0,size.ratio,0,0]});task=render;await render.promise;
   const content=await pdfpage.getTextContent();if(cancelled)return;
   const text=document.createElement('div');text.className='textLayer';text.style.setProperty('--total-scale-factor',String(viewport.scale));
   const pdfjs=await import('pdfjs-dist');layer=new pdfjs.TextLayer({textContentSource:content,container:text,viewport});await layer.render();if(cancelled)return;
   layer.textDivs.forEach((span,i)=>span.dataset.item=String(i));
   canvasHost.current?.replaceChildren(canvas);textHost.current?.replaceChildren(text);setBusy(false);setError('');
  }catch(e){if(!cancelled){setError(e instanceof Error?e.message:'Could not render this page.');setBusy(false);}}})();},80);
  return()=>{cancelled=true;clearTimeout(timer);task?.cancel();layer?.cancel();setBusy(true);};
 },[doc,page,width,active]);
 return <div className="paper sharp-paper" data-page={page} style={{width,height:width*aspect}} aria-busy={busy}><div ref={canvasHost}/><div className="pdf-selection-layer" ref={textHost}/>{children}{error&&<p role="alert" className="error">{error}</p>}</div>;
}
