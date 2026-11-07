import {itemMatches} from './stats.mjs';
const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function loadItemManifest(fetcher=fetch){
  let response=await fetcher('assets/league/item-catalog.json',{signal:AbortSignal.timeout(10000)});
  if(response.status===404)response=await fetcher('assets/league/item-manifest.json',{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Item catalog unavailable');
  const manifest=await response.json();
  if(manifest.names && typeof manifest.names==='object')manifest.items=Object.fromEntries(Object.entries(manifest.names).filter(([id,name])=>/^\d{3,6}$/.test(id)&&typeof name==='string').map(([id,name])=>[id,{name,icon:`assets/league/items/${id}.png`}]));
  if(!manifest.items || typeof manifest.items!=='object' || Array.isArray(manifest.items))throw new Error('Invalid item catalog');
  const items={};
  for(const [id,item] of Object.entries(manifest.items)){
    if(!/^\d{3,6}$/.test(id) || typeof item.name!=='string')continue;
    items[id]={name:item.name,icon:item.icon===`assets/league/items/${id}.png`?item.icon:null};
  }
  return {...manifest,items};
}
export async function loadItemNames(fetcher=fetch){
  const manifest=await loadItemManifest(fetcher);
  return Object.fromEntries(Object.entries(manifest.items).map(([id,item])=>[id,item.name]));
}
export function itemIcon(id,items,{decorative=false}={}){
  if(!Number.isInteger(Number(id)) || Number(id)<=0)return '<span class="item-icon item-empty" title="Empty item slot" aria-label="Empty item slot"></span>';
  const item=items[String(id)],label=item?.name || `Item #${id}`;
  const fallback=`<span class="item-fallback" role="img" aria-label="${escape(label)}"${item?.icon?' hidden':''}>?</span>`;
  return `<span class="item-icon" title="${escape(label)} (ID ${escape(id)})">${item?.icon?`<img src="${escape(item.icon)}" data-item-icon alt="${decorative?'':escape(label)}" loading="lazy" decoding="async" width="30" height="30">`:''}${fallback}</span>`;
}
export function itemBuild(ids,items,{names=false}={}){
  return `<span class="item-build${names?' item-build-names':''}" aria-label="Items equipped at game end">${(ids || []).slice(0,7).map(id=>names && Number(id)>0?`<span class="item-with-name">${itemIcon(id,items,{decorative:true})}<span>${escape(items[String(id)]?.name || `Item #${id}`)}</span></span>`:itemIcon(id,items)).join('')}</span>`;
}
export function itemSuggestions(query,items,popular=[]){
  const names=Object.fromEntries(Object.entries(items).map(([id,item])=>[id,item.name]));
  const ids=query.trim()?Object.keys(items).filter(id=>itemMatches(id,query,names)):popular;
  return ids.slice(0,6).map(id=>`<button type="button" class="item-choice" data-item-choice="${id}" aria-label="Filter matches by ${escape(items[id]?.name || `Item #${id}`)}" title="${escape(items[id]?.name || `Item #${id}`)}">${itemIcon(id,items,{decorative:true})}</button>`).join('');
}
