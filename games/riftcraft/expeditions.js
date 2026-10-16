/* Long self-crafting journeys and optional, bonus-only random mutations. */
(()=>{'use strict';const G=GAME,E=G.elements,P=G.profiles,R=G.recipes,C=CRAFT,K=C.key;G.mutations={};G.mutationPools={};G.journeys={};
function add(name,category,anchor,description){if(E[name])throw Error('Duplicate discovery '+name);E[name]={category,icon:category==='Mutation'?'✺':'◇',description};P[name]={...P[anchor]};return name}
const forms=['Rift Echo','Prismatic Anomaly','Paradox Fragment'];
for(const subject of Object.keys(G.variants)){const pool=G.mutationPools[subject]=[];for(const form of forms){const n=form+': '+subject;add(n,'Mutation',subject,'A spontaneous fan-made mutation. An extra discovery alongside the normal crafting result.');G.mutations[n]={subject,form};pool.push(n)}}
C.rollMutation=(result,known,random=Math.random)=>{if(!E[result])return null;const pool=G.mutationPools[P[result].subject];if(!pool)return null;const available=pool.filter(n=>!known.has(n));if(!available.length||random()>=.04)return null;return available[Math.min(available.length-1,Math.floor(random()*available.length))]};
// Find the functional graph's cycles before modifying any of its edges.
const baseline=Object.keys(E),next=new Map(baseline.map(n=>[n,C.resolve(n,n)])),done=new Set(),cycles=[];
for(const start of baseline){if(done.has(start))continue;const path=[],positions=new Map();let n=start;while(!done.has(n)&&!positions.has(n)){positions.set(n,path.length);path.push(n);n=next.get(n)}if(positions.has(n))cycles.push(path.slice(positions.get(n)));for(const p of path)done.add(p)}
const spell=['First Cast','Target Dummy','Combo Drill','Lane Trade','Wave Control','Roaming Route','River Skirmish','Dragon Contest','Tower Dive','Clutch Escape','Counterplay','Teamfight','Perfect Timing','Outplay','Highlight Reel','Combo Laboratory','Practice Academy','Masterclass','Showmatch','Tournament Run','Grand Final','Victory Parade','Hall of Fame','Living Legend'];
const esports=['Solo Queue','Duo Session','Five Stack','Practice Lobby','Scrim Block','Team Meeting','Draft Room','Regional Qualifier','Group Stage','Playoff Bracket','Quarterfinal','Semifinal','Grand Final','Victory Stage','Fan Celebration','Victory Tour','International Debut','World Stage','Championship Run','Trophy Room','Documentary','Legacy Archive','Hall of Fame','Immortal Legacy'];
const world=['First Spark','Resonance','Convergence','Formation','Sanctuary','Frontier','Expedition','Settlement','Citadel','Kingdom','Empire','Golden Age','World Wonder','Hidden Realm','Planar Crossing','New World','Constellation','Galactic Voyage','Cosmic Archive','Mythic Age','Creation Myth','Eternal Chronicle','World Memory','Infinity Nexus'];
for(const cycle of cycles){const anchor=cycle.find(n=>!R[K(n,n)])||cycle[cycle.length-1],exit=next.get(anchor),champ=P[anchor].champion||G.champMeta[P[anchor].subject],category=E[anchor].category;
 const titles=['Pro','Team','Esports','Draft'].includes(category)?esports:champ||category==='Ability'?spell:world;
 let previous=anchor;for(let i=0;i<titles.length;i++){const n=anchor+' — '+titles[i];add(n,'Journey',anchor,'Fan-made self-crafting journey. Chapter '+(i+1)+' of '+titles.length+'. Double to continue.');G.journeys[n]={anchor,chapter:i+1,total:titles.length};R[K(previous,previous)]=n;previous=n}R[K(previous,previous)]=exit;
}
C.names.length=0;for(const n of Object.keys(E).sort())C.names.push(n);
G.stats.selfRecipes=Object.keys(R).filter(k=>{const[a,b]=C.splitPair(k);return a===b}).length;G.stats.total=C.names.length;G.stats.mutations=Object.keys(G.mutations).length;G.stats.journeys=Object.keys(G.journeys).length;G.stats.extendedCycles=cycles.length;G.stats.authoredRecipes=Object.keys(R).length;
const oldExplain=C.explain;C.explain=(a,b)=>a===b&&G.journeys[C.resolve(a,b)]?'Continues a 24-chapter fan-made journey before the self-combination path can repeat.':oldExplain(a,b);
const oldImage=C.imageFor;C.imageFor=n=>G.mutations[n]||G.journeys[n]?null:oldImage(n);
})();
