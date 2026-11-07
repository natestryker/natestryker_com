import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir,readdir,cp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {writeJson,readJson,verifyArchive} from './archive.mjs';
import {collect,normalize} from './collect.mjs';
import {createBackup,verifyBackup} from './backup.mjs';
import {summarizeArchive} from '../../assets/league/stats.mjs';

const env={RIOT_API_KEY:'secret-never-save',RIOT_GAME_NAME:'name',RIOT_TAG_LINE:'NA1'};
function raw(id='NA1_1',year=2025){return {metadata:{matchId:id},info:{gameStartTimestamp:Date.UTC(year,5,1),gameDuration:1200,queueId:420,participants:[{puuid:'player',teamId:100,championName:'Zoe',win:true,kills:10,deaths:2,assists:6,totalMinionsKilled:100,neutralMinionsKilled:10,totalDamageDealtToChampions:12345,goldEarned:10000}]}};}
function apiWith(list,details=async id=>raw(id)){
 return async(_,path)=>{
  if(path.includes('/accounts/'))return {puuid:'player',gameName:'name',tagLine:'NA1'};
  if(path.includes('/summoners/'))return {summonerLevel:100};
  if(path.includes('/entries/')||path.includes('/champion-masteries/'))return [];
  if(path.includes('/ids?'))return list(new URLSearchParams(path.split('?')[1]));
  return details(path.split('/').at(-1));
 };
}
const temp=()=>mkdtemp(join(tmpdir(),'league-durability-'));
function git(repository,...args){return execFileSync('git',args,{cwd:repository,encoding:'utf8',stdio:'pipe'});}
async function repositoryFixture(directory){
 git(directory,'init');git(directory,'config','user.name','Archive Test');git(directory,'config','user.email','archive-test@example.invalid');git(directory,'config','core.autocrlf','false');
 const root=join(directory,'data/league');await mkdir(root,{recursive:true});
 const response=raw(),record={match:normalize(response,'player'),raw:response};
 await writeJson(join(root,'matches/NA1_1.json'),record,{immutable:true});
 await writeJson(join(root,'public.json'),{matches:[record.match]});
 git(directory,'add','--','data/league/**/*.json','data/league/*.json');git(directory,'commit','-m','Fixture');return root;
}
test('atomic immutable publishing never overwrites an existing match, including concurrent writers',async()=>{
 const root=await temp(),file=join(root,'NA1_1.json');
 try{
   await Promise.all([writeJson(file,{first:1},{immutable:true}),writeJson(file,{second:2},{immutable:true})]);
   const original=await readFile(file,'utf8');
   assert.ok(['first','second'].some(key=>Object.hasOwn(JSON.parse(original),key)));
   await writeJson(file,{replacement:true},{immutable:true});assert.equal(await readFile(file,'utf8'),original);
   assert.deepEqual(await readdir(root),['NA1_1.json']);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('235 new matches paginate to exhaustion; empty Riot history never removes lifetime archive',async()=>{
 const root=await temp(),ids=Array.from({length:235},(_,i)=>`NA1_${i+1}`),starts=[];
 try{
   await writeJson(join(root,'state.json'),{puuid:'player',platform:'na1',lastPoll:Math.floor(Date.now()/1000)-86400,backfillDone:true,backfillEnd:1});
   await collect(env,root,apiWith(params=>{starts.push(Number(params.get('start')));assert.ok(params.has('endTime'));return ids.slice(Number(params.get('start')),Number(params.get('start'))+100);}));
   assert.deepEqual(starts,[0,100,200]);
   const file=join(root,'matches/NA1_1.json'),original=await readFile(file,'utf8');
   await collect(env,root,apiWith(()=>[],()=>{throw new Error('Old Riot data unavailable');}));
   const summary=await readJson(join(root,'public.json'));
   assert.equal(summary.matches.length,235);assert.equal(summary.statistics.lifetime.games,235);
   assert.equal(await readFile(file,'utf8'),original);assert.ok(!original.includes(env.RIOT_API_KEY));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('pending IDs survive disappearing from Riot lists; successes persist despite another failed detail',async()=>{
 const root=await temp();let failed=true;
 try{
   const api=apiWith(()=>['NA1_1','NA1_2','NA1_3'],async id=>{if(id==='NA1_2'&&failed)throw new Error('404');return raw(id);});
   await assert.rejects(collect(env,root,api),/downloads pending/);
   assert.deepEqual(await readJson(join(root,'pending.json')),['NA1_2']);
   assert.equal((await readdir(join(root,'matches'))).length,2);
   assert.equal((await readJson(join(root,'state.json'))).lastPoll,undefined);
   failed=false;await collect(env,root,apiWith(()=>[],async id=>raw(id)));
   assert.deepEqual(await readJson(join(root,'pending.json')),[]);
   assert.equal((await readJson(join(root,'public.json'))).matches.length,3);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('mismatched responses and corrupt archives cannot replace a valid dashboard or advance cursors',async()=>{
 const root=await temp();
 try{
   await collect(env,root,apiWith(()=>['NA1_1']));
   const original=await readFile(join(root,'public.json'),'utf8'),state=await readJson(join(root,'state.json'));
   await assert.rejects(collect(env,root,apiWith(()=>['NA1_2'],async()=>raw('NA1_999'))),/pending/);
   assert.equal(await readFile(join(root,'public.json'),'utf8'),original);
   assert.equal((await readJson(join(root,'state.json'))).lastPoll,state.lastPoll);
   assert.equal((await readdir(join(root,'matches'))).length,1);
   await writeFile(join(root,'matches/NA1_1.json'),'{broken');
   await assert.rejects(collect(env,root,apiWith(()=>[],async id=>raw(id))));
   assert.equal(await readFile(join(root,'public.json'),'utf8'),original);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('yearly comparisons span years and exclude ARAM/Arena from lifetime and yearly totals',()=>{
 const a=normalize(raw('NA1_1',2024),'player'),b=normalize(raw('NA1_2',2025),'player');
 const summary=summarizeArchive([a,b,{...a,queue:450,kills:999},{...b,queue:1710,kills:999}]);
 assert.equal(summary.lifetime.games,2);assert.equal(summary.lifetime.killsTotal,20);
 assert.equal(summary.years[2024].games,1);assert.equal(summary.years[2025].damageTotal,12345);assert.equal(summary.yearBasis,'UTC');
});
test('pre-commit verification rejects edits and deletions but permits new archived matches',async()=>{
 const directory=await temp();
 try{
   const root=await repositoryFixture(directory),file=join(root,'matches/NA1_1.json'),original=await readFile(file);
   await verifyArchive(root,{repository:directory,checkGit:true});
   const response=raw('NA1_2');await writeJson(join(root,'matches/NA1_2.json'),{match:normalize(response,'player'),raw:response});
   git(directory,'add','.');await verifyArchive(root,{repository:directory,checkGit:true});
   const edited=JSON.parse(original);edited.match.kills=999;await writeJson(file,edited);
   await assert.rejects(verifyArchive(root,{repository:directory,checkGit:true}),/modified or deleted/);
   await writeFile(file,original);await rm(file);
   await assert.rejects(verifyArchive(root,{repository:directory,checkGit:true}),/modified or deleted/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('backup checksums verify and bundle restores Git history plus uncommitted match snapshots',async()=>{
 const directory=await temp(),destination=await temp();
 try{
   const root=await repositoryFixture(directory),response=raw('NA1_2',2026);
   await writeJson(join(root,'matches/NA1_2.json'),{match:normalize(response,'player'),raw:response});
   const backup=await createBackup(destination,{repository:directory});
   assert.equal((await verifyBackup(backup)).matches,2);
   const restored=join(destination,'restored');
   execFileSync('git',['clone',join(backup,'repository.bundle'),restored],{stdio:'pipe'});
   await cp(join(backup,'data/league'),join(restored,'data/league'),{recursive:true});
   assert.equal((await verifyArchive(join(restored,'data/league'))).matches,2);
   assert.match(git(restored,'log','-1','--format=%s'),/Fixture/);
   await writeFile(join(backup,'data/league/matches/NA1_1.json'),'{}');
   await assert.rejects(verifyBackup(backup),/checksum mismatch/);
 }finally{await rm(directory,{recursive:true,force:true});await rm(destination,{recursive:true,force:true});}
});
