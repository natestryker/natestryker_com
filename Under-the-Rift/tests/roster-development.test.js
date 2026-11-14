import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import {PORTRAIT_CROPS} from '../dist/portrait-crops.js';

const base=E.newGame(183);
const fresh=()=>E.validateSave(structuredClone(base));
const key=(a,b)=>[a.id,b.id].sort().join('|');
function drafted(){const s=fresh();while(!s.draft.complete)assert.ok(E.draftPlayer(s,s.draft.pool.find(id=>{const p=E.getPlayer(s,id);return p.team<0&&E.draftEligible(s,p,s.team);})));return s;}
function offer(s,p,terms={}){assert.ok(E.submitOffer(s,p.id,{...E.askingTerms(s,p),...terms}).ok);return s.market.offers.at(-1);}
function ui(s){let source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');const start=source.indexOf('const careerDB='),end=source.indexOf('function toast(');source=source.slice(0,start)+'let started=false;\n'+source.slice(end);source=source.slice(0,source.indexOf("document.addEventListener('click'"));const nodes={},document={addEventListener(){},querySelector:q=>nodes[q]??={innerHTML:'',showModal(){},close(){}}};const ctx=vm.createContext({E,PORTRAIT_CROPS,document,console});vm.runInContext(source+'\nofferFeedback=()=>{};globalThis.ui={set:x=>s=x,academyView,openProfile,negotiationDialog,offerFeedback:()=>{}};',ctx);ctx.ui.set(s);return {...ctx.ui,nodes};}

test('academy fixtures build every academy pair at the same rate as main-team connections',()=>{
 const s=drafted();E.finishDraft(s);const ps=E.academy(s),main=E.starters(s),ai=E.academy(s,1);
 ps.forEach(p=>p.focus='Balanced');main.forEach(p=>p.focus='Balanced');ps[0].focus='Communication';
 const before=E.familiarity(s,main[0].id,main[1].id);
 E.enterMatchday(s);E.fastForward(s);assert.ok(E.finishMatchday(s));
 for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++)assert.equal(E.familiarity(s,ps[i].id,ps[j].id),i===0?3:2);
 assert.equal(E.familiarity(s,main[0].id,main[1].id),before+2);
 assert.ok(E.familiarity(s,ai[0].id,ai[1].id)>=2);
 E.validateSave(structuredClone(s));
});

test('academy connections improve academy strength and survive call-ups and demotions',()=>{
 const s=drafted(),ps=E.academy(s),[a,b]=ps;s.bonds[key(a,b)]=70;
 const before=E.academyRating(s);s.bonds[key(a,b)]=0;assert.ok(before>E.academyRating(s));s.bonds[key(a,b)]=70;
 assert.ok(E.callUp(s,a.id));assert.ok(E.callUp(s,b.id));assert.equal(E.familiarity(s,a.id,b.id),70);
 assert.ok(E.demote(s,a.id));assert.equal(E.familiarity(s,a.id,b.id),70);
 assert.ok(E.callUp(s,a.id));assert.ok(E.setStarter(s,a.id));assert.ok(E.setStarter(s,b.id));assert.equal(E.familiarity(s,a.id,b.id),70);
});

test('former players retain softened connections through release, re-signing and save reload',()=>{
 const s=drafted(),[a,b]=E.academy(s);s.bonds[key(a,b)]=80;
 assert.ok(E.releasePlayer(s,a.id).ok);for(let n=0;n<12;n++)E.decayConnections(s);
 const retained=E.familiarity(s,a.id,b.id);assert.ok(retained>50&&retained<80);
 const o=offer(s,a,{salary:80000,bonus:5000});o.rivals=[];E.processOffers(s);assert.equal(o.status,'agreed');assert.ok(E.acceptOffer(s,o.id).ok);
 assert.equal(E.familiarity(s,a.id,b.id),retained);E.decayConnections(s);assert.equal(E.familiarity(s,a.id,b.id),retained);
 assert.equal(E.familiarity(E.validateSave(structuredClone(s)),a.id,b.id),retained);
});

test('connections fade only while apart and keep a lasting memory through long absences',()=>{
 const s=drafted(),[a,b]=E.academy(s),bond=key(a,b);s.bonds[bond]=90;E.decayConnections(s);assert.equal(s.bonds[bond],90);
 a.team=-1;a.squad='free';a.contract=null;E.decayConnections(s);assert.ok(s.bonds[bond]<90&&s.bonds[bond]>85);
 for(let n=0;n<1000;n++)E.decayConnections(s);assert.equal(s.bonds[bond],22.5);
 a.team=b.team=-1;E.decayConnections(s);assert.equal(s.bonds[bond],22.5);
 const [c,d]=E.starters(s);s.bonds[key(c,d)]=4;c.team=-1;
 for(let n=0;n<30;n++)E.decayConnections(s);assert.ok(E.familiarity(s,c.id,d.id)<4&&E.familiarity(s,c.id,d.id)>0);
});

test('connection imports reject nonnumeric, out-of-range and malformed player pairs',()=>{
 for(const change of [s=>s.bonds[key(E.starters(s)[0],E.starters(s)[1])]=NaN,s=>s.bonds['p0|p1']=101,s=>s.bonds['p0|p0']=30]){const s=fresh();change(s);assert.throws(()=>E.validateSave(s));}
});

test('four- and five-year extensions sign exactly once and preserve the current expiry before extending',()=>{
 for(const years of [4,5]){const s=fresh(),p=E.starters(s)[0],end=p.contract.end,budget=s.budget,o=offer(s,p,{salary:100000,bonus:5000,years});E.processOffers(s);assert.equal(o.status,'agreed');assert.ok(E.acceptOffer(s,o.id).ok);assert.equal(p.contract.end,end+years);assert.equal(s.budget,budget-5000);assert.equal(E.acceptOffer(s,o.id).ok,false);E.validateSave(structuredClone(s));}
});

test('a newly recruited player can sign a five-year contract',()=>{
 const s=drafted(),p=s.players.find(p=>p.team===-1&&!p.secretProspect),o=offer(s,p,{salary:100000,bonus:5000,years:5,role:'Rotation'});o.rivals=[];
 E.processOffers(s);assert.equal(o.status,'agreed');assert.ok(E.acceptOffer(s,o.id).ok);assert.equal(p.contract.end,s.year+4);E.validateSave(structuredClone(s));
});

test('players have stable individual length preferences that migrate without consuming RNG',()=>{
 const s=fresh();assert.deepEqual([...new Set(s.players.map(p=>p.preferredYears))].sort(),[1,2,3,4,5]);
 const preferences=s.players.map(p=>p.preferredYears),seed=s.seed;s.players.forEach(p=>delete p.preferredYears);E.validateSave(s);
 assert.deepEqual(s.players.map(p=>p.preferredYears),preferences);assert.equal(s.seed,seed);
 for(const p of s.players.filter(p=>p.preference==='Security'))assert.ok(p.preferredYears>=4);
 for(const value of [0,6,1.5,'3']){const bad=fresh();bad.players[0].preferredYears=value;assert.throws(()=>E.validateSave(bad));}
});

test('a preferred short or long term matters and richer offers can compensate for a mismatch',()=>{
 const s=fresh(),p=E.starters(s)[0];p.preferredYears=1;const ask=E.askingTerms(s,p);
 assert.ok(E.offerEvaluation(s,p,ask).score>E.offerEvaluation(s,p,{...ask,years:5}).score);
 assert.match(E.offerEvaluation(s,p,{...ask,years:5}).reasons.join(' '),/Prefers 1 year/);
 p.preference='Security';p.preferredYears=5;const long=E.askingTerms(s,p);
 assert.ok(E.offerEvaluation(s,p,long).score>E.offerEvaluation(s,p,{...long,years:1}).score);
 assert.ok(E.offerEvaluation(s,p,{...long,years:1,salary:long.salary*2}).score>=55);
});

test('unhappy players sometimes counter and sometimes reject; satisfied players always agree',()=>{
 for(const [seed,status] of [[0,'counter'],[1200,'rejected']]){const s=fresh(),p=E.starters(s)[0],o=offer(s,p,{salary:5000,bonus:0,years:1,role:'Prospect'});s.seed=seed;E.processOffers(s);assert.equal(o.status,status);assert.equal(E.heldCash(s),status==='counter'?o.bonus:0);if(status==='counter'){assert.equal(o.counter.years,p.preferredYears);assert.ok(E.offerEvaluation(s,p,o.counter).score>=55);assert.ok(E.submitOffer(s,p.id,o.counter).ok);E.processOffers(s);assert.equal(s.market.offers.at(-1).status,'agreed');}}
 for(const seed of [0,1200]){const s=fresh(),p=E.starters(s)[0],o=offer(s,p,{salary:100000,years:5});s.seed=seed;E.processOffers(s);assert.equal(o.status,'agreed');assert.equal(o.counter,undefined);assert.equal(s.seed,seed);}
});

test('counteroffers can shorten an overlong offer and survive export/import',()=>{
 const s=fresh(),p=E.starters(s)[0];p.preferredYears=1;
 const o=offer(s,p,{salary:Math.round(E.askingTerms(s,p).salary*.7/500)*500,bonus:0,years:5});s.seed=0;E.processOffers(s);
 assert.equal(o.status,'counter');assert.equal(o.counter.years,1);const loaded=E.validateSave(structuredClone(s));assert.deepEqual(loaded.market.offers.at(-1).counter,o.counter);
 const bad=structuredClone(s);bad.market.offers.at(-1).counter.years=6;assert.throws(()=>E.validateSave(bad));
});

test('signature traits change effective skills, overall, training and actual match performance',()=>{
 const s=fresh(),p=E.starters(s)[0];p.skills=Object.fromEntries(E.SKILLS.map(k=>[k,60]));p.traits=[];const normal=E.overall(p);
 p.traits=['FioraMain'];assert.equal(E.effectiveSkill(p,'Mechanics'),78);assert.equal(E.effectiveSkill(p,'Macro'),55);assert.ok(E.overall(p)>normal);
 p.traits=['Jhinaholic'];assert.equal(E.effectiveSkill(p,'Mechanics'),66);assert.equal(E.effectiveSkill(p,'Teamfighting'),70);
 p.skills.Mechanics=99;p.skills.Teamfighting=99;assert.equal(E.effectiveSkill(p,'Mechanics'),100);assert.equal(E.effectiveSkill(p,'Teamfighting'),100);
 for(const [trait,focus] of [['FioraMain','Mechanics'],['Jhinaholic','Teamfighting']]){const a=fresh(),b=structuredClone(a),pa=E.starters(a)[0],pb=E.starters(b)[0];pa.traits=[];pb.traits=[trait];pa.focus=pb.focus=focus;E.training(a);E.training(b);assert.ok(pb.skills[focus]>pa.skills[focus]);}
 const a=drafted(),b=structuredClone(a),pa=E.starters(a)[3],pb=E.starters(b)[3];pa.traits=[];pb.traits=['Jhinaholic'];E.finishDraft(a);E.finishDraft(b);E.enterMatchday(a);E.enterMatchday(b);E.fastForward(a);E.fastForward(b);
 const ar=a.match.games[0].ratings.find(r=>r.id===pa.id),br=b.match.games[0].ratings.find(r=>r.id===pb.id);assert.ok(br.rating>ar.rating);E.validateSave(structuredClone(b));
});

test('academy profiles show academy partners and displayed skills include signature passives',()=>{
 const s=drafted(),[a,b]=E.academy(s),v=ui(s);s.bonds[key(a,b)]=48;a.traits=['FioraMain'];a.skills.Mechanics=60;a.skills.Macro=60;
 v.openProfile(a.id);const html=v.nodes['#modal'].innerHTML;assert.ok(html.includes(b.name));assert.match(html,/48% familiarity/);assert.match(html,/Mechanics<\/span><b>78/);assert.match(html,/Macro<\/span><b>55/);assert.match(html,/FioraMain/);
 E.finishDraft(s);assert.match(v.academyView(),/Academy connections/);
});

test('contract talks display the preferred term and offer every length through five years',()=>{
 const s=fresh(),p=E.starters(s)[0],v=ui(s);p.preferredYears=5;v.negotiationDialog(p.id);
 const html=v.nodes['#modal'].innerHTML;assert.match(html,/Prefers 5 years added to the current deal/);
 for(const years of E.CONTRACT_YEARS)assert.ok(html.includes(`option value="${years}"`));assert.match(html,/value="5" selected/);
});
