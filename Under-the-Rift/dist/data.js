export const ROLES=['TOP','JGL','MID','ADC','SUP'];
export const SKILLS=['Mechanics','Communication','Macro','Teamfighting'];
export const FOCUSES=['Balanced','Mechanics','Communication','Macro','Teamfighting','Recovery'];
export const TRAITS={
Clutch:'Performs better in decisive games.',Playmaker:'Risky calls succeed 4 percentage points more often.',Student:'Training gains are 10% greater.',Resilient:'Poor performances have a smaller effect on Form.',Driven:'Learns more from intense sessions, but tires faster.',Connector:'Gets more value from teammate familiarity.',
Strategist:'Macro contributes an extra 2 points in key contests.',Duelist:'Mechanics contribute an extra 2 points in key contests.',Teamfighter:'Teamfighting contributes an extra 2 points in key contests.',Captain:'Natural leadership. The appointed club captain improves calls by up to 1.5 percentage points, based on Communication.',
Consistent:'Individual performance varies less between games.',Streaky:'Higher highs and lower lows in individual performance.',Tireless:'Accumulates 20% less training fatigue.',Restorative:'Recovery sessions remove 30% more fatigue.',Optimist:'Positive performances improve Form a little more.',Perfectionist:'Learns 5% faster, but reacts more strongly to a poor game.',Mentor:'Academy players on the team learn 5% faster.',Showman:'Community and media activities give an extra Form boost.',Analyst:'Learns Macro 15% faster.',RiskTaker:'Risky calls succeed 3 percentage points more often, with more variable performances.',Patient:'Safe calls succeed 4 percentage points more often.',Improviser:'Control calls succeed 4 percentage points more often.',BigStage:'A small performance boost in international games.',PracticeAce:'Training gains are 15% greater; match performances are slightly less reliable.'};
// Each personality modifier has a live, small gameplay effect.
export const PERSONALITY={
Empathetic:{description:'Communication training is 10% more effective.',skill:'Communication',gain:1.1},
Methodical:{description:'Balanced training is 8% more effective.',focus:'Balanced',pace:1.08},
Curious:{description:'Learns Macro 10% faster.',skill:'Macro',gain:1.1},
Reflective:{description:'Light training is 10% more effective.',intensity:'Light',pace:1.1},
Competitive:{description:'Intense training is 8% more effective, with 5% more fatigue.',intensity:'Intense',pace:1.08,fatigue:1.05},
Disciplined:{description:'Normal training generates 25% less fatigue.',fatigueNormal:.75},
Easygoing:{description:'Recovery restores one extra Form.',recoveryForm:1},
Focused:{description:'Mechanics training is 10% more effective.',skill:'Mechanics',gain:1.1},
Collaborative:{description:'Teamfighting training is 10% more effective.',skill:'Teamfighting',gain:1.1},
Composed:{description:'Game-to-game performance varies 10% less.',spread:.9},
Mercurial:{description:'Game-to-game performance varies 15% more.',spread:1.15},
Tenacious:{description:'Gains one performance point while behind in a series.',behind:1},
Closer:{description:'Gains one performance point when one win from taking a series.',matchPoint:1},
FreshMind:{description:'Gains one performance point below 25 fatigue.',fresh:1},
Encouraging:{description:'Positive performances improve Form 10% more.',positive:1.1},
Sensitive:{description:'Poor performances affect Form 10% more.',negative:1.1}
};
Object.assign(TRAITS,Object.fromEntries(Object.entries(PERSONALITY).map(([name,data])=>[name,data.description])));
export const LEGACY_PORTRAITS=[0,2,3,4,5,7,8,10,12,14,15];
export const MALE_PORTRAITS=[...LEGACY_PORTRAITS,...Array.from({length:256},(_,i)=>16+i)];
export const NICHES={
'Tank':{role:'TOP',champ:'Ornn',art:0},'Duelist':{role:'TOP',champ:'Fiora',art:1},'Bruiser':{role:'TOP',champ:'Gnar',art:2},
'Engage jungler':{role:'JGL',champ:'Sejuani',art:3},'Carry jungler':{role:'JGL',champ:'Graves',art:4},'Enabler':{role:'JGL',champ:'Ivern',art:5},
'Control mage':{role:'MID',champ:'Orianna',art:6},'Assassin':{role:'MID',champ:'Akali',art:7},'Artillery mage':{role:'MID',champ:'Zoe',art:8},
'Hypercarry':{role:'ADC',champ:'Jinx',art:9},'Lane bully':{role:'ADC',champ:'Caitlyn',art:10},'Utility carry':{role:'ADC',champ:'Ashe',art:11},
'Enchanter':{role:'SUP',champ:'Lulu',art:12},'Engage support':{role:'SUP',champ:'Rell',art:13},'Warden':{role:'SUP',champ:'Braum',art:14}};
export const COMBOS=[
['Tank','Hypercarry','Front to back','A durable frontline buys time for a scaling carry.',1.3],
['Hypercarry','Enchanter','Protect the carry','Shields and buffs support a sustained damage threat.',1.3],
['Tank','Control mage','Hold the line','Frontline control sets up reliable area damage.',.9],
['Engage jungler','Control mage','Wombo setup','Reliable initiation delivers the mage’s teamfight.',1.2],
['Engage jungler','Assassin','Find the pick','An initiator creates openings for the assassin.',1],
['Carry jungler','Enabler','Shared resources','',0],
['Carry jungler','Warden','Cover the invade','Protection helps a resource-heavy jungler contest space.',1],
['Duelist','Utility carry','Split-map cover','Utility and disengage give the duelist time in a side lane.',1.2],
['Duelist','Enabler','Side-lane insurance','A supportive jungler helps the duelist establish pressure.',1],
['Artillery mage','Lane bully','Siege pressure','Long-range pressure forces opponents away from towers.',1.2],
['Artillery mage','Warden','Protected poke','Peel gives an artillery player room to work.',1],
['Lane bully','Engage support','Lane kill threat','An aggressive lane converts pressure into openings.',1.2],
['Bruiser','Engage support','Dive partners','Two committed threats can reach the back line together.',1],
['Bruiser','Enabler','Sustained skirmish','A supportive jungler keeps the bruiser fighting.',1],
['Assassin','Utility carry','Catch and finish','A utility carry creates targets for the assassin.',1],
['Carry jungler','Control mage','Mid-jungle priority','Mid control creates space for an invading jungler.',1]] .filter(x=>x[4]>0);
export const ORGS=[
['Cloud9','C9','LCS','#3b9bc6'],['Team Liquid','TL','LCS','#304c72'],['FlyQuest','FLY','LCS','#427b59'],['Dignitas','DIG','LCS','#c49b30'],['Shopify Rebellion','SR','LCS','#36896b'],['LYON','LYON','LCS','#bc553e'],['Sentinels','SEN','LCS','#c94e52'],['Disguised','DSG','LCS','#85805f'],
['T1','T1','LCK','#c9434e'],['Gen.G','GEN','LCK','#9e8442'],['Hanwha Life','HLE','LCK','#d37337'],['Dplus KIA','DK','LCK','#35877b'],['kt Rolster','KT','LCK','#b7474d'],['Nongshim RedForce','NS','LCK','#a54b43'],['BNK FEARX','BFX','LCK','#b39932'],['DRX','DRX','LCK','#4a6cb2'],['DN SOOPers','DNS','LCK','#477885'],['BRION','BRO','LCK','#397459']];
// Ten-club custom LPL division; stable IDs append to the original clubs.
export const LPL_ORGS=[
['Bilibili Gaming','BLG','LPL','#ec6c9e'],['Top Esports','TES','LPL','#df603b'],['Team WE','WE','LPL','#c63442'],["Anyone's Legend",'AL','LPL','#cf9b46'],['JD Gaming','JDG','LPL','#d73d53'],['EDward Gaming','EDG','LPL','#b4b7bd'],['Invictus Gaming','IG','LPL','#9aa4b0'],['LNG Esports','LNG','LPL','#32b4bb'],['Ninjas in Pyjamas','NIP','LPL','#c4cc49'],['Weibo Gaming','WBG','LPL','#d06c35']];
ORGS.push(...LPL_ORGS);
export const LEC_ORGS=[['G2 Esports','G2','LEC','#b7bdc6'],['Fnatic','FNC','LEC','#f17b27'],['Karmine Corp','KC','LEC','#459fdb'],['Movistar KOI','MKOI','LEC','#6878dd'],['GIANTX','GX','LEC','#4d8fe1'],['Natus Vincere','NAVI','LEC','#e6ce39'],['Shifters','SHFT','LEC','#cf5f9c'],['SK Gaming','SK','LEC','#a9bbc8'],['Team Heretics','TH','LEC','#c4a875'],['Team Vitality','VIT','LEC','#e5bb32']];
ORGS.push(...LEC_ORGS);
export const TEAM_LOGOS=Object.fromEntries(ORGS.map(t=>[t[1],'assets/teams/'+t[1]+(t[1]==='DNS'?'.webp':'.png')]));
export const NAMES=`Aster Rift Kairo Halo Moss Ruin Tempo Wisp Nova Echo Slate Flux Prism Arrow Rune Atlas Drift Solace Vesper Beacon Cinder Haze Orbit Pulse Mellow Fable Onyx Lumen Comet Fern Axiom Torrent Mirage Flare Lark Crux Vex Lucent Raven Sage Zenith Sora Kite Bloom Pixel Dusk Polaris Nox Glint Cove Alder Ash Aspen Azure Basil Birch Bolt Boreal Breeze Brisk Bronze Cobalt Copper Coral Cosmos Crest Crow Cyan Dagger Dawn Delta Dew Ember Fenn Finch Flint Frost Gale Garnet Ghost Grove Harbor Hawk Hazel Hush Indigo Iris Ivory Jade Jet Jolt Juniper Kestrel Kindle Lake Laurel Leaf Lynx Maple Marble Meadow Meteor Mist Moon Nectar Night Oak Ocean Olive Opal Orchid Osprey Otter Peak Pebble Pine Pluto Quartz Quill Rain Reed Reef Ridge Rime River Robin Rose Rowan Ruby Rush Sable Scout Shade Shale Shore Silver Sky Snow Solar Sonic Spark Spruce Steel Stone Storm Summit Swift Talon Terra Thistle Thorn Tide Timber Topaz Trace Vale Vapor Velvet Verdant Violet Volt Wave Willow Winter Wren Zephyr Zero Zest Ardent Argo Aria Arrowhead Aura Avalon Beryl Blade Bramble Cascade Cipher Cloud Cometfall Cricket Cross Cypher Dancer Dash Daybreak Dream Dune Eclipse Edge Elio Enigma Epoch Falcon Fawn Feather Fervor Flash Flicker Flow Focus Forge Fox Galaxy Glacier Gleam Haloed Haven Helix Horizon Hunter Hydra Inferno Ion Javelin Joy Karma Koda Lagoon Lance Lapis Laser Legacy Legend Lilac Lotus Lunar Lyric Mako Mango Mars Maven Mercury Midnight Mint Mistral Monsoon Mystic Neon Nimbus Nomad North Oasis Obsidian Omega Oracle Origin Panda Paradox Patch Phantom Phoenix Pilot Pivot Pollen Proton Quest Quasar Quiver Raptor Ray Reverb Riddle Ripple Rook Saber Saffron Sail Salt Scarlet Shiver Signal Silk Sleet Slope Smoke Sol Sonicwave Specter Spirit Spire Spring Starlit Static Stellar Stride Sugar Sunflare Surge Sylvan Tactic Tangle Teal Thunder Titan Tracer Trinity Tundra Twilight Umbra Unity Valor Vector Venom Vertex Vigor Vista Vivid Void Wander Warden Whisper Wildfire Wish Wraith Xeno Yonder Yuki Zeno Zora`.split(' ');
// Pronounceable esports handles, deduplicated against the original word-name pool.
const handleStarts='Ae Aki Aro Azu Bao Beni Cae Dae Daro Eko Eri Fae Fio Garo Haku Haru Iko Izu Jae Jiro Kael Kaze Keni Kio Kuro Lio Lune Mako Miro Nari Neko Noa Oki Oru Raku Rei Riko Ryo Seki Seno Shio Taki Taro Teno Toki Vae Varo Vio Xai Xeno Yae Yori Yuno Zai Zeki Zio'.split(' ');
const handleEnds='ko rin zen kai ra no ki ri to shi vin ro sen lo mi on ru en yo su va ren ta'.split(' ');
const extraWords='Aegis Airlock Alchemy Anvil Apex Arcane Arctic Armada Aspect Astral Ballad Bastion Binary Blink Blitz Bravery Caliber Catalyst Cello Chisel Circuit Citadel Clarity Cobalt Composure Concord Conduit Courier Crescendo Cyclone Daring Decoy Defiant Deft Denali Dexter Digital Domino Dragonfly Dynamo Eden Elixir Emblem Encore Equinox Erode Ethereal Exodus Fathom Finesse Fjord Flick Flintlock Fortune Fresco Frontier Fugue Gambit Genesis Glimmer Grit Halcyon Hammer Harmonic Harpoon Helios Hexagon Hibiscus Hollow Humble Hyperion Ignite Impulse Inertia Infinite Insight Instinct Jaguar Jigsaw Jubilee Keystone Kinetic Knight Kraken Lantern Latitude Lazuli Leviathan Limelight Lockstep Logic Lucid Maestro Magnet Mantle Marigold Matrix Meridian Minuet Momentum Monarch Mosaic Nautilus Nebula Nickel Nitro Noble Nomadic Octave Omen Opus Outlier Overdrive Overture Paladin Panache Paragon Parity Patrol Pavilion Peregrine Pinnacle Plasma Polarity Prelude Prestige Prodigy Promise Prowess Pylon Radiant Rally Rampart Rapture Reason Recoil Resolve Resonance Rhetoric Ricochet Riptide Ritual Rocket Rondo Rumble Sanguine Savant Scepter Seabird Sentinel Serene Shard Shortcut Sidereal Siege Skylark Snapshot Snowcap Soprano Spectrum Spindle Spotlight Sprinter Stardust Steadfast Sterling Stonewall Stratus Sundial Supernova Symmetry Synapse Tangent Tapestry Tempest Thicket Torque Trance Traverse Trident Triumph Turbo Ultraviolet Unison Updraft Vanguard Vantage Vellum Verve Vigil Viridian Visage Vortex Wavelength Waypoint Whim Wildcard Windfall Wisdom Xenon Zeal Zodiac'.split(' ');
NAMES.push(...[...new Set([...extraWords,...handleStarts.flatMap(a=>handleEnds.map(b=>a+b))])].filter(n=>!NAMES.includes(n)));
export const EVENTS=[
{title:'An opening in bot lane',time:'08:40',text:'Their support has recalled. Your jungler is nearby.',calls:[['JGL','Commit to the gank','risk'],['MID','Keep the pressure in lane','steady'],['SUP','Secure vision first','control']]},
{title:'Trade or contest?',time:'19:20',text:'Dragon is coming up, but the opposite side of the map is open.',calls:[['JGL','Contest the river entrance','risk'],['TOP','Trade for a side-lane tower','steady'],['SUP','Wait for a better angle','control']]},
{title:'A Baron window',time:'29:10',text:'Their carry just showed bot. The team has a short window to act.',calls:[['JGL','Start Baron and force a response','risk'],['MID','Push the lanes first','steady'],['SUP','Catch them on the rotation','control']]},
{title:'A carry is getting ahead',time:'14:25',text:'Their strongest player is building a lead. Your team suggests a response.',calls:[['JGL','Send three and shut them down','risk'],['ADC','Trade resources on our strong side','steady'],['SUP','Protect our scaling lanes','control']]},
{title:'They are grouped mid',time:'23:15',text:'The enemy is threatening your outer tower with five players.',calls:[['TOP','Flank them before they reset','risk'],['ADC','Give the tower and farm safely','steady'],['MID','Clear the wave and hold position','control']]},
{title:'A chance to end',time:'33:40',text:'You have an opening after a skirmish, but the respawn timers are tight.',calls:[['ADC','Push now. We can finish','risk'],['TOP','Take the inhibitor and reset','steady'],['JGL','Turn to the next objective','control']]}
];
EVENTS.push(
{title:'A smite window',time:'21:30',impact:.22,text:'Dragon is low, but the enemy jungler still has a path into the pit.',calls:[['JGL','Commit to the finish','risk'],['ADC','Stop damage and force them away','steady'],['SUP','Zone the jungler before we finish','control']]},
{title:'Their teleport is down',time:'16:10',impact:.16,text:'Your top laner has a short numbers advantage on the opposite side of the map.',calls:[['TOP','Teleport behind their bot lane','risk'],['MID','Take the free side-lane pressure','steady'],['JGL','Threaten the dive and steal their camps','control']]},
{title:'A carry without Flash',time:'26:40',impact:.21,text:'The enemy carry used Flash. Your players see different ways to exploit the timer.',calls:[['SUP','Find the engage right now','risk'],['ADC','Hold our formation and punish a step forward','steady'],['MID','Control the choke they must walk through','control']]},
{title:'The base race call',time:'35:20',impact:.28,text:'Both teams have a wave near the enemy base. There may be time for only one decision.',calls:[['TOP','Keep pushing. We can end first','risk'],['MID','Recall and defend the Nexus','steady'],['JGL','Delay their recalls while our wave advances','control']]},
{title:'A suspiciously empty river',time:'18:50',impact:.17,text:'Three opponents are missing. The shortest route to the objective is unwarded.',calls:[['JGL','Challenge the brush together','risk'],['SUP','Give ground and use the longer route','steady'],['MID','Check with abilities and hold our exits','control']]},
{title:'An exposed inhibitor',time:'31:00',impact:.23,text:'An inhibitor is open, but your team is carrying unspent gold and the next objective is spawning.',calls:[['ADC','Push one more wave and take it','risk'],['JGL','Reset now and spend our gold','steady'],['TOP','I will threaten the inhibitor while you reset','control']]},
{title:'A level-two surprise',time:'02:15',impact:.10,text:'Your duo lane can reach level two first if the team commits to a fast opening.',calls:[['ADC','Flash forward as we level up','risk'],['SUP','Take the health advantage without overcommitting','steady'],['JGL','Path toward bot and cover the countergank','control']]},
{title:'The split-push dilemma',time:'28:30',impact:.22,text:'Your side laner is threatening a second tower while the other four face pressure at Baron.',calls:[['TOP','Keep them busy. I can take the base','risk'],['SUP','Give space and protect our retreat','steady'],['MID','Show at Baron without committing to a fight','control']]}
);

// Regional art pools describe commissioned fictional designs, not inferred identities.
export const PORTRAIT_POOLS={east:[...Array.from({length:64},(_,i)=>272+i),...Array.from({length:64},(_,i)=>400+i)],west:[...Array.from({length:64},(_,i)=>336+i),...Array.from({length:64},(_,i)=>464+i)]};
MALE_PORTRAITS.push(...PORTRAIT_POOLS.east,...PORTRAIT_POOLS.west);

// Rare personalities: weighted separately from the ordinary two-trait pool.
export const RARE_PERSONALITY={
AnchorMind:{description:'Rare · Teamfighting training +16%; steadier game performances.',skill:'Teamfighting',gain:1.16,spread:.9},
QuietGenius:{description:'Rare · Macro training +18%.',skill:'Macro',gain:1.18},
LimitBreaker:{description:'Rare · Mechanics training +18%; slightly more variable performances.',skill:'Mechanics',gain:1.18,spread:1.08},
SecondWind:{description:'Rare · +1.5 performance while behind in a series; +1 Form from recovery.',behind:1.5,recoveryForm:1},
IceVeins:{description:'Rare · +1.5 performance on match point; steadier performances.',matchPoint:1.5,spread:.9},
KindredSpirit:{description:'Rare · Communication training +18%.',skill:'Communication',gain:1.18},
ScrimDemon:{description:'Rare · Training gains +12%; stronger private scrim performances.',pace:1.12,scrim:3},
StageSpark:{description:'Rare · +1.5 performance on match point; positive Form gains +10%.',matchPoint:1.5,positive:1.1},
OldSoul:{description:'Rare · Light training +16%; poor games affect Form 15% less.',intensity:'Light',pace:1.16,negative:.85},
Relentless:{description:'Rare · Intense training +14%, with 10% less fatigue.',intensity:'Intense',pace:1.14,fatigue:.9},
PatternReader:{description:'Rare · Macro training +15%; +1 performance when fresh.',skill:'Macro',gain:1.15,fresh:1},
TeamFirst:{description:'Rare · Communication training +15%; normal training fatigue −20%.',skill:'Communication',gain:1.15,fatigueNormal:.8}
};
export const SPECIAL_PERSONALITY={OneMoreBubble:{description:'Signature · Mechanics training +20%; +1.5 performance while behind in a series.',skill:'Mechanics',gain:1.2,behind:1.5},StarCartographer:{description:'Signature · Macro training +18%; +1 performance when fresh.',skill:'Macro',gain:1.18,fresh:1},
Jhinaholic:{description:'Signature · Mechanics +6; Teamfighting +10; Teamfighting training +25%; match performance +1.5 with steadier aim.',skills:{Mechanics:6,Teamfighting:10},skill:'Teamfighting',gain:1.25,performance:1.5,spread:.85},
FioraMain:{description:'Signature · Mechanics +18; Macro −5; Mechanics training +40%.',skills:{Mechanics:18,Macro:-5},skill:'Mechanics',gain:1.4}};
Object.assign(PERSONALITY,RARE_PERSONALITY,SPECIAL_PERSONALITY);
Object.assign(TRAITS,Object.fromEntries(Object.entries({...RARE_PERSONALITY,...SPECIAL_PERSONALITY}).map(([k,v])=>[k,v.description])));
export const RARE_TRAITS=Object.keys(RARE_PERSONALITY);
export const SPECIAL_TRAITS=Object.keys(SPECIAL_PERSONALITY);
export const COMMON_TRAITS=Object.keys(TRAITS).filter(t=>!RARE_TRAITS.includes(t)&&!SPECIAL_TRAITS.includes(t));
const secretLink=(id,a,b,title,text,bonus,traits)=>Object.assign([a,b,title,text,bonus],{secretId:id,traits});
export const SECRET_COMBOS=[
secretLink('bedrock','Tank','Hypercarry','Bedrock & ambition','An unshakeable frontline protects a patient carry.',1.7,['AnchorMind','Patient']),
secretLink('silent-map','Control mage','Enabler','The silent map','Two quiet thinkers coordinate without wasting a word.',1.7,['QuietGenius','Analyst']),
secretLink('red-line','Duelist','Carry jungler','Beyond the red line','Two players find the limit together, then push it.',1.8,['LimitBreaker','Playmaker']),
secretLink('second-chance','Bruiser','Warden','One more stand','A resilient pair turns a retreat into a counterattack.',1.7,['SecondWind','Resilient']),
secretLink('absolute-zero','Hypercarry','Enchanter','Absolute zero','An ice-cold carry trusts an encouraging partner.',1.8,['IceVeins','Encouraging']),
secretLink('same-frequency','Engage jungler','Engage support','Same frequency','Two voices become one perfectly timed engage.',1.7,['KindredSpirit','Connector']),
secretLink('practice-stage','Assassin','Utility carry','From practice to stage','Private creativity finds a fearless public partner.',1.8,['ScrimDemon','StageSpark']),
secretLink('star-chart','Artillery mage','Warden','Written in the stars','Impossible angles meet impeccable protection.',1.9,['StarCartographer','TeamFirst']),
secretLink('long-game','Control mage','Tank','The long game','Patience turns a read into a winning map.',1.7,['PatternReader','OldSoul']),
secretLink('double-shift','Lane bully','Engage support','The double shift','Relentless practice meets a team-first lane partner.',1.8,['Relentless','TeamFirst'])
];
