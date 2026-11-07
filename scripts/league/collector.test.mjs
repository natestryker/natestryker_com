import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {client,normalize,collect,collectAll,parseAccounts,combineAccounts} from './collect.mjs';
import {aggregate,filterMatches,countsForStats,isHistoryOnly} from '../../assets/league/stats.mjs';
import {loadItemNames} from '../../assets/league/items.mjs';
const player={puuid:'player',teamId:100,championName:'Zoe',championId:142,win:true,kills:10,deaths:0,assists:5,totalMinionsKilled:180,neutralMinionsKilled:20,totalDamageDealtToChampions:30000};
const raw={metadata:{matchId:'NA1_123'},info:{participants:[player],gameStartTimestamp:1800000000000,gameEndTimestamp:1800001200000,gameDuration:1200,queueId:420}};
test('ARAM and Arena never affect stats but remain searchable in history across accounts',()=>{
 const ranked={...normalize(raw,'player'),accountId:'main'};
 const excluded=[65,67,100,450,720,1700,1710,2400].map((queue,i)=>({...ranked,queue,accountId:i%2?'alt':'third',kills:999,damage:999999,csPerMinute:99,kda:999}));
 const matches=[ranked,...excluded,{...ranked,remake:true}];
 assert.deepEqual(aggregate(matches),aggregate([ranked]));
 assert.deepEqual(matches.filter(countsForStats),[ranked]);
 assert.equal(Math.max(...matches.filter(countsForStats).map(m=>m.kills)),10);
 for(const match of excluded){
   assert.equal(isHistoryOnly(match),true);
   const history=filterMatches(matches,'',String(match.queue));
   assert.equal(history.length,1);assert.equal(aggregate(history).games,0);
   assert.equal(history.filter(countsForStats).length,0);
 }
 assert.equal(countsForStats({...ranked,queue:9999,gameMode:'ARAM'}),false);
 assert.equal(countsForStats({...ranked,queue:9999,gameMode:'CHERRY'}),false);
 assert.equal(countsForStats({...ranked,queue:'450'}),false);
 assert.equal(countsForStats({...ranked,queue:400}),true);
});
test('account configuration rejects duplicates, unsafe IDs and more than three accounts',()=>{
 const a={id:'main',gameName:'Name',tagLine:'NA1',platform:'na1'};
 assert.equal(parseAccounts({}),null);
 assert.equal(parseAccounts({RIOT_ACCOUNTS:JSON.stringify([a])})[0].id,'main');
 for(const config of [[a,{...a,id:'alt'}],[{...a,id:'../bad'}],[a,a,a,a],[],[{...a,platform:'invalid'}]]) assert.throws(()=>parseAccounts({RIOT_ACCOUNTS:JSON.stringify(config)}));
});
test('all accounts combine without collapsing a shared game or mixing record links',()=>{
 const accounts=['main','alt','third'].map((id,i)=>({id,label:id,updatedAt:null,matches:[{...normalize(raw,'player'),kills:i+1}],ranked:[],mastery:[],backfillComplete:true}));
 const combined=combineAccounts(accounts);
 assert.equal(combined.matches.length,3);assert.equal(new Set(combined.matches.map(m=>m.recordId)).size,3);
 assert.equal(combined.matches.reduce((best,m)=>m.kills>best.kills?m:best).accountId,'third');
 assert.equal(aggregate(combined.matches).games,3);
});
test('three-account polling isolates archives, resumes duplicates and retains failed-account data',async()=>{
 const root=await mkdtemp(join(tmpdir(),'league-multi-'));
 const config=['main','alt','third'].map(id=>({id,gameName:id,tagLine:'NA1',platform:'na1'}));
 const env={RIOT_API_KEY:'test-secret',RIOT_ACCOUNTS:JSON.stringify(config)};
 let fail=false,matchCalls=0;
 const api=async(_,path)=>{
   if(path.includes('/accounts/')){const name=path.split('/').at(-2);if(fail && name==='alt')throw new Error('outage');return {puuid:name,gameName:name,tagLine:'NA1'};}
   if(path.includes('/summoners/'))return {summonerLevel:100};
   if(path.includes('/entries/') || path.includes('/champion-masteries/'))return [];
   if(path.includes('/ids?'))return ['NA1_123'];
   matchCalls++;return {...raw,info:{...raw.info,participants:config.map(a=>({...player,puuid:a.id}))}};
 };
 try{
   await collectAll(env,root,api);assert.equal(matchCalls,3);
   let result=JSON.parse(await readFile(join(root,'public.json')));
   assert.equal(result.accounts.length,3);assert.equal(result.matches.length,3);
   fail=true;await assert.rejects(collectAll(env,root,api),/alt/);
   result=JSON.parse(await readFile(join(root,'public.json')));
   assert.equal(matchCalls,3);assert.equal(result.matches.length,3);
   assert.equal(result.accounts.find(a=>a.id==='alt').collectionFailed,true);
   assert.equal(result.accounts.find(a=>a.id==='main').ranked.length,2);
   assert.equal(result.accounts.find(a=>a.id==='alt').ranked.length,1);
   assert.equal((await readdir(join(root,'accounts','third','matches'))).length,1);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('existing single-account archive is imported without deleting the original',async()=>{
 const root=await mkdtemp(join(tmpdir(),'league-migration-'));
 const env={RIOT_API_KEY:'test-secret',RIOT_GAME_NAME:'main',RIOT_TAG_LINE:'NA1'};
 const api=async(_,path)=>{
   if(path.includes('/accounts/'))return {puuid:'player',gameName:'main',tagLine:'NA1'};
   if(path.includes('/summoners/'))return {};
   if(path.includes('/entries/')||path.includes('/champion-masteries/'))return [];
   if(path.includes('/ids?'))return ['NA1_123'];
   return raw;
 };
 try{
   await collect(env,root,api);
   await collectAll({...env,RIOT_ACCOUNTS:JSON.stringify([{id:'main',gameName:'main',tagLine:'NA1'}])},root,api);
   const output=JSON.parse(await readFile(join(root,'public.json')));
   assert.equal(output.matches[0].accountId,'main');assert.equal(output.accounts[0].ranked.length,2);
   assert.equal((await readdir(join(root,'matches'))).length,1);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('normalizes duration, zero-death KDA, CS and team participation',()=>{const m=normalize(raw,'player');assert.equal(m.duration,1200);assert.equal(m.kda,15);assert.equal(m.csPerMinute,10);assert.equal(m.killParticipation,150);assert.throws(()=>normalize(raw,'missing'));});
test('filters and aggregates remakes without counting them as losses',()=>{const m=normalize(raw,'player');const matches=[m,{...m,win:false},{...m,remake:true}];assert.deepEqual([aggregate(matches).games,aggregate(matches).wins,aggregate(matches).losses],[2,1,1]);assert.equal(filterMatches(matches,'zoe','420','loss').length,1);assert.equal(filterMatches(matches,'','', 'remake').length,1);assert.equal(aggregate([]).kda,0);});
test('champion and item searches combine with other filters and ignore empty item slots',()=>{
 const zoe={...normalize(raw,'player'),items:[3089,3020,0]}, ahri={...zoe,champion:'Ahri',items:[30890,0]};
 assert.deepEqual(filterMatches([zoe,ahri],'','420','win',' ZO ','3089'),[zoe]);
 assert.equal(filterMatches([zoe,ahri],'','','','','3089').length,1);
 assert.equal(filterMatches([zoe,ahri],'','','','','0').length,0);
 assert.equal(filterMatches([zoe,ahri],'','','','Ahri','3089').length,0);
});
test('item names support autocomplete values, partial names, apostrophes and boots wording',()=>{
 const shoes={...normalize(raw,'player'),items:[3020,0]}, cap={...shoes,items:[3089]};
 const names={3020:"Sorcerer's Shoes",3089:"Rabadon's Deathcap"};
 for(const query of ["Sorcerer's Shoes",'sorcerers boots','sorcerer shoes','SHOES','3020']){
   assert.deepEqual(filterMatches([shoes,cap],'','','','',query,names),[shoes]);
 }
 assert.deepEqual(filterMatches([shoes,cap],'','','','','deathcap',names),[cap]);
 assert.equal(filterMatches([shoes,cap],'','','','','unknown',names).length,0);
});
test('public item catalog maps IDs to names and fails safely on unavailable data',async()=>{
 const urls=[];
 const names=await loadItemNames(async url=>{urls.push(url);return Response.json(url.endsWith('versions.json')?['16.1.1']:{data:{3020:{name:"Sorcerer's Shoes"},3089:{name:"Rabadon's Deathcap"}}});});
 assert.equal(names[3020],"Sorcerer's Shoes");
 assert.ok(urls[1].endsWith('/16.1.1/data/en_US/item.json'));
 await assert.rejects(loadItemNames(async()=>new Response('',{status:503})),/unavailable/);
 await assert.rejects(loadItemNames(async()=>Response.json([])),/Invalid/);
});
test('retries 429 with Retry-After; authentication fails without leaking key',async()=>{let calls=0;const waits=[];const api=client('test-secret',async()=>++calls===1 ? new Response('',{status:429,headers:{'Retry-After':'3'}}) : Response.json({ok:true}),async ms=>waits.push(ms));assert.deepEqual(await api('na1','/test'),{ok:true});assert.ok(waits.includes(3000));await assert.rejects(client('test-secret',async()=>new Response('',{status:403}),async()=>{})('na1','/test'),/HTTP 403/);});
test('persists once, takes periodic rank snapshots and rejects account mixing',async()=>{
 const root=await mkdtemp(join(tmpdir(),'league-test-'));let matchCalls=0;
 const env={RIOT_API_KEY:'test-secret',RIOT_GAME_NAME:'name',RIOT_TAG_LINE:'tag',RIOT_PLATFORM:'na1'};
 const api=async(host,path)=>{
  if(path.includes('/accounts/'))return {puuid:'player',gameName:'name',tagLine:'tag'};
  if(path.includes('/summoners/'))return {summonerLevel:100};
  if(path.includes('/entries/'))return [{queueType:'RANKED_SOLO_5x5',tier:'MASTER',rank:'I',leaguePoints:100,wins:10,losses:5}];
  if(path.includes('/champion-masteries/'))return [];
  if(path.includes('/ids?'))return ['NA1_123'];
  if(path.endsWith('/NA1_123')){matchCalls++;return raw;}
  throw new Error('Unexpected endpoint');
 };
 try{await collect(env,root,api);await collect(env,root,api);assert.equal(matchCalls,1);assert.equal((await readdir(join(root,'matches'))).length,1);const output=await readFile(join(root,'public.json'),'utf8');assert.equal(JSON.parse(output).ranked.length,2);assert.equal(JSON.parse(output).matches.length,1);assert.ok(!output.includes('test-secret'));await assert.rejects(collect(env,root,async()=>({puuid:'other'})),/Account\/platform changed/);}finally{await rm(root,{recursive:true,force:true});}
});
test('an interrupted collection retains matches and resumes safely',async()=>{
 const root=await mkdtemp(join(tmpdir(),'league-resume-'));let fail=true;
 const env={RIOT_API_KEY:'test-secret',RIOT_GAME_NAME:'name',RIOT_TAG_LINE:'tag'};
 const api=async(_,path)=>{if(path.includes('/accounts/'))return {puuid:'player'};if(path.includes('/summoners/'))return {};if(path.includes('/entries/')||path.includes('/champion-masteries/'))return [];if(path.includes('/ids?'))return ['NA1_123','NA1_124'];if(path.endsWith('/NA1_123'))return raw;if(fail)throw new Error('temporary outage');return {...raw,metadata:{matchId:'NA1_124'}};};
 try{await assert.rejects(collect(env,root,api),/downloads pending/);assert.equal((await readdir(join(root,'matches'))).length,1);fail=false;await collect(env,root,api);assert.equal(JSON.parse(await readFile(join(root,'public.json'))).matches.length,2);}finally{await rm(root,{recursive:true,force:true});}
});
