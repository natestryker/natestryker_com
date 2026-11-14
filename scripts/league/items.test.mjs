import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {collectIds} from '../download-lol-item-icons.mjs';
import {loadItemManifest,itemIcon,itemBuild,itemSuggestions} from '../../assets/league/items.mjs';
import {optimizePng} from '../lib/png.mjs';
import {inflateSync,deflateSync,crc32} from 'node:zlib';

test('item scanner recognizes raw slots and compact index item arrays without empty IDs',()=>{
 const data={raw:{item0:3020,item1:3089,item6:0},index:{columns:['id','items'],rows:[['NA1_1',[3097,0,1001]]]},event:{itemId:3364}};
 assert.deepEqual([...collectIds(data)].sort(),['1001','3020','3089','3097','3364']);
});
test('icons use numeric IDs, local PNGs, names, lazy loading and safe fallbacks',async()=>{
 const manifest=await loadItemManifest(async url=>{assert.equal(url,'/assets/league/item-catalog.json');return Response.json({items:{3020:{name:"Sorcerer's Shoes",icon:'assets/league/items/3020.png'},9999:{name:'Unknown',icon:'https://example.invalid/tracking.png'}}});});
 assert.equal(manifest.items[9999].icon,null);
 const icon=itemIcon(3020,manifest.items);assert.match(icon,/assets\/league\/items\/3020.png/);assert.match(icon,/loading="lazy"/);assert.match(icon,/Sorcerer&#39;s Shoes/);
 assert.ok(!itemIcon(0,manifest.items).includes('<img'));
 assert.match(itemIcon(88888,manifest.items),/Item #88888/);
 assert.ok(!itemIcon(88888,manifest.items).includes('<img'));
 const build=itemBuild([3020,0,88888],manifest.items,{names:true});assert.match(build,/item-empty/);assert.match(build,/Sorcerer&#39;s Shoes/);
 assert.match(itemSuggestions('sorcerer boots',manifest.items),/data-item-choice="3020"/);
});
test('every generated manifest icon is a real local PNG and historical report has no missing IDs',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../../assets/league/item-manifest.json',import.meta.url)));
 const report=JSON.parse(await readFile(new URL('../../assets/league/item-icon-report.json',import.meta.url)));
 assert.ok(Object.keys(manifest.items).length>0);
 for(const [id,item] of Object.entries(manifest.items)){
   assert.equal(item.icon,`assets/league/items/${id}.png`);
   const png=await readFile(resolve(item.icon));
   assert.ok(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),id);
   assert.ok(png.readUInt32BE(16)>0 && png.readUInt32BE(20)>0,id);
 }
 assert.deepEqual(report.failedDownloads,[]);assert.deepEqual(report.unresolvedReferencedItemIds,[]);
 assert.equal(report.manifestItemCount,Object.keys(manifest.items).length);
});
test('compact item catalog preserves every name and falls back locally during deployment',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../../assets/league/item-manifest.json',import.meta.url)));
 const compact=JSON.parse(await readFile(new URL('../../assets/league/item-catalog.json',import.meta.url)));
 assert.deepEqual(compact.names,Object.fromEntries(Object.entries(manifest.items).map(([id,item])=>[id,item.name])));
 const requests=[];
 const loaded=await loadItemManifest(async url=>{requests.push(url);return requests.length===1?new Response('',{status:404}):Response.json(manifest);});
 assert.equal(Object.keys(loaded.items).length,Object.keys(manifest.items).length);
 assert.deepEqual(requests,['/assets/league/item-catalog.json','/assets/league/item-manifest.json']);
});
test('lossless PNG optimizer preserves decoded pixels, dimensions and every non-image chunk',async()=>{
 const original=await readFile(new URL('../../assets/league/items/3330.png',import.meta.url));
 function chunks(png){const rows=[];for(let i=8;i<png.length;){const length=png.readUInt32BE(i);rows.push({type:png.toString('ascii',i+4,i+8),data:png.subarray(i+8,i+8+length)});i+=length+12;}return rows;}
 const source=chunks(original),pixels=inflateSync(Buffer.concat(source.filter(x=>x.type==='IDAT').map(x=>x.data)));
 const uncompressed=source.filter(x=>x.type!=='IDAT');
 uncompressed.splice(1,0,{type:'IDAT',data:deflateSync(pixels,{level:0})});
 const fixture=Buffer.concat([original.subarray(0,8),...uncompressed.map(part=>{
   const body=Buffer.concat([Buffer.from(part.type),part.data]),length=Buffer.alloc(4),crc=Buffer.alloc(4);
   length.writeUInt32BE(part.data.length);crc.writeUInt32BE(crc32(body));return Buffer.concat([length,body,crc]);
 })]);
 const result=optimizePng(fixture),before=chunks(fixture),after=chunks(result);
 assert.ok(result.length<fixture.length/2);
 assert.deepEqual(before.filter(x=>x.type!=='IDAT'),after.filter(x=>x.type!=='IDAT'));
 assert.deepEqual(inflateSync(Buffer.concat(before.filter(x=>x.type==='IDAT').map(x=>x.data))),inflateSync(Buffer.concat(after.filter(x=>x.type==='IDAT').map(x=>x.data))));
 assert.deepEqual(optimizePng(result),result);
});
