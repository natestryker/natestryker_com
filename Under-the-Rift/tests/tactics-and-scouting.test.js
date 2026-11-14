import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {WAVE_SCENARIOS,WARD_SCENARIOS,tacticalScenario,tacticalChoices} from '../dist/tactical-checks-data.js';
import {PORTRAIT_CROPS} from '../dist/portrait-crops.js';

function setup(){const s=E.newGame(109);while(!s.draft.complete)E.draftPlayer(s,s.draft.pool.find(id=>E.getPlayer(s,id).team<0));E.finishDraft(s);return s;}
function ui(s){
 let source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 const start=source.indexOf('const careerDB='),end=source.indexOf('function toast(');
 source=source.slice(0,start)+'let started=true;\n'+source.slice(end);source=source.slice(0,source.indexOf("document.addEventListener('click'"));
 const nodes={},document={addEventListener(){},querySelector:q=>nodes[q]??={innerHTML:'',showModal(){this.open=true;},close(){this.open=false;}}};
 const ctx=vm.createContext({E,PORTRAIT_CROPS,document});
 vm.runInContext(source+'\nofferFeedback=()=>{};globalThis.ui={set:x=>s=x,query:x=>marketQuery=x,tab:x=>marketTab=x,marketPlayers,marketRating,dossier,openProfile,globalContractDatabase,negotiationDialog};',ctx);ctx.ui.set(s);return {api:ctx.ui,nodes};
}

test('both new checks have varied, unambiguous scenarios and real scored answers',()=>{
 for(const [type,scenarios] of [['wave',WAVE_SCENARIOS],['ward',WARD_SCENARIOS]]){
  assert.ok(scenarios.length>=8);
  for(let scenario=0;scenario<scenarios.length;scenario++)for(let variant=0;variant<4;variant++){
   const c={type,scenario,variant,status:'ready',mechanics:60},q=tacticalScenario(c),choices=tacticalChoices(c);
   assert.equal(choices.length,type==='wave'?3:4);assert.equal(new Set(choices).size,choices.length);assert.ok(choices.includes(q.answer));
   assert.ok(q.explanation.length>40);if(type==='ward')assert.ok(q.spots.every(([,label,x,y])=>label&&x>=0&&x<=320&&y>=0&&y<=300));
   for(const answer of [q.answer,choices.find(x=>x!==q.answer),true]){
    const s={match:{current:{skillCheck:{...c}}}};E.startSkillCheck(s);E.finishSkillCheck(s,answer);
    assert.equal(s.match.current.skillCheck.bonus,answer===q.answer?.06:-.03);assert.ok(s.match.current.skillCheck.feedback.includes(q.explanation));
   }
  }
 }
 assert.deepEqual([...new Set(WAVE_SCENARIOS.map(q=>q.answer))].sort(),['freeze','shove','slow']);
});

test('wave and ward checks roundtrip and decide the actual match moment exactly once',()=>{
 for(const type of ['wave','ward'])for(const success of [true,false]){
  const s=setup();E.enterMatchday(s);const g=s.match.current;g.events=[0];g.modes=['check'];E.prepareReplacementCheck(s);
  Object.assign(g.skillCheck,{type,scenario:6,variant:2});const before=E.validateSave(structuredClone(s));assert.equal(before.match.current.skillCheck.type,type);
  const q=tacticalScenario(g.skillCheck),answer=success?q.answer:tacticalChoices(g.skillCheck).find(x=>x!==q.answer),preview=E.callPreview(s,'control');
  E.startSkillCheck(s);E.finishSkillCheck(s,answer);E.validateSave(structuredClone(s));assert.equal(E.finishSkillCheck(s,q.answer),false);
  const bad=structuredClone(s);bad.match.current.skillCheck.answer='not-an-option';assert.throws(()=>E.validateSave(bad));
  E.resolveCall(s,'auto');const call=s.match.games[0].calls[0];assert.equal(call.worked,success);assert.equal(call.swing,success?preview.up:-preview.down);assert.equal(call.skillCheck.type,type);
 }
});

test('initial scout reports have stable off-center estimates and narrower reports reveal the truth',()=>{
 const s=setup(),players=s.players.filter(p=>p.team!==s.team).slice(0,200),seed=s.seed,before=JSON.stringify(s);let asymmetric=0;
 const reports=players.map(p=>{const report=E.scoutEstimate(s,p);assert.ok(report.low<=E.overall(p)&&report.high>=E.overall(p));assert.ok(report.low>=50&&report.high<=100);asymmetric+=report.estimate!==E.overall(p);return report;});
 assert.ok(asymmetric>120);assert.equal(s.seed,seed);assert.equal(JSON.stringify(s),before);
 for(const [i,p] of players.entries()){
  assert.deepEqual(E.scoutEstimate(s,p),reports[i]);p.scout=1;const middle=E.scoutEstimate(s,p);
  assert.ok(middle.low>=reports[i].low&&middle.high<=reports[i].high);assert.ok(middle.high-middle.low<reports[i].high-reports[i].low);
  assert.ok(middle.low<=E.overall(p)&&middle.high>=E.overall(p));p.scout=2;assert.equal(E.scoutingLabel(s,p),String(E.overall(p)));
 }
 const p=players[0];p.scout=0;const saved=E.validateSave(structuredClone(s));assert.deepEqual(E.scoutEstimate(saved,E.getPlayer(saved,p.id)),E.scoutEstimate(s,p));
});

test('hidden traits stay out of search, scout files, profiles and the discovery collection',()=>{
 const s=setup(),p=s.players.find(p=>p.team<0&&!p.secretProspect);p.name='HiddenCandidate';p.traits=['Student','Resilient','PhoenixMind','FinalBoss'];p.scout=0;s.discoveries.seenTraits=[];
 const {api,nodes}=ui(s);api.tab('free');api.query('FinalBoss');assert.ok(!api.marketPlayers().includes(p.name));
 api.dossier(p.id);let html=nodes['#modal'].innerHTML;assert.match(html,/3 hidden traits/);assert.doesNotMatch(html,/FinalBoss|PhoenixMind|Resilient/);assert.deepEqual(s.discoveries.seenTraits,['Student']);
 api.openProfile(p.id,false,true);html=nodes['#modal'].innerHTML;assert.ok(html.includes(E.scoutingLabel(s,p)));assert.doesNotMatch(html,/class="skills"|historychart|FinalBoss|PhoenixMind/);
 p.scout=1;api.dossier(p.id);html=nodes['#modal'].innerHTML;assert.match(html,/Phoenix Mind/);assert.doesNotMatch(html,/FinalBoss/);assert.match(html,/1 hidden trait/);
 api.query('PhoenixMind');assert.ok(api.marketPlayers().includes(p.name));api.query('FinalBoss');assert.ok(!api.marketPlayers().includes(p.name));
 p.scout=2;api.dossier(p.id);assert.match(nodes['#modal'].innerHTML,/Final Boss/);api.query('FinalBoss');assert.ok(api.marketPlayers().includes(p.name));assert.ok(s.discoveries.seenTraits.includes('FinalBoss'));
});

test('the GCD uses the same scouting ranges while keeping contracts public',()=>{
 const s=setup(),p=E.starters(s,1)[0],{api}=ui(s);p.scout=0;
 const row=api.globalContractDatabase().split(`data-gcd-player="${p.id}"`)[1].split('</tr>')[0];
 assert.ok(row.includes(`<b>${E.scoutingLabel(s,p)}</b>`));assert.ok(row.includes('$'+p.contract.salary.toLocaleString('en-US')+'/yr'));
 for(const skill of E.SKILLS)assert.ok(row.includes(E.scoutingLabel(s,p,skill)));
 p.team=s.team;assert.equal(E.knownTraits(s,p).length,p.traits.length);assert.equal(E.scoutingLabel(s,p),String(E.overall(p)));
});

test('GOAT traits are moderately nerfed and demand stronger guaranteed contracts and starts',()=>{
 const s=setup(),p=E.starters(s)[0],ordinary={...p,traits:[]};p.traits=['FioraMain','Captain'];
 const ask=E.askingTerms(s,p),normal=E.askingTerms(s,ordinary);
 assert.equal(E.PERSONALITY.FioraMain.skills.Mechanics,12);assert.equal(E.PERSONALITY.Jhinaholic.skills.Teamfighting,7);
 assert.ok(ask.salary>normal.salary*1.2);assert.ok(ask.bonus>normal.bonus*1.5);assert.equal(ask.role,'Starter');assert.equal(ask.years,2);assert.equal(E.requiredStartShare(p),.8);
 for(const changed of [{role:'Rotation',salary:200000,bonus:500000},{years:5},{salary:5000},{bonus:0}]){
  assert.ok(E.offerEvaluation(s,p,{...ask,...changed}).score<55);assert.ok(E.goatDealIssues(s,p,{...ask,...changed}).length);
 }
 assert.ok(E.submitOffer(s,p.id,ask).ok);E.processOffers(s);const offer=s.market.offers.at(-1);assert.equal(offer.status,'agreed');assert.ok(E.acceptOffer(s,offer.id).ok);
 p.form=80;p.trust=80;const replacement=E.createPlayer(s,p.role,45,s.team,'main');s.players.push(replacement);
 for(let i=0;i<4;i++){s.teams[s.team].lineup[p.role]=i<3?p.id:replacement.id;E.marketMatchday(s,[s.team]);}
 assert.equal(p.contract.promise.played,3);assert.equal(p.trust,68);assert.equal(p.form,75);
 const {api,nodes}=ui(s);api.negotiationDialog(p.id);assert.match(nodes['#modal'].innerHTML,/GOAT obligations|80%/);E.validateSave(structuredClone(s));
});
