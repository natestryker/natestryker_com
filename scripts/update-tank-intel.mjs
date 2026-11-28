// Refresh public reference data. --cached reuses downloaded responses in --cache-dir (default: OS temp).
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {normalize,dayKey} from '../games/tank-intel/core.mjs';
const args=process.argv.slice(2),cached=args.includes('--cached');
const cacheDir=args.includes('--cache-dir')?args[args.indexOf('--cache-dir')+1]:tmpdir();
const output=new URL('../games/tank-intel/catalogue.json',import.meta.url);
const snapshots=['v09171','v0922','v10000','v10900','v11302','v11801','v12200','v12601','v12900','v20000','v20100','v20210','v20301'];
const provenance=[];
async function source(file,url){
  const path=join(cacheDir,`tank-intel-${file}.json`);
  let text;
  if(cached)text=await readFile(path,'utf8');
  else{const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`${url}: ${response.status}`);text=await response.text();JSON.parse(text);await mkdir(cacheDir,{recursive:true});await writeFile(path,text);}
  provenance.push({url,sha256:createHash('sha256').update(text).digest('hex')});
  return JSON.parse(text.replace(/^\uFEFF/,''));
}
const current=await source('list','https://tanks.gg/api/list');
const histories=[];
for(const version of snapshots)histories.push(await source(`${version}-list`,`https://tanks.gg/api/${version}/list`));
const currentEquipment=await source('accessories','https://tanks.gg/api/accessories');
const oldEquipment=await source('v09171-accessories','https://tanks.gg/api/v09171/accessories');
const populations=[];
for(const region of ['na','eu'])populations.push({region,...await source(`unicum-${region}-tanks`,`https://unicum.gg/api/${region}/tanks`)});
const rawMaps=await source('unicum-na-maps','https://unicum.gg/api/na/maps');
const stats=new Map(),identities=new Map();
for(const population of populations)for(const row of population.results){
  const tag=row.identity.tag;identities.set(tag,row.identity);
  if(!row.stats)continue;
  if(!stats.has(tag))stats.set(tag,{players:0,battles:0,regions:[]});
  const record=stats.get(tag);record.players+=row.stats.players??0;record.battles+=row.stats.total_battles??0;record.regions.push(population.region);
}
const blocked=/(?:^|,)(?:secret|private|testTank|event_battles|comp7|clanWarsBattles|bob|fallout)(?:,|$)/;
// Tiny samples can be supertester accounts. Keep genuinely released rare vehicles only
// with an explicit first-party release reference, rather than rewarding test data.
const verifiedReleases={
  G183_Fossa_VM_68:'https://worldoftanks.eu/en/news/general-news/2-4-personal-battle-missions/',
  G32_PzV_PzIV_ausf_Alfa:'https://worldoftanks.eu/en/news/general-news/version-915-release-announcement/',
  G191_StuG_IIIF_CFE_A:'https://worldoftanks.eu/en/news/general-news/girls-und-panzer-march-2026/',
  G204_PzVI_Tiger_P_CFE_A:'https://wargaming.com/en/news/wot-welcomes-team-leoponsan/',
  Pl38_63TP_Rycerski:'https://worldoftanks.asia/vi/news/general-news/double-eleven-2026/',
  Pl27_SDP_Wz_66T_CFE_D:'https://worldoftanks.asia/en/news/competitive-gaming/wci-announcement-2026/',
  Pl40_Krazownik:'https://worldoftanks.eu/de/news/specials/polish-independence-day-2026/',
  Ch60_Vickers_TypeB:'https://worldoftanks.eu/en/news/general-news/vehicle-yearbook-2023/',
  A194_AHT_7:'https://worldoftanks.asia/en/news/specials/vault-of-whispers-2026/',
  F142_M47_Chevalier:'https://worldoftanks.asia/en/news/specials/vault-of-whispers-2026/',
  R234_T_13:'https://worldoftanks.asia/en/news/specials/vault-of-whispers-2026/',
  G161_Pz_Kpfw_M15_38_t:'https://worldoftanks.eu/en/news/specials/holiday-ops-2022-boxes/',
  F39_AMR_P103:'https://worldoftanks.com/en/news/specials/holiday-ops-large-boxes-december-2024/',
  F138_Renault_R35_FCM_36:'https://worldoftanks.com/en/news/general-news/holiday-ops-2026-large-boxes/',
  A145_TS_54:'https://worldoftanks.com/en/news/general-news/vehicle-yearbook-2023/'
};
const currentById=new Map(current.tanks.map(t=>[t.id,t]));
const all=new Map();
for(const snapshot of [...histories,current])for(const tank of snapshot.tanks){
  const identity=identities.get(tank.id),usage=stats.get(tank.id);
  if((blocked.test(tank.tags??'')&&!verifiedReleases[tank.id])||identity?.isCommonTest||identity?.eventRole)continue;
  const regular=tank.gold_price===0&&!tank.not_in_shop;
  if(!regular&&!usage?.players&&!/collectorVehicle/.test(tank.tags??'')&&!verifiedReleases[tank.id])continue;
  if(!all.has(tank.id))all.set(tank.id,{...tank,aliases:[],classifications:[],versions:[],publicCurrent:false,regularInSnapshot:false});
  const record=all.get(tank.id);
  record.regularInSnapshot||=regular;
  record.aliases.push(tank.name,tank.short_name);
  if(!record.classifications.some(c=>c.tier===tank.tier&&c.type===tank.type))record.classifications.push({tier:tank.tier,type:tank.type,version:snapshot.version});
  record.versions.push(snapshot.version);
  if(snapshot===current){Object.assign(record,tank);record.publicCurrent=true;}
}
// Released vehicles absent from tanks.gg's present list can still have historical player records.
const typeNames={lightTank:'light',mediumTank:'medium',heavyTank:'heavy','AT-SPG':'td',SPG:'spg'};
for(const [id,identity] of identities){
  if(all.has(id)||!stats.get(id)?.players||identity.isHidden||identity.isCommonTest||identity.eventRole||identity.variant)continue;
  const type=typeNames[identity.type];if(!type||!identity.name||identity.name.includes('\uFFFD'))continue;
  const raw=currentById.get(id);if(raw&&blocked.test(raw.tags??''))continue;
  all.set(id,{id,name:identity.name,short_name:identity.shortName,slug:identity.slug,nation:identity.nation,type,tier:identity.tier,aliases:[identity.shortName],classifications:[{tier:identity.tier,type,version:'historical-record'}],versions:[],tags:'',publicCurrent:false,gold_price:identity.isPremium||identity.isReward?1:0,not_in_shop:true});
}
const historySources={
  GB70_FV4202_105:'https://worldoftanks.com/en/news/general-news/missions-earn-fv4202p/',
  R70_T_50_2:'https://worldoftanks.eu/en/content/docs/release_notes/',
  G98_Waffentrager_E100:'https://wargaming.com/en/news/wot_update_9_15/'
};
// These released pre-9.17 vehicles predate tanks.gg's earliest published snapshot.
for(const [id,historySource] of Object.entries(historySources)){
  if(all.has(id))continue;const identity=identities.get(id);if(!identity)throw Error('Missing verified historical identity '+id);
  all.set(id,{id,name:identity.name,short_name:identity.shortName,slug:identity.slug,nation:identity.nation,type:typeNames[identity.type],tier:identity.tier,aliases:[identity.shortName],classifications:[{tier:identity.tier,type:typeNames[identity.type],version:'historical-record'}],versions:[],tags:'',publicCurrent:false,gold_price:0,historySource});
}
const aliases={
  'maus':['Mouse'],'t110e5':['E5'],'t110e4':['E4'],'t110e3':['E3'],
  'fv215b183':['Death Star','Deathstar','183'],'fv4005stageii':['FV4005','Shitbarn','Barn'],
  't57heavy':['T57','T57 Heavy Tank'],'superconqueror':['S Conq','SConq','Super Conq'],
  'is3':['IS 3'],'is7':['IS 7'],'t95fv4201chieftain':['Chieftain','Chief'],
  'leopard1':['Leo 1','Leo'],'rhinoceronte':['Rino'],'rinoceronte':['Rino'],
  'obj2684':['Bobject','268 v4','Object 268 Version 4','Obj 268 v4'],
  'object268version4':['Bobject','268 v4','268 4'],
  'jagdpanzer100':['JPE100','Jageroo','Jagdpanzer E 100','Jg Pz E 100'],
  'jagdpanzer e 100':['JPE100','Jageroo'],
  'pzkpfw7':['Pz VII','Panzer VII','Pz 7'],'pzkpfwvii':['Pz VII','Panzer VII'],
  'batzchatillon25t':['Batchat','Bat Chat','BC 25 t'],
  'batchatillon25t':['Batchat','Bat Chat','BC 25 t'],
  'batchatillon15558':['Batchat 155 58','BC 155 58'],
  'rhm panzerwagen':['Rhm Pzw','Rhm Panzerwagen'],
  'rheinmetallpanzerwagen':['Rhm Pzw','Rhm Panzerwagen'],
  'conquerorgc':['CGC','Conq GC','Conqueror Gun Carriage'],
  'conquerorguncarriage':['CGC','Conq GC'],
  'wz111model5a':['5A','WZ 5A','WZ-111 5A'],
  'waffentrageraufe100':['WT E100','WTE100','WT auf E100','Waffletraktor'],
  'rhm borsig':['Rhm B WT','Rhm Borsig','Borsig'],
  'rhmborsigwaffentrager':['Rhm B WT','Rhm Borsig','Borsig'],
  'aufklarungspanzerpanther':['Aufkl Panther','Awful Panther','Aufklärungspanzer V'],
  'manticore':['Manti'],'kranvagn':['Kran'],'minotauro':['Mino'],
  'controcarro3minotauro':['Minotauro','Mino'],'fv217badger':['Badger'],
  '60tplewandowskiego':['60TP'],'nc70blyskawica':['NC 70','Blyskawica'],
  'vz71tesak':['Vz 71','Tesak'],'fv230canopener':['FV230','Canopener'],
  'm41walkerbulldog':['M41','Walker Bulldog','Bulldog'],'xm551sheridan':['Sheridan'],
  't92hmc':['T92'],'e50ausfm':['E50M','E50 M'],'amxm4mle54':['AMX M4 54','AMX 54'],
  'amx50foch155':['Foch 155'],'amx50fochb':['Foch B'],
  't10':['IS-8'],'m4a1sherman':['M4 Sherman'],'strv103b':['103B','Strv B']
};
const aliasLookup={};
for(const [key,values] of Object.entries(aliases))aliasLookup[normalize(key)]=[...new Set([...(aliasLookup[normalize(key)]??[]),...values])];
function namesFor(tank){
  const values=[tank.name,tank.short_name,...tank.aliases];
  for(const value of [...values]){
    if(!value)continue;
    values.push(...(aliasLookup[normalize(value)]??[]));
    if(/^Object\s/i.test(value)){values.push(value.replace(/^Object/i,'Obj'));values.push(value.replace(/^Object\s*/i,''));}
    values.push(value.replace(/Pz\.Kpfw\./gi,'Pz').replace(/Panzerkampfwagen/gi,'Panzer').replace(/Bat\.-Châtillon/gi,'Batchat'));
    values.push(value.replace(/\b(?:model|mle\.?|Ausf\.?)\s*/gi,''));
  }
  return [...new Set(values.filter(Boolean))].filter(v=>v!==tank.name);
}
const grouped=new Map();
const heldForReleaseVerification=[];
for(const tank of all.values()){
  if(!tank.name||tank.name.includes('\uFFFD'))continue;
  const usage=stats.get(tank.id);
  if(usage?.players<100&&!tank.regularInSnapshot&&!verifiedReleases[tank.id]&&!historySources[tank.id]){
    heldForReleaseVerification.push({id:tank.id,name:tank.name,players:usage.players});continue;
  }
  const key=normalize(tank.name),record={
    id:tank.id,name:tank.name,aliases:namesFor(tank),nation:tank.nation,
    classifications:tank.classifications,collector:/collectorVehicle/.test(tank.tags??''),
    premium:Boolean(tank.gold_price||/special|premium/.test(tank.tags??'')),
    leftTechTree:Boolean(tank.regularInSnapshot&&(tank.gold_price||tank.not_in_shop)),
    retired:!tank.publicCurrent,observedSnapshots:new Set(tank.versions).size,
    usage:usage??null,tags:tank.tags??'',
    source:verifiedReleases[tank.id]??(tank.publicCurrent?`https://tanks.gg/tank/${tank.slug}`:tank.historySource??historySources[tank.id]??`https://tanks.gg/${tank.classifications[0].version}/list`),
    statisticsSource:usage?'https://unicum.gg/docs/tanks/get-region-tanks':null
  };
  if(record.source.includes('/historical-record/'))record.source='https://unicum.gg/na/tanks';
  const existing=grouped.get(key);
  if(!existing){grouped.set(key,record);continue;}
  existing.aliases=[...new Set([...existing.aliases,...record.aliases])];
  for(const c of record.classifications)if(!existing.classifications.some(x=>x.tier===c.tier&&x.type===c.type))existing.classifications.push(c);
  existing.collector||=record.collector;existing.premium||=record.premium;
  existing.leftTechTree||=record.leftTechTree;
  existing.retired&&=record.retired;existing.observedSnapshots=Math.max(existing.observedSnapshots,record.observedSnapshots);
  if((record.usage?.players??0)>(existing.usage?.players??0)){existing.usage=record.usage;existing.statisticsSource=record.statisticsSource;}
}
const tanks=[...grouped.values()].sort((a,b)=>a.name.localeCompare(b.name,'en'));
const log=(value,max)=>Math.log1p(value)/Math.log1p(max||1);
const maxPlayers=Math.max(...tanks.map(t=>t.usage?.players??0)),maxBattles=Math.max(...tanks.map(t=>t.usage?.battles??0));
for(const tank of tanks){
  const coverage=tank.observedSnapshots/(snapshots.length+1);
  if(tank.usage?.players){
    tank.exposure=.6*log(tank.usage.players,maxPlayers)+.3*log(tank.usage.battles,maxBattles)+.1*coverage;
    tank.basis=`Observed NA + EU sample: ${tank.usage.players.toLocaleString('en-US')} players, ${tank.usage.battles.toLocaleString('en-US')} lifetime battles; present in ${tank.observedSnapshots}/${snapshots.length+1} roster snapshots. Recognition estimate, not measured trivia-response frequency.`;
    tank.method='observed-popularity';
  }else{
    // Missing coverage is unknown, not zero owners. Use a conservative availability prior.
    tank.exposure=.35+.25*coverage+(tank.retired?-.12:0)+(tank.premium?-.05:0);
    tank.basis=`No population sample. Availability estimate: ${tank.retired?'historical/retired':'current'}, ${tank.premium?'Premium/reward':'standard'}, ${tank.observedSnapshots}/${snapshots.length+1} roster snapshots. Missing usage is not treated as zero popularity.`;
    tank.method='availability-estimate';
  }
}
const mapAliases={Prokhorovka:['Prok','Prokh'],Malinovka:['Mali'],Kharkov:['Kharkiv'],MannerheimLine:['Arctic Region'],Widepark:['Wide Park'],DragonRidge:["Dragon's Ridge"],SouthCoast:['South Shore'],FierySalient:['Fiery Prokhorovka'],Normandie:['Normandy']};
const excludedMaps=new Set(['Encounter Area','Mission Area','Himmelsdorf Championship','Lost City','Gift Factory','Paperland','Paperspace','Tank Rally']);
const maps=rawMaps.results.filter(m=>!m.commonTest&&!excludedMaps.has(m.name)&&(
  m.battleTypes.includes('random')||['Klondike','Nebelburg','Hinterland','Normandie','Kraftwerk','Fata Morgana'].includes(m.name)
)).map(m=>{
  const retired=Boolean(m.retired),monthsAway=retired?Math.max(0,(Date.parse('2026-11-27')-Date.parse(m.retired.lastDate))/2629800000):0;
  const first=retired?Date.parse((m.retired.firstDate??m.retired.lastDate)):null;
  const narrow=['Klondike','Nebelburg','Hinterland','Normandie','Kraftwerk','Fata Morgana'].includes(m.name);
  return {id:'map-'+m.arenaId,name:m.name,aliases:mapAliases[m.name.replace(/\s/g,'')]??[],climate:m.camouflage,size:m.sizeMeters,retired,
    exposure:(retired?.35:.9)-Math.min(.3,monthsAway/480)-(narrow?.12:0),
    method:'availability-estimate',basis:`Availability estimate: ${retired?'archived map/variant; last client archive '+m.retired.lastVersion:'current reference roster'}; ${narrow?'Grand Battle/Frontline':'regular map'} scope. Archive dates describe file history, not exact rotation-removal dates. No reliable map-recognition survey is available.`,
    source:`https://unicum.gg/na/maps/${m.slug}`};
});
const equipmentMap=new Map();
function baseName(name){return name.replace(/\s+Class\s*[1-5]\b/gi,'').replace(/\s+Mk\s*[12]\b/gi,'').replace(/\s+T[123]$/,'').trim();}
function equipmentAliases(name){const manual={
  'Gun Rammer':['Rammer','Medium-Caliber Tank Gun Rammer','Large-Caliber Tank Gun Rammer','Artillery Shell Rammer'],
  'Coated Optics':['Optics'],'Binocular Telescope':['Binocs','Binoculars','Binos'],
  'Camouflage Net':['Camo Net'],"Commander's Vision System":['CVS'],
  'Low Noise Exhaust System':['LNE','LNES','Low Noise Exhaust','Exhaust'],
  'Vertical Stabilizer':['VStab','V Stab','Vert Stab'],
  'Improved Aiming':['IAU','IA','Improved Aiming Unit'],
  'Improved Rotation Mechanism':['IRM'],'Enhanced Gun Laying Drive':['GLD','Gun Laying Drive','EGLD'],
  'Improved Ventilation':['Vents','Ventilation'],'Turbocharger':['Turbo'],
  'Improved Hardening':['Hardening'],'Modified Configuration':['Config','Modified Config'],
  'Improved Radio Set':['IRS'],'Additional Grousers':['Grousers'],
  '"Wet" Ammo Rack':['Wet Ammo Rack','WAR'],'Fill Tanks with CO2':['CO2 Tanks','Fill Tanks with Carbon Dioxide'],
  'Cyclone Filter':['Filter Cyclone'],'Fire-Control System':['FCS'],
  'Mobility Improvement System':['MIS'],'Survival Improvement Suite':['SIS'],
  'Accuracy Improvement System':['AIS'],
  'Light Spall Liner':['Spall Liner'],'Medium Spall Liner':['Spall Liner'],
  'Heavy Spall Liner':['Spall Liner'],'Superheavy Spall Liner':['Spall Liner']
};return manual[name]??[];}
for(const [snapshot,historical] of [[oldEquipment,true],[currentEquipment,false]])for(const item of snapshot.equipment){
  let name=baseName(item.name);
  if(/(?:Tank Gun|Artillery.?Shell) Rammer/.test(name))name='Gun Rammer';
  const key=normalize(name),tags=item.tags??'';
  const kind=historical?'retired':/deluxe/.test(tags)?'improved':/trophy/.test(tags)?'bounty':/modernized/.test(tags)?'experimental':'standard';
  const eligible=tanks.filter(tank=>{
    if(item.include_tags)return item.include_tags.split(/[,\s]+/).some(tag=>tank.tags.split(',').includes(tag));
    return tank.classifications.some(c=>c.tier>=(item.min_tier??2));
  }).length;
  const factors=(item.factors??[]).map(f=>f.type).join(' ');
  const roles=[];
  if(/Gun|Reload|Dispersion|crewLevel|aim|rammer|rotationMechanism/i.test(factors+' '+tags))roles.push('firepower');
  if(/Vision|Invis|Spot|crewLevel|coatedOptics|stereoscope|camouflageNet|radioCommunication|commandersView|additInvisibility/i.test(factors+' '+tags))roles.push('scouting');
  if(/EnginePower|RotationSpeed|SpeedLimit|crewLevel|grousers|rotationMechanism|turbocharger/i.test(factors+' '+tags))roles.push('mobility');
  if(/Repair|Health|Strength|FireChance|crewLevel|Stun|ShellDamage|crewHit|armor|healthReserve/i.test(factors+' '+tags))roles.push('survivability');
  const record={id:'equipment-'+key,name,aliases:[item.name,...equipmentAliases(name)],roles,kind,
    exposure:eligible/tanks.length*(kind==='retired'?.35:kind==='standard'?1:.65),method:'availability-estimate',
    basis:`Compatibility/availability estimate: approximately ${eligible} vehicles in the reference roster meet the published mounting tags or tier condition; ${kind} equipment. This is not an equipment-usage statistic.`,
    source:historical?'https://tanks.gg/v09171/compare':'https://worldoftanks.eu/en/content/guide/game-mechanics-and-achievements/equipment/'};
  const previous=equipmentMap.get(key);
  if(previous){record.aliases=[...new Set([...previous.aliases,...record.aliases])];record.roles=[...new Set([...previous.roles,...roles])];if(!historical||previous.kind==='retired')equipmentMap.set(key,record);}
  else equipmentMap.set(key,record);
}
const consumableMap=new Map(),directiveMap=new Map();
const foodNations={chocolate:'germany',ration:'ussr',cocacola:'usa',hotCoffee:'france',ration_uk:'uk',ration_china:'china',ration_japan:'japan',ration_czech:'czech',ration_sweden:'sweden',ration_poland:'poland',ration_italy:'italy'};
for(const [snapshot,historical] of [[oldEquipment,true],[currentEquipment,false]])for(const item of snapshot.consumables){
  const tags=item.tags??'',directive=/BattleBooster/.test(tags),food=/stimulator/.test(tags);
  if(/roleEquipment|poiEquipment|builtin|Increased Focus|Duty Comes First/.test(tags+' '+item.name))continue;
  const nation=foodNations[item.id];
  const eligible=nation?tanks.filter(t=>t.nation===nation).length:tanks.length;
  const name=item.name,key=normalize(name),target=directive?directiveMap:consumableMap;
  const record={id:(directive?'directive-':'consumable-')+key,name,aliases:[],food,
    exposure:(eligible/tanks.length)*(historical?.6:1)*(directive?.55:1),method:'availability-estimate',
    basis:`Availability estimate: ${nation?'restricted to '+nation:'broad vehicle eligibility'}; ${historical?'historical item':'current reference catalogue'}. No usage-frequency sample.`,
    source:historical?'https://tanks.gg/v09171/compare':'https://worldoftanks.eu/en/content/guide/game-mechanics-and-achievements/consumables/'};
  const extra={'Case of Cola':['Cola','Coke'],'Coffee with Cinnamon Buns':['Cinnamon Buns'],'Bread with Smalec':['Smalec'],'Spaghetti with Meat Sauce':['Spaghetti'],'Removed Speed Governor':['Speed Governor'],'Small First Aid Kit':['Small Medkit'],'Large First Aid Kit':['Large Medkit'],'Automatic Fire Extinguisher':['Auto Extinguisher','AFE']};
  record.aliases=extra[name]??[];
  target.set(key,record);
}
// Curated award conditions are a fallback complexity proxy, never a claimed recognition survey.
const epic=[
  ['Radley-Walters’ Medal',['Radley Walters','Radleys'],8,0,0],['Pool’s Medal',['Pool'],10,0,0],
  ['Kolobanov’s Medal',['Kolobanov','Kolo'],5,1,0],['Fadin’s Medal',['Fadin'],1,1,1],
  ['Pascucci’s Medal',['Pascucci'],2,0,0],['Burda’s Medal',['Burda'],3,0,0],
  ['Dumitru’s Medal',['Dumitru'],3,1,0],['Orlik’s Medal',['Orlik'],2,1,0],
  ['Oskin’s Medal',['Oskin'],3,1,0],['Halonen’s Medal',['Halonen'],2,1,0],
  ['De Langlade’s Medal',['De Langlade','Langlade'],4,1,0],['Lehväslaiho’s Medal',['Lehvaslaiho'],2,1,0],
  ['Nicl’s Medal',['Nicl'],4,1,0],['Yoshio Tamada’s Medal',['Yoshio Tamada','Tamada'],2,1,0],
  ['Billotte’s Medal',['Billotte'],2,2,0],['Bruno’s Medal',['Bruno'],3,2,0],
  ['Tarczay’s Medal',['Tarczay'],5,2,0],['Stark’s Medal',['Stark'],2,2,0],
  ['Naydin’s Medal',['Naydin'],3,1,0],['Raseiniai Heroes’ Medal',['Raseiniai Heroes','Raseiniai'],14,0,0],
  ['Boelter’s Medal',['Boelter','Bolter'],7,1,0]
];
const hero=[['Top Gun',6,0,0],['High Caliber',0,0,0],['Steel Wall',0,1,0],['Confederate',6,0,0],['Defender',0,1,0],['Invader',0,1,0],['Scout',9,1,0],['Patrol Duty',6,1,0],['Tank Sniper',0,2,0],['Sniper',0,2,1]];
const awards=[...epic.map(([name,aliases,kills,constraints,legacy])=>({name,aliases,kills,constraints,legacy,group:'epic'})),...hero.map(([name,kills,constraints,legacy])=>({name,aliases:name==='High Caliber'?['High Calibre']:[],kills,constraints,legacy,group:'heroes'}))].map(a=>({
  id:'award-'+normalize(a.name),name:a.name,aliases:a.aliases,group:a.group,
  exposure:1/(1+a.kills*.08+a.constraints*.35+a.legacy*.4+(a.name==='Boelter’s Medal'?.6:0)),
  method:'requirements-estimate',basis:`Estimated from award-condition complexity and historical status. This is not an observed award frequency or an objective player-recognition rating.`,
  source:'https://worldoftanks.eu/en/content/guide/general/achievements/'
}));
const result={meta:{retrievedOn:dayKey(),snapshot:current.version,snapshots:[...snapshots,current.version],populationRegions:['na','eu'],populationScope:'Lifetime totals among unicum.gg-tracked players; not the entire server population or trivia-answer frequency.',sources:provenance,method:'Tank exposure = 60% normalized log tracked-player count + 30% normalized log lifetime battles + 10% historical snapshot coverage. Missing usage uses an availability prior. Other answer types use labelled availability/condition estimates. Per-prompt exposure ranks divide non-Ace answers into four quartiles; the single least-exposed answer is Tank Ace, with alphabetical tie-breaking.'},tanks,maps,equipment:[...equipmentMap.values()],consumables:[...consumableMap.values()],directives:[...directiveMap.values()],awards};
result.meta.verifiedReleases=verifiedReleases;
result.meta.heldForReleaseVerification=heldForReleaseVerification;
result.meta.version=createHash('sha256').update(JSON.stringify(result)).digest('hex').slice(0,16);
await writeFile(output,JSON.stringify(result)+'\n');
console.log(JSON.stringify({version:result.meta.version,tanks:tanks.length,observed:tanks.filter(t=>t.usage).length,maps:maps.length,equipment:result.equipment.length,consumables:result.consumables.length,directives:result.directives.length,awards:awards.length}));
