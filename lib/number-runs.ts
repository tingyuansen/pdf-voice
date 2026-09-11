// Keep decimal/scientific number tokens together visually without altering text.
export function numberRuns(text:string):{text:string;number:boolean}[]{
 const pattern=/[+−-]?(?:\d+(?:[.,]\d+)+|\d+)[eE][+−-]?\d+|[+−-]?\d+(?:[.,]\d+)+/g;
 const result:{text:string;number:boolean}[]=[];let offset=0;
 for(const match of text.matchAll(pattern)){const start=match.index!;if(start>offset)result.push({text:text.slice(offset,start),number:false});result.push({text:match[0],number:true});offset=start+match[0].length;}
 if(offset<text.length)result.push({text:text.slice(offset),number:false});return result;
}
