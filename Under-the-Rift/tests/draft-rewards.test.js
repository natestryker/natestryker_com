import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {PORTRAIT_CROPS} from '../dist/portrait-crops.js';

const fresh=()=>E.newGame(109);
const ids=(s,role='ALL')=>E.draftProspects(s,role).map(p=>p.id);
function win(s,event,year=s.year,team=s.team){s.honors.push({year,event,winner:team,runner:team===0?1:0,managerTeam:team});}
function ui(s){
 let source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 const start=source.indexOf('const careerDB='),end=source.indexOf('function toast(');
 source=source.slice(0,start)+'let started=true;\n'+source.slice(end);source=source.slice(0,source.indexOf("document.addEventListener('click'"));
 const nodes={},document={addEventListener(){},querySelector:q=>nodes[q]??={innerHTML:'',showModal(){},close(){},focus(){},scrollIntoView(){}}};
 const context=vm.createContext({E,PORTRAIT_CROPS,document});
 vm.runInContext(source+'\nglobalThis.ui={set:x=>s=x,celebrationDialog,combinationDialog};',context);context.ui.set(s);return {api:context.ui,nodes};
}

test('scouting twice keeps every draft prospect in place, including filters and reloads',()=>{
 const s=fresh(),before=ids(s),p=E.getPlayer(s,before[35]),seed=s.seed;
 assert.ok(E.scout(s,p.id));assert.deepEqual(ids(s),before);assert.equal(p.scout,1);
 assert.ok(E.scout(s,p.id));assert.deepEqual(ids(s),before);assert.equal(p.scout,2);assert.equal(s.seed,seed);
 for(const role of E.ROLES)assert.deepEqual(ids(s,role),before.filter(id=>E.getPlayer(s,id).role===role));
 assert.deepEqual(ids(E.validateSave(structuredClone(s))),before);
 assert.ok(E.upgradeNetwork(s,s.teams[s.team].region));assert.deepEqual(ids(s),before);
 assert.ok(E.draftPlayer(s,p.id));assert.deepEqual(ids(s),before.filter(id=>E.getPlayer(s,id).team<0));
});

test('legacy boards gain stable ordering once; invalid saved orders are rejected',()=>{
 const s=fresh(),before=ids(s),seed=s.seed;delete s.draft.boardOrder;
 E.validateSave(s);assert.deepEqual(ids(s),before);assert.equal(s.seed,seed);
 for(const order of [[],[...s.draft.pool.slice(1),'missing'],s.draft.pool.map(()=>s.draft.pool[0])]){
  const bad=structuredClone(s);bad.draft.boardOrder=order;assert.throws(()=>E.validateSave(bad));
 }
 const p=E.getPlayer(s,before[20]),rank=E.scoutOrderingEstimate(s,p);p.scout=2;assert.equal(E.scoutOrderingEstimate(s,p),rank);
});

test('only managed MSI and Worlds wins earn one credit per unique title',()=>{
 const s=fresh();win(s,'LCS Spring');s.honors.push({year:s.year,event:'MSI',winner:1,runner:s.team,managerTeam:s.team});
 assert.equal(E.combinationRewards(s).length,0);const original=JSON.stringify(s);assert.equal(E.revealCombination(s),null);assert.equal(JSON.stringify(s),original);
 win(s,'MSI');win(s,'MSI');win(s,'Worlds');assert.equal(E.combinationRewards(s).length,2);
 E.dismissCelebration(s);assert.equal(E.combinationRewards(s).filter(r=>!r.claimed).length,2);
});

test('each credit reveals one unknown combination, persists, and does not use other RNG streams',()=>{
 const s=fresh();win(s,'MSI');win(s,'Worlds');
 const known=E.SECRET_COMBOS[0];s.discoveries.combos[known.secretId]={year:s.year,step:s.step};
 const seed=s.seed,discoverySeed=s.discoveries.seed,copy=E.validateSave(structuredClone(s));
 const first=E.revealCombination(s);assert.ok(first);assert.notEqual(first.secretId,known.secretId);assert.equal(E.revealCombination(copy).secretId,first.secretId);
 assert.equal(Object.keys(s.discoveries.combos).length,2);assert.equal(E.combinationRewards(s).filter(r=>!r.claimed).length,1);
 const loaded=E.validateSave(structuredClone(s));s.team=1;assert.equal(E.combinationRewards(s).filter(r=>!r.claimed).length,1);
 const second=E.revealCombination(loaded);assert.ok(second);assert.notEqual(second.secretId,first.secretId);
 assert.equal(Object.keys(loaded.discoveries.combos).length,3);assert.equal(E.combinationRewards(loaded).filter(r=>!r.claimed).length,0);
 assert.equal(loaded.seed,seed);assert.equal(loaded.discoveries.seed,discoverySeed);
 const complete=JSON.stringify(loaded);assert.equal(E.revealCombination(loaded),null);assert.equal(JSON.stringify(loaded),complete);E.validateSave(loaded);
});

test('fully discovered playbooks keep unused credits and malformed claims cannot mint rewards',()=>{
 const s=fresh();win(s,'MSI');
 for(const combo of E.SECRET_COMBOS)s.discoveries.combos[combo.secretId]={year:s.year,step:s.step};
 const before=JSON.stringify(s);assert.equal(E.revealCombination(s),null);assert.equal(JSON.stringify(s),before);assert.equal(E.combinationRewards(s).filter(r=>!r.claimed).length,1);
 const empty=fresh();win(empty,'Worlds');const combo=E.revealCombination(empty);E.validateSave(structuredClone(empty));
 for(const change of [x=>x.comboReveals={'2026:MSI:99':combo.secretId},x=>x.comboReveals[Object.keys(x.comboReveals)[0]]='unknown',x=>x.revealSeed=-1,x=>x.comboReveals=[]]){
  const bad=structuredClone(empty);change(bad.discoveries);assert.throws(()=>E.validateSave(bad));
 }
});

test('old saves and pending title celebrations acquire rewards without changing players or RNG',()=>{
 const s=fresh();win(s,'MSI');delete s.discoveries.comboReveals;delete s.discoveries.revealSeed;
 const players=structuredClone(s.players),seed=s.seed,discoverySeed=s.discoveries.seed;
 const loaded=E.validateSave(s);assert.deepEqual(loaded.players,players);assert.equal(s.seed,seed);assert.equal(s.discoveries.seed,discoverySeed);
 assert.equal(E.combinationRewards(loaded).filter(r=>!r.claimed).length,1);
});

test('actual international final wins create both celebration links and saved reveal credits',()=>{
 const s=fresh();while(!s.draft.complete)E.draftPlayer(s,s.draft.pool.find(id=>E.getPlayer(s,id).team<0));E.finishDraft(s);
 for(const p of s.players.filter(p=>p.team===s.team||p.team===1)){p.traits=[];p.form=p.team===s.team?100:50;for(const k of E.SKILLS)p.skills[k]=p.team===s.team?100:1;}
 for(const event of ['MSI','Worlds']){
  E.dismissCelebration(s);s.phase='internationalFinal';s.event=event;s.bracket=[[s.team,1]];
  assert.ok(E.enterMatchday(s));E.fastForward(s);assert.ok(s.match.won);assert.ok(E.finishMatchday(s));
  assert.equal(s.celebration.event,event);const {api,nodes}=ui(s);api.celebrationDialog();assert.match(nodes['#modal'].innerHTML,/data-action="championplaybook"/);
  E.validateSave(structuredClone(s));
 }
 assert.equal(E.combinationRewards(s).filter(r=>!r.claimed).length,2);
});

test('the playbook shows available credits, reveals details and disables exhausted rewards',()=>{
 const s=fresh();win(s,'MSI');const {api,nodes}=ui(s);api.combinationDialog();
 assert.match(nodes['#modal'].innerHTML,/1 reveal available/);assert.ok(!nodes['#modal'].innerHTML.includes(E.SECRET_COMBOS[0][2]));
 const combo=E.revealCombination(s);api.combinationDialog(combo.secretId);const html=nodes['#modal'].innerHTML;
 assert.ok(html.includes(combo[2]));assert.ok(html.includes(combo[0]));assert.ok(html.includes(combo[1]));assert.ok(html.includes('newcombo'));
 assert.match(html,/data-action="revealcombo" disabled/);
 s.celebration={year:s.year,event:'LCS Spring',winner:s.team,prize:50000,roster:[]};api.celebrationDialog();assert.doesNotMatch(nodes['#modal'].innerHTML,/championplaybook/);
});
