import {LIMITS, stem} from './core.mjs';
let utif;
function tiffLib(){if(!utif){importScripts('./vendor/pako.min.js','./vendor/utif.js');utif=self.UTIF;}return utif;}
function checkPixels(width,height){if(!(width>0&&height>0)||width*height>LIMITS.pixels||Math.max(width,height)>16384)throw new Error('Use an image of at most 16 megapixels and 16,384 pixels on either side.');}
export async function bitmapOf(file,format){
  if(format==='tiff') {
    const bytes=await file.arrayBuffer(),U=tiffLib(),pages=U.decode(bytes),page=pages[0];
    if(!page)throw new Error('No image was found in this TIFF.');
    checkPixels(page.width||page.t256?.[0],page.height||page.t257?.[0]);U.decodeImage(bytes,page);
    const rgba=U.toRGBA8(page);return createImageBitmap(new ImageData(new Uint8ClampedArray(rgba),page.width,page.height));
  }
  if(format==='ico') {
    const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer);
    if(bytes.length<22)throw new Error('Invalid ICO file.');
    const count=view.getUint16(4,true);let best=null;
    for(let i=0;i<count;i++){const at=6+i*16;if(at+16>bytes.length)break;const width=bytes[at]||256,height=bytes[at+1]||256,size=view.getUint32(at+8,true),offset=view.getUint32(at+12,true);if(offset+size<=bytes.length&&bytes[offset]===137&&(!best||width>best.width))best={width,height,size,offset};}
    if(!best)throw new Error('This ICO uses an older bitmap encoding. Only PNG-based ICO input is supported.');
    return createImageBitmap(new Blob([bytes.slice(best.offset,best.offset+best.size)],{type:'image/png'}));
  }
  const bitmap=await createImageBitmap(file);checkPixels(bitmap.width,bitmap.height);return bitmap;
}
export async function imageInfo(file,format){const bitmap=await bitmapOf(file,format);const info={width:bitmap.width,height:bitmap.height};bitmap.close();return info;}
function bmp(canvas){
  const {width,height}=canvas,stride=Math.ceil(width*3/4)*4,pixels=canvas.getContext('2d').getImageData(0,0,width,height).data;
  const bytes=new Uint8Array(54+stride*height),view=new DataView(bytes.buffer);bytes[0]=66;bytes[1]=77;view.setUint32(2,bytes.length,true);view.setUint32(10,54,true);view.setUint32(14,40,true);view.setInt32(18,width,true);view.setInt32(22,height,true);view.setUint16(26,1,true);view.setUint16(28,24,true);view.setUint32(34,stride*height,true);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const input=(y*width+x)*4,output=54+(height-1-y)*stride+x*3;bytes[output]=pixels[input+2];bytes[output+1]=pixels[input+1];bytes[output+2]=pixels[input];}return bytes;
}
export async function convertImage(file,info,target,options={}) {
  let bitmap;
  try {
    bitmap=await bitmapOf(file,info.preparedFormat||info.format);
    const maxWidth=target==='ico'?Math.min(Number(options.width)||256,256):Number(options.width)||bitmap.width;
    const scale=Math.min(1,maxWidth/bitmap.width,target==='ico'?256/bitmap.height:1);
    const width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
    const canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d');
    if(['jpg','jpeg','bmp'].includes(target)){ctx.fillStyle=options.background||'#ffffff';ctx.fillRect(0,0,width,height);}
    ctx.drawImage(bitmap,0,0,width,height);bitmap.close();bitmap=null;
    let bytes,type;
    if(target==='bmp'){bytes=bmp(canvas);type='image/bmp';}
    else if(target==='tiff'){const rgba=ctx.getImageData(0,0,width,height).data;bytes=new Uint8Array(tiffLib().encodeImage(rgba.buffer,width,height));type='image/tiff';}
    else {
      type=['jpg','jpeg'].includes(target)?'image/jpeg':target==='webp'?'image/webp':'image/png';
      const blob=await canvas.convertToBlob({type,quality:Number(options.quality)||.9});
      if(blob.type!==type)throw new Error(`Your browser cannot encode ${target.toUpperCase()}. Choose PNG or JPG.`);
      bytes=new Uint8Array(await blob.arrayBuffer());
      if(target==='ico'){const data=new Uint8Array(22+bytes.length),view=new DataView(data.buffer);view.setUint16(2,1,true);view.setUint16(4,1,true);data[6]=width===256?0:width;data[7]=height===256?0:height;view.setUint16(10,1,true);view.setUint16(12,32,true);view.setUint32(14,bytes.length,true);view.setUint32(18,22,true);data.set(bytes,22);bytes=data;type='image/x-icon';}
    }
    canvas.width=canvas.height=0;
    return [{name:stem(file.name)+'.'+target,bytes,type}];
  }catch(error){if(error.name==='InvalidStateError'||error.name==='EncodingError')throw new Error('This image encoding is not supported by your browser, or the image is damaged.');throw error;}
  finally{bitmap?.close();}
}
