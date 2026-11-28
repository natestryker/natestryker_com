import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildBank,findAnswer,suggestAnswers,normalize,dayKey,dailyQuestions,createRun,validRun,submitAnswer,rankAnswers,RARITIES,ROUND_LENGTH} from '../games/tank-intel/core.mjs';
const catalogue=JSON.parse(await readFile(new URL('../games/tank-intel/catalogue.json',import.meta.url),'utf8'));
const bank=buildBank(catalogue),prompt=id=>bank.find(q=>q.id===id);

test('expanded sourced catalogue: each prompt has five rarities and one singular Tank Ace',()=>{
  assert.ok(bank.length>=100,bank.length);assert.ok(catalogue.tanks.length>=900);assert.ok(catalogue.maps.length>=60);
  assert.equal(new Set(bank.map(q=>q.id)).size,bank.length);
  for(const q of bank){
    assert.ok(q.answers.length>=5,q.id);
    assert.equal(q.answers.filter(a=>a.points===100).length,1,q.id);
    assert.deepEqual(new Set(q.answers.map(a=>a.rarity)),new Set(RARITIES.map(r=>r.name)),q.id);
    assert.equal(new Set(q.answers.map(a=>normalize(a.name))).size,q.answers.length,q.id);
    for(const a of q.answers){assert.ok(a.source?.startsWith('https://'),q.id+': '+a.name);assert.ok(a.basis&&Number.isFinite(a.exposure));}
  }
  console.log(`${bank.length} prompts; ${bank.reduce((n,q)=>n+q.answers.length,0)} accepted prompt/answer combinations`);
});
test('every canonical answer can be submitted without ambiguity',()=>{
  for(const q of bank)for(const answer of q.answers)assert.equal(findAnswer(q,answer.name)?.id,answer.id,q.id+': '+answer.name);
});
test('historical classifications, retired maps, old equipment, and old consumables remain valid',()=>{
  for(const [id,name] of [
    ['tier-10-td','WT E100'],['tier-10-td','Object 263'],['tier-10-medium','FV4202'],
    ['tier-5','T-50-2'],['tier-6-light','T-50-2'],['tier-7-light','Aufkl Panther'],
    ['retired-maps','Hidden Village'],['retired-maps','Port'],['retired-maps','Northwest'],
    ['all-maps','Klondike'],['all-maps','Nebelburg'],['all-maps','Hinterland'],
    ['retired-equipment','Toolbox'],['retired-equipment','Cyclone Filter'],
    ['retired-tanks','FV215b'],['retired-tanks','FV215b (183)'],['retired-tanks','Foch 155'],
    ['consumables','Removed Speed Governor'],['consumables','100-octane Gasoline']
  ])assert.ok(findAnswer(prompt(id),name),id+': '+name);
  for(const name of ['Encounter Area','Mission Area'])assert.equal(findAnswer(prompt('all-maps'),name),null);
  assert.equal(findAnswer(prompt('class-spg'),'Maus'),null);
});
test('normalization, abbreviations, model names and typo confirmation',()=>{
  for(const [id,value] of [['tier-10-heavy','T110 E5'],['tier-10-heavy','E5'],['tier-10-td','obj 268 v4'],['tier-10-medium','Batchat 25t'],['tier-10-td','NC 70 Blyskawica'],['tier-10-light','Vz 71 Tesak'],['all-equipment','CVS']])assert.ok(findAnswer(prompt(id),value),id+': '+value);
  assert.equal(findAnswer(prompt('tier-10-heavy'),'Muas'),null);
  assert.ok(suggestAnswers(prompt('tier-10-heavy'),'Muas').some(a=>a.name==='Maus'));
  assert.ok(suggestAnswers(prompt('all-maps'),'Himmelsdrof').some(a=>a.name==='Himmelsdorf'));
  assert.ok(!suggestAnswers(prompt('tier-10-heavy'),'Object 278').some(a=>a.name==='Object 277'));
  assert.deepEqual(suggestAnswers(prompt('tier-10-heavy'),'m'),[]);
  const ambiguous={answers:[{id:'first',name:'First vehicle',aliases:['Shared nickname']},{id:'second',name:'Second vehicle',aliases:['Shared nickname']}]};
  assert.equal(findAnswer(ambiguous,'Shared nickname'),null);
  assert.equal(suggestAnswers(ambiguous,'Shared nickname').length,2);
});
test('compound-name, phonetic, partial-name, reordered-word, and model-letter corrections',()=>{
  for(const [id,value,target] of [
    ['tier-10-td','waffentrager e100','Waffenträger auf E 100'],
    ['tier-10-td','jagpanzer e100','Jagdpanzer E 100'],
    ['tier-10-td','e100 jagdpanzer','Jagdpanzer E 100'],
    ['tier-10-td','bliskavica','NC 70 Błyskawica'],
    ['tier-10-light','rheinmetal panzerwagon','Rheinmetall Panzerwagen'],
    ['tier-10-medium','Leoperd 1','Leopard 1'],
    ['class-medium','burask','Bat.-Châtillon Bourrasque'],
    ['tier-10-heavy','E1OO','E 100'],
    ['creators-all','Quikybaby','QuickyBaby'],
    ['creators-all','Skil4lutu','Skill4ltu'],
    ['crew-all','situatonal awarness','Situational Awareness']
  ])assert.ok(suggestAnswers(prompt(id),value).some(a=>normalize(a.name)===normalize(target)),`${id}: ${value} → ${target}; got ${suggestAnswers(prompt(id),value).map(a=>a.name).join(', ')}`);
  assert.ok(findAnswer(prompt('tier-10-td'),'FV183'));
  assert.ok(findAnswer(prompt('class-medium'),'Borat'));
  assert.ok(findAnswer(prompt('class-td'),'RHM'));
  assert.equal(findAnswer(prompt('creators-all'),'QB')?.name,'QuickyBaby');
});
test('new topics cover creators, Christmas box years, crew roles, release eras, and mechanics',()=>{
  assert.ok(bank.filter(q=>q.creative).length>=35);
  for(const family of ['creators','holiday','crew','eras','mechanics','oddities'])assert.ok(bank.some(q=>q.family===family),family);
  assert.ok(bank.filter(q=>q.creative).every(q=>q.answers.every(a=>!a.id.startsWith('reference-'))),'Every sourced creative vehicle must resolve to a shared identity');
  for(const [id,value] of [['holiday-boxes-2023','BZ-176'],['holiday-boxes-2024','Vickers 6 ton'],['holiday-boxes-2025','DZT-159'],['creators-team-clash','Dakillzor'],['creators-team-clash','AEG'],['crew-gunner','Snap Shot'],['crew-loader','Intuition'],['crew-commander','Hold the Line'],['releases-2020','Char Futur 4'],['released-before-2020','FV215b'],['jet-boosters','BZ-75'],['animal-names','Maus']])assert.ok(findAnswer(prompt(id),value),id+': '+value);
  assert.equal(prompt('crew-2026'),undefined);
  for(const [id,value] of [['holiday-boxes-2022','BZ-176'],['holiday-boxes-2024','Panzerwagen 39'],['crew-commander','Snap Shot'],['crew-all','Sixth Sense'],['released-after-2020','Object 777 Version II'],['releases-2022','T-22 medium']])assert.equal(findAnswer(prompt(id),value),null,id+': '+value);
  for(const q of bank.filter(q=>['all-maps','maps-a-l','maps-m-z'].includes(q.id)))assert.ok(q.title.startsWith('Name a (Current or Former) WoT Map'));
  assert.equal(findAnswer(prompt('creators-all'),'Jingles')?.name,'The Mighty Jingles');
});
test('accented names survive imports and tiny test-account samples need release evidence',()=>{
  for(const q of bank)for(const answer of q.answers)assert.doesNotMatch(answer.name,/[ÃÂÐ]|â[€\u0080-\u00bf]|Å[\u0080-\u00bf]/u,answer.name);
  for(const name of ['Löwe','Škoda T 56','Bat.-Châtillon 25 t','Aufklärungspanzer Panther'])assert.ok(catalogue.tanks.some(t=>t.name===name),name);
  for(const id of ['G122_VK6501H','J42_Chi_Se','R188_Object_259A'])assert.ok(!catalogue.tanks.some(t=>t.id===id),id);
  for(const id of ['G32_PzV_PzIV_ausf_Alfa','G183_Fossa_VM_68','Pl38_63TP_Rycerski'])assert.ok(catalogue.tanks.some(t=>t.id===id),id);
});
test('invalid guesses never consume attempts or reset the deadline; only one accepted answer can score',()=>{
  const q=prompt('tier-10-heavy'),run=createRun([q],1000),original=structuredClone(run);
  for(let i=0;i<100;i++)assert.equal(submitAnswer(run,q,'not a tank','answer',1001+i).kind,'retry');
  assert.deepEqual(run,original);
  const typo=submitAnswer(run,q,'Muas','answer',2000);assert.equal(typo.kind,'retry');assert.ok(typo.suggestions.length);
  const accepted=submitAnswer(run,q,'Maus','answer',2001);assert.equal(accepted.kind,'recorded');assert.equal(run.results.length,1);
  assert.equal(submitAnswer(run,q,'Maus','answer',2002).kind,'inactive');assert.equal(run.results.length,1);
  assert.ok(validRun(run,[q]));
});
test('late corrections and valid guesses time out against the original absolute deadline',()=>{
  const q=prompt('tier-10-heavy');
  for(const reason of ['answer','pass']){const run=createRun([q],1000);const outcome=submitAnswer(run,q,'Maus',reason,1000+ROUND_LENGTH);assert.equal(outcome.kind,'recorded');assert.equal(run.results[0].reason,'timeout');assert.equal(run.results[0].points,0);}
});
test('saved runs are pinned to their exact bank and schedule; malformed data is rejected',()=>{
  const questions=dailyQuestions(bank,'2026-11-28'),run=createRun(questions,1000);assert.ok(validRun(JSON.parse(JSON.stringify(run)),questions));
  for(const modified of [{...run,index:7},{...run,bankVersion:'older-bank'},{...run,questionIds:['different']},{...run,results:[{reason:'answer',points:100,answerId:'unknown'}]},{...run,deadline:null}])assert.equal(validRun(modified,questions),false);
});
test('Eastern midnight is real in winter, summer, and daylight-saving transitions',()=>{
  for(const [before,after,oldDay,newDay] of [
    ['2026-11-28T04:59:59Z','2026-11-28T05:00:00Z','2026-11-27','2026-11-28'],
    ['2026-07-01T03:59:59Z','2026-07-01T04:00:00Z','2026-06-30','2026-07-01'],
    ['2026-03-08T04:59:59Z','2026-03-08T05:00:00Z','2026-03-07','2026-03-08'],
    ['2026-11-02T04:59:59Z','2026-11-02T05:00:00Z','2026-11-01','2026-11-02']
  ]){assert.equal(dayKey(Date.parse(before)),oldDay);assert.equal(dayKey(Date.parse(after)),newDay);}
});
test('daily selection is shared, deterministic, varied, and contains seven unique prompts',()=>{
  const seen=new Set();
  for(let i=0;i<365;i++){
    const day=new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),questions=dailyQuestions(bank,day);
    assert.equal(questions.length,7);assert.equal(new Set(questions.map(q=>q.id)).size,7);assert.equal(new Set(questions.map(q=>q.family)).size,7);
    assert.ok(questions.filter(q=>q.creative).length>=2);
    assert.deepEqual(questions.map(q=>q.id),dailyQuestions(bank,day).map(q=>q.id));
    seen.add(questions.map(q=>q.id).join('|'));
  }
  assert.equal(seen.size,365);
});
test('rarity uses exposure ordering, missing-data priors, and stable single-Ace tie breaks',()=>{
  const ranked=rankAnswers(['Alpha','Bravo','Charlie','Delta','Echo'].map((name,i)=>({name,exposure:5-i})));
  assert.deepEqual(ranked.map(a=>a.points),[20,40,60,80,100]);
  const tied=rankAnswers(['A','B','C','D','E'].map(name=>({name,exposure:1})));
  assert.equal(tied.filter(a=>a.rarity==='Tank Ace').length,1);
  assert.ok(catalogue.tanks.filter(t=>t.method==='observed-popularity').length>900);
  assert.ok(catalogue.tanks.filter(t=>!t.usage?.players).every(t=>t.exposure>0));
});
