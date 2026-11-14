import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const manifest=JSON.parse(readFileSync(new URL('../assets/terrain/manifest.json',import.meta.url),'utf8'));
function jpegSize(buffer){
 for(let offset=2;offset<buffer.length;){
  if(buffer[offset]!==255){offset++;continue;}
  const marker=buffer[offset+1];offset+=2;
  if(marker===216||marker===217)continue;
  const length=buffer.readUInt16BE(offset);
  if([192,193,194].includes(marker))return {width:buffer.readUInt16BE(offset+5),height:buffer.readUInt16BE(offset+3)};
  offset+=length;
 }
 throw Error('JPEG dimensions not found');
}
test('the native capture contains over five times the pixels of the previous map',()=>{
 assert.equal(manifest.width,11537);assert.equal(manifest.height,9544);
 assert.ok(manifest.width*manifest.height>5*5000*4196);
});
test('all pyramid tiles exist with correct edge dimensions and a matching preview',()=>{
 let count=0;
 for(const scale of manifest.scales){
  const width=Math.ceil(manifest.width/scale),height=Math.ceil(manifest.height/scale);
  for(let y=0;y<Math.ceil(height/manifest.tileSize);y++)for(let x=0;x<Math.ceil(width/manifest.tileSize);x++){
   const path=manifest.pattern.replace('{scale}',scale).replace('{x}',x).replace('{y}',y);
   const buffer=readFileSync(new URL('../assets/terrain/'+path,import.meta.url));
   assert.deepEqual(jpegSize(buffer),{width:Math.min(manifest.tileSize,width-x*manifest.tileSize),height:Math.min(manifest.tileSize,height-y*manifest.tileSize)},path);count++;
  }
 }
 assert.equal(count,159);
 assert.deepEqual(jpegSize(readFileSync(new URL('../assets/terrain/'+manifest.preview,import.meta.url))),{width:Math.ceil(manifest.width/manifest.previewScale),height:Math.ceil(manifest.height/manifest.previewScale)});
});
