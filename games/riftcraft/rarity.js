/* Rare variants require explicit crafted catalysts, never a generic fallback. */
(()=>{'use strict';const G=GAME,E=G.elements,P=G.profiles,R=G.recipes,V=G.variants,K=G.pairKey;
const variantNames=new Set(Object.values(V).flatMap(v=>Object.values(v)));
const rare=n=>!!G.growth[n]||variantNames.has(n)||E[n]?.category==='Rare';
for(const n of variantNames)E[n].rarity='rare';
G.catalysts={};G.rareDetails={};
function add(n,subject,trait,category='Material'){if(!E[n]){E[n]={category,icon:category==='Rare'?'✦':'◈',description:category==='Rare'?'A rare fan-made transformation, unlocked with crafted enchantments.':'A crafted enchantment material. Combine with an ingredient to unlock rare variants.'};P[n]={subject:P[subject].subject,trait};if(P[subject].champion)P[n].champion=P[subject].champion}return n}
function recipe(a,b,c){if(!E[a]||!E[b]||!E[c])throw Error('Missing rarity ingredient '+[a,b,c]);R[K(a,b)]=c}
add('Enchantment Forge','Magic','rune');recipe('Arcane Singularity','World Rune','Enchantment Forge');
const materials={fire:['Infernal Ember','Fire'],water:['Abyssal Pearl','Water'],earth:['Mountain Heart','Earth'],magic:['Arcane Prism','Magic'],rune:['Runic Seal','Rune'],armor:['Adamant Plate','Shield'],life:['Vital Spark','Life'],nature:['Ancient Seed','Nature'],shadow:['Eclipse Shard','Shadow'],death:['Soul Cinder','Death'],spirit:['Spirit Knot','Spirit'],dream:['Dream Thread','Dream'],portal:['Rift Key','Portal'],star:['Astral Core','Star'],light:['Dawn Crystal','Light'],ice:['True Ice Shard','Ice'],steam:['Cloud Condensate','Steam'],tech:['Resonant Hextech Core','Hextech'],gold:['Sovereign Gold','Gold'],attack:['Perfect Edge','Sword'],speed:['Wind Essence','Bow'],time:['Hourglass Sand','Time'],rage:['Berserker Seal','Rage'],poison:['Venom Distillate','Poison'],big:['Colossus Sigil','Mountain'],power:['Masterwork Sigil','Mastery'],tiny:['Miniature Sigil','Poro'],bootleg:['Counterfeit Seal','Shop'],stealth:['Veil Thread','Ward'],tilt:['Tilt Relic','Competition']};
for(const[trait,[name,source]]of Object.entries(materials)){const uncut='Unrefined '+name;add(uncut,source,trait);add(name,source,trait);G.catalysts[name]=trait;recipe('Enchantment Forge',source,uncut);recipe(uncut,'Mastery',name)}
add('Ascension Sigil','Magic','power');G.catalysts['Ascension Sigil']='growth';recipe('Masterwork Sigil','Enchantment Forge','Ascension Sigil');
// Remove short-circuits into adjective families. Once earned, doubling a growth
// card can still advance its own chain, but cannot spill into another family.
let gated=0;for(const[k,v]of Object.entries(R)){if(!rare(v))continue;const[a,b]=G.splitPair(k);if(G.catalysts[a]||G.catalysts[b])continue;if(a===b&&G.growth[a]&&G.growth[v]?.base===G.growth[a].base)continue;delete R[k];gated++}
for(const[subject,variants]of Object.entries(V))for(const[trait,name]of Object.entries(variants))recipe(subject,materials[trait][0],name);
for(const[base,stages]of Object.entries(G.growthFamilies))recipe(base,'Ascension Sigil',stages[0]);
// Specific two-enchantment fusions: the first rare form is an ingredient, not a
// shortcut that ordinary starter elements can create.
const fusions=[['Event-Horizon','star','shadow'],['Dream-Walking','dream','portal'],['Storm-Forged','water','tech'],['Sun-Crowned','fire','light'],['Winterbound','ice','spirit'],['Soul-Forged','spirit','armor'],['Time-Fractured','time','portal'],['World-Shattering','earth','power']];
const subjects=Object.keys(G.champMeta).concat(Object.keys(G.itemMeta),Object.keys(G.pros));
for(const subject of subjects){if(!V[subject])continue;for(const[prefix,first,second]of fusions){const n=prefix+' '+subject;add(n,subject,second,'Rare');G.rareDetails[n]={subject,first,second};recipe(V[subject][first],materials[second][0],n)}}
const specials=[['Sleep-Deprived Zoe','Zoe','dream','tilt'],['Deadline-Dodging Ekko','Ekko','time','stealth'],['Overclocked Blitzcrank','Blitzcrank','tech','speed'],['Solar-Powered Leona','Leona','light','power'],['Black-Ice Lissandra','Lissandra','ice','shadow'],['Galaxy-Brained Heimerdinger','Heimerdinger','star','tech'],['Stage-Diving Seraphine','Seraphine','spirit','rage'],['Caffeine-Fueled Faker','Faker','speed','power'],['Final-Boss Faker','Faker','power','shadow'],['Pocket-Dimension Yuumi','Yuumi','tiny','portal'],['Dragon-Hoard Ornn','Ornn','fire','gold'],['Moonstruck Aphelios','Aphelios','light','dream']];
for(const[n,s,a,b]of specials){if(!V[s])continue;add(n,s,b,'Rare');G.rareDetails[n]={subject:s,first:a,second:b};recipe(V[s][a],materials[b][0],n)}
G.isRare=rare;G.rarityStats={gatedShortcuts:gated,newRareVariants:Object.keys(G.rareDetails).length};
G.trails.push({name:'Earn your enchantments',target:'Enchantment Forge',description:'Build an arcane forge to unlock rare transformation materials.',icon:'◈'},{name:'Beyond the horizon',target:'Event-Horizon Zoe',description:'Fuse astral and eclipse enchantments into a rare Zoe variant.',icon:'✦'});
G.stats.selfRecipes=Object.keys(R).filter(k=>{const[a,b]=G.splitPair(k);return a===b}).length;G.stats.total=Object.keys(E).length;G.stats.authoredRecipes=Object.keys(R).length;
})();
