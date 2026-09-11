export type ReadingScope='selection'|'page'|'document';
export function nextPlayback(scope:ReadingScope,index:number,count:number,page:number,totalPages:number):'passage'|'page'|'stop'{
 if(index+1<count)return 'passage';
 return scope==='document'&&page<totalPages?'page':'stop';
}
