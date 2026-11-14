import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readJson,writeJson,sha256} from './archive.mjs';
import {collect,normalize} from './collect.mjs';
import {publish} from './publish.mjs';
import {loadDashboardData,loadMatchDetails,loadRankedHistory} from '../../assets/league/data.mjs';
import {aggregate} from '../../assets/league/stats.mjs';
import {INDEX_COLUMNS} from '../../assets/league/schema.mjs';
import {checkHealth} from './health.mjs';
const env={RIOT_API_KEY:'not-a-real-key',RIOT_GAME_NAME:'player',RIOT_TAG_LINE:'NA1'};
const temp=()=>mkdtemp(join(tmpdir(),'league-publish-'));
function raw(id,puuid='player',year=2025){return {metadata:{matchId:id},info:{gameStartTimestamp:Date.UTC(year,3,1),gameDuration:1200,queueId:420,participants:[{puuid,teamId:100,championId:142,championName:'Zoe',kills:10,deaths:2,assists:5,win:true,totalMinionsKilled:150,neutralMinionsKilled:10,totalDamageDealtToChampions:10000,goldEarned:12000,challenges:{goldPerMinute:600,largeData:'x'.repeat(10000)}}]}};}
async function fixture(root){
 for(const [i,id] of ['main','alt','third'].entries()){
   const base=join(root,'accounts',id),response=raw(`NA1_${i+1}`,id,2024+i);
   await writeJson(join(base,`matches/NA1_${i+1}.json`),{raw:response,match:normalize(response,id)},{immutable:true});
   await writeJson(join(base,'state.json'),{puuid:id,platform:'na1',backfillOffset:100,backfillDone:false});
   await writeJson(join(base,'public.json'),{profile:{riotId:`${id}#NA1`,platform:'na1'},updatedAt:'2026-11-07T12:00:00Z',mastery:[]});
   await writeJson(join(base,'ranked.json'),[{at:'2026-11-07T12:00:00Z',entries:[]},{at:'2026-11-06T12:00:00Z',entries:[]}]);
 }
}
function fetchFrom(root,requests){return async url=>{requests.push(url);const path=url.replace(/^\/data\/league\//,'').split('?')[0];return {ok:true,json:()=>readJson(join(root,path))};};}
test('compact publication preserves every raw byte; indexes give accurate three-account totals and lazy details',async()=>{
 const root=await temp();try{
   await fixture(root);const original=await readFile(join(root,'accounts/main/matches/NA1_1.json'));
   const result=await publish(root),requests=[],fetcher=fetchFrom(root,requests);
   assert.equal(result.schemaVersion,2);assert.equal(result.backfillComplete,false);assert.equal(result.accounts.length,3);
   assert.equal(result.matchCount,3);assert.equal(result.matches,undefined);assert.equal(result.accounts[0].matches,undefined);
   assert.equal(result.statistics.lifetime.games,3);assert.equal(Object.keys(result.statistics.years).length,3);
   const data=await loadDashboardData(fetcher);
   assert.equal(aggregate(data.matches).games,3);
   assert.equal(data.matches[0].challenges,undefined);
   assert.ok(!requests.some(url=>url.includes('/matches/')||url.includes('/views/details/')||url.includes('ranked.json')));
   const detail=await loadMatchDetails(result.accounts.find(a=>a.id==='main'),'NA1_1',fetcher,data.matches.find(m=>m.accountId==='main').detailHash);
   assert.equal(detail.challenges.goldPerMinute,600);
   assert.ok(!requests.some(url=>url.includes('/matches/')));
   const ranks=await loadRankedHistory(result.accounts[0],fetcher);assert.ok(ranks[0].at<ranks[1].at);
   assert.equal(sha256(await readFile(join(root,'accounts/main/matches/NA1_1.json'))),sha256(original));
   assert.ok(result.indexes.reduce((s,x)=>s+x.bytes,0)<original.length/2);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('republication merges new raw matches, retains old hashed indexes and cannot erase history on an API failure',async()=>{
 const root=await temp();try{
   await fixture(root);const before=await publish(root),oldIndex=before.indexes[0].url;
   const response=raw('NA1_99','alt',2026);
   await writeJson(join(root,'accounts/alt/matches/NA1_99.json'),{raw:response,match:normalize(response,'alt')},{immutable:true});
   const state=await readJson(join(root,'accounts/alt/state.json'));state.lastError='Riot HTTP 503';await writeJson(join(root,'accounts/alt/state.json'),state);
   const after=await publish(root);assert.equal(after.matchCount,4);assert.equal(after.accounts.find(a=>a.id==='alt').collectionFailed,true);
   assert.equal((await loadDashboardData(fetchFrom(root,[]))).matches.length,4);
   assert.ok(await readJson(join(root,oldIndex)));
   const previous=await readFile(join(root,'public.json'),'utf8');
   await writeFile(join(root,'accounts/main/matches/NA1_1.json'),'broken');
   await assert.rejects(publish(root));assert.equal(await readFile(join(root,'public.json'),'utf8'),previous);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('backfill advances checkpointed pages despite a failed detail and resumes at the correct next offset',async()=>{
 const root=await temp(),ids=Array.from({length:235},(_,i)=>`NA1_${i+1}`),starts=[];let fail=true;
 const api=async(_,path)=>{
   if(path.includes('/accounts/'))return {puuid:'player',gameName:'player',tagLine:'NA1'};
   if(path.includes('/summoners/'))return {};
   if(path.includes('/entries/')||path.includes('/champion-masteries/'))return [];
   if(path.includes('/ids?')){const params=new URLSearchParams(path.split('?')[1]);if(params.has('startTime'))return [];const start=Number(params.get('start'));starts.push(start);return ids.slice(start,start+100);}
   const id=path.split('/').at(-1);if(fail&&id==='NA1_42')throw new Error('Temporary unavailable');return raw(id);
 };
 try{
   await assert.rejects(collect(env,root,api),/pending/);
   const state=await readJson(join(root,'state.json'));assert.equal(state.backfillOffset,200);assert.equal(state.backfillDone,false);
   assert.equal((await readdir(join(root,'matches'))).length,199);
   assert.deepEqual(await readJson(join(root,'pending.json')),['NA1_42']);
   fail=false;await collect(env,root,api);
   assert.deepEqual(starts,[0,100,200]);assert.equal((await readJson(join(root,'state.json'))).backfillDone,true);
   assert.equal((await readdir(join(root,'matches'))).length,235);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('ID-list errors never mark backfill complete or discard the checkpointed first page',async()=>{
 const root=await temp();
 const api=async(_,path)=>{
   if(path.includes('/accounts/'))return {puuid:'player'};if(path.includes('/summoners/'))return {};
   if(path.includes('/entries/')||path.includes('/champion-masteries/'))return [];
   if(path.includes('startTime='))return [];
   if(path.includes('start=0&'))return Array.from({length:100},(_,i)=>`NA1_${i}`);
   throw new Error('Page two failure');
 };
 try{await assert.rejects(collect(env,root,api),/Page two/);const state=await readJson(join(root,'state.json'));assert.equal(state.backfillOffset,100);assert.equal(state.backfillDone,false);assert.equal((await readJson(join(root,'pending.json'))).length,100);}finally{await rm(root,{recursive:true,force:true});}
});
test('loader handles ten thousand searchable rows without fetching detailed archives',async()=>{
 const rows=Array.from({length:10000},(_,i)=>INDEX_COLUMNS.map(key=>({id:`NA1_${i}`,accountId:'main',date:Date.UTC(2025,0,1)+i,champion:'Zoe',queue:420,kills:1,deaths:1,assists:1,win:true,items:[]})[key]??0));
 const block={schemaVersion:2,columns:INDEX_COLUMNS,rows},requests=[];
 const data=await loadDashboardData(async url=>{requests.push(url);return {ok:true,json:async()=>url.endsWith('public.json')?{schemaVersion:2,matchCount:10000,accounts:[{id:'main',label:'Main'}],indexes:[{url:'views/index-2025-01-abc.json',count:10000}]}:block};});
 assert.equal(data.matches.length,10000);assert.equal(requests.length,2);
 const duplicate={...block,rows:[rows[0],rows[0]]};
 await assert.rejects(loadDashboardData(async url=>({ok:true,json:async()=>url.endsWith('public.json')?{schemaVersion:2,matchCount:2,accounts:[{id:'main'}],indexes:[{url:'views/index-2025-01-abc.json',count:2}]}:duplicate})),/Duplicate/);
});
test('health monitor identifies a stale or failed account even while another account updates',()=>{
 const now=Date.parse('2026-11-07T12:00:00Z');
 assert.equal(checkHealth({accounts:[{id:'main',updatedAt:'2026-11-07T11:00:00Z',backfillComplete:true}]},now).length,0);
 const issues=checkHealth({accounts:[{id:'main',updatedAt:'2026-11-07T11:00:00Z',backfillComplete:true},{id:'alt',updatedAt:'2026-11-05T11:00:00Z',collectionFailed:true,backfillComplete:false}]},now);
 assert.equal(issues.length,3);assert.ok(issues.every(x=>x.startsWith('alt:')));
});
test('duplicate configured PUUIDs cannot replace a valid combined manifest',async()=>{
 const root=await temp();try{
   await fixture(root);await publish(root);const original=await readFile(join(root,'public.json'),'utf8');
   const state=await readJson(join(root,'accounts/main/state.json'));state.puuid='alt';await writeJson(join(root,'accounts/main/state.json'),state);
   await assert.rejects(publish(root),/same Riot account/);
   assert.equal(await readFile(join(root,'public.json'),'utf8'),original);
 }finally{await rm(root,{recursive:true,force:true});}
});
