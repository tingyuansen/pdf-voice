import type {PDFPageProxy} from 'pdfjs-dist';
import type {CropBox} from './reflow';
// Trimmed raster of one page region (a display equation or a figure); width
// and height are PDF points.
export type CropImage={url:string;width:number;height:number};
export const EQUATION_SCALE=6,FIGURE_SCALE=3;
export async function renderCrop(page:PDFPageProxy,box:CropBox,scale:number):Promise<CropImage|null>{
 const [vx0,vy0,vx1,vy1]=page.view;
 const x0=Math.max(vx0,box.x0),x1=Math.min(vx1,box.x1),y0=Math.max(vy0,box.y0),y1=Math.min(vy1,box.y1);
 if(x1-x0<1||y1-y0<1)return null;
 const viewport=page.getViewport({scale,rotation:0});
 const width=Math.ceil((x1-x0)*scale),height=Math.ceil((y1-y0)*scale);
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 // Supplying the context keeps its alpha channel (pdf.js opens its own without
 // one), so a transparent background lets the reader's theme colour the glyphs.
 const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return null;
 // Shift the page so the region's top-left corner lands on the canvas origin.
 // The typings insist on `canvas`, which would make pdf.js discard the context.
 const params={canvasContext:context,viewport,transform:[1,0,0,1,-(x0-vx0)*scale,-(vy1-y1)*scale],background:'rgba(0,0,0,0)'} as unknown as Parameters<typeof page.render>[0];
 await page.render(params).promise;
 const data=context.getImageData(0,0,width,height).data;
 let top=height,bottom=-1,left=width,right=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(data[(y*width+x)*4+3]<24)continue;
  if(y<top)top=y;if(y>bottom)bottom=y;if(x<left)left=x;if(x>right)right=x;
 }
 if(bottom<0)return null;
 const pad=Math.round(scale*1.2);
 left=Math.max(0,left-pad);right=Math.min(width-1,right+pad);top=Math.max(0,top-pad);bottom=Math.min(height-1,bottom+pad);
 const out=document.createElement('canvas');out.width=right-left+1;out.height=bottom-top+1;
 out.getContext('2d')!.drawImage(canvas,left,top,out.width,out.height,0,0,out.width,out.height);
 return {url:out.toDataURL('image/png'),width:out.width/scale,height:out.height/scale};
}
