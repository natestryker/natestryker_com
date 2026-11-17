import {decode,escapeHtml,LIMITS,validateData} from './core.mjs';
let purifierPromise,turndownPromise;
function script(path,globalName){return new Promise((resolve,reject)=>{const tag=document.createElement('script');tag.src=new URL(path,import.meta.url);tag.onload=()=>resolve(window[globalName]);tag.onerror=()=>reject(new Error('A document library could not load. Refresh and try again.'));document.head.append(tag);});}
async function purifier(){return purifierPromise??=script('./vendor/purify.min.js','DOMPurify');}
export async function cleanHTML(html,svg=false){
  if(html.length>12*1024*1024)throw new Error('The generated markup is too large to process safely.');
  const purify=await purifier();
  let clean=purify.sanitize(html,{USE_PROFILES:svg?{svg:true,svgFilters:true}:{html:true},FORBID_TAGS:['script','style','iframe','object','embed','link','meta','base','foreignObject','form','input','video','audio','source'],FORBID_ATTR:['srcset','ping'],ALLOW_DATA_ATTR:false});
  const doc=new DOMParser().parseFromString(clean,svg?'image/svg+xml':'text/html');
  if(svg&&doc.querySelector('parsererror'))throw new Error('This SVG could not be parsed.');
  for(const node of doc.querySelectorAll('*')){
    for(const attr of [...node.attributes]){
      const name=attr.name.toLowerCase(),value=attr.value.trim();
      if(name.startsWith('on')||name==='style'&&/url\s*\(\s*['"]?(?!#)|@import|expression\s*\(/i.test(value))node.removeAttribute(attr.name);
      else if(['src','href','xlink:href'].includes(name)){
        const image=/^(?:img|image)$/i.test(node.tagName),local=value.startsWith('#'),embedded=/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(value);
        if(image?!embedded&&!local:svg?!local:!local)node.removeAttribute(attr.name);
      }else if(/url\s*\(\s*['"]?(?!#)/i.test(value))node.removeAttribute(attr.name);
    }
  }
  return svg?new XMLSerializer().serializeToString(doc.documentElement):doc.body.innerHTML;
}
export function htmlText(html){
  const doc=new DOMParser().parseFromString(html,'text/html');
  for(const node of doc.querySelectorAll('br'))node.replaceWith('\n');
  for(const node of doc.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,tr,blockquote,pre'))node.append('\n');
  for(const node of doc.querySelectorAll('td,th'))node.append('\t');
  return (doc.body.textContent||'').replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
export async function markdown(html){
  const Service=await(turndownPromise??=script('./vendor/turndown.js','TurndownService'));
  return new Service({headingStyle:'atx',codeBlockStyle:'fenced'}).turndown(html)+'\n';
}
export function htmlDocument(body,title='Converted document'){return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHtml(title)+'</title></head><body>\n'+body+'\n</body></html>\n';}
export function parseXML(text){
  if(/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error('XML declarations containing DTDs or entities are not supported.');
  const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw new Error('This XML file is invalid.');
  function typed(node,depth=0){
    if(depth>80)throw new Error('XML nesting is too deep.');
    const type=node.getAttribute('type');
    if(type==='array')return [...node.children].map(child=>typed(child,depth+1));
    if(type==='object')return Object.fromEntries([...node.children].map(child=>{if(!child.hasAttribute('key'))throw new Error('Invalid typed XML object.');return [child.getAttribute('key'),typed(child,depth+1)];}));
    if(type==='null')return null;
    if(type==='boolean'){if(!['true','false'].includes(node.textContent))throw new Error('Invalid XML boolean.');return node.textContent==='true';}
    if(type==='number'){if(!node.textContent.trim())throw new Error('Invalid XML number.');const value=Number(node.textContent);if(!Number.isFinite(value))throw new Error('Invalid XML number.');return value;}
    if(type==='string')return node.textContent;
    throw new Error('Unrecognized typed XML value.');
  }
  function ordinary(node,depth=0){
    if(depth>80)throw new Error('XML nesting is too deep.');
    const children=[...node.children],attrs=Object.fromEntries([...node.attributes].map(a=>['@'+a.name,a.value]));
    if(!children.length&&!Object.keys(attrs).length)return node.textContent;
    const out=attrs;
    for(const child of children){const value=ordinary(child,depth+1);if(Object.hasOwn(out,child.tagName)){if(!Array.isArray(out[child.tagName]))out[child.tagName]=[out[child.tagName]];out[child.tagName].push(value);}else out[child.tagName]=value;}
    const text=[...node.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim();if(text)out['#text']=text;return out;
  }
  const root=doc.documentElement;
  return validateData(root.tagName==='converted-data'&&root.getAttribute('version')==='1'?typed(root.firstElementChild):{[root.tagName]:ordinary(root)});
}
export function htmlTables(html){
  const doc=new DOMParser().parseFromString(html,'text/html');
  return [...doc.querySelectorAll('table')].map(table=>{
    const rows=[...table.rows];if(rows.length>100000)throw new Error('This HTML table has too many rows.');
    return rows.map(row=>[...row.cells].map(cell=>{if(cell.colSpan>1||cell.rowSpan>1)throw new Error('HTML tables with merged cells are not supported; simplify the table first.');return cell.textContent.trim();}));
  });
}
export async function prepareFile(file){
  const head=new TextDecoder().decode(await file.slice(0,4096).arrayBuffer()).trim();
  if(!/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[^]*?-->\s*)?<svg\b/i.test(head))return {file,prepared:{}};
  if(file.size>LIMITS.text)throw new Error('SVG files must be 5 MB or less.');
  const source=decode(new Uint8Array(await file.arrayBuffer()));
  if(/<!DOCTYPE|<!ENTITY/i.test(source))throw new Error('SVG files with DTDs or entity declarations are not supported.');
  const clean=await cleanHTML(source,true),doc=new DOMParser().parseFromString(clean,'image/svg+xml'),root=doc.documentElement;
  if(root.tagName.toLowerCase()!=='svg')throw new Error('Invalid SVG image.');
  const view=root.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number);
  const dimension=value=>{if(!value)return 0;const match=value.match(/^([\d.]+)(?:px)?$/);return match?Number(match[1]):0;};
  const width=dimension(root.getAttribute('width'))||view?.[2]||300,height=dimension(root.getAttribute('height'))||view?.[3]||150;
  if(!(width>0&&height>0)||width*height>LIMITS.pixels||Math.max(width,height)>16384)throw new Error('SVG rasterization is limited to 16 megapixels.');
  root.setAttribute('width',String(Math.round(width)));root.setAttribute('height',String(Math.round(height)));
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(root)],{type:'image/svg+xml'})),image=new Image();let canvas;
  try{
    image.src=url;await image.decode();canvas=document.createElement('canvas');canvas.width=Math.round(width);canvas.height=Math.round(height);canvas.getContext('2d').drawImage(image,0,0);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not rasterize this SVG.')),'image/png'));
    return {file:new File([blob],file.name,{type:'image/png',lastModified:file.lastModified}),prepared:{preparedFormat:'svg'}};
  }finally{URL.revokeObjectURL(url);image.src='';if(canvas)canvas.width=canvas.height=0;}
}
export async function prepareText(file,info){
  if(!['xml','html','txt','md'].includes(info.format))return {};
  if(file.size>LIMITS.text)throw new Error('Text and markup files must be 5 MB or less.');
  const text=decode(new Uint8Array(await file.arrayBuffer()));
  if(info.format==='xml')return {xmlData:parseXML(text)};
  if(info.format==='html'){const clean=await cleanHTML(text);let tables=[];try{tables=htmlTables(clean);}catch{}return {cleanHTML:clean,plainText:htmlText(clean),tables};}
  if(info.format==='txt')return {plainText:text,cleanHTML:'<pre><code>'+escapeHtml(text)+'</code></pre>'};
  return {};
}
