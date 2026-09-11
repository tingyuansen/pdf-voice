import {endsSentence,nextSpeechBoundary} from './phrase-boundaries';
export type Item = {str:string;transform:number[];width:number;height:number;hasEOL?:boolean};
export type Script = {start:number;end:number;kind:'sub'|'sup'};
export type Passage = {text:string; indices:number[]; scripts?:Script[]};
// Preserve PDF extraction order, including column order supplied by the document.
export function passagesFromItems(items:Item[]):Passage[]{
 const result:Passage[]=[]; let text='',indices:number[]=[];
 const flush=()=>{if(text.trim())result.push({text:text.trim(),indices:[...indices]});text='';indices=[];};
 items.forEach((item,i)=>{if(!item.str.trim())return;
  if(text.length+item.str.length>2400)flush();
  if(item.str.length>2000){flush();for(let j=0;j<item.str.length;){const end=nextSpeechBoundary(item.str,j);result.push({text:item.str.slice(j,end).trim(),indices:[i]});j=end;}return;}
  text+=(text?' ':'')+item.str;indices.push(i);
  if(endsSentence(text) && text.length>70)flush();
 });flush();return result;
}
