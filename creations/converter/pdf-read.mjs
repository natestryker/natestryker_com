import {orderedPages,stem,encode,LIMITS,escapeHtml} from './core.mjs';
let library;
async function lib(){
  if(!library){library=await import('../pdf-image-converter/vendor/pdfjs/build/pdf.min.mjs');library.GlobalWorkerOptions.workerSrc=new URL('../pdf-image-converter/vendor/pdfjs/build/pdf.worker.min.mjs',import.meta.url).href;}
  return library;
}
export async function readPDF(file,target,options,progress,control){
  const reader=await lib(),assets=new URL('../pdf-image-converter/vendor/pdfjs/',import.meta.url).href;
  const task=reader.getDocument({data:new Uint8Array(await file.arrayBuffer()),password:options.password||'',cMapUrl:assets+'cmaps/',cMapPacked:true,standardFontDataUrl:assets+'standard_fonts/',wasmUrl:assets+'wasm/',iccUrl:assets+'iccs/',isEvalSupported:false});
  control.cancel=()=>task.destroy();let canvas;
  try{
    const pdf=await task.promise,pages=orderedPages(options.pages||'',pdf.numPages),outputs=[],textPages=[];let total=0;
    for(const [index,number]of pages.entries()){
      if(control.canceled)throw new DOMException('Canceled','AbortError');
      progress({message:`Processing PDF page ${number} (${index+1}/${pages.length})…`,fraction:index/pages.length});
      const page=await pdf.getPage(number);
      if(['txt','html','pdf-json'].includes(target)){
        const content=await page.getTextContent();let text='';
        for(const item of content.items)if('str'in item)text+=item.str+(item.hasEOL?'\n':' ');
        textPages.push({page:number,text:text.trim()});
      }else{
        const viewport=page.getViewport({scale:Number(options.resolution)||2});
        if(Math.ceil(viewport.width)*Math.ceil(viewport.height)>LIMITS.pixels||Math.max(viewport.width,viewport.height)>8192)throw new Error('A PDF page is too large at this resolution. Select a lower DPI.');
        canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff'}).promise;
        const format=target==='pdf-zip'?'png':target,type=['jpg','jpeg'].includes(format)?'image/jpeg':`image/${format}`;
        const blob=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Image export failed. Try a lower resolution.')),type,Number(options.quality)||.9));
        if(blob.type!==type)throw new Error('Your browser does not support this image encoder.');
        const bytes=new Uint8Array(await blob.arrayBuffer());total+=bytes.length;if(total>LIMITS.outputs)throw new Error('These pages exceed 200 MB. Select fewer pages or a lower DPI.');
        outputs.push({name:stem(file.name)+'-page-'+number+'.'+format,bytes,type});canvas.width=canvas.height=0;canvas=null;
      }
      page.cleanup();await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(target==='txt'){
      if(!textPages.some(page=>page.text))throw new Error('No selectable text was found. This may be a scanned PDF; OCR is not included.');
      return [{name:stem(file.name)+'.txt',bytes:encode(textPages.map(page=>page.text).join('\n\n\f\n\n')),type:'text/plain;charset=utf-8'}];
    }
    if(target==='pdf-json'){
      const metadata=await pdf.getMetadata();return [{name:stem(file.name)+'.json',bytes:encode(JSON.stringify({pageCount:pdf.numPages,metadata:metadata.info,pages:textPages},null,2)),type:'application/json'}];
    }
    if(target==='html')return [{name:stem(file.name)+'.html',bytes:encode('<!doctype html><html lang="en"><meta charset="utf-8"><title>'+escapeHtml(stem(file.name))+'</title>'+textPages.map(page=>'<section><h1>Page '+page.page+'</h1><pre>'+escapeHtml(page.text)+'</pre></section>').join('\n')+'</html>'),type:'text/html;charset=utf-8'}];
    return outputs;
  }catch(error){
    if(control.canceled)throw new DOMException('Canceled','AbortError');
    if(error.name==='PasswordException')throw new Error('This PDF requires a password, or the password is incorrect. Enter a known password in the settings.');
    if(error.name==='InvalidPDFException')throw new Error('This file is not a readable PDF. It may be damaged.');
    throw error;
  }finally{if(canvas)canvas.width=canvas.height=0;await task.destroy();control.cancel=null;}
}
