import assert from 'node:assert/strict';import fs from 'node:fs';import {convert,oklab,countsFor,blockPosition,rowRuns} from './dist/engine.js';import {schematicBlob,litematicBlob,validateProject,csvText} from './dist/exports.js';
const blocks=JSON.parse(fs.readFileSync('dist/blocks.json'));assert.equal(blocks.length,162);assert.equal(new Set(blocks.map(b=>b.id)).size,162);for(const b of blocks)assert(fs.existsSync('dist/'+b.texture));const palette=blocks.filter(b=>b.category==='Concrete'),settings={method:'oklab',transparent:'air',saturation:1,contrast:1,brightness:0,maxColors:0,dither:0};
for(const [i,b]of palette.entries())assert.equal(convert({pixels:[...b.color,255],width:1,height:1,palette,settings})[0],i);assert.equal(convert({pixels:[255,0,0,0],width:1,height:1,palette,settings})[0],-1);assert(Math.abs(oklab([255,255,255])[0]-1)<.0001);
for(const kind of ['gradient','portrait','landscape','logo','pixelart','transparent']){const pixels=[];for(let y=0;y<48;y++)for(let x=0;x<64;x++){const color=kind==='gradient'?[x*4,y*5,130]:kind==='portrait'?(Math.hypot(x-32,y-24)<15?[206,151,110]:[30,60,90]):kind==='landscape'?(y<24?[110,170,220]:[45,100,65]):kind==='logo'?(x>16&&x<48?[240,60,20]:[250,250,250]):palette[(x+y)%16].color;pixels.push(...color,kind==='transparent'&&x<10?0:255)}for(const dither of [0,1]){const cells=convert({pixels,width:64,height:48,palette:blocks,settings:{...settings,dither,maxColors:8}});assert.equal(cells.length,3072);assert(countsFor(cells).size<=8);assert.equal([...countsFor(cells).values()].reduce((a,b)=>a+b,0),cells.filter(i=>i>=0).length);if(kind==='transparent')assert.equal(cells.filter(i=>i<0).length,480)}}
assert.deepEqual(blockPosition(0,2,2),{x:0,y:1,z:0});assert.deepEqual(rowRuns([0,0,1,-1],2,2,0),[{block:1,count:1,start:0,end:0},{block:-1,count:1,start:1,end:1}]);
const project={format:'blockloom',version:1,name:'Orientation fixture',width:2,height:2,palette,cells:[0,1,2,-1],settings:{},done:[2],collected:[]};assert.deepEqual(validateProject(JSON.parse(JSON.stringify(project)),blocks).cells,project.cells);assert.throws(()=>validateProject({...project,cells:[0]},blocks));assert.throws(()=>validateProject({...project,width:1000},blocks));assert.equal(csvText(project).split('\r\n').length,4);
const start=performance.now();assert.equal(convert({pixels:new Uint8ClampedArray(256*256*4).fill(180),width:256,height:256,palette:blocks,settings}).length,65536);console.log('PASS assets, conversion fixtures, dithering, caps, transparency, counts, orientation, project validation. Large conversion:',Math.round(performance.now()-start),'ms');
fs.mkdirSync('test-output',{recursive:true});for(const [name,p]of [['small',project],['crossword',{...project,width:13,height:7,palette:blocks.slice(0,20),cells:Array.from({length:91},(_,i)=>i%21-1)}],['wide',{...project,width:37,height:19,palette:blocks,cells:Array.from({length:703},(_,i)=>i%17===0?-1:i%162)}]]){fs.writeFileSync('test-output/'+name+'.json',JSON.stringify(p));fs.writeFileSync('test-output/'+name+'.schem',Buffer.from(await (await schematicBlob(p)).arrayBuffer()));fs.writeFileSync('test-output/'+name+'.litematic',Buffer.from(await (await litematicBlob(p)).arrayBuffer()))}

// Inventory accounting preserves every block, including incomplete stacks.
const {stackSlots}=await import('./dist/materials.js');
assert.deepEqual(stackSlots([[2,130],[4,1]]),[{block:2,count:64},{block:2,count:64},{block:2,count:2},{block:4,count:1}]);
assert.equal(stackSlots([[0,3457]]).length,55);assert.deepEqual(stackSlots([]),[]);
// Exercise movement with real camera math and focus-scoped input events.
const THREE=await import('./dist/vendor/three.module.js');const {FreeCamera}=await import('./dist/free-camera.js');
const handlers={};globalThis.document={addEventListener(){}};
const canvas={offsetWidth:100,setAttribute(){},focus(){},setPointerCapture(){},addEventListener(n,fn){handlers[n]=fn}};
const camera=new THREE.PerspectiveCamera();let exited=false;const flight=new FreeCamera(canvas,camera,()=>{},()=>exited=true);
const key=(code)=>handlers.keydown({code,preventDefault(){}});
key('KeyW');assert.equal(flight.update(.05),false);flight.setActive(true);key('KeyW');flight.update(.05);assert.equal(camera.position.z,-1);
handlers.blur();assert.equal(flight.update(.05),false);key('KeyD');flight.update(.05);assert.equal(camera.position.x,1);
handlers.blur();key('KeyE');key('ShiftLeft');flight.update(.05);assert.equal(camera.position.y,3);
handlers.blur();key('KeyS');flight.update(.05);assert.equal(camera.position.z,0);
handlers.blur();key('KeyA');flight.update(.05);assert.equal(camera.position.x,0);
handlers.blur();key('KeyQ');flight.update(.05);assert.equal(camera.position.y,2);
key('Escape');assert(exited);flight.setActive(false);assert.equal(flight.update(.05),false);
console.log('PASS chest stacks and free camera movement, boost, focus and exit');
