import {orderedPages,stem,LIMITS} from './core.mjs';
import {pageLayout} from '../pdf-image-converter/core.mjs';
let pdfLib,fontkit,fontBytes;
function pdf(){if(!pdfLib){importScripts('../pdf-image-converter/vendor/pdf-lib.min.js');pdfLib=self.PDFLib;}return pdfLib;}
async function font(document){
  if(!fontkit){importScripts('./vendor/fontkit.min.js');fontkit=self.fontkit;}
  if(!fontBytes)fontBytes=new Uint8Array(await (await fetch(new URL('./vendor/NotoSans-Regular.ttf',import.meta.url))).arrayBuffer());
  document.registerFontkit(fontkit);return document.embedFont(fontBytes,{subset:true});
}
export async function textPDF(text){
  const P=pdf(),document=await P.PDFDocument.create(),face=await font(document),supported=new Set(face.getCharacterSet());
  const unsupported=[...new Set([...text.replace(/[\r\n\t]/g,'')].filter(char=>!supported.has(char.codePointAt(0))))];
  if(unsupported.length)throw new Error('The PDF font cannot display: '+unsupported.slice(0,8).join(' ')+' . Export TXT/HTML instead to preserve these characters.');
  let page=document.addPage([595.28,841.89]),y=792,pages=1;const size=11,lineHeight=16,maxWidth=499;
  const draw=line=>{if(y<48){if(++pages>200)throw new Error('This text needs more than 200 PDF pages.');page=document.addPage([595.28,841.89]);y=792;}if(line)page.drawText(line,{x:48,y,size,font:face});y-=lineHeight;};
  for(const paragraph of text.replace(/\r\n?/g,'\n').replace(/\t/g,'    ').split('\n')){
    let line='';
    for(const char of paragraph){if(face.widthOfTextAtSize(line+char,size)>maxWidth&&line){draw(line);line='';}line+=char;}
    draw(line);
  }
  return document.save();
}
export async function imagesPDF(files,infos,options,progress){
  const document=await pdf().PDFDocument.create();const {convertImage}=await import('./image.mjs');
  for(let i=0;i<files.length;i++){
    progress({message:`Adding image ${i+1} of ${files.length}…`,fraction:i/files.length});
    const [image]=await convertImage(files[i],infos[i],'png',options);
    const embedded=await document.embedPng(image.bytes);
    const layout=pageLayout(embedded.width,embedded.height,options.pageSize||'fit',options.orientation||'auto',Number(options.margin)||0);
    const page=document.addPage([layout.width,layout.height]);page.drawImage(embedded,{x:layout.x,y:layout.y,width:layout.imageWidth,height:layout.imageHeight});
  }
  return [{name:(options.name?stem(options.name):files.length>1?'combined-images':stem(files[0].name))+'.pdf',bytes:await document.save(),type:'application/pdf'}];
}
async function open(file){try{return await pdf().PDFDocument.load(await file.arrayBuffer());}catch(error){if(/encrypted/i.test(error.message))throw new Error('Encrypted PDFs cannot be edited or merged here. PDF image and text exports can use a known password.');throw new Error('This PDF is damaged or unsupported: '+error.message);}}
export async function mergePDF(files,options,progress){
  const result=await pdf().PDFDocument.create();let pages=0;
  for(let i=0;i<files.length;i++){progress({message:`Merging PDF ${i+1} of ${files.length}…`,fraction:i/files.length});const source=await open(files[i]);pages+=source.getPageCount();if(pages>500)throw new Error('Merge up to 500 pages at a time.');for(const page of await result.copyPages(source,source.getPageIndices()))result.addPage(page);}
  return [{name:stem(options.name||'merged-document')+'.pdf',bytes:await result.save(),type:'application/pdf'}];
}
export async function editPDF(file,target,options,progress){
  const P=pdf(),source=await open(file),pages=orderedPages(options.pages||'',source.getPageCount());
  if(target==='pdf-split'){
    const outputs=[];
    for(const [i,number] of pages.entries()){progress({message:`Splitting page ${number}…`,fraction:i/pages.length});const doc=await P.PDFDocument.create();const [page]=await doc.copyPages(source,[number-1]);doc.addPage(page);outputs.push({name:stem(file.name)+'-page-'+number+'.pdf',bytes:await doc.save(),type:'application/pdf'});}return outputs;
  }
  const result=await P.PDFDocument.create();let face;
  if(target==='pdf-watermark'||target==='pdf-number')face=await font(result);
  if(target==='pdf-watermark'){
    if(!options.watermark?.trim())throw new Error('Enter the watermark text.');
    const supported=new Set(face.getCharacterSet());if([...options.watermark].some(char=>!supported.has(char.codePointAt(0))))throw new Error('The watermark contains characters this font cannot display.');
  }
  for(const [i,number]of pages.entries()){
    const [page]=await result.copyPages(source,[number-1]);result.addPage(page);
    if(target==='pdf-rotate')page.setRotation(P.degrees((page.getRotation().angle+Number(options.rotation||90))%360));
    if(target==='pdf-number')page.drawText(`${i+1} / ${pages.length}`,{x:24,y:18,size:10,font:face,color:P.rgb(.3,.3,.3)});
    if(target==='pdf-watermark'){const size=Math.min(42,page.getWidth()/Math.max(1,face.widthOfTextAtSize(options.watermark,1))*.8);page.drawText(options.watermark,{x:Math.max(16,(page.getWidth()-face.widthOfTextAtSize(options.watermark,size))/2),y:page.getHeight()/2,font:face,size,color:P.rgb(.4,.4,.4),opacity:.22});}
    progress({message:`Processing page ${number}…`,fraction:(i+1)/pages.length});
  }
  return [{name:stem(file.name)+'-'+target.replace('pdf-','')+'.pdf',bytes:await result.save(),type:'application/pdf'}];
}
