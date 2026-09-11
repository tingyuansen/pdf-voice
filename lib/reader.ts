export function rasterSize(width:number,height:number,pixelRatio:number){
 // Match display pixels; cap pathological pages at 32 megapixels.
 const ratio=Math.min(Math.max(1,pixelRatio),Math.sqrt(32_000_000/(width*height)));
 return {ratio,width:Math.ceil(width*ratio),height:Math.ceil(height*ratio)};
}
