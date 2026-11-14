import {createSpotPool} from './core.js';

export function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Could not load map image'));image.src=src;});}

function spotsFromPreview(image,width,height,scale){
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
 const {data}=context.getImageData(0,0,canvas.width,canvas.height);
 return createSpotPool({accept:(x,y)=>{
  const px=Math.min(canvas.width-1,Math.floor(x*width/scale)),py=Math.min(canvas.height-1,Math.floor(y*height/scale)),i=(py*canvas.width+px)*4;
  return data[i+3]>128&&Math.max(data[i],data[i+1],data[i+2])>18;
 }});
}

export class ImageSource{
 constructor(image,label){
  this.preview=image;this.width=image.naturalWidth;this.height=image.naturalHeight;this.label=label;this.spots=spotsFromPreview(image,this.width,this.height,1);
 }
 async render(context,region,{isCurrent=()=>true}={}){
  if(isCurrent()){
   context.imageSmoothingQuality='high';
   if(region.width<.001&&region.height<.001){context.save();context.imageSmoothingEnabled=false;context.drawImage(this.preview,Math.floor(region.x+region.width/2),Math.floor(region.y+region.height/2),1,1,0,0,context.canvas.width,context.canvas.height);context.restore();}
   else context.drawImage(this.preview,region.x,region.y,region.width,region.height,0,0,context.canvas.width,context.canvas.height);
  }
  return true;
 }
}

export class TerrainSource{
 static async load(path='assets/terrain/manifest.json'){
  const response=await fetch(path);if(!response.ok)throw Error('Terrain manifest unavailable');
  const manifest=await response.json(),base=new URL('.',new URL(path,location.href));
  const preview=await loadImage(new URL(manifest.preview,base).href);
  return new TerrainSource(manifest,preview,base);
 }
 constructor(manifest,preview,base){
  this.width=manifest.width;this.height=manifest.height;this.label=manifest.label;this.manifest=manifest;this.preview=preview;this.base=base;this.cache=new Map();
  this.spots=spotsFromPreview(preview,this.width,this.height,manifest.previewScale);
 }
 tile(scale,x,y){
  const key=scale+'/'+x+'-'+y;
  if(this.cache.has(key)){const promise=this.cache.get(key);this.cache.delete(key);this.cache.set(key,promise);return promise;}
  const path=this.manifest.pattern.replace('{scale}',scale).replace('{x}',x).replace('{y}',y);
  const promise=loadImage(new URL(path,this.base).href).catch(error=>{this.cache.delete(key);throw error;});
  this.cache.set(key,promise);
  while(this.cache.size>24)this.cache.delete(this.cache.keys().next().value);
  return promise;
 }
 async render(context,region,{isCurrent=()=>true}={}){
  if(!isCurrent())return null;
  if(region.width<=0||region.height<=0)return false;
  const previewScale=this.manifest.previewScale,outWidth=context.canvas.width,outHeight=context.canvas.height;
  context.imageSmoothingQuality='high';context.fillStyle='#06100e';context.fillRect(0,0,outWidth,outHeight);
  if(region.width<.001&&region.height<.001){
   const size=this.manifest.tileSize,cx=Math.min(this.width-1,Math.max(0,region.x+region.width/2)),cy=Math.min(this.height-1,Math.max(0,region.y+region.height/2));
   const x=Math.floor(cx/size),y=Math.floor(cy/size);
   try{const image=await this.tile(1,x,y);if(!isCurrent())return null;context.save();context.imageSmoothingEnabled=false;context.drawImage(image,Math.floor(cx-x*size),Math.floor(cy-y*size),1,1,0,0,outWidth,outHeight);context.restore();return true;}catch{return false;}
  }
  context.drawImage(this.preview,region.x/previewScale,region.y/previewScale,region.width/previewScale,region.height/previewScale,0,0,outWidth,outHeight);
  const ratio=Math.min(region.width/outWidth,region.height/outHeight);
  if(ratio>=previewScale)return true;
  const scale=[...this.manifest.scales].sort((a,b)=>b-a).find(s=>s<=ratio)||1,tileSize=this.manifest.tileSize;
  const left=region.x/scale,top=region.y/scale,right=(region.x+region.width)/scale,bottom=(region.y+region.height)/scale;
  const maxX=Math.ceil(this.width/scale/tileSize)-1,maxY=Math.ceil(this.height/scale/tileSize)-1;
  const requests=[];
  for(let y=Math.max(0,Math.floor(top/tileSize));y<=Math.min(maxY,Math.ceil(bottom/tileSize)-1);y++){
   for(let x=Math.max(0,Math.floor(left/tileSize));x<=Math.min(maxX,Math.ceil(right/tileSize)-1);x++)requests.push(this.tile(scale,x,y).then(image=>({image,x,y})));
  }
  try{
   const tiles=await Promise.all(requests);if(!isCurrent())return null;
   for(const {image,x,y} of tiles){
    const sx=Math.max(0,left-x*tileSize),sy=Math.max(0,top-y*tileSize);
    const sw=Math.min(image.naturalWidth,right-x*tileSize)-sx,sh=Math.min(image.naturalHeight,bottom-y*tileSize)-sy;
    if(sw<=0||sh<=0)continue;
    const dx=(x*tileSize+sx-left)*scale/region.width*outWidth,dy=(y*tileSize+sy-top)*scale/region.height*outHeight;
    context.drawImage(image,sx,sy,sw,sh,dx,dy,sw*scale/region.width*outWidth,sh*scale/region.height*outHeight);
   }
   return true;
  }catch{return false;}
 }
}
