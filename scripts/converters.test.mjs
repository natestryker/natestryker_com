import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePages, pageLayout, filename} from '../creations/pdf-image-converter/core.mjs';
import {signature, orderedPages, safePath, uniqueNames, dataCapabilities, rowsOf, recordsOf, sqlOf, validateData} from '../creations/converter/core.mjs';
import {catalog, compatible, searchCatalog} from '../creations/converter/catalog.mjs';
import {tar, untar, zipIndex} from '../creations/converter/archive.mjs';
import {mediaDuration,MediaProgress,timeRemaining} from '../creations/converter/progress.mjs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('media progress estimates the selected clip rather than the full source duration',()=>{
  assert.equal(mediaDuration({duration:3600},{start:120,duration:60}),60);
  assert.equal(mediaDuration({duration:3600},{start:3500,duration:600}),100);
  assert.equal(mediaDuration({duration:3600},{}),3600);
  let clock=0;const estimate=new MediaProgress(60,()=>clock);
  assert.equal(estimate.update(0).remaining,null,'No estimate before encoding starts');
  clock=2000;assert.equal(estimate.update(10e6).remaining,null,'Allow a warm-up period');
  clock=10000;let update=estimate.update(20e6);
  assert.equal(update.fraction,1/3);assert.equal(update.remaining,20);
  clock=30000;update=estimate.update(40e6);
  assert.equal(update.fraction,2/3);assert.equal(update.remaining,15,'Estimate adapts to actual speed');
  assert.equal(estimate.update(-1).fraction,2/3,'Timestamps cannot move progress backward');
  update=estimate.update(90e6);assert.equal(update.fraction,.99);assert.equal(update.phase,'finalizing');assert.equal(update.remaining,null);
});

test('unknown media duration stays indeterminate and each encoding gets a fresh estimate',()=>{
  let clock=0;const unknown=new MediaProgress(0,()=>clock);clock=10000;
  assert.deepEqual(unknown.update(20e6),{fraction:null,remaining:null,phase:'processing'});
  const next=new MediaProgress(100,()=>clock);
  assert.equal(next.update(NaN).fraction,0);assert.equal(next.update(10e6).remaining,null);
  assert.equal(timeRemaining(null),'Estimating time remaining…');
  assert.equal(timeRemaining(Infinity),'Estimating time remaining…');
  assert.equal(timeRemaining(25),'Less than a minute remaining');
  assert.equal(timeRemaining(121),'About 3 min remaining');
  assert.equal(timeRemaining(3660),'About 1 hr 1 min remaining');
});

test('long media jobs have no client timeout and remain cancelable',async()=>{
  const source=await readFile(new URL('../creations/converter/client.mjs',import.meta.url),'utf8');
  const timers=new Set(),workers=[];
  const context={URL,DOMException,setTimeout:callback=>{timers.add(callback);return callback;},clearTimeout:timer=>timers.delete(timer),Worker:class{
    constructor(){workers.push(this);}
    postMessage(data){this.request=data;}
    terminate(){this.terminated=true;}
  }};
  vm.runInNewContext(source.replace('export class','class').replace('import.meta.url',JSON.stringify(new URL('../creations/converter/client.mjs',import.meta.url).href))+';globalThis.client=new ConverterWorker();',context);
  const media=context.client.call('convert',{options:{engine:'media'}});
  assert.equal(timers.size,0,'A multi-hour encoding must not arm the four-minute watchdog');
  context.client.cancel();await assert.rejects(media,{name:'AbortError'});assert.equal(workers[0].terminated,true);
  const next=context.client.call('inspect',{});assert.equal(workers.length,2);assert.equal(timers.size,1);
  workers[1].onmessage({data:{id:workers[1].request.id,event:'result',result:{format:'mp4'}}});
  assert.equal((await next).format,'mp4');assert.equal(timers.size,0,'Completed requests clear their timer');
});

test('page selection deduplicates ranges and rejects nonexistent or excessive pages', () => {
  assert.deepEqual(parsePages('5, 1, 3-5', 8), [1, 3, 4, 5]);
  assert.deepEqual(parsePages('', 3), [1, 2, 3]);
  assert.deepEqual(parsePages('150-152', 200), [150, 151, 152]);
  for (const value of ['0', '9', '5-2', '1,', 'one', '1-900000000000', '-1', '1.5']) assert.throws(() => parsePages(value, 8));
  assert.throws(() => parsePages('', 101), /100 pages/);
  assert.throws(() => parsePages('1-101', 200), /100 pages/);
});

test('PDF page fitting preserves aspect ratio within margins and selects orientation per image', () => {
  for (const [width, height] of [[1600, 900], [900, 1600], [1000, 1000]]) {
    for (const size of ['a4', 'letter']) {
      const layout = pageLayout(width, height, size, 'auto', 36);
      assert.ok(layout.x >= 36 - 1e-8 && layout.y >= 36 - 1e-8);
      assert.ok(layout.x + layout.imageWidth <= layout.width - 36 + 1e-8);
      assert.ok(layout.y + layout.imageHeight <= layout.height - 36 + 1e-8);
      assert.ok(Math.abs(layout.imageWidth / layout.imageHeight - width / height) < 1e-8);
      assert.equal(layout.width > layout.height, width > height);
    }
  }
  assert.deepEqual(pageLayout(800, 400, 'fit', 'auto', 18), {width:600, height:300, x:0, y:0, imageWidth:600, imageHeight:300});
  assert.throws(() => pageLayout(0, 100, 'fit', 'auto', 0));
});

test('download filenames keep text safe for local files without losing Unicode', () => {
  assert.equal(filename('summer.photo.JPG'), 'summer.photo');
  assert.equal(filename('summer.final'), 'summer.final');
  assert.equal(filename('résumé.pdf'), 'résumé');
  assert.equal(filename('a/b:c?.pdf'), 'a-b-c-');
  assert.equal(filename(' .pdf', 'images'), 'images');
  assert.equal(filename('a'.repeat(200)).length, 100);
});

test('hub detects formats from bytes rather than the filename', () => {
  const bytes=text=>new TextEncoder().encode(text);
  assert.equal(signature(bytes('%PDF-1.7\n')), 'pdf');
  assert.equal(signature(new Uint8Array([137,80,78,71,13,10,26,10])), 'png');
  assert.equal(signature(bytes('RIFF....WEBP')), 'webp');
  assert.equal(signature(bytes('SQLite format 3\0')), 'sqlite');
  assert.equal(signature(bytes('not a PDF')), null);
});

test('hub preserves requested PDF page order while bounding ranges', () => {
  assert.deepEqual(orderedPages('5, 2, 1-3, 5', 5), [5,2,1,3]);
  assert.deepEqual(orderedPages('3-1',3),[3,2,1]);
  assert.throws(()=>orderedPages('1-999999999',10));
  assert.throws(()=>orderedPages('0',10));
  assert.throws(()=>orderedPages('',101));
});

test('registry offers only data destinations compatible with the inspected shape', () => {
  const info={format:'json',...dataCapabilities({a:null,b:true})};
  const targets=compatible(info,{}).map(item=>item.target);
  assert.ok(!targets.includes('ini'));assert.ok(!targets.includes('toml'));assert.ok(!targets.includes('jsonl'));assert.ok(!targets.includes('csv'));
  assert.ok(targets.includes('yaml'));assert.ok(targets.includes('xml'));
  const rows={format:'json',...dataCapabilities([{id:'001',value:2}])};
  assert.ok(compatible(rows,{}).some(item=>item.target==='csv'));
  const silent={format:'mp4',hasAudio:false,hasVideo:true};
  assert.ok(!compatible(silent,{}).some(item=>item.target==='mp3'));
  assert.ok(!compatible({format:'png'},{webp:false}).some(item=>item.target==='webp'));
  assert.equal(compatible({format:'csv'},{workers:false}).length,0);
  assert.ok(!compatible({format:'csv'},{wasm:false}).some(item=>item.target==='sqlite'));
  assert.ok(!compatible({format:'html',hasTables:false},{}).some(item=>item.engine==='html-table'));
});

test('catalog search handles JPEG aliases, arrows and category filters', () => {
  assert.ok(searchCatalog('JPEG to PNG','Images',{}).some(item=>item.source==='jpg'&&item.target==='png'));
  assert.equal(searchCatalog('JPEG to PNG','Images',{}).length,1);
  assert.ok(searchCatalog('MP4 → MP3','Audio',{}).some(item=>item.id==='mp4:mp3'));
  assert.equal(searchCatalog('HEIC','All',{}).length,0);
  assert.ok(searchCatalog('merge PDF','PDFs',{}).some(item=>item.batch==='merge-pdf'));
  assert.ok(searchCatalog('normalize audio','Audio',{}).some(item=>item.target==='audio-mp3'));
  assert.ok(searchCatalog('PDF to JSON','PDFs',{}).some(item=>item.target==='pdf-json'));
  assert.ok(searchCatalog('images to PDF','PDFs',{}).some(item=>item.batch==='combine-images'));
  assert.equal(new Set(catalog.map(item=>item.id)).size,catalog.length,'Conversion IDs must be unique');
});

test('tabular data rejects silent flattening and SQL escapes identifiers and values', () => {
  assert.deepEqual(rowsOf([{id:'001',name:"O'Brien"}]),[['id','name'],['001',"O'Brien"]]);
  assert.throws(()=>rowsOf([{nested:{value:1}}]));
  assert.throws(()=>recordsOf([['name','name'],['a','b']]));
  assert.match(sqlOf([['value'],["x'); DROP TABLE users; --"]]),/x''\); DROP TABLE users; --/);
  assert.throws(()=>validateData(JSON.parse('{"__proto__":{"polluted":true}}')));
  const circle={};circle.self=circle;assert.throws(()=>validateData(circle));
});

test('archive paths reject traversal and TAR round trips retain exact file bytes', () => {
  for(const path of ['../x','a/../../x','/etc/passwd','C:/file','a\\b','a/./b','x\0y'])assert.throws(()=>safePath(path));
  const entries=[{name:'folder/hello.txt',bytes:new TextEncoder().encode('Hello résumé\n')},{name:'empty.bin',bytes:new Uint8Array()}];
  const packed=tar(entries),unpacked=untar(packed);assert.deepEqual(unpacked,entries);
  packed[0]^=1;assert.throws(()=>untar(packed),/checksum/);
  assert.throws(()=>zipIndex(new Uint8Array(22)),/Invalid ZIP/);
});

test('duplicate download names are kept as separate files', () => {
  assert.deepEqual(uniqueNames([{name:'a.png'},{name:'a.png'},{name:'a.png'},{name:'folder/a.png'}]).map(file=>file.name),['a.png','a (2).png','a (3).png','folder/a.png']);
});
