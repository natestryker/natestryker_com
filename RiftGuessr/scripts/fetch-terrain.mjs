import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const root=join(tmpdir(),'riftguessr-map-source');
const mode=process.argv[2]||'probe';
const tasks=mode==='all'?[...Array.from({length:46*38},(_,i)=>[6,i%46,Math.floor(i/46)]),...Array.from({length:6*5},(_,i)=>[3,i%6,Math.floor(i/6)])]:[[6,20,18],[6,25,18],[6,0,0],[3,3,2]];
let cursor=0,done=0,bytes=0;
async function get([z,x,y]){
 const directory=join(root,String(z),String(x)),file=join(directory,y+'.png');
 try{const old=await stat(file);if(old.size>100)return;}catch{}
 await mkdir(directory,{recursive:true});
 let last;
 for(let attempt=0;attempt<4;attempt++){
  try{
   const response=await fetch(`https://summonersrift.mvilim.dev/combined_S14/${z}/${x}/${y}.png`,{signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('HTTP '+response.status+' for '+z+'/'+x+'/'+y);
   const buffer=Buffer.from(await response.arrayBuffer());
   if(buffer.length<100||buffer.readUInt32BE(0)!==0x89504e47)throw Error('Not a PNG: '+z+'/'+x+'/'+y);
   await writeFile(file,buffer);bytes+=buffer.length;
   if(mode!=='all')console.log(JSON.stringify({file,width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20),bytes:buffer.length}));
   return;
  }catch(error){last=error;await new Promise(resolve=>setTimeout(resolve,350*(attempt+1)));}
 }
 throw last;
}
await Promise.all(Array.from({length:4},async()=>{while(cursor<tasks.length){const next=tasks[cursor++];await get(next);done++;if(mode==='all'&&(done%100===0||done===tasks.length))console.log(`Downloaded ${done}/${tasks.length} tiles (${(bytes/1048576).toFixed(1)} MB new)`);}}));
console.log('Tile cache: '+root);
