export const LIMITS = {file:150*1024*1024, media:64*1024*1024, text:5*1024*1024, expanded:150*1024*1024, outputs:200*1024*1024, files:100, entries:500, pixels:16_000_000};
export const utf8 = new TextDecoder('utf-8', {fatal:true});
export const encode = text => new TextEncoder().encode(text);
export function decode(bytes) {
  if (bytes[0] === 255 && bytes[1] === 254) return new TextDecoder('utf-16le', {fatal:true}).decode(bytes);
  if (bytes[0] === 254 && bytes[1] === 255) return new TextDecoder('utf-16be', {fatal:true}).decode(bytes);
  try { return utf8.decode(bytes).replace(/^\uFEFF/, ''); }
  catch { throw new Error('Text must use UTF-8 or UTF-16 encoding. This file is binary or uses an unsupported text encoding.'); }
}
export function stem(name) { return name.replace(/\.(tar\.gz|[^.]+)$/i,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[. ]+$/,'').slice(0,110) || 'converted'; }
export function sizeLabel(bytes) { return bytes < 1024 ? `${bytes} B` : bytes < 1024**2 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1024**2).toFixed(2)} MB`; }
export function safePath(value) {
  if (!value || value.includes('\0') || value.includes('\\') || value.startsWith('/') || /^[a-z]:/i.test(value) || value.split('/').some(part => part === '..' || part === '.')) throw new Error('This archive contains an unsafe path and cannot be processed.');
  return value;
}
export function uniqueNames(outputs) {
  const names = new Set();
  return outputs.map(output => {
    let name = output.name, index = 2;
    while (names.has(name)) { const dot = output.name.lastIndexOf('.'); name = dot > 0 ? `${output.name.slice(0,dot)} (${index++})${output.name.slice(dot)}` : `${output.name} (${index++})`; }
    names.add(name); return {...output, name};
  });
}
export function orderedPages(value, total) {
  if (!value.trim()) {
    if (total > 100) throw new Error('Select up to 100 pages at a time.');
    return Array.from({length:total},(_,i)=>i+1);
  }
  const result = [], seen = new Set();
  for (const part of value.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Enter pages like 1, 3-5, or 5, 2, 1 to reorder.');
    const a=Number(match[1]), b=Number(match[2] || a);
    if(a<1 || a>total || b<1 || b>total || Math.abs(b-a)>99) throw new Error(`Choose up to 100 pages between 1 and ${total}.`);
    const step=b>=a?1:-1;
    for(let i=a;step>0?i<=b:i>=b;i+=step) { if(!seen.has(i)) { result.push(i);seen.add(i); } }
    if(result.length>100) throw new Error('Select up to 100 pages at a time.');
  }
  return result;
}
export function validateData(value) {
  let count=0;
  const ancestors = new Set();
  function walk(node, depth) {
    if (++count > 500000 || depth > 80) throw new Error('This data structure is too large or deeply nested.');
    if (typeof node === 'number' && !Number.isFinite(node)) throw new Error('Non-finite numbers cannot be represented reliably.');
    if (typeof node === 'bigint' || typeof node === 'undefined') throw new Error('This value cannot be represented without losing its type.');
    if (node && typeof node === 'object') {
      if(ancestors.has(node)) throw new Error('Circular references are not supported.');
      ancestors.add(node);
      for(const [key,child] of Object.entries(node)) {
        if(['__proto__','constructor','prototype'].includes(key)) throw new Error('Reserved object keys are not supported.');
        walk(child,depth+1);
      }
      ancestors.delete(node);
    }
  }
  walk(value,0);return value;
}
export function isTabular(value) {
  return Array.isArray(value) && value.length > 0 && value.every(row => (Array.isArray(row) || row && typeof row === 'object' && !(row instanceof Date))
    && Object.values(row).every(cell => cell == null || ['string','number','boolean'].includes(typeof cell)));
}
export function dataCapabilities(value) {
  const isObject=node=>node!==null&&typeof node==='object'&&!Array.isArray(node)&&!(node instanceof Date);
  const iniString=(key,val)=>!!key&&!/[\r\n=\[\]]/.test(key)&&typeof val==='string'&&!/[\r\n]/.test(val)&&val===val.trim();
  const canINI=isObject(value)&&Object.entries(value).every(([key,val])=>isObject(val)?!!key&&!/[\r\n\[\]]/.test(key)&&Object.entries(val).every(([k,v])=>iniString(k,v)):iniString(key,val));
  const noNull=node=>node!==null&&(!(node&&typeof node==='object')||Object.values(node).every(noNull));
  return {tabular:isTabular(value),canINI,canTOML:isObject(value)&&noNull(value),canJSONL:Array.isArray(value)};
}
export function rowsOf(value) {
  if (!isTabular(value)) throw new Error('This conversion requires a non-empty flat array of records or rows. Nested objects are not silently flattened.');
  if(value.every(Array.isArray))return value;
  if(value.some(Array.isArray))throw new Error('Use records or arrays consistently, not a mixture of both.');
  const keys=[...new Set(value.flatMap(Object.keys))];
  return [keys,...value.map(row=>keys.map(key=>row[key]??''))];
}
export function recordsOf(rows) {
  if (!rows.length) return [];
  const keys=rows[0].map(String);
  if(keys.some(key=>!key.trim()) || new Set(keys).size !== keys.length) throw new Error('A record export needs non-empty, unique column headings.');
  return rows.slice(1).map(row=>Object.fromEntries(keys.map((key,i)=>[key,row[i]??''])));
}
export function escapeHtml(text) { return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function sqlOf(rows, name='converted_data') {
  const records=recordsOf(rows),keys=rows[0].map(String),quote=name=>`"${name.replace(/"/g,'""')}"`;
  const literal=value=>value==null?'NULL':typeof value==='number'?String(value):typeof value==='boolean'?(value?'1':'0'):`'${String(value).replace(/'/g,"''")}'`;
  return `-- Generated INSERT statements; create a compatible table before running.\n`+records.map(row=>`INSERT INTO ${quote(name)} (${keys.map(quote).join(', ')}) VALUES (${keys.map(key=>literal(row[key])).join(', ')});`).join('\n')+'\n';
}
export function signature(bytes) {
  const ascii=(start,end)=>String.fromCharCode(...bytes.slice(start,end));
  if(ascii(0,5)==='%PDF-')return 'pdf';
  if(ascii(0,16)==='SQLite format 3\0')return 'sqlite';
  if(bytes[0]===137&&ascii(1,4)==='PNG')return 'png';
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg';
  if(ascii(0,6)==='GIF87a'||ascii(0,6)==='GIF89a')return 'gif';
  if(ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP')return 'webp';
  if(ascii(0,2)==='BM')return 'bmp';
  if(ascii(0,4)==='II*\0'||ascii(0,4)==='MM\0*')return 'tiff';
  if(bytes[0]===0&&bytes[1]===0&&bytes[2]===1&&bytes[3]===0)return 'ico';
  if(bytes[0]===80&&bytes[1]===75&&[3,5,7].includes(bytes[2]))return 'zip';
  if(bytes[0]===31&&bytes[1]===139)return 'gz';
  if(ascii(257,262)==='ustar')return 'tar';
  if(ascii(0,4)==='RIFF'&&ascii(8,12)==='WAVE')return 'wav';
  if(ascii(0,4)==='RIFF'&&ascii(8,12)==='AVI ')return 'avi';
  if(ascii(0,4)==='fLaC')return 'flac';
  if(ascii(0,4)==='OggS')return ascii(0,200).includes('OpusHead')?'opus':ascii(0,200).includes('theora')?'ogv':'ogg';
  if(ascii(0,4)==='FORM'&&['AIFF','AIFC'].includes(ascii(8,12)))return 'aiff';
  if(ascii(0,3)==='ID3'||bytes[0]===255&&(bytes[1]&0xe0)===0xe0&&((bytes[1]>>1)&3)!==0)return 'mp3';
  if(bytes[0]===255&&(bytes[1]&0xf6)===0xf0)return 'aac';
  if(ascii(4,8)==='ftyp') {
    const brand=ascii(8,12);
    if(['avif','avis','heic','heix','mif1','heif'].includes(brand))return 'unsupported-image';
    if(brand==='qt  ')return 'mov';
    if(brand.startsWith('M4A'))return 'm4a';
    if(brand.startsWith('M4V'))return 'm4v';
    if(brand.startsWith('3g'))return '3gp';
    return 'mp4';
  }
  if(bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3)return ascii(0,128).includes('webm')?'webm':'mkv';
  if(ascii(0,3)==='FLV')return 'flv';
  if(ascii(0,5)==='#!AMR')return 'amr';
  if(bytes[0]===0x30&&bytes[1]===0x26&&bytes[2]===0xb2&&bytes[3]===0x75)return 'asf';
  if(bytes[0]===0&&bytes[1]===0&&bytes[2]===1&&[0xba,0xb3].includes(bytes[3]))return 'mpeg';
  if(bytes[0]===0x47&&bytes[188]===0x47)return 'ts';
  if(ascii(0,4)==='8BPS'||ascii(0,4)==='DDS '||ascii(0,4)==='qoif'||ascii(0,4)==='v/1\x01')return 'unsupported-image';
  return null;
}
