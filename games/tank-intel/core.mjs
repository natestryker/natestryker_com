import {buildCreativePrompts} from './creative.mjs';
export const BANK_VERSION = '2026-11-28-v4';
export const ROUND_LENGTH = 25_000;
export const ROUND_COUNT = 7;
export const RARITIES = [
  {name:'Tomato',points:20,className:'tomato'},
  {name:'Average',points:40,className:'average'},
  {name:'Unicum',points:60,className:'unicum'},
  {name:'Super Unicum',points:80,className:'super-unicum'},
  {name:'Tank Ace',points:100,className:'tank-ace'}
];
const roman = {i:'1',ii:'2',iii:'3',iv:'4',v:'5',vi:'6',vii:'7',viii:'8',ix:'9',x:'10',xi:'11'};
const aliasKeyCache=new WeakMap();
export function normalize(value) {
  return String(value).toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'')
    .replace(/ł/g,'l').replace(/ß/g,'ss').replace(/\b(?:xi|viii|vii|iii|vi|iv|ix|ii|v|x|i)\b/g,part=>roman[part])
    .replace(/[^a-z0-9]/g,'');
}
export function aliasKeys(answer) {
  if(!aliasKeyCache.has(answer))aliasKeyCache.set(answer,[...new Set([answer.name,...answer.aliases].map(normalize).filter(Boolean))]);
  return aliasKeyCache.get(answer);
}
export function exactMatches(question,value) {
  const key=normalize(value);
  if(!key)return [];
  const named=question.answers.filter(answer=>normalize(answer.name)===key);
  return named.length?named:question.answers.filter(answer=>aliasKeys(answer).includes(key));
}
export function findAnswer(question,value) {
  const matches=exactMatches(question,value);
  return matches.length===1 ? matches[0] : null;
}
// Optimal string alignment distance includes adjacent transpositions ("Muas" → "Maus").
export function editDistance(a,b) {
  const rows=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++)rows[i][0]=i;
  for(let j=0;j<=b.length;j++)rows[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
    rows[i][j]=Math.min(rows[i-1][j]+1,rows[i][j-1]+1,rows[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1);
  }
  return rows[a.length][b.length];
}
export function suggestAnswers(question,value) {
  const exact=exactMatches(question,value);
  if(exact.length>1)return exact.slice(0,4);
  const query=searchVariant(String(value).replace(/(?<=\d)[oO]+/g,part=>'0'.repeat(part.length)));
  if(query.key.length<3)return [];
  const ranked=[];
  for(const answer of question.answers){
    let best=0;
    for(const candidate of searchVariants(answer)){
      // Preserve model identity. Missing name words are fine; 277 is never "corrected" to 278.
      if(query.numbers&&query.numbers!==candidate.numbers)continue;
      best=Math.max(best,variantSimilarity(query,candidate));
    }
    if(best>=.64)ranked.push({answer,score:best});
  }
  ranked.sort((a,b)=>b.score-a.score||a.answer.name.localeCompare(b.answer.name));
  return ranked.filter(item=>item.score>=ranked[0].score-.09).slice(0,4).map(item=>item.answer);
}
const searchCache=new WeakMap();
const ignoredWords=new Set(['auf','mle','model','ausf','stage','tank','the','of','de','le','mk']);
const expansions={obj:'object',pz:'panzer',pzkpfw:'panzer',rhm:'rheinmetall',bc:'batchat'};
function searchVariant(value){
  const words=String(value).toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replace(/ł/g,'l').replace(/ß/g,'ss')
    .replace(/([a-z])(\d)|(\d)([a-z])/g,'$1$3 $2$4').split(/[^a-z0-9]+/).filter(Boolean)
    .map(word=>roman[word]??expansions[word]??word).filter(word=>!ignoredWords.has(word));
  const key=normalize(value),simple=words.join('');
  const sound=simple.replace(/qu/g,'k').replace(/ph/g,'f').replace(/ck/g,'k').replace(/sch/g,'sh').replace(/([a-z])\1+/g,'$1').replace(/[aeiouy]/g,'');
  return {key,simple,sound,words:words.filter(word=>/[a-z]{2}/.test(word)),numbers:key.match(/\d+/g)?.join('')??''};
}
function searchVariants(answer){
  if(!searchCache.has(answer))searchCache.set(answer,[answer.name,...answer.aliases].map(searchVariant));
  return searchCache.get(answer);
}
function wordSimilarity(a,b){
  if(a===b)return 1;
  if(a.length>=3&&b.startsWith(a))return .92;
  if(b.length>=3&&a.startsWith(b))return .84;
  return 1-editDistance(a,b)/Math.max(a.length,b.length);
}
function variantSimilarity(query,candidate){
  let best=0;
  for(const [a,b] of [[query.key,candidate.key],[query.simple,candidate.simple]]){
    if(!a||!b)continue;
    if(a===b)return 1;
    if(Math.abs(a.length-b.length)<=Math.max(4,a.length*.45))best=Math.max(best,1-editDistance(a,b)/Math.max(a.length,b.length));
  }
  // Compare meaningful words independently: missing particles, reordered names, and
  // a shortened surname should not swamp the signal from an exact model number.
  if(query.words.length&&candidate.words.length&&query.words.join('').length>=3){
    const scores=query.words.map(word=>Math.max(...candidate.words.map(other=>wordSimilarity(word,other))));
    if(scores.every(score=>score>=.55)){
      const score=scores.reduce((sum,n)=>sum+n,0)/scores.length-Math.min(.1,Math.max(0,candidate.words.length-query.words.length)*.025);
      best=Math.max(best,score);
    }
  }
  // A conservative consonant signature helps with foreign-name spellings such as
  // "burask" / "Bourrasque"; suggestions still always need player confirmation.
  if(query.simple.length>=4&&query.sound.length>=3&&query.sound===candidate.sound)best=Math.max(best,.86);
  return best;
}
export function dayKey(now=Date.now()) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now)).map(part=>[part.type,part.value]));
  return [parts.year,parts.month,parts.day].join('-');
}
function hash(value) {
  let result=2166136261;
  for(const char of value){result^=char.charCodeAt(0);result=Math.imul(result,16777619);}
  return result>>>0;
}
function random(seed) {
  return ()=>{seed+=0x6D2B79F5;let n=seed;n=Math.imul(n^n>>>15,n|1);n^=n+Math.imul(n^n>>>7,n|61);return ((n^n>>>14)>>>0)/4294967296;};
}
function shuffle(values,rng) {
  const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;
}
export function dailyQuestions(bank,key) {
  const rng=random(hash(BANK_VERSION+(bank[0]?.version??'')+key)),groups=new Map();
  for(const question of bank){if(!groups.has(question.family))groups.set(question.family,[]);groups.get(question.family).push(question);}
  // Draw across topics first, then fill from unused prompts. IDs and ordering are stable.
  const creativeFamilies=[...groups.keys()].filter(family=>groups.get(family).some(q=>q.creative)).sort();
  const featured=shuffle(creativeFamilies,rng).slice(0,2);
  const families=[...featured,...shuffle([...groups.keys()].filter(family=>!featured.includes(family)).sort(),rng)].slice(0,ROUND_COUNT);
  const picked=families.map(family=>{
    const candidates=groups.get(family).toSorted((a,b)=>a.id.localeCompare(b.id));
    return candidates[Math.floor(rng()*candidates.length)];
  });
  if(picked.length<ROUND_COUNT){const used=new Set(picked.map(q=>q.id));picked.push(...shuffle(bank.filter(q=>!used.has(q.id)),rng).slice(0,ROUND_COUNT-picked.length));}
  return shuffle(picked,rng);
}
export function createRun(questions,now=Date.now()) {
  return {version:BANK_VERSION,bankVersion:questions[0]?.version,questionIds:questions.map(q=>q.id),index:0,results:[],deadline:now+ROUND_LENGTH};
}
export function validRun(run,questions) {
  if(!run||run.version!==BANK_VERSION||run.bankVersion!==questions[0]?.version||!Number.isInteger(run.index)||run.index<0||run.index>questions.length||!Array.isArray(run.results)||!Array.isArray(run.questionIds))return false;
  if(run.questionIds.join('|')!==questions.map(q=>q.id).join('|')||!Number.isFinite(run.deadline))return false;
  if(run.results.length!==run.index&&run.results.length!==run.index+1)return false;
  if(run.results.length>questions.length)return false;
  return run.results.every((result,i)=>{
    if(['pass','timeout'].includes(result.reason))return result.points===0;
    const answer=questions[i].answers.find(a=>a.id===result.answerId);
    return result.reason==='answer'&&answer&&answer.points===result.points;
  });
}
// A failed match is deliberately a no-op: neither the score nor deadline changes.
export function submitAnswer(run,question,value,reason='answer',now=Date.now()) {
  if(!run||run.results.length!==run.index||run.index>=run.questionIds.length)return {kind:'inactive'};
  if(now>=run.deadline)reason='timeout';
  const answer=reason==='answer'?findAnswer(question,value):null;
  if(reason==='answer'&&!answer)return {kind:'retry',suggestions:suggestAnswers(question,value)};
  run.results.push({reason,guess:reason==='answer'?value:'',answerId:answer?.id??null,name:answer?.name??'',points:answer?.points??0,rarity:answer?.rarity??'Miss'});
  return {kind:'recorded',answer};
}
export function rankAnswers(answers) {
  // Recognition proxy: more observed players/battles or broader availability → more familiar.
  // Name is a stable tie-break only; one and only one rarest entry receives Tank Ace.
  const ordered=answers.toSorted((a,b)=>b.exposure-a.exposure||a.name.localeCompare(b.name,'en'));
  return ordered.map((answer,index)=>{
    const rarity=index===ordered.length-1?RARITIES[4]:RARITIES[Math.min(3,Math.floor(index/Math.max(1,ordered.length-1)*4))];
    return {...answer,rarity:rarity.name,points:rarity.points,rarityClass:rarity.className};
  });
}
export function buildBank(catalogue) {
  const nicknames={fv215b183:['FV183','FV 183'],batchatillonbourrasque:['Borat','Bourra','Bourrasque'],amxm4mle54:['AMX M4 54','M4 54'],rhmborsigwaffentrager:['RHM','Rhm Borsig'],t95fv4201chieftain:['Chieftain','Chief'],waffentrageraufe100:['Waffle','WT E100','E100 WT']};
  const bank=[],tanks=catalogue.tanks.map(tank=>({...tank,aliases:[...new Set([...tank.aliases,...(nicknames[normalize(tank.name)]??[])])]}));
  function add(id,family,category,title,detail,answers){
    if(answers.length>=5)bank.push({id,version:catalogue.meta.version,family,category,title,detail,answers:rankAnswers(answers)});
  }
  const historical='Current and historical WoT PC vehicles count, including Premium, reward, collector, renamed, and removed vehicles. Use any tier or class the vehicle held in a released version.';
  const names={usa:'U.S.',ussr:'Soviet',germany:'German',france:'French',uk:'British',china:'Chinese',japan:'Japanese',czech:'Czechoslovakian',sweden:'Swedish',poland:'Polish',italy:'Italian'};
  const types={light:'light tank',medium:'medium tank',heavy:'heavy tank',td:'tank destroyer',spg:'SPG'};
  const numerals=['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
  const isTier=(tank,tier,type)=>tank.classifications.some(c=>c.tier===tier&&(!type||c.type===type));
  for(const [type,label] of Object.entries(types)){
    add('class-'+type,'vehicle-classes','Vehicle classes',`Name ${type==='spg'?'an':'a'} ${label}`,historical,tanks.filter(t=>t.classifications.some(c=>c.type===type)));
    for(const tier of [6,7,8,9,10,11])add(`tier-${tier}-${type}`,'tier-and-class',`Tier ${numerals[tier]}`,`Name a Tier ${numerals[tier]} ${label}`,historical,tanks.filter(t=>isTier(t,tier,type)));
  }
  for(let tier=1;tier<=11;tier++)add('tier-'+tier,'tiers','Vehicle tiers',`Name a Tier ${numerals[tier]} vehicle`,historical,tanks.filter(t=>isTier(t,tier)));
  for(const [nation,label] of Object.entries(names)){
    const roster=tanks.filter(t=>t.nation===nation);
    const article=nation==='italy'?'an':'a';
    add('nation-'+nation,'nations','Nations',`Name ${article} ${label} vehicle`,historical,roster);
    for(const tier of [6,8,10])add(`nation-${nation}-${tier}`,'national-tiers',`${label} vehicles`,`Name ${article} ${label} Tier ${numerals[tier]} vehicle`,historical,roster.filter(t=>isTier(t,tier)));
    for(const [type,typeLabel] of Object.entries(types))add(`nation-${nation}-${type}`,'national-classes',`${label} vehicles`,`Name ${article} ${label} ${typeLabel}`,historical,roster.filter(t=>t.classifications.some(c=>c.type===type)));
  }
  add('collectors','vehicle-history','Collectors',"Name a Collector's vehicle",'A vehicle sold through the collector system, including vehicles formerly in a tech tree.',tanks.filter(t=>t.collector));
  add('retired-tanks','vehicle-history','Vehicle history','Name a vehicle removed from, replaced in, or moved out of a tech tree','Includes complete removals, replacements, re-tierings, and moves into collector or reward status. Historical versions count.',tanks.filter(t=>t.retired||t.leftTechTree||t.collector||t.classifications.length>1));
  add('premium-tanks','vehicle-history','Premium and rewards','Name a Premium or reward vehicle','Released WoT PC vehicles only. Historical and retired vehicles count.',tanks.filter(t=>t.premium));
  add('all-maps','maps','Maps','Name a (Current or Former) WoT Map','Regular maps, historical map variants, Grand Battle maps, and Frontline maps in this reference roster count. Removed maps count.',catalogue.maps);
  for(const [id,title,filter] of [
    ['maps-a-l','Name a (Current or Former) WoT Map from A to L',m=>/^[a-l]/i.test(m.name)],
    ['maps-m-z','Name a (Current or Former) WoT Map from M to Z',m=>/^[m-z]/i.test(m.name)],
    ['retired-maps','Name a removed map or a retired map variant',m=>m.retired],
    ['winter-maps','Name a winter-camouflage map',m=>m.climate==='winter'],
    ['summer-maps','Name a summer-camouflage map',m=>m.climate==='summer'],
    ['large-maps','Name a map at least 1,000 metres wide',m=>m.size>=1000]
  ])add(id,'maps','Maps',title,'Current and historical English map names count. Map variants and non-Random battlefields in the reference roster are accepted.',catalogue.maps.filter(filter));
  for(const [id,title,filter] of [
    ['all-equipment','Name a piece of equipment',()=>true],
    ['standard-equipment','Name a standard equipment type',a=>a.kind==='standard'],
    ['gun-equipment','Name equipment that improves gun performance',a=>a.roles.includes('firepower')],
    ['spotting-equipment','Name equipment that helps spotting or concealment',a=>a.roles.includes('scouting')],
    ['mobility-equipment','Name equipment that improves mobility',a=>a.roles.includes('mobility')],
    ['survival-equipment','Name equipment that improves survivability',a=>a.roles.includes('survivability')],
    ['bond-equipment','Name a piece of improved equipment bought with bonds',a=>a.kind==='improved'],
    ['bounty-equipment','Name a piece of Bounty equipment',a=>a.kind==='bounty'],
    ['retired-equipment','Name a retired standard equipment type',a=>a.kind==='retired']
  ])add(id,'equipment','Equipment',title,'Current and historical base names count. Equipment classes and experimental upgrade levels are grouped under their base type.',catalogue.equipment.filter(filter));
  add('consumables','supplies','Consumables','Name a standard battle consumable','Current and historical repair, medical, fire, fuel, and food consumables count. Directives are a separate prompt.',catalogue.consumables);
  add('food','supplies','Rations','Name a national crew ration','Any of the national food or drink consumables that improve crew performance.',catalogue.consumables.filter(c=>c.food));
  add('directives','supplies','Directives','Name an equipment or crew directive','Use its English name; current and historical directives count.',catalogue.directives);
  for(const group of ['heroes','epic'])add('awards-'+group,'awards','Battle awards',group==='heroes'?'Name a Battle Hero award':'Name an Epic Medal','Current and retired awards count. A namesake’s surname is accepted when unambiguous.',catalogue.awards.filter(a=>a.group===group));
  for(const prompt of buildCreativePrompts(catalogue,{normalize,tanks})){
    if(prompt.answers.length<5)continue;
    add(prompt.id,prompt.family,prompt.category,prompt.title,prompt.detail,prompt.answers);
    bank.at(-1).creative=true;
  }
  return bank;
}
