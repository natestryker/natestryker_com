/* Double Down: finite, ingredient-specific fan progression, hydrated locally. */
(()=>{'use strict';const G=GAME,E=G.elements,P=G.profiles,R=G.recipes,V=G.variants,key=G.pairKey=(a,b)=>{const pair=[a,b].sort();return pair.some(n=>n.includes('|'))?JSON.stringify(pair):pair.join('|')};G.splitPair=k=>{try{return k.startsWith('["')?JSON.parse(k):k.split('|')}catch{return[]}};
const before=Object.keys(E),growth=G.growth={},families=G.growthFamilies={};
function add(n,subject,trait='magic',category='Evolution',description='A fan-made crafting evolution, not an official item, skin, or achievement.'){if(!E[n]){E[n]={category,icon:'✧',description};P[n]={subject:P[subject]?.subject||subject,trait};if(P[subject]?.champion)P[n].champion=P[subject].champion}return n}
function recipe(a,b,c){if(!E[a]||!E[b]||!E[c])throw Error('Invalid Double Down recipe: '+[a,b,c]);R[key(a,b)]=c}
for(const[n,subject,trait,description]of [['Potential','Magic','power','The possibility of becoming something greater.'],['Color','Light','light','Pigment, palettes, and cosmetic possibilities.'],['Sound','Music','spirit','A note waiting to become a song.'],['Teamwork','Human','power','One player becomes a team.']]){
 const anchor=V[subject]?subject:subject==='Music'?'Spirit':'Magic';add(n,anchor,trait,'Essence',description);
}
G.starters=[...new Set([...G.starters,'Life','Time','Metal','Competition','Potential','Color','Sound','Teamwork'])];
// Distinct names and destinations for the early game, not adjective fallbacks.
const paths=[
 ['Time','Clock','Timeline','History','Ancient History','Lost Civilization'],
 ['Competition','Tournament','Playoffs','Grand Final','Championship','Championship Dynasty'],
 ['Potential','Training','Practice','Mastery','Limit Break','Transcendence'],
 ['Color','Palette','Rainbow','Aurora','Prismatic Sky','Chromatic Universe'],
 ['Sound','Music','Song','Concert','World Tour','Worlds Anthem'],
 ['Teamwork','Duo Queue','Five Stack','Scrim','Team Synergy','Perfect Teamfight'],
 ['Life','Heal','Regeneration','Immortality','Eternal Life','World Tree'],
 ['Metal','Sword','B. F. Sword','Infinity Edge','Masterwork Infinity Edge','Infinity Forge'],
 ['Ruby Crystal',"Giant's Belt","Warmog's Armor",'Heartsteel','Infinite Heartsteel','Titan of the Rift'],
 ['Sapphire Crystal','Tear of the Goddess',"Archangel's Staff","Seraph's Embrace",'Mana Ocean','Living Mana'],
 ['Long Sword','Pickaxe','B. F. Sword','Infinity Edge','Masterwork Infinity Edge','Infinity Forge'],
 ['Cloth Armor','Chain Vest','Thornmail','Walking Fortress','Unbreakable Citadel','Living Bastion'],
 ['Boots','Boots of Speed','Boots of Swiftness','Lightning Steps','Across the Rift','Everywhere at Once'],
 ['Poro','Poro Family','Poro Village','Poro Kingdom','Poro Empire','Poroverse'],
 ['Minion','Minion Wave','Cannon Wave','Super Minion Wave','Minion Army','Minion Uprising'],
 ['Ward','Vision Network','Map Control','Total Vision','Omniscient Ward','All-Seeing Rift'],
 ['Gold','Treasure','Vault','Royal Treasury','Dragon Hoard','Golden Empire'],
 ['Dragon','Dragon Nest','Dragon Flight','Dragon Council','Dragon Kingdom','Dragon World'],
 ['Fire','Sun','Supernova','Nebula','Galaxy','Universe'],
 ['Water','Ocean','World Ocean','Ocean Planet','Tidal Galaxy','Endless Sea'],
 ['Earth','Mountain','Mountain Range','Continent','Supercontinent','Living Planet'],
 ['Magic','Rune','Runic Circle','Ley Line','Arcane Nexus','Arcane Singularity']
];
for(const path of paths){const anchor=P[path[0]].subject,trait=P[path[0]].trait;for(const n of path)add(n,anchor,trait);for(let i=0;i<path.length-1;i++)recipe(path[i],path[i],path[i+1])}
// Every starter pair gets a deliberate route into League, cosmetics or esports.
const early=`Magic|Life|Human
Magic|Time|Time Warp
Magic|Metal|Hextech
Magic|Competition|Esports
Magic|Potential|Rune
Magic|Color|Cosmetics
Magic|Sound|Bard
Magic|Teamwork|Summoner
Earth|Life|Nature
Earth|Time|Fossil
Earth|Metal|Ore
Earth|Competition|Arena
Earth|Potential|Seed
Earth|Color|Gemstone
Earth|Sound|Echo
Earth|Teamwork|Demacia
Water|Life|Fish
Water|Time|Erosion
Water|Metal|Rust
Water|Competition|River Race
Water|Potential|Rain
Water|Color|Ink
Water|Sound|Wave
Water|Teamwork|Bilgewater
Fire|Life|Phoenix
Fire|Time|Ash
Fire|Metal|Forge
Fire|Competition|Rivalry
Fire|Potential|Spark
Fire|Color|Fireworks
Fire|Sound|Explosion
Fire|Teamwork|Noxus
Life|Time|Growth
Life|Metal|Blitzcrank
Life|Competition|Gladiator
Life|Potential|Evolution
Life|Color|Flower
Life|Sound|Voice
Life|Teamwork|Community
Time|Metal|Clock
Time|Competition|Speedrun
Time|Potential|Training
Time|Color|Seasons
Time|Sound|Rhythm
Time|Teamwork|Legacy
Metal|Competition|Trophy
Metal|Potential|Anvil
Metal|Color|Chrome
Metal|Sound|Bell
Metal|Teamwork|Workshop
Competition|Potential|Rookie
Competition|Color|Team Colors
Competition|Sound|Crowd
Competition|Teamwork|Esports
Potential|Color|Chroma
Potential|Sound|Melody
Potential|Teamwork|Dream Team
Color|Sound|K/DA
Color|Teamwork|Team Jersey
Sound|Teamwork|Pentakill`;
for(const line of early.split('\n')){const[a,b,c]=line.split('|');add(c,P[a].subject,P[a].trait);recipe(a,b,c)}
// Fan progression is separate from official skins/items and never renames them.
const templates={
 Champion:['Champion Mastery: ','Signature Pick: ','Champion Legend: '],
 Item:['Reforged: ','Masterwork: ','Mythic Relic: '],
 Ability:['Practiced: ','Max-rank: ','Perfect Cast: '],
 Skin:['Skin Spotlight: ',"Collector Showcase: ",'Skin Exhibition: '],
 Chroma:['Color Swatch: ','Color Study: ','Prismatic Showcase: '],
 Theme:['Theme Collection: ','Theme Festival: ','Theme Universe: '],
 Pro:['Highlight Montage: ','Career Tribute: ','Esports Legacy: '],
 Team:['Fan Club: ','Home Stadium: ','Team Dynasty: '],
 Region:['Regional Alliance: ','Regional Empire: ','Regional Golden Age: '],
 Rift:['Rift Encounter: ','Rift Adventure: ','Rift Legend: '],
 Rune:['Empowered Rune: ','Runic Inscription: ','Runic Monument: '],
 Build:['Build Guide: ','Build Masterclass: ','Build Legend: '],
 Esports:['Esports Spotlight: ','Esports Documentary: ','Esports Archive: '],
 Collection:['Expanded Collection: ','Grand Collection: ','Complete Showcase: '],
 Essence:['Concentrated: ','Abundant: ','Boundless: '],
 Evolution:['Greater: ','Exalted: ','Legendary: ']
};
const bases=Object.keys(E).filter(n=>templates[E[n].category]&&!G.starters.includes(n));
for(const base of bases){const stages=templates[E[base].category].map(prefix=>prefix+base),profile=P[base];families[base]=stages;
 for(let i=0;i<stages.length;i++){add(stages[i],profile.subject,profile.trait);growth[stages[i]]={base,stage:i};if(profile.champion)P[stages[i]].champion=profile.champion}
 // Retain hand-authored upgrades such as Ruby Crystal -> Giant's Belt.
 if(!R[key(base,base)])recipe(base,base,stages[0]);
 recipe(base,'Potential',stages[0]);
 for(let i=0;i<stages.length-1;i++)recipe(stages[i],stages[i],stages[i+1]);
 // The final tier connects back to a different branch of the same ingredient.
 const alternate=V[profile.subject]?.[profile.trait==='power'?'star':'power'];
 if(alternate)recipe(stages[2],stages[2],alternate);
}
// Preserve starter recipes where Potential participates; they take precedence.
for(const line of early.split('\n')){const[a,b,c]=line.split('|');recipe(a,b,c)}
for(const path of paths)for(let i=0;i<path.length-1;i++)recipe(path[i],path[i],path[i+1]);
// Alternate routes keep earlier content reachable when an early pair changes.
for(const[a,b,c]of [['Forge','Metal','Shield'],['Rivalry','Fire','Rage'],['Tournament','Time','Best of Five'],['Voice','Magic','Spirit'],['Gold','Competition','Shop'],['Rune','Teamwork','World Rune'],['Minion Wave','Metal','Super Minion'],['Dragon','Time','Elder Dragon'],['Mountain','Magic','Targon'],['Poro Family','Life','Gigantic Poro']])recipe(a,b,c);
// Each starter's own progression remains available via doubling even when its
// Potential pairing is reserved for the early-game recipe above.
G.trails.push({name:'The power of two',target:'Poroverse',description:'Double a Poro all the way into its own universe.',icon:'×2'},{name:'Born to compete',target:'Championship Dynasty',description:'Grow Competition into a championship dynasty.',icon:'🏆'},{name:'A perfect cast',target:'Perfect Cast: Paddle Star',description:'Practice Zoe’s Q and follow its own evolution.',icon:'✹'},{name:'The sound of Worlds',target:'Worlds Anthem',description:'Turn a sound into a world-stage anthem.',icon:'♫'});
G.stats.total=Object.keys(E).length;G.stats.evolutions=Object.keys(growth).length;G.stats.newSelfDiscoveries=G.stats.total-before.length;G.stats.authoredRecipes=Object.keys(R).length;G.stats.selfRecipes=Object.keys(R).filter(k=>{const[a,b]=G.splitPair(k);return a===b}).length;
})();
