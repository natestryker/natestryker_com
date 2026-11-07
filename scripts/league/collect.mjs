import { mkdir, readFile, writeFile, readdir, rename, cp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const routes = {na1:'americas',br1:'americas',la1:'americas',la2:'americas',euw1:'europe',eun1:'europe',tr1:'europe',ru:'europe',kr:'asia',jp1:'asia',oc1:'sea',ph2:'sea',sg2:'sea',th2:'sea',tw2:'sea',vn2:'sea',me1:'europe'};
const sleep = ms => new Promise(r => setTimeout(r, ms));
export function client(key, fetcher = fetch, pause = sleep) {
  return async (host, path) => {
    for (let attempt = 0; attempt < 6; attempt++) {
      // Below the standard personal-key 100 requests / 2 minutes budget.
      await pause(1300);
      let response;
      try { response = await fetcher(`https://${host}.api.riotgames.com${path}`, {headers:{'X-Riot-Token':key}, signal:AbortSignal.timeout(30000)}); }
      catch { if (attempt === 5) throw new Error('Riot connection failed after retries'); await pause(2000 * 2 ** attempt); continue; }
      if (response.ok) return response.json();
      if (response.status === 429 || response.status >= 500) {
        await pause(Math.max(1000 * Number(response.headers.get('retry-after') || 0), 2000 * 2 ** attempt));
        continue;
      }
      throw new Error(`Riot HTTP ${response.status}. Check key, Riot ID, platform and API availability.`);
    }
    throw new Error('Riot retry budget exhausted; saved data is retained.');
  };
}
export function normalize(raw, puuid) {
  const p = raw.info.participants.find(p => p.puuid === puuid);
  if (!p) throw new Error('Tracked player missing from match');
  const duration = raw.info.gameEndTimestamp ? (raw.info.gameEndTimestamp - raw.info.gameStartTimestamp) / 1000 : raw.info.gameDuration;
  const teamKills = raw.info.participants.filter(x=>x.teamId === p.teamId).reduce((s,x)=>s+x.kills,0);
  return {id:raw.metadata.matchId, date:raw.info.gameStartTimestamp, duration, queue:raw.info.queueId, gameMode:raw.info.gameMode, mapId:raw.info.mapId, patch:raw.info.gameVersion,
    champion:p.championName, championId:p.championId, role:p.teamPosition || p.individualPosition || 'UNKNOWN', win:p.win,
    remake:!!p.gameEndedInEarlySurrender, kills:p.kills, deaths:p.deaths, assists:p.assists,
    kda:(p.kills+p.assists)/Math.max(1,p.deaths), cs:p.totalMinionsKilled+p.neutralMinionsKilled,
    csPerMinute:(p.totalMinionsKilled+p.neutralMinionsKilled)/Math.max(1,duration/60),
    damage:p.totalDamageDealtToChampions, damageTaken:p.totalDamageTaken, gold:p.goldEarned,
    vision:p.visionScore, wards:p.wardsPlaced, controlWards:p.visionWardsBoughtInGame,
    healing:p.totalHeal, objectiveDamage:p.damageDealtToObjectives, turretDamage:p.damageDealtToTurrets,
    killParticipation:teamKills ? (p.kills+p.assists)/teamKills*100 : 0,
    doubleKills:p.doubleKills, tripleKills:p.tripleKills, quadraKills:p.quadraKills, pentaKills:p.pentaKills,
    items:Array.from({length:7},(_,i)=>p[`item${i}`]), challenges:p.challenges || {}};
}
async function load(path, fallback) { try {return JSON.parse(await readFile(path,'utf8'));} catch(e) {if(e.code === 'ENOENT') return fallback; throw e;} }
async function save(path, value) {await mkdir(resolve(path,'..'),{recursive:true}); await writeFile(`${path}.tmp`,JSON.stringify(value,null,2)+'\n'); await rename(`${path}.tmp`,path);}
export async function collect(env = process.env, root = resolve('data/league'), apiOverride) {
  const {RIOT_API_KEY:key, RIOT_GAME_NAME:name, RIOT_TAG_LINE:tag, RIOT_PLATFORM:platform = 'na1'} = env;
  if (!key || !name || !tag || !routes[platform]) throw new Error('Set RIOT_API_KEY, RIOT_GAME_NAME, RIOT_TAG_LINE and a supported RIOT_PLATFORM.');
  const api = apiOverride || client(key), region = routes[platform], enc = encodeURIComponent;
  const account = await api(region,`/riot/account/v1/accounts/by-riot-id/${enc(name)}/${enc(tag)}`);
  const state = await load(join(root,'state.json'),{});
  if (state.puuid && (state.puuid !== account.puuid || state.platform !== platform)) throw new Error('Account/platform changed. Use a separate data directory to preserve history.');
  const puuid = enc(account.puuid);
  const summoner = await api(platform,`/lol/summoner/v4/summoners/by-puuid/${puuid}`);
  const entries = await api(platform,`/lol/league/v4/entries/by-puuid/${puuid}`);
  const mastery = await api(platform,`/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}`);
  const snapshots = await load(join(root,'ranked.json'),[]);
  const now = new Date().toISOString();
  snapshots.push({at:now,entries:entries.map(({queueType,tier,rank,leaguePoints,wins,losses})=>({queueType,tier,rank,leaguePoints,wins,losses}))});
  await save(join(root,'ranked.json'),snapshots);
  const directory = join(root,'matches'); await mkdir(directory,{recursive:true});
  const known = new Set((await readdir(directory)).filter(x=>x.endsWith('.json')).map(x=>x.slice(0,-5)));
  // A stable time window + persisted offset backfills incrementally without losing new matches.
  const end = state.backfillEnd || Math.floor(Date.now()/1000);
  async function ingest(query) {
    const ids = await api(region,`/lol/match/v5/matches/by-puuid/${puuid}/ids?${query}&count=100`);
    for (const id of ids) {
      if (!/^[A-Z0-9]+_\d+$/.test(id)) throw new Error('Invalid match ID');
      if (known.has(id)) continue;
      const raw = await api(region,`/lol/match/v5/matches/${id}`);
      await save(join(directory,`${id}.json`),{match:normalize(raw,account.puuid),raw}); known.add(id);
    }
    return ids;
  }
  // Scan every page since the previous successful poll (with a one-day overlap).
  for(let start=0;;start+=100) {
    const ids = await ingest(`startTime=${Math.max(0,(state.lastPoll || end)-86400)}&start=${start}`);
    if(ids.length < 100) break;
  }
  let offset = state.backfillOffset || 0, done = state.backfillDone || false;
  if(!done) {const ids = await ingest(`endTime=${end}&start=${offset}`); offset += ids.length; done = ids.length < 100;}
  const matches = [];
  for (const file of await readdir(directory)) if(file.endsWith('.json')) matches.push((await load(join(directory,file))).match);
  matches.sort((a,b)=>b.date-a.date);
  await save(join(root,'public.json'),{updatedAt:now,profile:{riotId:`${account.gameName}#${account.tagLine}`,level:summoner.summonerLevel,platform},backfillComplete:done,matches,ranked:snapshots,mastery:mastery.map(({championId,championLevel,championPoints})=>({championId,championLevel,championPoints}))});
  await save(join(root,'state.json'),{puuid:account.puuid,platform,backfillEnd:end,backfillOffset:offset,backfillDone:done,lastPoll:Math.floor(new Date(now).getTime()/1000)});
  console.log(`Saved ${matches.length} unique matches and ${snapshots.length} ranked observations.`);
}
export function parseAccounts(env){
  if(!env.RIOT_ACCOUNTS?.trim()) return null;
  let accounts;
  try {accounts=JSON.parse(env.RIOT_ACCOUNTS);} catch {throw new Error('RIOT_ACCOUNTS must be a JSON array.');}
  if(!Array.isArray(accounts) || accounts.length<1 || accounts.length>3) throw new Error('Configure between one and three accounts.');
  const ids=new Set(), identities=new Set();
  for(const a of accounts){
    if(!a || typeof a.id!=='string' || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(a.id) || ids.has(a.id)) throw new Error('Each account needs a unique, stable lowercase id (letters, numbers, hyphens).');
    if(typeof a.gameName!=='string' || !a.gameName.trim() || typeof a.tagLine!=='string' || !a.tagLine.trim() || !routes[a.platform || 'na1']) throw new Error('Each account needs gameName, tagLine and a supported platform.');
    const identity=`${a.platform || 'na1'}:${a.gameName.trim().toLowerCase()}#${a.tagLine.trim().toLowerCase()}`;
    if(identities.has(identity)) throw new Error('The same Riot account cannot be configured twice.');
    ids.add(a.id);identities.add(identity);
  }
  return accounts;
}
export function combineAccounts(accounts){
  return {updatedAt:accounts.map(a=>a.updatedAt).filter(Boolean).sort().at(-1) || null,accounts,
    matches:accounts.flatMap(a=>a.matches.map(m=>({...m,accountId:a.id,accountName:a.profile?.riotId || a.label,recordId:`${a.id}--${m.id}`}))).sort((a,b)=>b.date-a.date),
    backfillComplete:accounts.every(a=>a.backfillComplete),ranked:[],mastery:[]};
}
export async function collectAll(env=process.env,root=resolve('data/league'),apiOverride){
  const config=parseAccounts(env);
  if(!config) return collect(env,root,apiOverride);
  if(!env.RIOT_API_KEY) throw new Error('Set RIOT_API_KEY.');
  const api=apiOverride || client(env.RIOT_API_KEY), results=[], failures=[];
  for(const [index,a] of config.entries()){
    const directory=join(root,'accounts',a.id);
    // Import the original single-account archive once, without deleting any source data.
    const legacy=await load(join(root,'state.json'),null);
    if(index===0 && legacy && !await load(join(directory,'state.json'),null)){
      await mkdir(directory,{recursive:true});
      for(const file of ['matches','ranked.json','state.json']){
        try {await cp(join(root,file),join(directory,file),{recursive:true});} catch(e){if(e.code!=='ENOENT') throw e;}
      }
      const old=await load(join(root,'public.json'),null);
      if(old && !old.accounts) await save(join(directory,'public.json'),old);
    }
    try {
      await collect({...env,RIOT_GAME_NAME:a.gameName,RIOT_TAG_LINE:a.tagLine,RIOT_PLATFORM:a.platform || 'na1'},directory,api);
    } catch(e){failures.push(a.id);console.error(`Account ${a.id}: ${e.message}`);}
    const summary=await load(join(directory,'public.json'),{updatedAt:null,profile:null,matches:[],ranked:[],mastery:[],backfillComplete:false});
    results.push({...summary,id:a.id,label:`${a.gameName}#${a.tagLine}`,collectionFailed:failures.includes(a.id)});
  }
  await save(join(root,'public.json'),combineAccounts(results));
  if(failures.length) throw new Error(`Collection incomplete for: ${failures.join(', ')}. Other accounts and existing archives are preserved.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) collectAll().catch(e=>{console.error(e.message);process.exitCode=1;});
