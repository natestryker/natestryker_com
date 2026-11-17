import {categories,formats,imageInputs,compatible,searchCatalog,availableCatalog} from './catalog.mjs';
import {LIMITS,stem,sizeLabel,signature,decode,encode,uniqueNames} from './core.mjs';
import {ConverterWorker} from './client.mjs';
import {prepareFile,prepareText,parseXML,cleanHTML,htmlText,htmlDocument,markdown} from './documents.mjs';
import {readPDF} from './pdf-read.mjs';
import {timeRemaining} from './progress.mjs';

const $=id=>document.getElementById(id),worker=new ConverterWorker();
const state={files:[],outputs:[],zipUrl:null,busy:false,inspecting:false,canceled:false,preferred:null,category:'All',visible:18,control:null};
const capabilities={workers:typeof Worker==='function',wasm:typeof WebAssembly==='object',offscreen:typeof OffscreenCanvas==='function'&&typeof createImageBitmap==='function',webp:document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp')};
let nextFile=0,progressContext=null;
function message(text,error=false){if($('status').textContent!==text)$('status').textContent=text;$('status').classList.toggle('error',error);}
function progress(data){
  if(data.message)message(data.message);
  const fraction=Number.isFinite(data.fraction)?Math.max(0,Math.min(1,data.fraction)):null;
  const overall=fraction===null?null:progressContext?(progressContext.index+fraction)/progressContext.total:fraction;
  if(overall!==null){$('progress').max=1;$('progress').value=overall;}else $('progress').removeAttribute('value');
  $('progress-percent').textContent=overall===null?'':`${Math.floor(overall*100)}%`;
  $('progress-file').textContent=progressContext?.total>1?`File ${progressContext.index+1} of ${progressContext.total}`:'';
  const estimate=data.phase==='processing'?timeRemaining(data.remaining):data.phase==='finalizing'?'Finishing file…':'';
  $('progress-estimate').textContent=estimate&&progressContext?.total>1?`This file: ${estimate}`:estimate;
}
function resetProgress(context=null){progressContext=context;progress({fraction:null});}
function option(value,text){const node=document.createElement('option');node.value=value;node.textContent=text;return node;}
const outputLabel=target=>target==='jpg'?'JPG (.jpg)':target==='jpeg'?'JPEG (.jpeg)':formats[target]||target;
function choices(row){return row.info?compatible(row.info,capabilities):[];}
function selected(row){return choices(row).find(item=>item.target===row.target);}
function note(item,row){return item.warning+(row?.info?.format==='tiff'?' Multi-page TIFF input uses its first page only.':'')+(row?.info?.format==='svg'?' SVG is rasterized at its intrinsic size; scripts and external resources are removed.':'');}

function clearResults(){
  for(const output of state.outputs)URL.revokeObjectURL(output.url);state.outputs=[];
  if(state.zipUrl)URL.revokeObjectURL(state.zipUrl);state.zipUrl=null;
  $('result-grid').replaceChildren();$('results').hidden=true;$('zip-link').hidden=true;$('zip-link').removeAttribute('href');$('download-zip').hidden=false;
}
function controls(){
  const locked=state.busy||state.inspecting;
  for(const id of ['file-input','drop-zone','clear-files','settings'])$(id).disabled=locked;
  $('cancel').hidden=!locked;$('cancel').disabled=state.canceled;
  $('progress').hidden=!locked;
  $('progress-detail').hidden=!locked;
  const mode=$('batch-mode').value,count=state.files.filter(row=>selected(row)&&!row.error).length;
  $('convert').disabled=locked||!state.files.length||(mode==='each'&&!count);
  $('convert').textContent=state.busy?'Processing…':mode==='each'?count?`Convert ${count} file${count===1?'':'s'}`:'Convert files':mode==='combine-images'?'Create combined PDF':mode==='merge-pdf'?'Merge PDFs':'Create ZIP';
  renderFiles();
}
function fileButton(text,label,callback,disabled=false){const button=document.createElement('button');button.type='button';button.className='file-control';button.textContent=text;button.setAttribute('aria-label',label);button.disabled=disabled||state.busy||state.inspecting;button.addEventListener('click',callback);return button;}
function renderFiles(){
  $('file-list').replaceChildren();$('file-toolbar').hidden=!state.files.length;
  $('file-count').textContent=`${state.files.length} file${state.files.length===1?'':'s'} · ${sizeLabel(state.files.reduce((sum,row)=>sum+row.original.size,0))}`;
  state.files.forEach((row,index)=>{
    const item=document.createElement('li');item.className='file-item';item.dataset.fileId=row.id;
    const top=document.createElement('div');top.className='file-top';
    const number=document.createElement('span');number.className='file-number';number.textContent=String(index+1);
    const description=document.createElement('div');description.className='file-description';
    const name=document.createElement('strong');name.textContent=row.original.name;
    const detail=document.createElement('small');
    const format=row.info?(formats[row.info.format]||'Unrecognized / unsupported format'):'Inspecting contents…';
    detail.textContent=`${format} · ${sizeLabel(row.original.size)}`+(row.info?.width?` · ${row.info.width} × ${row.info.height}`:'')+(row.info?.duration?` · ${Math.floor(row.info.duration/60)}:${String(Math.floor(row.info.duration%60)).padStart(2,'0')}`:'');
    description.append(name,detail);const actions=document.createElement('div');actions.className='file-actions';
    const move=direction=>{const [entry]=state.files.splice(index,1);state.files.splice(index+direction,0,entry);clearResults();renderFiles();message('File order updated.');};
    actions.append(fileButton('↑',`Move up: ${row.original.name}`,()=>move(-1),index===0),fileButton('↓',`Move down: ${row.original.name}`,()=>move(1),index===state.files.length-1),fileButton('×',`Remove ${row.original.name}`,()=>{state.files=state.files.filter(file=>file!==row);clearResults();refresh();message('File removed.');}));
    top.append(number,description,actions);item.append(top);
    const bottom=document.createElement('div');bottom.className='file-bottom';
    if(row.info){
      const label=document.createElement('label');label.textContent='To';const select=document.createElement('select');select.setAttribute('aria-label',`Output for ${row.original.name}`);select.append(option('','Choose output…'));
      for(const item of choices(row))select.append(option(item.target,outputLabel(item.target)));
      select.value=row.target||'';select.disabled=state.busy||state.inspecting||$('batch-mode').value!=='each';
      select.addEventListener('change',()=>{row.target=select.value;row.error=null;row.status='Ready';clearResults();refresh();});label.append(select);bottom.append(label);
    }
    const status=document.createElement('span');status.className='file-state'+(row.error?' error':row.status==='Done'?' done':'');status.textContent=row.error||row.status||'Choose an output';bottom.append(status);item.append(bottom);
    const operation=selected(row);
    if(operation){const details=document.createElement('details');details.className='file-notes';const summary=document.createElement('summary');summary.textContent='Details';const copy=document.createElement('p');copy.textContent=note(operation,row);details.append(summary,copy);item.append(details);}
    $('file-list').append(item);
  });
}
function renderSettings(){
  const prior=$('batch-mode').value,ready=state.files.filter(row=>row.info&&!row.error),all=state.files.length&&ready.length===state.files.length;
  $('batch-mode').replaceChildren(option('each','Convert each file'));
  if(all&&ready.every(row=>imageInputs.includes(row.info.format)))$('batch-mode').append(option('combine-images','Combine into PDF'));
  if(all&&ready.length>1&&ready.every(row=>row.info.format==='pdf'))$('batch-mode').append(option('merge-pdf','Merge PDFs'));
  if(state.files.length)$('batch-mode').append(option('pack-zip','Create ZIP'));
  if([...$('batch-mode').options].some(o=>o.value===prior))$('batch-mode').value=prior;
  if(state.preferred?.batch&&[...$('batch-mode').options].some(o=>o.value===state.preferred.batch))$('batch-mode').value=state.preferred.batch;
  const mode=$('batch-mode').value,items=state.files.map(selected).filter(Boolean),engines=new Set(items.map(item=>item.engine)),targets=new Set(items.map(item=>item.target));
  const show=(id,value)=>{$(id).hidden=!value;};
  show('image-settings',engines.has('image')||engines.has('image-pdf')||items.some(item=>item.engine==='pdf-read'&&['jpg','jpeg','webp'].includes(item.target)));
  show('pdf-read-settings',engines.has('pdf-read'));show('pdf-pages-settings',engines.has('pdf-read')||engines.has('pdf-edit'));show('pdf-create-settings',engines.has('image-pdf')||mode==='combine-images');
  show('pdf-resolution-field',items.some(item=>item.engine==='pdf-read'&&['png','jpg','jpeg','webp','pdf-zip'].includes(item.target)));
  show('rotation-field',targets.has('pdf-rotate'));show('watermark-field',targets.has('pdf-watermark'));
  const audioTargets=['mp3','wav','ogg','flac','aac','m4a','aiff','audio-mp3','audio-wav'];
  show('media-settings',engines.has('media'));show('audio-settings',items.some(item=>item.engine==='media'&&audioTargets.includes(item.target)));
  show('video-settings',items.some(item=>item.engine==='media'&&!audioTargets.includes(item.target)));
  show('name-field',['combine-images','merge-pdf'].includes(mode));show('settings-empty',!items.length&&mode==='each');
  $('settings-empty').textContent=state.files.length?'Choose an output.':'Add a file.';
  const union=new Map();for(const row of ready)for(const item of choices(row))union.set(item.target,outputLabel(item.target));
  $('bulk-output').replaceChildren(option('','Choose a format…'),...[...union].sort((a,b)=>a[1].localeCompare(b[1])).map(([value,title])=>option(value,title)));
  show('bulk-field',ready.length>0&&mode==='each');
  const shortNotes={image:'Metadata removed; animations use the first frame. JPG/WebP are lossy.',
    'image-pdf':'First frame only. Image metadata removed.',
    'pdf-read':'Image exports flatten text. Text exports lose layout; no OCR.',
    'pdf-edit':'Forms and signatures may be lost.',
    'document-pdf':'Plain text only. Layout and images are removed.',
    document:'Formatting may change.',
    table:'Styles and formulas may be lost.',
    'html-table':'Table content only; no merged cells.',
    data:'Some data types may change.',
    'data-table':'Flat tables only. CSV loses data types.',
    sqlite:'Table values only; schema is not preserved.',
    media:'Quality, metadata and extra tracks may be lost.',
    archive:''};
  const notes=new Map();for(const row of state.files){const item=selected(row);if(item&&!notes.has(item.engine))notes.set(item.engine,shortNotes[item.engine]??note(item,row));}
  $('active-notes').textContent=mode==='combine-images'?'First frame only. Image metadata removed.':mode==='merge-pdf'?'Forms and signatures may be lost.':mode==='pack-zip'?'':[...notes.values()].filter(Boolean).join(' ');
  $('active-notes').hidden=!$('active-notes').textContent;
}
function refresh(){renderSettings();controls();}

async function addFiles(incoming){
  if(state.busy||state.inspecting){message('Wait for the current task, or cancel it before adding more files.');return;}
  const files=[...incoming];$('file-input').value='';if(!files.length)return;
  if(state.files.length+files.length>LIMITS.files){message('Choose up to 100 files at a time.',true);return;}
  if(files.some(file=>!file.size||file.size>LIMITS.file)){message('Files must be non-empty and 400 MB or less.',true);return;}
  if([...state.files.map(row=>row.original),...files].reduce((sum,file)=>sum+file.size,0)>LIMITS.file){message('Keep the batch total at 400 MB or less.',true);return;}
  clearResults();resetProgress();state.inspecting=true;state.canceled=false;controls();
  for(const original of files){
    if(state.canceled)break;
    const row={id:++nextFile,original,file:original,info:null,prepared:{},target:'',status:'Inspecting…',error:null};state.files.push(row);renderFiles();
    message(`Checking ${original.name}…`);
    try{
      const preparedFile=await prepareFile(original);row.file=preparedFile.file;row.prepared=preparedFile.prepared;
      if(state.canceled)break;
      const head=new Uint8Array(await row.file.slice(0,65536).arrayBuffer());
      if(!signature(head)&&!row.prepared.preparedFormat&&row.file.size<=LIMITS.text){
        const preview=new TextDecoder().decode(head).trim();
        if(preview.startsWith('<')&&!/^<!doctype\s+html|^<(?:html|body|table|p|div|h[1-6])\b/i.test(preview))row.prepared.xmlData=parseXML(decode(new Uint8Array(await row.file.arrayBuffer())));
      }
      row.info=await worker.call('inspect',{file:row.file,prepared:row.prepared},progress);
      if(state.canceled)break;
      Object.assign(row.prepared,await prepareText(row.file,row.info));
      if(row.info.format==='html')row.info.hasTables=!!row.prepared.tables?.length;
      if(state.preferred){const item=choices(row).find(item=>item.id===state.preferred.id);if(item)row.target=item.target;}
      row.status=row.target?'Ready':'Choose an output';
      if(row.info.mediaUnsupported)row.status='Unsupported media codec; compression is available';
    }catch(error){row.info??={format:'unknown'};row.error=error.name==='AbortError'?'Inspection canceled. Remove and re-add this file to retry.':error.message;row.status='Error';}
    renderFiles();
  }
  state.inspecting=false;refresh();message(state.canceled?'Inspection canceled.':'Choose an output format.');
}
function options(){return {quality:$('quality').value,width:$('image-width').value,background:$('background').value,resolution:$('resolution').value,password:$('pdf-password').value,pages:$('page-range').value,pageSize:$('page-size').value,orientation:$('orientation').value,margin:$('margin').value,rotation:$('rotation').value,watermark:$('watermark').value,start:$('start-time').value,duration:$('clip-duration').value,bitrate:$('bitrate').value,sampleRate:$('sample-rate').value,channels:$('channels').value,normalize:$('normalize').checked,videoWidth:$('video-width').value,fps:$('frame-rate').value,name:$('combined-name').value};}
async function runOne(row,settings){
  const active=()=>{if(state.canceled)throw new DOMException('Canceled','AbortError');};active();
  const operation=selected(row);if(!operation)throw new Error('Choose a compatible output format.');
  const payload={file:row.file,info:row.info,target:row.target,options:{...settings,engine:operation.engine},prepared:row.prepared};
  if(operation.engine==='pdf-read'){
    const outputs=await readPDF(row.file,row.target,settings,progress,state.control);
    if(row.target==='pdf-zip'){active();const result=await worker.call('zip',{entries:outputs},progress);result[0].name=stem(row.original.name)+'-pages.zip';return result;}return outputs;
  }
  if(operation.engine==='document-pdf'&&['md','docx'].includes(row.info.format)){
    const rendered=await worker.call('convert',{...payload,options:{...settings,engine:'document'}},progress);
    const clean=await cleanHTML(rendered.html);payload.prepared={...payload.prepared,plainText:htmlText(clean)};
  }
  active();
  const result=await worker.call('convert',payload,progress);
  if(operation.engine==='document'){
    const clean=await cleanHTML(result.html||row.prepared.cleanHTML||'');let text;
    if(row.target==='html')text=htmlDocument(clean,stem(row.original.name));
    else if(row.target==='md')text=await markdown(clean);else text=htmlText(clean);
    if(result.messages?.length)row.messages=result.messages;
    return [{name:stem(row.original.name)+'.'+row.target,bytes:encode(text),type:row.target==='html'?'text/html;charset=utf-8':'text/plain;charset=utf-8'}];
  }
  return result;
}
function keepOutputs(outputs){
  const current=state.outputs.reduce((sum,out)=>sum+out.blob.size,0),incoming=outputs.reduce((sum,out)=>sum+out.bytes.length,0);
  if(current+incoming>LIMITS.outputs)throw new Error('The batch outputs exceed 400 MB. Convert fewer files or choose a smaller output format.');
  if(state.outputs.length+outputs.length>LIMITS.entries)throw new Error('A batch can produce up to 500 outputs.');
  const renamed=uniqueNames([...state.outputs,...outputs]).slice(state.outputs.length);
  for(const output of renamed){const blob=new Blob([output.bytes],{type:output.type});state.outputs.push({name:output.name,type:output.type,blob,url:URL.createObjectURL(blob)});}
}
function showResults(){
  $('result-grid').replaceChildren();$('results').hidden=!state.outputs.length;
  $('results-summary').textContent=`${state.outputs.length} file${state.outputs.length===1?'':'s'} · ${sizeLabel(state.outputs.reduce((sum,out)=>sum+out.blob.size,0))} total`;
  state.outputs.forEach((output,index)=>{
    const card=document.createElement('article');card.className='result-card';
    if(index<12&&['image/png','image/jpeg','image/webp','image/gif'].includes(output.type)){const image=document.createElement('img');image.src=output.url;image.loading='lazy';image.alt=`Preview of ${output.name}`;card.append(image);}
    if(index<3&&output.type?.startsWith('audio/')){const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src=output.url;audio.setAttribute('aria-label',`Preview ${output.name}`);card.append(audio);}
    const title=document.createElement('strong');title.textContent=output.name;
    const size=document.createElement('small');size.textContent=sizeLabel(output.blob.size);
    const link=document.createElement('a');link.className='converter-button';link.href=output.url;link.download=output.name.split('/').pop();link.textContent='Download';link.setAttribute('aria-label',`Download ${output.name}`);
    card.append(title,size,link);$('result-grid').append(card);
  });
}
async function convert(){
  if(state.busy||state.inspecting)return;
  const settings=options(),mode=$('batch-mode').value,rows=mode==='each'?state.files.filter(row=>selected(row)&&!row.error):state.files;
  if(!rows.length)return;
  if(!$('settings').reportValidity())return;
  clearResults();resetProgress();state.busy=true;state.canceled=false;state.control={canceled:false,cancel:null};controls();let errors=0;
  try{
    if(mode!=='each'){
      message(mode==='pack-zip'?'Packaging original files…':'Preparing combined PDF…');
      let result;
      if(mode==='pack-zip'){
        const entries=await Promise.all(rows.map(async row=>({name:row.original.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-'),bytes:new Uint8Array(await row.original.arrayBuffer())})));
        if(state.canceled)throw new DOMException('Canceled','AbortError');result=await worker.call('zip',{entries},progress);
      }else result=await worker.call(mode,{files:rows.map(row=>row.file),infos:rows.map(row=>row.info),options:settings},progress);
      if(state.canceled)throw new DOMException('Canceled','AbortError');keepOutputs(result);for(const row of rows)row.status='Done';
    }else for(const [index,row]of rows.entries()){
      if(state.canceled)break;
      resetProgress({index,total:rows.length});row.status='Processing…';renderFiles();progress({message:`Converting ${row.original.name} (${index+1}/${rows.length})…`,fraction:0});
      try{const result=await runOne(row,settings);if(state.canceled)break;keepOutputs(result);row.status='Done';row.error=null;}
      catch(error){if(error.name==='AbortError'||state.canceled)break;row.error=error.message;row.status='Error';errors++;}
      renderFiles();await new Promise(resolve=>setTimeout(resolve,0));
    }
    showResults();message(state.canceled?`Conversion canceled. ${state.outputs.length} completed output${state.outputs.length===1?'':'s'} available.`:errors?`${state.outputs.length} output${state.outputs.length===1?'':'s'} ready. ${errors} file${errors===1?'':'s'} failed; see the messages beside their filenames.`:`${state.outputs.length} file${state.outputs.length===1?'':'s'} ready to download.`,errors>0);
  }catch(error){message(state.canceled?'Conversion canceled.':error.message,true);showResults();}
  finally{for(const row of state.files)if(row.status==='Processing…')row.status='Canceled';state.busy=false;state.control=null;controls();}
}

function renderCatalog(){
  const matches=searchCatalog($('catalog-search').value,state.category,capabilities);$('catalog-list').replaceChildren();
  $('catalog-total').textContent=`${searchCatalog('','All',capabilities).length} conversions`;
  $('catalog-status').textContent=matches.length?`${Math.min(state.visible,matches.length)} of ${matches.length}`:'No matches.';
  for(const item of matches.slice(0,state.visible)){
    const button=document.createElement('button');button.type='button';button.className='catalog-item';button.setAttribute('aria-pressed',String(state.preferred?.id===item.id));
    const copy=document.createElement('span'),title=document.createElement('strong'),arrow=document.createElement('span');
    title.textContent=item.title;arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');copy.append(title);button.append(copy,arrow);
    button.addEventListener('click',()=>{
      if(state.busy||state.inspecting){message('Finish or cancel the current task before selecting a conversion.');return;}
      if(state.preferred?.id===item.id){
        state.preferred=null;
        for(const row of state.files)if(row.target===item.target&&choices(row).some(choice=>choice.id===item.id)){row.target='';row.status=row.error?'Error':'Choose an output';}
        if(item.batch&&$('batch-mode').value===item.batch)$('batch-mode').value='each';
        clearResults();refresh();renderCatalog();message(`${item.title} deselected.`);return;
      }
      state.preferred=item;let changed=0;
      for(const row of state.files)if(choices(row).some(choice=>choice.id===item.id)){row.target=item.target;row.error=null;row.status='Ready';changed++;}
      clearResults();refresh();renderCatalog();message(changed?`${item.title} selected.`:`${item.title}: add ${item.batch==='merge-pdf'?'two or more PDFs':item.batch==='combine-images'?'images':item.batch==='pack-zip'?'files':formats[item.source]||'a file'}.`);
      $('workspace').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
    });$('catalog-list').append(button);
  }
  $('show-more').hidden=state.visible>=matches.length;
}
for(const category of categories){const button=document.createElement('button');button.type='button';button.className='converter-button';button.textContent=category;button.setAttribute('aria-pressed',String(category==='All'));button.addEventListener('click',()=>{state.category=state.category===category?'All':category;state.visible=18;for(const item of $('category-filters').children)item.setAttribute('aria-pressed',String(item.textContent===state.category));renderCatalog();});$('category-filters').append(button);}
$('catalog-search').addEventListener('input',()=>{state.visible=18;renderCatalog();});
$('show-more').addEventListener('click',()=>{state.visible+=18;renderCatalog();});
$('drop-zone').addEventListener('click',()=>$('file-input').click());
$('file-input').addEventListener('change',event=>addFiles(event.target.files));
$('drop-zone').addEventListener('dragover',event=>{event.preventDefault();if(!state.busy&&!state.inspecting)$('drop-zone').classList.add('dragging');});
$('drop-zone').addEventListener('dragleave',()=>$('drop-zone').classList.remove('dragging'));
$('drop-zone').addEventListener('drop',event=>{event.preventDefault();$('drop-zone').classList.remove('dragging');addFiles(event.dataTransfer.files);});
for(const type of ['dragover','drop'])window.addEventListener(type,event=>{if([...event.dataTransfer.types].includes('Files'))event.preventDefault();});
$('clear-files').addEventListener('click',()=>{state.files=[];$('pdf-password').value='';clearResults();refresh();message('');});
$('bulk-output').addEventListener('change',()=>{const target=$('bulk-output').value;if(!target)return;for(const row of state.files)if(choices(row).some(item=>item.target===target)){row.target=target;row.error=null;row.status='Ready';}clearResults();refresh();message(`${formats[target]} selected for compatible files.`);});
$('batch-mode').addEventListener('change',()=>{state.preferred=null;clearResults();refresh();});
$('convert').addEventListener('click',convert);
$('cancel').addEventListener('click',()=>{state.canceled=true;if(state.control){state.control.canceled=true;state.control.cancel?.();}worker.cancel();$('cancel').disabled=true;message('Canceling… Completed files will remain available.');});
$('download-zip').addEventListener('click',async()=>{
  if(state.busy||state.inspecting||!state.outputs.length)return;
  resetProgress();state.busy=true;state.canceled=false;controls();$('download-zip').disabled=true;
  try{
    message('Preparing ZIP…');const entries=await Promise.all(state.outputs.map(async output=>({name:output.name,bytes:new Uint8Array(await output.blob.arrayBuffer())})));
    if(state.canceled)throw new DOMException('Canceled','AbortError');
    const [result]=await worker.call('zip',{entries},progress);state.zipUrl=URL.createObjectURL(new Blob([result.bytes],{type:'application/zip'}));
    $('zip-link').href=state.zipUrl;$('zip-link').download='converted-files.zip';$('zip-link').hidden=false;$('download-zip').hidden=true;$('zip-link').click();message('ZIP ready.');
  }catch(error){message(state.canceled?'ZIP preparation canceled.':error.message,true);}
  finally{state.busy=false;$('download-zip').disabled=false;controls();}
});
window.addEventListener('pagehide',event=>{if(!event.persisted){worker.cancel();for(const output of state.outputs)URL.revokeObjectURL(output.url);if(state.zipUrl)URL.revokeObjectURL(state.zipUrl);}});
const notes=document.createElement('p');notes.id='active-notes';notes.className='converter-hint active-notes';notes.hidden=true;$('convert').before(notes);
renderCatalog();refresh();
if(!capabilities.workers){$('drop-zone').disabled=true;$('file-input').disabled=true;message('Your browser cannot run background workers. Use a current browser to convert files.',true);}
