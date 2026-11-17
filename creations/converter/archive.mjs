import {LIMITS, decode, encode, safePath, stem} from './core.mjs';
let zipLibrary;
const crcTable=Uint32Array.from({length:256},(_,value)=>{for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);return value>>>0;});
function lib() { if(!zipLibrary) { importScripts('../pdf-image-converter/vendor/fflate.js'); zipLibrary=self.fflate; } return zipLibrary; }
export function zipIndex(bytes) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), end=bytes.length;
  let eocd=-1;
  for(let i=end-22;i>=Math.max(0,end-65557);i--) if(view.getUint32(i,true)===0x06054b50) { eocd=i;break; }
  if(eocd<0)throw new Error('Invalid ZIP: its directory could not be read.');
  if(view.getUint16(eocd+4,true)||view.getUint16(eocd+6,true))throw new Error('Multi-volume ZIP archives are not supported.');
  const count=view.getUint16(eocd+10,true), start=view.getUint32(eocd+16,true);
  if(count===65535||start===0xffffffff)throw new Error('ZIP64 archives are not supported.');
  if(count>LIMITS.entries)throw new Error(`Use an archive with at most ${LIMITS.entries} entries.`);
  let offset=start,total=0;const entries=[],names=new Set();
  for(let i=0;i<count;i++) {
    if(offset+46>end||view.getUint32(offset,true)!==0x02014b50)throw new Error('Invalid ZIP directory.');
    const flags=view.getUint16(offset+8,true),method=view.getUint16(offset+10,true), size=view.getUint32(offset+24,true), n=view.getUint16(offset+28,true),extra=view.getUint16(offset+30,true),comment=view.getUint16(offset+32,true);
    if(flags&1)throw new Error('Encrypted ZIP archives are not supported.');
    if(![0,8].includes(method))throw new Error('This ZIP uses a compression method that is not supported.');
    if(offset+46+n+extra+comment>end)throw new Error('Truncated ZIP directory.');
    const path=safePath(decode(bytes.slice(offset+46,offset+46+n)));
    if(names.has(path))throw new Error('This ZIP contains duplicate paths.');names.add(path);
    const mode=view.getUint32(offset+38,true)>>>16;
    if((mode&0xf000)===0xa000)throw new Error('Archives containing symbolic links are not supported.');
    total+=size;
    if(total>LIMITS.expanded)throw new Error('This archive expands beyond the 150 MB safety limit.');
    entries.push({path,size,crc:view.getUint32(offset+16,true)});offset+=46+n+extra+comment;
  }
  return entries;
}
export function unzip(bytes) {
  const index=zipIndex(bytes),entries=lib().unzipSync(bytes),out=[];
  for(const item of index) {
    if(item.path.endsWith('/'))continue;
    const bytes=entries[item.path];
    if(!bytes||bytes.length!==item.size)throw new Error('ZIP contents do not match its directory.');
    let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);
    if(((crc^0xffffffff)>>>0)!==item.crc)throw new Error('ZIP checksum mismatch: the archive may be damaged.');
    out.push({name:item.path,bytes});
  }
  return out;
}
export function zip(entries) {
  if(entries.length>LIMITS.entries)throw new Error('Too many files for one ZIP.');
  const files=Object.create(null);let total=0;
  for(const entry of entries) { safePath(entry.name);total+=entry.bytes.length;if(total>LIMITS.outputs)throw new Error('Outputs are too large to package.');files[entry.name]=entry.bytes; }
  return lib().zipSync(files,{level:0});
}
export function gunzip(bytes) {
  const chunks=[];let total=0;
  const stream=new (lib().Gunzip)((chunk)=>{total+=chunk.length;if(total>LIMITS.expanded)throw new Error('This compressed file expands beyond 150 MB.');chunks.push(chunk);});
  for(let offset=0;offset<bytes.length;offset+=16384)stream.push(bytes.subarray(offset,offset+16384),offset+16384>=bytes.length);
  const result=new Uint8Array(total);let at=0;for(const chunk of chunks){result.set(chunk,at);at+=chunk.length;}return result;
}
export function gzip(bytes) { return lib().gzipSync(bytes,{level:6,mtime:0}); }
function tarNumber(bytes) { const text=new TextDecoder().decode(bytes).replace(/\0/g,'').trim();if(!/^[0-7]*$/.test(text))throw new Error('Unsupported TAR numeric header.');return parseInt(text||'0',8); }
function tarText(bytes) { const end=bytes.indexOf(0);return decode(end<0?bytes:bytes.subarray(0,end)); }
export function untar(bytes) {
  let offset=0,total=0;const out=[],seen=new Set();
  while(offset+512<=bytes.length) {
    const header=bytes.subarray(offset,offset+512);if(header.every(b=>b===0))break;
    const expected=tarNumber(header.subarray(148,156));let checksum=0;for(let i=0;i<512;i++)checksum+=i>=148&&i<156?32:header[i];
    if(checksum!==expected)throw new Error('Invalid TAR checksum.');
    const prefix=tarText(header.subarray(345,500)),path=safePath((prefix?prefix+'/':'')+tarText(header.subarray(0,100)));
    const size=tarNumber(header.subarray(124,136)),type=header[156];
    if(![0,48,53].includes(type))throw new Error('This TAR uses links, extended headers or special records. Only USTAR files and directories are supported.');
    if(offset+512+size>bytes.length)throw new Error('Truncated TAR archive.');
    if(type!==53) {
      if(seen.has(path))throw new Error('Duplicate TAR paths are not supported.');seen.add(path);
      total+=size;if(total>LIMITS.expanded||out.length>=LIMITS.entries)throw new Error('This TAR exceeds the extraction limits (150 MB / 500 files).');
      out.push({name:path,bytes:bytes.slice(offset+512,offset+512+size)});
    }
    offset+=512+Math.ceil(size/512)*512;
  }
  if(!out.length)throw new Error('This TAR has no regular files to extract.');return out;
}
export function tar(entries) {
  const total=entries.reduce((sum,e)=>sum+512+Math.ceil(e.bytes.length/512)*512,1024);
  if(total>LIMITS.outputs)throw new Error('The TAR output is too large.');
  const bytes=new Uint8Array(total);let offset=0;
  const write=(header,at,length,text)=>{const data=encode(text);if(data.length>length)throw new Error('An archive filename is too long for USTAR.');header.set(data,at);};
  const oct=(value,length)=>value.toString(8).padStart(length-1,'0')+'\0';
  for(const entry of entries) {
    safePath(entry.name);let name=entry.name,prefix='';
    if(encode(name).length>100){const slash=name.lastIndexOf('/');if(slash<0)throw new Error('A filename is too long for TAR.');prefix=name.slice(0,slash);name=name.slice(slash+1);}
    const header=bytes.subarray(offset,offset+512);
    write(header,0,100,name);write(header,100,8,'0000644\0');write(header,108,8,'0000000\0');write(header,116,8,'0000000\0');write(header,124,12,oct(entry.bytes.length,12));write(header,136,12,'00000000000\0');
    header.fill(32,148,156);header[156]=48;write(header,257,6,'ustar\0');write(header,263,2,'00');write(header,345,155,prefix);
    const checksum=header.reduce((a,b)=>a+b,0);write(header,148,8,checksum.toString(8).padStart(6,'0')+'\0 ');
    bytes.set(entry.bytes,offset+512);offset+=512+Math.ceil(entry.bytes.length/512)*512;
  }
  return bytes;
}
export async function convertArchive(file, info, target) {
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(target==='gz')return [{name:file.name+'.gz',bytes:gzip(bytes),type:'application/gzip'}];
  if(target==='unpack')return [{name:file.name.replace(/\.gz$/i,'')||'decompressed-file',bytes:gunzip(bytes),type:'application/octet-stream'}];
  const expanded=info.format==='tgz'?gunzip(bytes):bytes;
  const entries=info.format==='zip'?unzip(expanded):untar(expanded);
  if(target==='extract')return entries.map(e=>({...e,type:'application/octet-stream'}));
  if(target==='zip')return [{name:stem(file.name)+'.zip',bytes:zip(entries),type:'application/zip'}];
  const packed=tar(entries);
  return [{name:stem(file.name)+(target==='tgz'?'.tar.gz':'.tar'),bytes:target==='tgz'?gzip(packed):packed,type:target==='tgz'?'application/gzip':'application/x-tar'}];
}
