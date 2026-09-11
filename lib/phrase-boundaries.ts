// A PDF run ending in a period is not necessarily the end of a sentence.
export function endsSentence(value:string):boolean{
 const text=value.trim().replace(/[”’"')\]]+$/,'');
 if(!/[.!?]$/.test(text))return false;
 if(/[!?]$/.test(text))return true;
 if(/(?:\b(?:e\.g|i\.e|et\s+al|figs?|eqs?|secs?|dr|mr|mrs|ms|prof|vs|cf|approx|nos?|vol|pp|refs?)|\b[A-Z]|\b(?:[A-Za-z]\.)+[A-Za-z])\.$/i.test(text))return false;
 return true;
}
export const MAX_SPEECH_CHARS=2400;
export function nextSpeechBoundary(text:string,start:number,target=900):number{
 const hard=Math.min(text.length,start+MAX_SPEECH_CHARS);
 if(text.length-start<=target)return text.length;
 const candidates:number[]=[];const section=text.slice(start,hard);
 for(const match of section.matchAll(/[.!?][”’"')\]]*(?:\s+|$)/g)){
  const end=match.index!+match[0].length;const prefix=section.slice(0,end);
  if(!endsSentence(prefix))continue;
  // Keep parenthetical phrases/citations intact when possible.
  const depth=(prefix.match(/[([]/g)||[]).length-(prefix.match(/[)\]]/g)||[]).length;
  if(depth<=0)candidates.push(start+end);
 }
 const before=candidates.filter(end=>end<=start+target&&end>start+70).at(-1);
 if(before)return before;
 const after=candidates.find(end=>end>start+target);if(after)return after;
 if(hard===text.length)return hard;
 // Exceptionally long sentences still respect the API limit, preferably at a clause.
 const clause=Array.from(section.matchAll(/[;,:—]\s+/g)).at(-1);
 if(clause&&clause.index!>200)return start+clause.index!+clause[0].length;
 const space=section.lastIndexOf(' ');return space>200?start+space+1:hard;
}
