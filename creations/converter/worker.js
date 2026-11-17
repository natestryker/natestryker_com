let queue=Promise.resolve();
self.onmessage=event=>{queue=queue.catch(()=>{}).then(()=>handle(event.data));};
async function handle({id,action,file,info,target,options={},prepared={},files,infos,entries}){
  const progress=data=>self.postMessage({id,event:'progress',...data});
  try{
    const C=await import('./core.mjs');let result;
    if(action==='inspect'){
      if(file.size>C.LIMITS.file)throw new Error('Files must be 150 MB or less.');
      const head=new Uint8Array(await file.slice(0,65536).arrayBuffer());let format=C.signature(head),details={};
      if(format==='zip'){
        const A=await import('./archive.mjs'),index=A.zipIndex(new Uint8Array(await file.arrayBuffer())),names=index.map(item=>item.path);
        if(names.includes('word/document.xml'))format='docx';else if(names.includes('xl/workbook.xml'))format='xlsx';else if(names.includes('mimetype')&&names.includes('content.xml'))format='ods';
      }
      if(format==='gz'){
        const A=await import('./archive.mjs'),expanded=A.gunzip(new Uint8Array(await file.arrayBuffer()));if(C.signature(expanded.slice(0,512))==='tar')format='tgz';
      }
      if(!format){
        let text='';
        if(file.size>C.LIMITS.text)format='unknown';
        else try{text=C.decode(new Uint8Array(await file.arrayBuffer()));if(/[\x00-\x08\x0e-\x1f]/.test(text)){format='unknown';text='';}}
        catch{format='unknown';}
        const trim=text.trim(),ext=file.name.split('.').pop().toLowerCase();
        if(/^<svg\b|^<\?xml[\s\S]*?<svg\b/i.test(trim)){format='svg';}
        else if(/^<!doctype\s+html|^<html\b|^<(?:body|table|p|div|h[1-6])\b/i.test(trim)){format='html';}
        else if(trim.startsWith('<'))format='xml';
        else if(/^[\[{]/.test(trim)){try{JSON.parse(trim);format='json';}catch{if(ext==='json')throw new Error('This JSON file is invalid.');}}
        if(!format&&['json','yaml','yml','toml','ini','jsonl','ndjson'].includes(ext))format=({yml:'yaml',ndjson:'jsonl'})[ext]||ext;
        if(!format&&['csv','tsv'].includes(ext))format=ext;
        if(!format&&/\t/.test(trim.split(/\r?\n/)[0]||''))format='tsv';
        if(!format&&trim.includes('\n')&&(trim.split(/\r?\n/)[0]||'').includes(','))format='csv';
        if(!format)format=['md','markdown'].includes(ext)||/^#{1,6}\s|^```/m.test(trim)?'md':'txt';
        if(['json','yaml','toml','ini','jsonl','xml'].includes(format)){
          const D=await import('./data.mjs'),value=await D.parseData(text,format,prepared);Object.assign(details,C.dataCapabilities(value));
        }
        if(['csv','tsv'].includes(format)){const D=await import('./data.mjs');await D.readTables(file,{format});}
      }
      if(prepared.preparedFormat==='svg'){format='svg';details.preparedFormat='png';}
      if(['png','jpg','gif','webp','bmp','ico','tiff'].includes(format)||details.preparedFormat){const I=await import('./image.mjs');Object.assign(details,await I.imageInfo(file,details.preparedFormat||format));}
      if(['mp3','wav','ogg','opus','flac','aac','m4a','aiff','wma','amr','mp4','webm','mov','mkv','avi','flv','asf','mpeg','m4v','3gp','ogv','ts'].includes(format)){
        const M=await import('./media.mjs');Object.assign(details,await M.inspectMedia(file,format,progress));format=details.format;
      }
      result={format,...details};
    }else if(action==='zip'){
      const A=await import('./archive.mjs');result=[{name:'converted-files.zip',bytes:A.zip(entries),type:'application/zip'}];
    }else if(action==='merge-pdf'||action==='combine-images'){
      const P=await import('./pdf-write.mjs');result=action==='merge-pdf'?await P.mergePDF(files,options,progress):await P.imagesPDF(files,infos,options,progress);
    }else if(action==='media-diagnostics'){const M=await import('./media.mjs');result=await M.diagnostics();}
    else if(action==='convert'){
      if(target==='gz'){const A=await import('./archive.mjs');result=await A.convertArchive(file,info,target);}
      else if(options.engine==='image'){const I=await import('./image.mjs');result=await I.convertImage(file,info,target,options);}
      else if(options.engine==='archive'){const A=await import('./archive.mjs');result=await A.convertArchive(file,info,target);}
      else if(['data','data-table'].includes(options.engine)){const D=await import('./data.mjs');result=await D.convertData(file,info,target,options,prepared);}
      else if(options.engine==='sqlite'){const S=await import('./sqlite.mjs');result=await S.convertSQLite(file,info,target,options,prepared);}
      else if(['table','html-table'].includes(options.engine)){const D=await import('./data.mjs');result=await D.convertTable(file,info,target,options,prepared);}
      else if(options.engine==='media'){const M=await import('./media.mjs');result=await M.convertMedia(file,info,target,options,progress);}
      else if(options.engine==='image-pdf'){const P=await import('./pdf-write.mjs');result=await P.imagesPDF([file],[info],options,progress);}
      else if(options.engine==='pdf-edit'){const P=await import('./pdf-write.mjs');result=await P.editPDF(file,target,options,progress);}
      else if(options.engine==='document-pdf'){const P=await import('./pdf-write.mjs');result=[{name:C.stem(file.name)+'.pdf',bytes:await P.textPDF(prepared.plainText??C.decode(new Uint8Array(await file.arrayBuffer()))),type:'application/pdf'}];}
      else if(options.engine==='document'){
        if(info.format==='docx'){
          importScripts('./vendor/mammoth.browser.min.js');
          const value=await self.mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()},{externalFileAccess:false});
          result={html:value.value,messages:value.messages.map(item=>item.message)};
        }else if(info.format==='md'){
          const {marked}=await import('./vendor/marked.mjs');result={html:marked.parse(C.decode(new Uint8Array(await file.arrayBuffer())))};
        }else result={html:prepared.cleanHTML,plainText:prepared.plainText};
      }else throw new Error('This conversion has not been implemented.');
    }else throw new Error('Unknown converter operation.');
    const transfers=Array.isArray(result)?result.filter(o=>o.bytes?.buffer instanceof ArrayBuffer).map(o=>o.bytes.buffer):[];
    self.postMessage({id,event:'result',result},[...new Set(transfers)]);
  }catch(error){
    const fatal=/memory access out of bounds|out of memory|allocation failed|unreachable/i.test(error.message||'');
    self.postMessage({id,event:'error',fatal,message:fatal?'The media engine could not process this encoding within the browser’s memory limits. Try a smaller file, a shorter clip, or another format.':error.message||'Conversion failed.'});
  }
}
