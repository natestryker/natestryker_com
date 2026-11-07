import {inflateSync,deflateSync} from 'node:zlib';
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const table=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function chunk(type,data){
  const name=Buffer.from(type),body=Buffer.concat([name,data]);let crc=0xffffffff;
  for(const byte of body)crc=table[(crc^byte)&255]^(crc>>>8);
  const header=Buffer.alloc(4),trailer=Buffer.alloc(4);header.writeUInt32BE(data.length);trailer.writeUInt32BE((crc^0xffffffff)>>>0);
  return Buffer.concat([header,body,trailer]);
}
export function optimizePng(input){
  if(!input.subarray(0,8).equals(signature))throw new Error('Not a PNG');
  const parts=[];let offset=8;
  while(offset<input.length){
    const length=input.readUInt32BE(offset),end=offset+12+length;
    if(end>input.length)throw new Error('Truncated PNG chunk');
    parts.push({type:input.toString('ascii',offset+4,offset+8),bytes:input.subarray(offset,end),data:input.subarray(offset+8,end-4)});offset=end;
  }
  const compressed=Buffer.concat(parts.filter(p=>p.type==='IDAT').map(p=>p.data));
  if(!compressed.length)throw new Error('PNG has no image data');
  const pixels=inflateSync(compressed,{maxOutputLength:64*1024*1024}),optimized=deflateSync(pixels,{level:9});
  // Original filtered pixel bytes, dimensions, color profiles and metadata are unchanged.
  if(!inflateSync(optimized).equals(pixels))throw new Error('PNG optimization changed image data');
  let emitted=false;const result=[signature];
  for(const part of parts){if(part.type!=='IDAT')result.push(part.bytes);else if(!emitted){result.push(chunk('IDAT',optimized));emitted=true;}}
  const output=Buffer.concat(result);return output.length<input.length?output:input;
}
