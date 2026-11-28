import {TOPICS} from './topics.mjs';

export function buildCreativePrompts(catalogue,{normalize,tanks}){
  const prompts=[];
  const add=(id,family,title,answers,detail='')=>prompts.push({id,family,category:({creators:'Creators and community',holiday:'Holiday Ops',crew:'Crew skills',eras:'Release eras',mechanics:'Special mechanics',oddities:'Garage curiosities'})[family],title,answers,detail,creative:true});
  const fixLookalikes=value=>value.replace(/^I\s+S-/,'IS-').replace(/[АВЕКМНОРСТХаеорсух]/g,char=>({'А':'A','В':'B','Е':'E','К':'K','М':'M','Н':'H','О':'O','Р':'P','С':'C','Т':'T','Х':'X','а':'a','е':'e','о':'o','р':'p','с':'c','у':'y','х':'x'}[char]));
  function resolve(name){
    const key=normalize(fixLookalikes(name));
    return tanks.find(t=>normalize(t.name)===key)||tanks.find(t=>t.aliases.some(a=>normalize(fixLookalikes(a))===key))||
      (key==='m24e2superchaffee'?tanks.find(t=>t.name==='Super Chaffee'):null);
  }
  function vehicle(name,source){
    const tank=resolve(name);
    return tank?{...tank,source}: {id:'reference-'+normalize(name),name:fixLookalikes(name),aliases:[],source,exposure:.45,method:'availability-estimate',basis:'Listed in the linked publisher reference. No matched vehicle population sample; uses an availability prior.'};
  }
  const unique=answers=>[...new Map(answers.map(answer=>[normalize(answer.name),answer])).values()];
  const holiday=[
    [2018,'https://worldoftanks.eu/en/news/general-news/holiday-ops-2018-guide/',
      ['Type 59','T26E5','Lorraine 40 t','Skorpion G','T-28E with F-30','AC 1 Sentinel','Pz.Kpfw. B2 740 (f)']],
    [2019,'https://worldoftanks.eu/en/news/specials/large-boxes-last-chance/',
      ['IS-3A','Object 252U Defender','Skorpion G','E 25','105 leFH18B2','M4 Improved','KV-220-2','Turán III prototípus']],
    [2020,'https://worldoftanks.com/en/news/general-news/holiday-ops-2020-boxes/',
      ['Progetto M35 mod. 46','Object 703 Version II','E 75 TS','SU-130PM','AM 39 Gendron-Somua','Sexton I','Pz.Kpfw. III Ausf. K','Bretagne Panther','Sherman VC Firefly']],
    [2021,'https://worldoftanks.com/en/news/general-news/holiday-ops-2021-large-boxes/',
      ['Bat.-Châtillon Bourrasque','Bisonte C45','GSOR 1008','ISU-152K','M4A1 FL 10','M22 Locust','Matilda Black Prince','T78','Pz.Kpfw. T 15']],
    [2022,'https://worldoftanks.eu/en/news/specials/holiday-ops-2022-boxes/',
      ['Bofors Tornvagn','Caliban','M-IV-Y','122 TM','Škoda T 56','Pz.Kpfw. 35 R','Pz.Kpfw. M 15','Matilda LVT','M4-85','KV-1 shielded']],
    [2023,'https://worldoftanks.com/en/news/general-news/holiday-ops-2023-boxes/',
      ['M47 Iron Arnie','BZ-176','Char Mle. 75','SMV CC-64 Vipera','AMBT','Pz.Kpfw. 38H 735 (f)','M3 Light','A25 Harry Hopkins I','Pz.Kpfw. KW I (r)','SU-2-122']],
    [2024,'https://worldoftanks.eu/en/news/specials/holiday-ops-2024-boxes/',
      ['Tiger-Maus','Object 752','Type 63','XM66F','GSOR 1010 FB','ARMT','M24 Chaffee No. 594','A7E3','IT-3','Vickers 6 ton']],
    [2025,'https://worldoftanks.com/en/news/specials/holiday-ops-large-boxes-december-2024/',
      ['DZT-159','Toro','FV226 Contradictious','XM57','Vz. 68 Squall','SU-100I','Pz.Kpfw. 38 (K)','Type 1 Ho-Ni II','M3A3 Stuart','AMR P.103']],
    [2026,'https://worldoftanks.com/en/news/general-news/holiday-ops-2026-large-boxes/',
      ['BZT-70','Coccodrillo','Projet Louis','TBT','Jagdpanzer E 90','Stridsyxa','Cromwell Applique','T-115','Škoda T 15A','Rheinmetall Begleitwagen','Renault R35/FCM 36']]
  ];
  const boxes=[];
  for(const [year,source,names] of holiday){
    const answers=unique(names.map(name=>({...vehicle(name,source),holidayYear:year})));
    boxes.push(...answers);
    add('holiday-boxes-'+year,'holiday',`Name a tank from Holiday Ops ${year} Christmas lootboxes`,answers,'Holiday Ops uses the event label, not the calendar year when boxes went on sale. High- and low-tier vehicle drops count; styles and gift tanks outside boxes do not.');
  }
  add('holiday-boxes-ever','holiday','Name a Christmas lootbox tank from Holiday Ops 2018–2026',unique(boxes));
  add('holiday-small-tanks','holiday','Name a Tier V or lower Christmas lootbox tank',unique(boxes.filter(t=>t.classifications?.some(c=>c.tier<=5))));
  add('holiday-high-tier','holiday','Name a Tier VIII–X Christmas lootbox tank',unique(boxes.filter(t=>t.classifications?.some(c=>c.tier>=8))));

  const crewSource='https://worldoftanks.com/en/news/general-news/crew-perks-expansion-2026/';
  // Name, role, situational flag, year cohort, gun/reload interaction. No copied descriptions.
  const roles={
    commander:[['Recon',false,0],['Emergency',true,2024],['Mentor',false,0],['Coordination',true,2024,true],['Sound Detection',true,0],['Practicality',false,2024],['Hold the Line',true,2026],['Stay Sharp',true,2026]],
    gunner:[['Snap Shot',false,0,true],['Deadeye',false,0],['Designated Target',true,0],['Concentration',true,2024,true],['Quick Aiming',false,2024,true],['Armorer',false,0,true],['Point Blank',true,2026],['Lone Wolf',true,2026,true]],
    driver:[['Clutch Braking',false,0],['Smooth Ride',false,0,true],['Off-Road Driving',false,0],['Reliable Placement',false,2024],['Controlled Impact',false,0],['Engineer',false,2024],['Field Support',true,2026],['Bulletproof',true,2026]],
    loader:[['Adrenaline Rush',true,0,true],['Safe Stowage',false,0],['Intuition',false,0,true],['Perfect Charge',false,2024,true],['Close Combat',true,2024,true],['Ammo Tuning',false,2024],['Second Chance',true,2026,true],['Mag Mastery',false,2026,true]],
    'radio operator':[['Situational Awareness',false,0],['Side by Side',true,2024],['Jamming',false,2024],['Signal Interception',false,2024],['Communications Expert',true,2024],['Firefighting',false,0],['Battle Tempered',true,2026],['Threat Search',true,2026]]
  };
  const crewAliases={'Brothers in Arms':['BIA','Brothers-in-Arms'],'Concealment':['Camouflage','Camo'],'Snap Shot':['Snapshot'],'Off-Road Driving':['Offroad Driving'],'Situational Awareness':['SA'],'Safe Stowage':['Safe Storage'],'Second Chance':['The Second Chance'],'Sound Detection':['Sound Detector']};
  const skills=[];
  for(const [role,rows] of Object.entries(roles))for(const [name,situational,cohort,firepower] of rows)skills.push({
    id:'crew-'+normalize(name),name,aliases:crewAliases[name]??[],role,situational,cohort,firepower,source:crewSource,
    exposure:cohort===2026?.3:cohort===2024?.55:.85,method:'availability-estimate',basis:`Crew-role and introduction-cohort estimate: ${role}; ${cohort||'longstanding'} perk. This is not a measured skill-pick rate.`
  });
  for(const name of ['Brothers in Arms','Concealment','Repairs'])skills.push({id:'crew-'+normalize(name),name,aliases:crewAliases[name]??[],role:'group',source:crewSource,exposure:.95,method:'availability-estimate',basis:'Longstanding group perk available to all crew roles; familiarity estimate, not measured pick rate.'});
  add('crew-all','crew','Name a trainable crew skill or perk',skills,'Current trainable individual and group perks. Sixth Sense is a built-in feature, not a currently trainable perk.');
  for(const role of Object.keys(roles))add('crew-'+role.replace(' ','-'),'crew',`Name a ${role}-specific crew perk`,skills.filter(skill=>skill.role===role));
  add('crew-situational','crew','Name a crew perk with a situational effect',skills.filter(skill=>skill.situational));
  add('crew-firepower','crew','Name a crew perk that improves aiming, gun handling, or reload',skills.filter(skill=>skill.firepower));

  const creatorAliases={quickybaby:['QB','QuickieBaby','Quickfingers'],skill4ltu:['Skill','Skill4','Skil4ltu'],dakillzor:['Daki','Dakill','Dakilzor'],awesomeepicguys:['AEG','Awesome Epic Guys'],dezgamez:['Dez','DezGames'],circon:['Circonflexes','SirCircon'],iyouxin:['Iyou','Iyouxin'],orzanel:['Orzy']};
  const clash2020=['Mailand','Skill4ltu','AwesomeEpicGuys','DezGamez'],clash2021=['Circon','Orzanel','NewMulti2k','Dakillzor'];
  const spotlight=new Set(['dakillzor','damiensgaming','mailand','quickybaby','skill4ltu']);
  const people=TOPICS.creators.map(person=>{
    const key=normalize(person.name),appearances=1+(spotlight.has(key)?1:0)+(clash2020.some(n=>normalize(n)===key)?1:0)+(clash2021.some(n=>normalize(n)===key)?1:0);
    return {id:'creator-'+key,name:person.name,aliases:[...(creatorAliases[key]??[]),...person.channels.flatMap(url=>{const handle=url.match(/(?:twitch\.tv\/|youtube\.com\/@)([^/?]+)/)?.[1];return handle?[handle]:[];})],language:person.language,source:TOPICS.meta.creatorSource,exposure:appearances/4,method:'reference-exposure-estimate',basis:`Listed in Wargaming's creator directory; ${appearances} appearances across this reference set's directory, spotlight, and Team Clash rosters. Editorial familiarity proxy, not follower counts or measured trivia frequency.`};
  });
  // Historical Team Clash participants remain valid even if no longer in today's directory.
  for(const name of [...clash2020,...clash2021])if(!people.some(person=>normalize(person.name)===normalize(name)))people.push({id:'creator-'+normalize(name),name,aliases:creatorAliases[normalize(name)]??[],language:name==='Mailand'?'DE':name==='NewMulti2k'?'PL':'EN',source:'https://worldoftanks.eu/en/news/general-news/team-clash-2021-winner/',exposure:.5,method:'reference-exposure-estimate',basis:'Verified historical Team Clash roster; editorial familiarity estimate.'});
  const legacyCreators=['QuickyBaby','Circon','Merlanthous','Zeronez','The Mighty Jingles','Highflyer15'];
  for(const name of legacyCreators)if(!people.some(person=>normalize(person.name)===normalize(name)))people.push({id:'creator-'+normalize(name),name,aliases:name==='The Mighty Jingles'?['Jingles','Mighty Jingles','BohemianEagle']:[],language:'EN',source:'https://worldoftanks.eu/en/news/general-news/89-information-community-activities/',exposure:name==='The Mighty Jingles'?.7:.35,method:'reference-exposure-estimate',basis:'Verified in the publisher’s 2013 Patch 8.9 community roundup. Historical creator familiarity estimate.'});
  add('creators-all','creators','Name a WoT content creator',people,'Creators in the official directory snapshot and historical EU Team Clash 2020/2021 participants.');
  for(const [language,label] of [['EN','English-language'],['DE','German-language'],['PL','Polish-language'],['FR','French-language']])add('creators-'+language.toLowerCase(),'creators',`Name an ${label} WoT content creator`.replace('an German','a German').replace('an Polish','a Polish').replace('an French','a French'),people.filter(person=>person.language===language));
  add('creators-team-clash','creators','Name a team leader from EU Team Clash 2020 or 2021',people.filter(person=>[...clash2020,...clash2021].some(name=>normalize(name)===normalize(person.name))));
  add('creators-2013','creators','Name a creator in the 2013 Patch 8.9 community roundup',people.filter(person=>legacyCreators.some(name=>normalize(name)===normalize(person.name))));

  const releases=[];
  for(const [year,book] of Object.entries(TOPICS.yearbooks)){
    // A return to the shop is not a first release: both of these existed much earlier.
    const names=book.names.filter(name=>!(Number(year)===2021&&/Aufklärungspanzer/.test(name))&&!(Number(year)===2022&&/T-22 medium/.test(name)));
    const answers=unique(names.map(name=>({...vehicle(name,book.source),releaseYear:Number(year)})));
    releases.push(...answers);add('releases-'+year,'eras',`Name a tank first released in NA/EU in ${year}`,answers,'Publisher NA/EU yearbook; returning versions of previously released tanks are excluded. A prior launch in another region does not determine the NA/EU introduction date.');
  }
  const laterNames=new Set([...releases,...boxes.filter(t=>[2025,2026].includes(t.holidayYear))].map(t=>normalize(t.name)));
  const early=tanks.filter(t=>!laterNames.has(normalize(t.name))&&t.classifications.some(c=>['v09171','v0922','v10000'].includes(c.version)));
  const until2019=unique([...early,...boxes.filter(t=>t.holidayYear<=2020)]);
  const newer=unique([...releases.filter(t=>t.releaseYear>2020),...boxes.filter(t=>[2025,2026].includes(t.holidayYear))]);
  add('released-before-2020','eras','Name a tank released in NA/EU before 2020',until2019,'Historical production rosters and pre-2020 Holiday Ops vehicles.');
  add('released-after-2020','eras','Name a tank first released in NA/EU after 2020',newer);
  add('released-before-2023','eras','Name a tank released in NA/EU before 2023',unique([...until2019,...releases.filter(t=>t.releaseYear<2023)]));
  add('released-after-2022','eras','Name a tank first released in NA/EU after 2022',unique([...releases.filter(t=>t.releaseYear>2022),...boxes.filter(t=>[2025,2026].includes(t.holidayYear))]));
  for(const [id,title,tag] of [
    ['jet-boosters','Name a tank with jet boosters','rocketAcceleration'],
    ['wheels','Name a wheeled vehicle','wheeledVehicle'],
    ['double-barrels','Name a double-barreled tank','dualgun'],
    ['siege-mode','Name a tank with a siege or alternate driving mode','siegeMode'],
    ['autocannons','Name a tank with an autocannon','autocannon']
  ])add(id,'mechanics',title,tanks.filter(t=>t.tags.split(',').includes(tag)),'Mechanic verified against the published vehicle tags.');
  add('animal-names','oddities','Name a tank named after an animal or mythical creature',tanks.filter(t=>/\b(?:Maus|Löwe|Tiger|Panther|Leopard|Luchs|Lynx|Rinoceronte|Minotauro|Manticore|Tortoise|Badger|Scorpion|Skorpion|Turtle|Viper|Cobra|Lion|LIS|Bisonte|Fossa|Borkenkäfer|Coccodrillo)\b/i.test(t.name)),'Animal names, translations, and mythical creatures in vehicle names count.');
  add('people-names','oddities',"Name a tank whose name includes a person's surname",tanks.filter(t=>/\b(?:Patton|Sherman|Pershing|Sheridan|Jackson|Churchill|Cromwell|Walker|Hopkins|Grant|Lee|Stuart|Turchaninov|Lewandowskiego)\b/i.test(t.name)),'Includes actual and fictional namesakes explicitly used in the English vehicle name.');
  return prompts;
}
