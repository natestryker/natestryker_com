import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {PORTRAIT_CROPS} from '../dist/portrait-crops.js';

const base=E.newGame(183);
const fresh=()=>E.validateSave(structuredClone(base));
function draft(s){while(!s.draft.complete)assert.ok(E.draftPlayer(s,s.draft.pool.find(id=>{const p=E.getPlayer(s,id);return p.team<0&&E.draftEligible(s,p,s.team);})));assert.ok(E.finishDraft(s));}
function special(kind){const s=fresh();let seed=0;for(;seed<100000;seed++){const x={seed};if(E.secretRandom(x)<.2&&Object.keys(E.SECRET_PROSPECTS)[Math.floor(E.secretRandom(x)*3)]===kind)break;}s.discoveries.seed=seed;s.discoveries.prospect.lastRollYear=null;E.seedSecretProspect(s,s.draft.pool);return s;}
function ui(s){let source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');const start=source.indexOf('const careerDB='),end=source.indexOf('function toast(');source=source.slice(0,start)+'let started=false;\n'+source.slice(end);source=source.slice(0,source.indexOf("document.addEventListener('click'"));const nodes={},document={addEventListener(){},querySelector:q=>nodes[q]??={innerHTML:'',showModal(){},close(){}}};const ctx=vm.createContext({E,PORTRAIT_CROPS,document,console});vm.runInContext(source+'\nglobalThis.ui={set:x=>s=x,academyView,roster,openProfile,matchView,playerName,captainBadge};',ctx);ctx.ui.set(s);return {...ctx.ui,nodes};}

test('every club has one deterministic captain and selection consumes no RNG or state',()=>{
 const s=fresh(),before=JSON.stringify(s);
 for(const team of s.teams){const p=E.teamCaptain(s,team.id),owned=s.players.filter(p=>p.team===team.id);assert.ok(p);assert.equal(p.team,team.id);assert.equal(p.age,Math.max(...owned.map(p=>p.age)));assert.equal(E.teamCaptain(s,team.id).id,p.id);}
 assert.equal(JSON.stringify(s),before);assert.equal(E.teamCaptain(s,-1),null);
});

test('tenure wins, age decides near ties, and ties use the original longest-serving cohort',()=>{
 const s=fresh(),ps=E.starters(s);s.step=40;
 ps.forEach((p,i)=>{p.clubTenure={team:p.team,since:20+i};p.age=22;});
 ps[0].clubTenure.since=0;ps[0].age=19;ps[1].clubTenure.since=3;ps[1].age=35;
 assert.equal(E.teamCaptain(s).id,ps[0].id);
 ps[1].clubTenure.since=2;assert.equal(E.teamCaptain(s).id,ps[1].id);
 ps[2].clubTenure.since=4;ps[2].age=50;assert.equal(E.teamCaptain(s).id,ps[1].id);
 ps[1].age=19;assert.equal(E.teamCaptain(s).id,ps[0].id);
});

test('special players always lead their draft listing and become captain immediately, including in academy',()=>{
 for(const kind of Object.keys(E.SECRET_PROSPECTS)){
  const s=special(kind),p=s.players.find(p=>p.secretProspect),pool=[...s.draft.pool];
  assert.ok(p.traits.includes('Captain'));assert.equal(E.draftProspects(s)[0].id,p.id);assert.equal(E.draftProspects(s,p.role)[0].id,p.id);
  assert.deepEqual(s.draft.pool,pool);assert.ok(E.draftPlayer(s,p.id));assert.equal(p.squad,'academy');assert.equal(E.teamCaptain(s).id,p.id);
  draft(s);assert.equal(E.teamCaptain(s).id,p.id);assert.equal(E.teamCaptain(E.validateSave(structuredClone(s))).id,p.id);
 }
});

test('special prospect priority remains first even if another prospect has a better rating',()=>{
 const s=special('toast'),p=s.players.find(p=>p.secretProspect),other=E.draftProspects(s).find(q=>q.id!==p.id);
 other.skills=Object.fromEntries(E.SKILLS.map(k=>[k,100]));assert.ok(E.overall(other)>E.overall(p));assert.equal(E.draftProspects(s)[0].id,p.id);
 const team=1,position=s.draft.pool.indexOf(p.id);assert.ok(E.passDraftPick(s));assert.equal(p.team,team);assert.ok(s.draft.picks.some(pick=>pick.player===p.id));assert.equal(s.draft.pool[position],p.id);
});

test('legacy special players gain Captain without disturbing their passives or recorded ability',()=>{
 const s=special('vdupard'),p=s.players.find(p=>p.secretProspect);p.traits=p.traits.filter(t=>t!=='Captain');const skills={...p.skills},seed=s.seed;
 E.validateSave(s);assert.ok(p.traits.includes('FioraMain'));assert.ok(p.traits.includes('Captain'));assert.deepEqual(p.skills,skills);assert.equal(s.seed,seed);
});

test('renewals, promotions and demotions preserve the current club stint',()=>{
 const s=fresh();s.step=12;const p=E.draftProspects(s)[0];assert.ok(E.draftPlayer(s,p.id));assert.deepEqual(p.clubTenure,{team:s.team,since:12});
 draft(s);assert.ok(E.callUp(s,p.id));assert.ok(E.demote(s,p.id));assert.deepEqual(p.clubTenure,{team:s.team,since:12});
 const terms={...E.askingTerms(s,p),salary:80000,years:5};assert.ok(E.submitOffer(s,p.id,terms).ok);E.processOffers(s);const o=s.market.offers.at(-1);assert.equal(o.status,'agreed');s.step=20;assert.ok(E.acceptOffer(s,o.id).ok);assert.deepEqual(p.clubTenure,{team:s.team,since:12});
});

test('release, re-signing and club changes reset continuous tenure while retaining connection history',()=>{
 const s=fresh();draft(s);const p=E.academy(s)[0],mate=E.academy(s)[1],key=[p.id,mate.id].sort().join('|');s.bonds[key]=66;s.step=10;
 assert.ok(E.releasePlayer(s,p.id).ok);assert.equal(p.clubTenure,null);s.step=16;
 assert.ok(E.submitOffer(s,p.id,{...E.askingTerms(s,p),salary:80000,years:2}).ok);const o=s.market.offers.at(-1);o.rivals=[];E.processOffers(s);assert.equal(o.status,'agreed');assert.ok(E.acceptOffer(s,o.id).ok);
 assert.deepEqual(p.clubTenure,{team:s.team,since:16});assert.equal(s.bonds[key],66);
 s.step=22;E.setPlayerTeam(s,p,1);assert.deepEqual(p.clubTenure,{team:1,since:22});
});

test('an actual completed trade resets incoming tenure and reassigns both captains',()=>{
 const s=fresh();draft(s);s.step=20;s.budget=500000;const p=E.starters(s)[0],q=E.starters(s,1)[0];p.listing=q.listing='Available';
 assert.ok(E.submitTrade(s,{team:1,give:[p.id],take:[q.id],cash:100000}).ok);const d=s.market.inbox[0];assert.ok(E.completeTrade(s,d.id).ok);
 assert.deepEqual(p.clubTenure,{team:1,since:20});assert.deepEqual(q.clubTenure,{team:s.team,since:20});assert.equal(E.teamCaptain(s).team,s.team);assert.equal(E.teamCaptain(s,1).team,1);E.validateSave(structuredClone(s));
});

test('tenure migrates from existing club history, survives reload and rejects invalid timestamps',()=>{
 const s=fresh();s.step=30;const p=E.starters(s)[0];delete p.clubTenure;s.discoveries.history[p.id]={team:p.team,since:9,visited:[p.team]};const seed=s.seed;
 E.validateSave(s);assert.deepEqual(p.clubTenure,{team:p.team,since:9});assert.equal(s.seed,seed);assert.equal(E.teamCaptain(E.validateSave(structuredClone(s))).id,E.teamCaptain(s).id);
 for(const tenure of [{team:999,since:0},{team:s.team,since:31},{team:s.team,since:-1},{team:s.team,since:'0'}]){const bad=structuredClone(s);bad.players[0].clubTenure=tenure;assert.throws(()=>E.validateSave(bad));}
});

test('captain Communication gives a bounded and increasing boost to displayed and resolved calls',()=>{
 const s=fresh();draft(s);E.enterMatchday(s);s.match.current.modes=s.match.current.events.map(()=>'call');
 const captain=E.teamCaptain(s),actor=E.starters(s).find(p=>p.role===E.EVENTS[s.match.current.events[0]].calls[0][0]);
 captain.skills.Communication=40;const low=E.captainCallBonus(s);captain.skills.Communication=100;const high=E.captainCallBonus(s);assert.equal(high,.015);assert.ok(high>low);
 assert.equal(E.captainCallBonus(s,1),E.effectiveSkill(E.teamCaptain(s,1),'Communication')*.00015);
 const preview=E.callPreview(s,'control'),before=s.seed;assert.equal(preview.captain.id,captain.id);assert.equal(preview.captainBonus,.015);assert.equal(s.seed,before);assert.ok(preview.chance<=.85);
 assert.ok(E.resolveCall(s,'control'));const game=s.match.games[0]||s.match.current;assert.equal(game.calls[0].chance,preview.chance);assert.ok(actor);
});

test('the captain bonus itself can change a call outcome without changing the lineup or its chemistry',()=>{
 const s=fresh();draft(s);const captain=E.academy(s)[0];captain.age=100;assert.equal(E.teamCaptain(s).id,captain.id);
 E.enterMatchday(s);s.match.current.modes=s.match.current.events.map(()=>'call');
 captain.skills.Communication=40;const low=E.callPreview(s,'control'),chemistry=E.chemistry(s);
 captain.skills.Communication=100;const high=E.callPreview(s,'control');assert.equal(E.chemistry(s),chemistry);assert.ok(Math.abs(high.chance-low.chance-.009)<1e-12);
 let seed=0;for(;seed<100000;seed++){const roll=E.rng({seed});if(roll>=low.chance&&roll<high.chance)break;}assert.ok(seed<100000);
 const a=structuredClone(s),b=structuredClone(s);E.getPlayer(a,captain.id).skills.Communication=40;a.seed=b.seed=seed;
 E.resolveCall(a,'control');E.resolveCall(b,'control');const call=x=>(x.match.games[0]||x.match.current).calls[0];assert.equal(call(a).worked,false);assert.equal(call(b).worked,true);assert.equal(call(a).chance,low.chance);assert.equal(call(b).chance,high.chance);
});

test('special names are highlighted in draft and profiles, with one visible captain badge per ordinary roster',()=>{
 const s=special('toast'),p=s.players.find(p=>p.secretProspect),v=ui(s),html=v.academyView();
 assert.match(html,/special-player-name/);assert.match(html,/C · Captain/);assert.ok(html.indexOf('special-player-name')<html.indexOf('data-draft='));
 assert.match(v.playerName({...p,name:'<script>alert(1)</script>'}),/&lt;script&gt;/);assert.doesNotMatch(v.playerName({...p,name:'<script>'}),/<script>/);
 assert.ok(E.draftPlayer(s,p.id));draft(s);v.openProfile(p.id);assert.match(v.nodes['#modal'].innerHTML,/special-player-name/);assert.match(v.nodes['#modal'].innerHTML,/C · Captain/);
 const normal=fresh(),n=ui(normal),roster=n.roster();assert.equal((roster.match(/C · Captain/g)||[]).length,1);assert.match(roster,/Club captain/);assert.match(roster,/percentage points to calls/);
});
