// Public static game data: no API key or authenticated Riot endpoint is used.
export async function loadItemNames(fetcher=fetch) {
  async function json(url){
    const response=await fetcher(url,{signal:AbortSignal.timeout(10000)});
    if(!response.ok) throw new Error('Item catalog unavailable');
    return response.json();
  }
  const versions=await json('https://ddragon.leagueoflegends.com/api/versions.json');
  if(!Array.isArray(versions) || !/^\d+\.\d+\.\d+$/.test(versions[0])) throw new Error('Invalid item catalog version');
  const catalog=await json(`https://ddragon.leagueoflegends.com/cdn/${versions[0]}/data/en_US/item.json`);
  if(!catalog.data || typeof catalog.data!=='object') throw new Error('Invalid item catalog');
  return Object.fromEntries(Object.entries(catalog.data).filter(([id,item])=>/^\d+$/.test(id) && typeof item.name==='string').map(([id,item])=>[id,item.name]));
}
