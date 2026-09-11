import {endsSentence,nextSpeechBoundary} from './phrase-boundaries';
import type {Item,Passage,Script} from './passages';
// PDF user-space box (y grows upward) to rasterise for a display equation or a figure.
export type CropBox={x0:number;y0:number;x1:number;y1:number};
export type ReflowBlock={kind:'paragraph'|'heading'|'equation'|'figure'|'caption';passages:number[];box?:CropBox;label?:string;alt?:string};
// Item indices the document already knows to be running heads or page numbers,
// and the page's media box so wordless graphics at a page edge are still found.
export type ReflowOptions={furniture?:ReadonlySet<number>;view?:readonly number[]};
type Piece={text:string;indices:number[];script?:Script['kind']};
type Figure={caption:Line[];lines:Line[];box:CropBox;label:string;table:boolean};
type Line={pieces:Piece[];items:Item[];x:number;y:number;end:number;height:number;last:Item;rotated:boolean;equation?:boolean;figure?:Figure;caption?:Figure};
type Group={pieces:Piece[];kind:ReflowBlock['kind'];items:Item[];figure?:Figure};
const clean=(s:string)=>s.replace(/[ﬀﬁﬂﬃﬄ]/g,c=>({'ﬀ':'ff','ﬁ':'fi','ﬂ':'fl','ﬃ':'ffi','ﬄ':'ffl'}[c]!)).replace(/´([A-Za-zı])/g,(_,c)=>((c==='ı'?'i':c)+'́').normalize('NFC'));
const itemHeight=(item:Item)=>item.height||Math.hypot(item.transform[2]||0,item.transform[3]||0)||10;
const itemX=(item:Item)=>item.transform[4]||0,itemY=(item:Item)=>item.transform[5]||0;
// Vertical text (axis labels) advances along y; its width must not count horizontally.
const rotated=(item:Item)=>Math.abs(item.transform[1]||0)>Math.abs(item.transform[0]||0);
const wordCount=(text:string)=>(text.match(/[A-Za-z]{2,}/g)||[]).length;
// Equation numbers as set by LaTeX-style classes: (4), (10), (2.3), (A1), (6a).
const LABEL=/^\((?:\d{1,3}[a-z]?|[A-Z]{1,2}\.?\d{1,3}[a-z]?|\d{1,2}\.\d{1,3}[a-z]?)\)$/;
// Control characters are large delimiters and operators from math extension fonts.
const MATH=/[=≈≃≡≤≥≠∝∑∫∏∈∉→←↔±×∞√∂∇⊤†‖]|[α-ωΓΔΘΛΞΠΣΦΨΩ]|[\u0000-\u0008\u000e-\u001f]/;
const STRONG_MATH=/[=≈≃≡≤≥≠∝∑∫∏→]|[\u0000-\u0008\u000e-\u001f]/;
const GLYPH=/^[\u0000-\u001f\s]+$/;
const SUFFIX=/^(?:ing|ings|tion|tions|sion|sions|ed|ly|ment|ments|ness|ity|ities|ous|ive|ively|ally|ance|ence|ent|ant|ers?|ations?|ising|izing|ised|ized|able|ible|ful|less|tors?|tory|tures?|tive)$/;
// Caption labels: "Figure 1.", "Fig. 2:", "FIGURE 3 —", "Table 1", "Fig. 1 |".
const CAPTION=/^(?:fig(?:ure)?s?\.?|table|plate|chart|scheme|listing|algorithm)\s*[A-Z]?\d{1,3}[a-z]?\s*(?:[.:|—–-]|$)/i;
function lineText(line:Line){return line.pieces.map(p=>p.text).join('');}
function heading(line:Line){const text=lineText(line).trim();return text.length<180&&((text.match(/[A-Za-z]/g)||[]).length>=3&&/[A-Z]/.test(text)&&text===text.toUpperCase()||/^\d+(?:\.\d+)*\.\s+[A-Z]/.test(text));}
// Numbered drafts print small integers beside every line, outside the text
// column; four or more stacked at one x with text alongside are line numbers.
function marginNumbers(items:Item[]):Set<number>{
 const long=items.filter(i=>i.str.trim().length>30);if(long.length<4)return new Set();
 const heights=long.map(itemHeight).sort((a,b)=>a-b);const body=heights[Math.floor(heights.length/2)];
 const small=items.map((item,index)=>({item,index})).filter(({item})=>/^\d{1,4}$/.test(item.str.trim())&&itemHeight(item)<=body*.75);
 const beside=small.filter(({item})=>long.some(l=>Math.abs(itemY(l)-itemY(item))<2&&(itemX(item)+item.width<itemX(l)-1||itemX(item)>itemX(l)+l.width+1)));
 const groups=new Map<number,number>();
 for(const {item} of beside){const key=Math.round(itemX(item)/4);groups.set(key,(groups.get(key)||0)+1);}
 // Numbers in that column beside equations or figures are line numbers too.
 return new Set(small.filter(({item})=>(groups.get(Math.round(itemX(item)/4))||0)>=4).map(({index})=>index));
}
// Position-aware reflow preserves every nonempty source item. Audio boundaries
// are independent from paragraph boundaries and keep original PDF item mappings.
export function reflowItems(items:Item[],documentWords:ReadonlySet<string>=new Set(),options:ReflowOptions={}):{blocks:ReflowBlock[];passages:Passage[];body:number}{
 const lines:Line[]=[];
 const silent=new Set([...marginNumbers(items),...(options.furniture||[])]),silentItems=new Set([...silent].map(i=>items[i]));let carried:{item:Item;index:number}[]=[];
 items.forEach((item,index)=>{
  if(!item.str.trim())return;
  const x=itemX(item),y=itemY(item),h=itemHeight(item),advance=rotated(item)?h:item.width;
  // Line numbers and page furniture stay mapped to a line for highlighting but add no text.
  if(silent.has(index)){const line=lines.at(-1);if(line){line.pieces.push({text:'',indices:[index]});line.items.push(item);}else carried.push({item,index});return;}
  let line=lines.at(-1);const decimalAdjacent=line&&/\d$/.test(lineText(line).trim())&&/^\.\d/.test(item.str)||line&&/\d\.$/.test(lineText(line).trim())&&/^\d/.test(item.str)||line&&/\d$/.test(lineText(line).trim())&&item.str==='.';
  // Large delimiters from math extension fonts sit well above the baseline of
  // the text they belong to; they must not split an inline expression.
  const glyph=GLYPH.test(item.str),glyphLine=Boolean(line&&line.items.every(i=>GLYPH.test(i.str)));
  const reach=glyph||glyphLine?1.6:.55;
  const same=line&&Math.abs(y-line.y)<=Math.max(h,line.height)*reach&&x>=line.x-2&&x-line.end<Math.max(h*4,25)&&(!line.last.hasEOL||glyph||glyphLine||Boolean(Math.abs(y-line.y)<Math.max(h,line.height)*.2&&x-line.end<Math.max(h,line.height)*(decimalAdjacent ? 0.3 : 1.2)));
  if(!same){line={pieces:[],items:[],x,y,end:x,height:h,last:item,rotated:rotated(item)};lines.push(line);for(const c of carried){line.pieces.push({text:'',indices:[c.index]});line.items.push(c.item);}carried=[];}
  else if(glyphLine&&!glyph)line!.y=y;
  let text=clean(item.str);const prior=line!.pieces.at(-1);if(prior?.text.endsWith('´')&&/^[A-Za-zı]/.test(text)){prior.text=prior.text.slice(0,-1);text=clean('´'+text);}
  const previous=line!.pieces.at(-1)?.text||'';const gap=x-line!.end;
  // Adjacent font runs, punctuation, decimal points and subscripts must not
  // acquire synthetic spaces. Larger physical gaps indicate real word spaces.
  const separator=previous&&!/\s$/.test(previous)&&!/^\s/.test(text)&&gap>Math.min(h,line!.height)*.14?' ':'';
  line!.pieces.push({text:separator+text,indices:[index]});line!.items.push(item);line!.end=Math.max(line!.end,x+advance);line!.height=Math.max(line!.height,h);line!.last=item;
 });
 const upright=lines.filter(l=>!l.rotated);
 const heights=upright.filter(l=>lineText(l).length>30).map(l=>l.height).sort((a,b)=>a-b);const body=heights[Math.floor(heights.length/2)]||10;
 if(!lines.length)return {blocks:[],passages:[],body};
 const widths=upright.filter(l=>lineText(l).length>30).map(l=>l.end-l.x).sort((a,b)=>a-b);const typicalWidth=widths[Math.floor(widths.length/2)]||250;
 const words=new Set(items.flatMap(i=>i.str.toLowerCase().match(/[a-z]{3,}/g)||[]));
 const compounds=new Set(items.flatMap(i=>i.str.toLowerCase().match(/[a-z]+-[a-z]+/g)||[]));
 // Smaller glyphs raised or lowered from the line's baseline are inline scripts.
 for(const line of lines){
  const full=line.items.filter(i=>itemHeight(i)>=line.height*.9).map(itemY).sort((a,b)=>a-b);
  const baseline=full.length?full[Math.floor(full.length/2)]:line.y;
  line.pieces.forEach((piece,k)=>{const item=line.items[k];const h=itemHeight(item);if(h>=line.height*.85||!/\S/.test(piece.text))return;const dy=itemY(item)-baseline;if(dy>line.height*.15)piece.script='sup';else if(dy<-line.height*.1)piece.script='sub';});
 }
 // Columns come from well-supported clusters of long lines, ignoring stray
 // figure text; equations sit centred inside one column.
 const clusters:{x:number;right:number;count:number;ends:number[]}[]=[];
 for(const l of upright.filter(l=>l.end-l.x>typicalWidth*.6).sort((a,b)=>a.x-b.x)){const c=clusters.find(c=>Math.abs(c.x-l.x)<body*1.5);if(c){c.ends.push(l.end);c.count++;}else clusters.push({x:l.x,right:l.end,count:1,ends:[l.end]});}
 // The right edge is the typical line end, so a full-width caption or table
 // does not drag a column's margin across the page.
 for(const c of clusters){const tally=new Map<number,number>();for(const end of c.ends){const key=Math.round(end);tally.set(key,(tally.get(key)||0)+1);}c.right=[...tally.entries()].reduce((best,entry)=>entry[1]>best[1]||entry[1]===best[1]&&entry[0]>best[0]?entry:best)[0];}
 const support=clusters.reduce((sum,c)=>sum+c.count,0);
 const columns=clusters.filter(c=>c.count>=3&&c.count>=support*.1);
 if(!columns.length)columns.push({x:Math.min(...lines.map(l=>l.x)),right:Math.max(...lines.map(l=>l.end)),count:0,ends:[]});
 const columnOf=(l:Line)=>{const center=(l.x+l.end)/2;const inside=columns.filter(c=>center>=c.x-body*2&&center<=c.right+body*2);return inside.length?inside.reduce((a,b)=>b.count>a.count?b:a):columns.reduce((best,c)=>Math.abs(c.x-l.x)<Math.abs(best.x-l.x)?c:best);};
 const atMargin=(l:Line)=>!l.rotated&&Math.abs(l.x-columnOf(l).x)<body*.5;
 const width=(l:Line)=>l.end-l.x;
 // A margin line whose row (pieces within a fraction of a line of it) carries
 // real words is running text, even when inline fractions or limits split it.
 const rowWords=(l:Line)=>{const c=columnOf(l);return lines.filter(o=>Math.abs(o.y-l.y)<body*.9&&columnOf(o)===c).reduce((n,o)=>n+(lineText(o).match(/[A-Za-z]{3,}/g)||[]).length,0);};
 const textRow=lines.map(l=>atMargin(l)&&rowWords(l)>=3);
 const besideText=lines.map((l,n)=>{const c=columnOf(l);return lines.some((o,k)=>k!==n&&textRow[k]&&Math.abs(o.y-l.y)<body*.9&&columnOf(o)===c);});
 // A numbered display equation ends with a right-aligned label set apart from its body.
 const anchor=(l:Line)=>{
  const visible=l.items.filter(i=>!silentItems.has(i));const last=visible.at(-1);if(!last||!LABEL.test(last.str.trim()))return false;
  const c=columnOf(l);if(itemX(last)+last.width<c.right-body*.8)return false;
  const before=visible.at(-2);if(before&&itemX(last)-(itemX(before)+before.width)<body*.5)return false;
  return visible.length===1||!atMargin(l)||itemX(last)-l.x<typicalWidth*.8||MATH.test(lineText(l));
 };
 // Unnumbered displays are short centred lines carrying relations or operators,
 // set among running text rather than among the tick labels of a figure.
 const nearText=(l:Line)=>{const c=columnOf(l);return lines.some(o=>o!==l&&o.end-o.x>typicalWidth*.6&&atMargin(o)&&Math.abs(o.y-l.y)<body*5&&columnOf(o)===c);};
 const lonelyRow=(l:Line)=>!lines.some(o=>o!==l&&Math.abs(o.y-l.y)<body*.3&&(o.end<l.x||o.x>l.end)&&width(o)<typicalWidth*.6&&!atMargin(o));
 const centeredMath=(l:Line,n:number)=>{
  if(l.rotated||l.figure||atMargin(l)||width(l)>typicalWidth*.8)return false;const text=lineText(l);
  if(!STRONG_MATH.test(text)||!nearText(l)||!lonelyRow(l)||besideText[n])return false;
  const c=columnOf(l);if(Math.abs((l.x+l.end)/2-(c.x+c.right)/2)>typicalWidth*.3)return false;
  const prev=lines[n-1];return !prev||prev.y-l.y>body*1.3||prev.equation===true||wordCount(text)<=3;
 };
 // Fraction parts, limits and delimiters are short pieces stacked close to an equation line.
 const fragment=(l:Line,n:number,near:Line)=>{
  if(textRow[n]||besideText[n]||l.rotated||l.figure)return false;
  const dy=Math.abs(l.y-near.y),text=lineText(l).trim();
  if(!atMargin(l)&&width(l)<typicalWidth*.6&&dy<body*1.6&&(wordCount(text)<=5||MATH.test(text)))return true;
  if(!atMargin(l)&&dy<body*1.35&&STRONG_MATH.test(text))return true;
  // Wide displays start at the margin; only stacked parts sit closer than a line pitch.
  return dy<body*.9&&STRONG_MATH.test(text)&&!endsSentence(text);
 };
 // Reading order interleaves limits, numerators and main lines, so look a few
 // lines either way inside the same column rather than only at neighbours.
 const absorb=()=>{for(let pass=0;pass<40;pass++){
  let changed=false;
  lines.forEach((l,n)=>{
   if(l.equation)return;const column=columnOf(l);
   for(let k=Math.max(0,n-10);k<=Math.min(lines.length-1,n+10);k++){const near=lines[k];if(near.equation&&columnOf(near)===column&&fragment(l,n,near)){l.equation=true;changed=true;break;}}
  });
  if(!changed)break;
 }};
 // Numbered displays are certain, so they are settled before figures are cut
 // out; unnumbered displays are then sought only outside figures, where axis
 // annotations such as "R2 = 0.98" would otherwise pass for one.
 lines.forEach(l=>{if(anchor(l))l.equation=true;});absorb();
 // Running heads and page numbers bound how far a figure crop may reach.
 const ys=items.filter(i=>i.str.trim()).map(itemY);const mid=(Math.max(...ys)+Math.min(...ys))/2;
 let topClip=Infinity,bottomClip=-Infinity;
 for(const index of options.furniture||[]){const f=items[index];if(!f)continue;const y=itemY(f),h=itemHeight(f);if(y>mid)topClip=Math.min(topClip,y-h*.5);else bottomClip=Math.max(bottomClip,y+h*1.2);}
 // Figures and tables are found from their captions. The body is the band of
 // non-text lines between the caption and the nearest running text, spanning
 // the caption's column (or the page, for a full-width caption); the reader
 // rasterises that band and trims it, so wordless graphics are covered too.
 const captionMatch=(l:Line)=>l.rotated?null:CAPTION.exec(lineText(l).trim());
 // Only a numbered or multi-word capitalised heading bounds a figure; short
 // capitalised panel labels do not.
 const textNearby=(l:Line)=>{const c=columnOf(l);return lines.some((o,k)=>textRow[k]&&Math.abs(o.y-l.y)<body*2.5&&columnOf(o)===c);};
 const strongHeading=(l:Line)=>{const text=lineText(l).trim();return (/^\d{1,2}(?:\.\d{1,2})*\.?\s+(?:[A-Z][a-z]|[A-Z]{3,})/.test(text)&&text.length<180||heading(l)&&wordCount(text)>=2&&(text.match(/[A-Za-z]/g)||[]).length>=8)&&textNearby(l);};
 // Table rows read like text but are cells separated by wide gaps; a row of
 // tick labels can be as wide as a text line. Neither bounds a figure.
 const tabular=(l:Line)=>{let gaps=0;for(let k=1;k<l.items.length;k++){const a=l.items[k-1],b=l.items[k];if(silentItems.has(a)||silentItems.has(b))continue;if(itemX(b)-(itemX(a)+a.width)>l.height*1.5)gaps++;}return gaps>=2;};
 const stopLine=(l:Line,n:number)=>!tabular(l)&&(textRow[n]||width(l)>=typicalWidth*.85&&(lineText(l).match(/[A-Za-z]{3,}/g)||[]).length>=4)||strongHeading(l)||l.equation===true||Boolean(captionMatch(l))||Boolean(l.figure)||Boolean(l.caption);
 const pageTop=options.view?options.view[3]:Math.max(...lines.map(l=>l.y+l.height)),pageBottom=options.view?options.view[1]:Math.min(...lines.map(l=>l.y));
 const claims:{figure:Figure;above:boolean}[]=[];
 lines.forEach((l,n)=>{
  const match=captionMatch(l);if(!match||l.caption||l.figure||l.equation)return;
  const table=/^table/i.test(match[0]);
  const caption=[l];for(let k=n+1;k<lines.length;k++){const o=lines[k],p=lines[k-1];const gap=p.y-o.y;if(o.rotated||o.equation||o.figure||o.caption||captionMatch(o)||Math.abs(o.x-l.x)>=body*2&&!(atMargin(o)&&columnOf(o)===columnOf(l))||gap<body*.5||gap>body*1.5||Math.abs(o.height-l.height)>body*.25)break;caption.push(o);}
  const last=caption.at(-1)!;const full=caption.some(o=>width(o)>typicalWidth*1.25);const column=columnOf(l);
  const x0=full?Math.min(...columns.map(c=>c.x)):column.x,x1=full?Math.max(...columns.map(c=>c.right)):column.right;
  const band=(above:boolean)=>{
   const edge=above?l.y+l.height*.9:last.y-last.height*.45;
   const candidates=lines.map((o,k)=>({o,k})).filter(({o})=>!caption.includes(o)&&o.x<x1+body&&o.end>x0-body&&(above?o.y>edge:o.y<edge)).sort((a,b)=>above?a.o.y-b.o.y:b.o.y-a.o.y);
   const inside:Line[]=[];let boundary:Line|null=null;
   for(const {o,k} of candidates){if(stopLine(o,k)){boundary=o;break;}inside.push(o);}
   const far=above?(boundary?boundary.y-boundary.height*.4:topClip):(boundary?boundary.y+boundary.height*.95:bottomClip);
   const box=above?{x0:x0-body*1.5,y0:edge,x1:x1+body*1.5,y1:far}:{x0:x0-body*1.5,y0:far,x1:x1+body*1.5,y1:edge};
   const distance=boundary?Math.abs(boundary.y-(above?l.y:last.y)):Infinity;
   // Without any line to stop at, the band runs to the page edge: only worth
   // cropping when there is room for graphics there.
   const room=above?pageTop-l.y:last.y-pageBottom;
   return {lines:inside,box,boundary,distance,room};
  };
  const aboveBand=band(true),belowBand=band(false);
  // A line that merely begins with "Figure 1." sits at normal pitch below
  // running text; a caption has graphics or a gap on the figure's side.
  const nearAbove=Boolean(aboveBand.boundary)&&!aboveBand.lines.length&&aboveBand.distance<body*1.5;
  const nearBelow=Boolean(belowBand.boundary)&&!belowBand.lines.length&&belowBand.distance<body*1.5;
  // A band is worth cropping when it holds figure text or a real gap for graphics.
  const useful=(b:ReturnType<typeof band>)=>b.lines.length>0||(b.boundary?b.distance>=body*1.5:b.room>=body*4);
  let chosen:ReturnType<typeof band>|null=null;
  if(table){if(!nearBelow&&useful(belowBand))chosen=belowBand;else if(!nearAbove&&aboveBand.lines.length>=2)chosen=aboveBand;}
  else{if(!nearAbove&&useful(aboveBand)&&(aboveBand.lines.length||belowBand.lines.length<2))chosen=aboveBand;else if(!nearBelow&&useful(belowBand))chosen=belowBand;}
  if(!chosen||!(chosen.box.y1>chosen.box.y0+body))return;
  const label=match[0].replace(/\s*[.:|—–-]\s*$/,'').replace(/\s+/g,' ').replace(/^fig(?:ure)?s?\.?\s*/i,'Figure ').replace(/^(\w)/,c=>c.toUpperCase());
  const figure:Figure={caption,lines:chosen.lines,box:chosen.box,label,table};
  for(const o of caption)o.caption=figure;claims.push({figure,above:chosen===aboveBand});
 });
 // A table (caption above its body) stacked over a figure (caption below its
 // body) claim the same band from both sides; split it at the widest gap.
 for(const upper of claims)for(const lower of claims){
  if(upper===lower||upper.above||!lower.above)continue;const a=upper.figure.box,b=lower.figure.box;
  if(a.y0>=b.y1||b.y0>=a.y1||a.x1<=b.x0||b.x1<=a.x0)continue;
  const shared=[...new Set([...upper.figure.lines,...lower.figure.lines])].filter(o=>o.y<a.y1&&o.y>b.y0).sort((p,q)=>q.y-p.y);
  let best=-Infinity,split=(a.y1+b.y0)/2;
  for(let k=0;k<=shared.length;k++){const top=k===0?a.y1:shared[k-1].y-shared[k-1].height*.4,bottom=k===shared.length?b.y0:shared[k].y+shared[k].height;if(top-bottom>best){best=top-bottom;split=(top+bottom)/2;}}
  upper.figure.lines=upper.figure.lines.filter(o=>o.y>split);lower.figure.lines=lower.figure.lines.filter(o=>o.y<split);a.y0=split;b.y1=split;
 }
 for(const {figure} of claims)for(const o of figure.lines)o.figure=figure;
 lines.forEach((l,n)=>{if(!l.equation&&!l.figure&&!l.caption&&centeredMath(l,n))l.equation=true;});absorb();
 const groups:Group[]=[];let lastParagraph:Group|undefined,deferred:Group[]=[];
 for(let n=0;n<lines.length;n++){
  const line=lines[n],prev=lines[n-1];
  if(line.equation){
   const group=groups.at(-1);
   if(prev?.equation&&group?.kind==='equation'){group.pieces.push({text:' ',indices:[]},...line.pieces);group.items.push(...line.items);}
   else groups.push({pieces:[...line.pieces],kind:'equation',items:[...line.items]});
   continue;
  }
  if(line.figure)continue;
  if(line.caption){
   const group=groups.at(-1);
   if(group?.kind==='caption'&&group.figure===line.caption){group.pieces.push({text:' ',indices:[]},...line.pieces);group.items.push(...line.items);}
   else groups.push({pieces:[...line.pieces],kind:'caption',items:[...line.items],figure:line.caption});
   continue;
  }
  const isHeading=heading(line);let newBlock=!prev||prev.equation===true;
  if(prev&&(prev.figure||prev.caption)){
   // Text after a float continues the paragraph the float interrupted unless
   // that paragraph ended or this line is indented as a new one.
   const indented=line.x-columnOf(line).x>body*.55;
   newBlock=!(lastParagraph&&!isHeading&&!indented&&!endsSentence(lastParagraph.pieces.map(p=>p.text).join('')));
   // The float then moves behind the paragraph it interrupted, including any
   // display that completes it, and reappears at the next paragraph break.
   if(!newBlock)while(groups.at(-1)?.kind==='caption')deferred.unshift(groups.pop()!);
  }else if(prev&&!prev.equation){
   const gap=prev.y-line.y,shift=line.x-prev.x,prevHeading=heading(prev)||groups.at(-1)?.kind==='heading';
   const columnJump=gap < -body*2&&shift>typicalWidth*.6;
   const indent=shift>body*.55&&shift<body*2.2;
   const gapBreak=gap>body*1.65;
   const sizeBreak=Math.abs(line.height-prev.height)>body*.25;
   const shortEnded=endsSentence(lineText(prev))&&(prev.end-prev.x)<typicalWidth*.72;
   newBlock=isHeading||prevHeading||(!columnJump&&(gapBreak||sizeBreak||indent||shortEnded||gap< -body*.6||Math.abs(shift)>typicalWidth*.65));
   // A column continuation isn't a paragraph unless the new line is indented
   // relative to subsequent lines in that same column.
   if(columnJump){const next=lines[n+1];newBlock=isHeading||prevHeading||Boolean(next&&line.x-next.x>body*.55&&line.x-next.x<body*2.2);}
   // Numerators and denominators of inline fractions sit a fraction of a line
   // above or below their text line; they continue the paragraph.
   if(Math.abs(gap)<body*1.05&&!isHeading&&!prevHeading&&(width(line)<typicalWidth*.5||width(prev)<typicalWidth*.5))newBlock=false;
   // A centred short line right under a heading is the heading's second line.
   if(prevHeading&&!isHeading&&!atMargin(line)&&width(line)<typicalWidth*.8&&gap>0&&gap<body*1.4&&!sizeBreak&&columnOf(line)===columnOf(prev)&&!MATH.test(lineText(line))&&!endsSentence(lineText(line)))newBlock=false;
  }
  if(newBlock||!lastParagraph){groups.push(...deferred);deferred=[];lastParagraph={pieces:[],kind:isHeading?'heading':'paragraph',items:[]};groups.push(lastParagraph);}
  const group=lastParagraph;
  if(group.pieces.length){
   const tail=group.pieces.map(p=>p.text).join('').slice(-60);const first=line.pieces[0];
   const left=tail.match(/([A-Za-z]+)-$/)?.[1],right=first.text.match(/^([A-Za-z]+)/)?.[1];
   if(left&&right){
    const combined=(left+right).toLowerCase(),hyphenated=(left+'-'+right).toLowerCase();
    // Remove ambiguous line-end hyphens when the joined word is attested elsewhere
    // or the remainder is a plain suffix; preserve compounds and minus signs.
    if((words.has(combined)||documentWords.has(combined)||left.length>=3&&SUFFIX.test(right.toLowerCase()))&&!compounds.has(hyphenated)){const last=group.pieces.at(-1)!;last.text=last.text.slice(0,-1);}
   }else if(!/\s$/.test(tail))group.pieces.push({text:' ',indices:[]});
  }
  group.pieces.push(...line.pieces);group.items.push(...line.items);
 }
 groups.push(...deferred);
 const passages:Passage[]=[],blocks:ReflowBlock[]=[];
 const cropText=(pieces:Piece[])=>pieces.map(p=>p.text).join('').replace(/[\u0000-\u001f]/g,'').replace(/\s+/g,' ').trim();
 const figureBlock=(figure:Figure,passage:number):ReflowBlock=>({kind:'figure',passages:passage>=0?[passage]:[],box:figure.box,label:figure.label,alt:cropText(figure.lines.flatMap(o=>[{text:' ',indices:[]},...o.pieces]))});
 for(const group of groups){
  if(group.kind==='equation'){
   const labels=group.items.map(i=>i.str.trim()).filter(s=>LABEL.test(s)).map(s=>s.slice(1,-1));
   const cue=labels.length>1?`Equations ${labels.slice(0,-1).join(', ')} and ${labels.at(-1)}.`:labels.length?`Equation ${labels[0]}.`:'Equation.';
   let x0=Infinity,x1=-Infinity,low=Infinity,high=-Infinity;
   for(const item of group.items){if(silentItems.has(item))continue;const x=itemX(item),y=itemY(item);x0=Math.min(x0,x);x1=Math.max(x1,x+item.width);low=Math.min(low,y);high=Math.max(high,y);}
   // Tall operators and delimiters overflow their nominal boxes, so extend the
   // region up to the neighbouring text lines; the renderer trims blank space.
   const column=columns.find(c=>x0>=c.x-body*2&&x0<=c.right)||columnOf({x:x0,end:x1} as Line);
   let above=high+body*1.6,below=low-body*1.6;
   for(const l of lines){if(l.equation||columnOf(l)!==column)continue;if(l.y>high)above=Math.min(above,l.y-l.height*.35);else if(l.y<low)below=Math.max(below,l.y+l.height*.95);}
   blocks.push({kind:'equation',passages:[passages.length],box:{x0:x0-body*.5,y0:below,x1:x1+body*.5,y1:above},...(labels.length?{label:labels.join(', ')}:{}),alt:cropText(group.pieces)});
   passages.push({text:cue,indices:[...new Set(group.pieces.flatMap(p=>p.indices))]});continue;
  }
  // A figure precedes its caption and a table follows it; the caption's first
  // passage carries the graphic's items so highlights and speech stay aligned.
  const figure=group.kind==='caption'?group.figure:undefined;const first=passages.length;
  if(figure&&!figure.table)blocks.push(figureBlock(figure,first));
  const text=group.pieces.map(p=>p.text).join('');const spans:{start:number;end:number;indices:number[];script?:Script['kind']}[]=[];let offset=0;
  for(const piece of group.pieces){spans.push({start:offset,end:offset+piece.text.length,indices:piece.indices,script:piece.script});offset+=piece.text.length;}
  const block:ReflowBlock={kind:group.kind,passages:[]};let start=0;
  while(start<text.length){
   const end=nextSpeechBoundary(text,start);
   const raw=text.slice(start,end);const input=raw.trim();
   if(input){
    const base=start+(raw.length-raw.trimStart().length);
    // Silent pieces are empty; one at the very end still belongs to this passage.
    const indices=[...new Set(spans.filter(p=>p.end>start&&p.start<end||p.start===p.end&&p.start>=start&&p.start<=end).flatMap(p=>p.indices))];
    const scripts:Script[]=[];
    for(const p of spans){
     if(!p.script||p.end<=base||p.start>=base+input.length)continue;
     const lead=text.slice(p.start,p.end).match(/^\s*/)![0].length;
     const s=Math.max(p.start+lead,base)-base,e=Math.min(p.end,base+input.length)-base;
     if(e>s)scripts.push({start:s,end:e,kind:p.script});
    }
    block.passages.push(passages.length);passages.push({text:input,indices,...(scripts.length?{scripts}:{})});
   }
   start=end;
  }
  if(block.passages.length)blocks.push(block);
  if(figure){
   const extra=figure.lines.flatMap(o=>o.pieces.flatMap(p=>p.indices));
   if(passages.length>first)passages[first].indices=[...new Set([...passages[first].indices,...extra])];
   else if(!figure.table)blocks.pop();
   if(figure.table)blocks.push(figureBlock(figure,passages.length>first?first:-1));
  }
 }
 return {blocks,passages,body};
}
