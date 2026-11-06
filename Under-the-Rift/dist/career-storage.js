import {mergeAchievementBooks,emptyAchievementBook} from './achievements.js';
// Each career has its own key. Autosaves never depend on a shared active pointer.
const PREFIX='slot:',META='slots-meta';
export const defaultCareerName=s=>`${s.manager} · ${s.teams[s.team].tag}`;
const cleanName=(name,fallback)=>String(name||'').trim().slice(0,60)||fallback;
export class CareerStore{
 constructor(driver){this.driver=driver;this.queue=Promise.resolve();}
 run(action){const result=this.queue.then(action);this.queue=result.catch(()=>{});return result;}
 async initialize(validate,legacyRaw){
  return this.run(async()=>{
   const meta=await this.driver.get(META);
   if(meta){const active=meta.active&&await this.driver.get(PREFIX+meta.active);if(active)return active;const keys=(await this.driver.keys()).filter(k=>k.startsWith(PREFIX));return keys.length?this.driver.get(keys[0]):null;}
   const raw=await this.driver.get('save')||legacyRaw;
   if(!raw)return null;
   const data=validate(typeof raw==='string'?JSON.parse(raw):raw);
   // Stable ID makes a partially interrupted migration safe to repeat.
   let record=await this.driver.get(PREFIX+'original');
   if(!record){record=this.record('original',data,defaultCareerName(data));await this.driver.set(PREFIX+'original',record);}
   await this.driver.set(META,{active:record.id});return record;
  });
 }
 record(id,data,name){const t=data.teams[data.team];return {id,name:cleanName(name,defaultCareerName(data)),updated:Date.now(),summary:{manager:data.manager,team:t.name,tag:t.tag,region:t.region,year:data.year,phase:data.phase,split:data.split,step:data.step},data};}
 create(data,name){const snapshot=structuredClone(data);return this.run(async()=>{const id=globalThis.crypto.randomUUID();const record=this.record(id,snapshot,name);await this.driver.set(PREFIX+id,record);await this.persistAchievements(snapshot);await this.driver.set(META,{active:id});return record;});}
 write(id,data){const snapshot=structuredClone(data);return this.run(async()=>{const old=await this.driver.get(PREFIX+id);if(!old)throw Error('This career slot no longer exists. Export your progress before reloading.');await this.driver.set(PREFIX+id,this.record(id,snapshot,old.name));await this.persistAchievements(snapshot);});}
 async persistAchievements(data){const x=data.discoveries;if(!x)return;const current=await this.driver.get('shared-achievements')||emptyAchievementBook();const next=mergeAchievementBooks(current,{unlocked:x.awards,progress:x.progress,seenTraits:x.seenTraits,eggs:Object.keys(x.found)});await this.driver.set('shared-achievements',next);}
 achievementBook(){return this.run(async()=>await this.driver.get('shared-achievements')||emptyAchievementBook());}
 read(id){return this.run(()=>this.driver.get(PREFIX+id));}
 list(){return this.run(async()=>{const keys=(await this.driver.keys()).filter(k=>k.startsWith(PREFIX));const rows=await Promise.all(keys.map(k=>this.driver.get(k)));return rows.filter(Boolean).map(({data,...summary})=>summary).sort((a,b)=>b.updated-a.updated);});}
 activate(id){return this.run(async()=>{if(!await this.driver.get(PREFIX+id))throw Error('Career not found.');await this.driver.set(META,{active:id});});}
 rename(id,name){return this.run(async()=>{const r=await this.driver.get(PREFIX+id);if(!r)throw Error('Career not found.');r.name=cleanName(name,r.name);await this.driver.set(PREFIX+id,r);});}
 remove(id){return this.run(async()=>{const meta=await this.driver.get(META);if(meta?.active===id)throw Error('Switch to another career before deleting this one.');await this.driver.remove(PREFIX+id);});}
}
export function localDriver(storage){const key=k=>'under-the-rift-slots:'+k;return {async get(k){const raw=storage.getItem(key(k));return raw?JSON.parse(raw):undefined;},async set(k,value){storage.setItem(key(k),JSON.stringify(value));},async remove(k){storage.removeItem(key(k));},async keys(){const out=[];for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k?.startsWith('under-the-rift-slots:'))out.push(k.slice('under-the-rift-slots:'.length));}return out;}};}
export async function openCareerStore(indexedDB,storage){
 let db;try{db=await new Promise((resolve,reject)=>{const request=indexedDB.open('under-the-rift',1);request.onupgradeneeded=()=>request.result.createObjectStore('career');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}catch{return new CareerStore(localDriver(storage));}
 const request=(mode,operation)=>new Promise((resolve,reject)=>{const tx=db.transaction('career',mode);const r=operation(tx.objectStore('career'));let result;r.onsuccess=()=>{result=r.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||r.error);tx.onabort=()=>reject(tx.error||Error('Save interrupted.'));});
 const driver={get:k=>request('readonly',s=>s.get(k)),set:(k,v)=>request('readwrite',s=>s.put(v,k)),remove:k=>request('readwrite',s=>s.delete(k)),keys:()=>request('readonly',s=>s.getAllKeys())};
 // If IndexedDB becomes available after a fallback session, retain that backend.
 const fallback=localDriver(storage);if(!await driver.get(META)&&await fallback.get(META))return new CareerStore(fallback);
 return new CareerStore(driver);
}
