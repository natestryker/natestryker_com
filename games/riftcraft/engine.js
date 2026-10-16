/* Ingredient-driven, finite crafting. No category lotteries or hashed outputs. */
(()=>{'use strict';const G=window.GAME,E=G.elements,R=G.recipes,P=G.profiles,V=G.variants;
const names=Object.keys(E).sort(),key=G.pairKey||((a,b)=>a<b?a+'|'+b:b+'|'+a),splitPair=G.splitPair||(k=>k.split('|'));
const identity=n=>P[n].champion||G.identity[n]||(G.champMeta[n]?n:G.champMeta[P[n].subject]?P[n].subject:null);
const ranks={Evolution:10,Pro:11,Team:10,Esports:7,Ability:8,Chroma:6,Collection:4,Rune:5,Draft:11,Champion:9,Skin:9,Build:9,Item:8,Rift:7,Region:6,Essence:4,Oddity:2,Theme:1};
const draftByName={};for(const [pro,entries] of Object.entries(G.drafts||{}))for(const [champion,name] of Object.entries(entries))draftByName[name]={pro,champion};
const itemFlags={};for(const [n,m] of Object.entries(G.itemMeta)){const t=new Set(m.tags);itemFlags[n]={hp:t.has('Health'),ap:t.has('SpellDamage'),ad:t.has('Damage'),armor:t.has('Armor'),mr:t.has('SpellBlock'),mana:t.has('Mana'),as:t.has('AttackSpeed'),crit:t.has('CriticalStrike'),vamp:t.has('LifeSteal'),boots:t.has('Boots'),gold:m.gold}}
const interactions={};function interaction(a,b,c){interactions[key(a,b)]=c}
for(const [a,b,c] of [['fire','water','steam'],['fire','ice','water'],['fire','earth','armor'],['water','earth','nature'],['magic','armor','tech'],['light','shadow','star'],['life','death','spirit'],['life','shadow','death'],['fire','nature','fire'],['water','poison','poison'],['tech','poison','poison'],['star','shadow','shadow'],['life','poison','poison'],['nature','death','nature'],['ice','water','ice'],['fire','steam','steam'],['magic','tech','tech'],['light','death','spirit'],['water','gold','gold'],['armor','attack','armor']])interaction(a,b,c);
const traitSubjects={fire:'Dragon',water:'Fish',earth:'Mountain',magic:'Crystal',rune:'Rune',armor:'Shield',life:'Animal',nature:'Forest',shadow:'Spirit',death:'Spirit',spirit:'Spirit',dream:'Dream',portal:'Portal',star:'Galaxy',light:'Rainbow',ice:'Poro',steam:'Cloud',tech:'Machine',gold:'Shopping Cart',attack:'Sword',speed:'Boots',time:'Clock',rage:'Warrior',poison:'Mushroom',big:'Poro',power:'Minion',tiny:'Poro',bootleg:'Long Sword',stealth:'Ward',tilt:'Minion'};
const seeds={fire:'Fire',water:'Water',earth:'Earth',magic:'Magic',rune:'Rune',armor:'Shield',life:'Life',nature:'Nature',shadow:'Shadow',death:'Death',spirit:'Spirit',dream:'Dream',portal:'Portal',star:'Star',light:'Light',ice:'Ice',steam:'Steam',tech:'Hextech',gold:'Gold',attack:'Sword',speed:'Bow',time:'Time',rage:'Rage',poison:'Poison',big:'Gigantic Poro',power:'Unstoppable Minion',tiny:'Tiny Poro',bootleg:'Bootleg Long Sword',stealth:'Invisible Ward',tilt:'Tilted Minion'};
const seedTraits=Object.fromEntries(Object.entries(seeds).map(([t,n])=>[n,t]));
const skinThemes={fire:'Infernal',water:'Pool Party',star:'Cosmic',nature:'Elderwood',ice:'Winter Wonder',tech:'PROJECT',shadow:'Coven',dream:'Spirit Blossom',light:'Dawnbringer'};
function variant(subject,trait,a,b){if(!V[subject])throw Error('Unknown semantic subject: '+subject);let out=V[subject][trait]||V[subject].magic;if(out===a||out===b){out=V[subject][trait==='big'?'power':'big'];if(out===a||out===b)out=V[subject].power;if(out===a||out===b)out=V[subject].magic}return out}
function championBuild(champ,item){const f=itemFlags[item]||{},p=f.ap?'AP':f.armor||f.mr||f.hp?'Tank':f.as?'On-hit':f.boots?'Haste':'AD';return p+' '+champ}
function itemPair(a,b){const x=itemFlags[a],y=itemFlags[b];if(!x||!y)return null;const s={};for(const k of ['hp','ap','ad','armor','mr','mana','as','crit','vamp','boots'])s[k]=x[k]||y[k];
 let out;
 if(s.ap&&s.ad)out="Guinsoo's Rageblade";
 else if(s.ap&&s.armor)out="Zhonya's Hourglass";
 else if(s.ap&&s.mr)out="Banshee's Veil";
 else if(s.armor&&s.mr)return variant(x.gold>=y.gold?a:b,'armor',a,b);
 else if(s.hp&&s.ap&&s.mana)out='Rod of Ages';
 else if(s.hp&&s.ap)out="Rylai's Crystal Scepter";
 else if(s.armor&&s.mana)out='Frozen Heart';
 else if(s.hp&&s.mr)out='Spirit Visage';
 else if(s.hp&&s.armor)out='Sunfire Aegis';
 else if(s.hp&&s.ad)out='Titanic Hydra';
 else if(s.ap&&s.as)out="Nashor's Tooth";
 else if(s.vamp&&s.ad)out='Bloodthirster';
 else if(s.ad&&s.as)out='Blade of the Ruined King';
 else if(s.mana&&s.ad)out='Manamune';
 else if(s.mana&&s.ap)out="Archangel's Staff";
 else if(s.hp&&s.mana)out='Catalyst of Aeons';
 else if(s.crit&&s.ad)out='Infinity Edge';
 else if(s.crit&&s.as)out="Runaan's Hurricane";
 else if(s.hp)out="Warmog's Armor";
 else if(s.ap)out="Rabadon's Deathcap";
 else if(s.armor)out='Thornmail';
 else if(s.mr)out='Force of Nature';
 else if(s.as)out="Guinsoo's Rageblade";
 else if(s.ad||s.crit)out='Infinity Edge';
 else if(s.mana)out="Seraph's Embrace";
 else if(s.boots)out='Boots of Swiftness';
 if(out&&E[out]&&out!==a&&out!==b)return out;
 const target=x.gold>=y.gold?a:b,other=target===a?b:a;return variant(target,P[other].trait,a,b)
}
function duo(a,b){if(a===b)return 'One-Trick '+a;const direct=R[key(a,b)];if(direct)return direct;
 const x=new Set(G.champMeta[a].roles),y=new Set(G.champMeta[b].roles),has=r=>x.has(r)||y.has(r),both=r=>x.has(r)&&y.has(r);
 if(has('Marksman')&&has('Support'))return 'Bot Lane Duo';if(both('Mage'))return 'Mage Duo';if(both('Assassin'))return 'Assassination Squad';if(both('Tank'))return 'Unbreakable Frontline';if(both('Marksman'))return 'Double Marksman';if(both('Support'))return 'Double Support';if(has('Mage')&&has('Assassin'))return 'Pick Comp';if(has('Mage')&&has('Marksman'))return 'Poke Comp';if(has('Tank')&&has('Support'))return 'Peel Comp';if(has('Assassin')&&has('Fighter'))return 'Dive Comp';if(has('Mage')&&has('Fighter'))return 'Wombo Combo';if(has('Fighter')&&has('Marksman'))return 'Skirmish Comp';if(has('Tank')||both('Fighter'))return 'Frontline';return 'Duo Queue'}
function rawResolve(a,b){if(!E[a]||!E[b])return null;const authored=R[key(a,b)];if(authored)return authored;if(a>b)[a,b]=[b,a];const x=E[a],y=E[b],pa=P[a],pb=P[b],ca=identity(a),cb=identity(b);
 // Progression + a new starter branches into that ingredient's own themes.
 if(G.growth?.[a]||G.growth?.[b]){const target=G.growth[a]?a:b,other=target===a?b:a,g=G.growth[target],stages=G.growthFamilies[g.base];if(['Potential','Time'].includes(other)&&g.stage<2)return stages[g.stage+1];const trait={Life:'life',Metal:'armor',Competition:'power',Color:'light',Sound:'spirit',Teamwork:'power'}[other];if(trait)return variant(P[target].subject,trait,a,b)}
 if(draftByName[a]||draftByName[b]){const d=draftByName[a]||draftByName[b],other=draftByName[a]?b:a,champ=identity(other);if(champ){const out=G.drafts[d.pro][champ];return out!==a&&out!==b?out:G.highlights[d.pro]['Outplay']}if(G.highlights[d.pro][other])return G.highlights[d.pro][other];if(E[other].category==='Item'||E[other].category==='Ability')return G.highlights[d.pro]['Outplay'];return variant(d.pro,P[other].trait,a,b)}
 if(x.category==='Item'&&y.category==='Item'){const result=itemPair(a,b);if(result)return result}
 if(ca&&cb){if(ca!==cb)return duo(ca,cb);if(x.category==='Build'&&a===b){const full=a.startsWith('Full-build ')?null:'Full-build '+a;if(full&&E[full])return full;return variant(ca,'power',a,b)}if(a===b)return variant(ca,pa.trait==='big'?'power':'big',a,b);return variant(ca,interactions[key(pa.trait,pb.trait)]||pb.trait,a,b)}
 if(ca&&y.category==='Item'||cb&&x.category==='Item'){const champ=ca||cb,item=ca?b:a,champInput=ca?a:b;let build=championBuild(champ,item);if(build===champInput)build='Full-build '+build;if(E[build]&&build!==champInput)return build;return variant(champ,P[item].trait,a,b)}
 if(x.category==='Region'&&y.category==='Region'&&a!==b)return 'Runeterra';
 if(a===b)return variant(pa.subject,pa.trait==='big'?'power':'big',a,b);
 // Modifier seeds always transform the other subject. This also provides a route
 // to every named variant without relying on chance or an unrelated result.
 let target,source;
 if(seedTraits[a]&&!seedTraits[b]){target=b;source=a}else if(seedTraits[b]&&!seedTraits[a]){target=a;source=b}
 else if(ca||cb){target=ca?a:b;source=ca?b:a}
 else{const rankA=ranks[E[pa.subject]?.category]||2,rankB=ranks[E[pb.subject]?.category]||2;target=rankA>=rankB?a:b;source=target===a?b:a}
 const pt=P[target],ps=P[source];let subject=pt.subject,trait=seedTraits[source]||ps.trait;
 if(seedTraits[a]&&seedTraits[b]){
  // Two abstractions use a concrete representative of one ingredient.
  target=(V[a]?a:V[b]?b:null);subject=target||traitSubjects[pa.trait];trait=target===a?pb.trait:target===b?pa.trait:pb.trait;
 }
 // Existing transformed objects carry their element forward into interactions.
 if(pt.transformed&&!seedTraits[source])trait=interactions[key(pt.trait,ps.trait)]||ps.trait;
 else if(pt.transformed&&['fire','water','ice','earth','nature','light','shadow','life','death','tech','poison'].includes(pt.trait))trait=interactions[key(pt.trait,trait)]||trait;
 const champ=ca||cb;
 if(champ&&E[source].category==='Theme'&&skinThemes[trait]){const skin=R[key(champ,skinThemes[trait])];if(skin&&E[skin].category==='Skin'&&skin!==a&&skin!==b)return skin}
 return variant(subject,trait,a,b)
}
// Unmatched pairs explore concrete concepts. Adjective variants are reserved
// for explicit recipes involving the enchantment materials above.
const concrete={fire:['Infernal','Brand','Dragon','Forge','Sun'],water:['Pool Party','Nami','Ocean','River','Fish'],earth:['Mountain','Targon','Malphite','Earth'],magic:['Rune','Crystal','Mage','Ryze'],rune:['World Rune','Ryze','Rune'],armor:['Shield','Guardian','Braum','Barrier'],life:['Heal','Regeneration','Soraka','Nature'],nature:['Elderwood','Forest','Ivern','Plant'],shadow:['Coven','Shadow Isles','Nocturne','Shadow'],death:['Shadow Isles','Karthus','Spirit','Death'],spirit:['Spirit Blossom','Ionia','Bard','Spirit'],dream:['Dream','Lillia','Zoe','Sleepy Trouble Bubble'],portal:['Portal','Zoe','Portal Jump','Void'],star:['Cosmic','Targon','Aurelion Sol','Galaxy'],light:['Dawnbringer','Lux','Light','Rainbow'],ice:['Winter Wonder','Freljord','Anivia','Ice'],steam:['Cloud','Steam','Ocean'],tech:['Hextech','Piltover','Heimerdinger','Machine'],gold:['Shop','Gold','Treasure','Shopping Cart'],attack:['Sword','Warrior','Darius','Noxus'],speed:['Boots of Swiftness','Hecarim','Bow','Boots'],time:['Clock','Ekko','Time','Zilean'],rage:['Rage','Tryndamere','Battle','Warrior'],poison:['Poison','Singed','Teemo','Mushroom'],big:['Mountain','Malphite','Titanic Hydra','Poro'],power:['Mastery','Victory','Competition','Warrior'],tiny:['Poro','Yordle','Bandle City','Teemo'],bootleg:['Shop','Shaco','Trickster'],stealth:['Ward','Vision Network','Akali','Shadow'],tilt:['Competition','Rivalry','Rage','Defeat']};
const abilities={};for(const[n,m]of Object.entries(G.abilityMeta||{}))(abilities[m.champion]??=[]).push(n);
function grounded(a,b){const pa=P[a],pb=P[b],ca=identity(a),cb=identity(b);let target,source;if(seedTraits[a]&&!seedTraits[b]){target=b;source=a}else if(seedTraits[b]&&!seedTraits[a]){target=a;source=b}else if(ca||cb){target=ca?a:b;source=ca?b:a}else{target=(ranks[E[pa.subject]?.category]||2)>=(ranks[E[pb.subject]?.category]||2)?a:b;source=target===a?b:a}const subject=P[target].subject,trait=seedTraits[source]||P[source].trait,champ=identity(target),pool=concrete[trait]||concrete.magic;
 const usable=n=>n&&E[n]&&n!==a&&n!==b&&!G.isRare(n);
 if(champ){const theme=skinThemes[trait];const skin=theme&&R[key(champ,theme)];if(usable(skin)&&E[skin].category==='Skin')return skin;
  if(G.isRare(target)||G.growth[target]||a===b){for(const n of abilities[champ]||[])if(usable(n))return n}
  if(usable(theme))return theme;
 }
 // Look for a genuine recipe involving this subject and a concrete expression
 // of the other ingredient's theme, before stepping into that theme itself.
 for(const ingredient of pool){const out=R[key(subject,ingredient)];if(usable(out))return out}
 if(E[target].category==='Item'){const preferred={fire:'Forge',earth:'Cloth Armor',armor:'Chain Vest',tech:'Hextech',gold:'Shop',life:'Ruby Crystal',magic:'Amplifying Tome',water:'Sapphire Crystal',attack:'Long Sword',speed:'Boots'}[trait];if(usable(preferred))return preferred}
 if(G.isRare(target)&&usable(subject))return subject;
 for(const n of pool)if(usable(n))return n;
 for(const n of ['Training','Mastery','Competition','Rune'])if(usable(n))return n;
 throw Error('No concrete route for '+a+' + '+b)
}
function resolve(a,b){if(!E[a]||!E[b])return null;if(a>b)[a,b]=[b,a];const direct=R[key(a,b)];if(direct)return direct;const out=rawResolve(a,b);return G.isRare?.(out)?grounded(a,b):out}
function explain(a,b){if(G.catalysts?.[a]||G.catalysts?.[b])return 'A crafted enchantment unlocks a rare fan transformation. Combine two enchantments for a specific rare fusion.';if(a===b)return 'Doubling concentrates, upgrades, or expands this ingredient. Named evolutions are fan-made discoveries; their first stage requires an Ascension Sigil.';if(G.growth?.[a]||G.growth?.[b])return 'A fan-made progression of the original ingredient; starters unlock related branches.';if(draftByName[a]||draftByName[b]||G.pros?.[a]||G.pros?.[b])return 'A fan-made esports connection or fantasy draft, not a current roster or match record.';if(G.abilityMeta?.[a]||G.abilityMeta?.[b])return 'Uses the champion and their ability identity.';if(E[a]?.category==='Item'&&E[b]?.category==='Item')return 'An upgrade based on the ingredients’ item stats and effects.';const ca=identity(a),cb=identity(b);if(ca&&cb)return 'Champion relationships or roles determine the pairing.';if(ca||cb)return 'Uses the champion’s abilities, skins, builds, or related themes. Rare variants require crafted enchantments.';return 'Explores a concrete concept related to the ingredients. Crafted enchantments unlock rare variants.'}
function validPair(k){if(typeof k!=='string')return false;const p=splitPair(k);return p.length===2&&p.every(n=>E[n])&&key(...p)===k}
function partnerIndex(tried){const index=new Map();for(const k of tried){if(!validPair(k))continue;const [a,b]=splitPair(k);if(!index.has(a))index.set(a,new Set());if(!index.has(b))index.set(b,new Set());index.get(a).add(b);index.get(b).add(a)}return index}
function completion(n,discovered,index){const partners=index.get(n)||new Set();let known=0;for(const p of partners)if(discovered.has(p))known++;return{known,total:discovered.size,mastered:partners.size===names.length,caughtUp:known===discovered.size}}
window.CRAFT={resolve,key,splitPair,validPair,partnerIndex,completion,names,seeds,explain,grounded,imageFor:n=>E[n].image||E[G.growth?.[n]?.base]?.image||E[draftByName[n]?.champion]?.image||E[P[n].subject]?.image};
})();
