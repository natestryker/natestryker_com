export const queues = {65:'ARAM (legacy)',67:'ARAM Co-op (legacy)',100:'ARAM (Butcher\'s Bridge)',400:'Normal Draft',420:'Ranked Solo/Duo',430:'Normal Blind',440:'Ranked Flex',450:'ARAM',490:'Quickplay',720:'ARAM Clash',1700:'Arena',1710:'Arena',2400:'ARAM: Mayhem'};
export const queueName = id => queues[id] || `Queue ${id}`;
// Riot queue reference: https://static.developer.riotgames.com/docs/lol/queues.json
const historyOnlyQueues = new Set([65,67,100,450,720,1700,1710,2400]);
export const isHistoryOnly = match => historyOnlyQueues.has(Number(match.queue)) || ['ARAM','CHERRY'].includes(String(match.gameMode || '').toUpperCase());
export const countsForStats = match => !match.remake && !isHistoryOnly(match);
export function aggregate(matches) {
  const games = matches.filter(countsForStats), n = games.length;
  const sum = key => games.reduce((s,m)=>s+(m[key] || 0),0);
  const wins = games.filter(m=>m.win).length;
  return {games:n,wins,losses:n-wins,winRate:n ? wins/n*100 : 0,kda:sum('kills')+sum('assists') ? (sum('kills')+sum('assists'))/Math.max(1,sum('deaths')) : 0,cs:n ? sum('csPerMinute')/n : 0,damage:n ? sum('damage')/n : 0};
}
export function summarizeArchive(matches){
  const eligible=matches.filter(countsForStats);
  const totals=games=>({...aggregate(games),...Object.fromEntries(['kills','deaths','assists','cs','damage','gold','duration'].map(key=>[`${key}Total`,games.reduce((sum,m)=>sum+(Number(m[key]) || 0),0)]))});
  const years=[...new Set(eligible.map(m=>new Date(m.date).getUTCFullYear()))].sort();
  return {yearBasis:'UTC',lifetime:totals(eligible),years:Object.fromEntries(years.map(year=>[year,totals(eligible.filter(m=>new Date(m.date).getUTCFullYear()===year))]))};
}
export const normalizeItemName = value => String(value).toLowerCase().replace(/['\u2019]/g,'').replace(/\bboots\b/g,'shoes').replace(/[^a-z0-9]+/g,' ').trim();
export function itemMatches(id, query, names={}) {
  if(!id) return false;
  if(/^\d+$/.test(query.trim())) return String(id)===query.trim();
  const name=normalizeItemName(names[id] || ''), search=normalizeItemName(query);
  return !!name && !!search && search.split(' ').every(word=>name.includes(word));
}
export function filterMatches(matches,search='',queue='',result='',champion='',item='',itemNames={}) {
  const q = search.trim().toLowerCase();
  const c = champion.trim().toLowerCase(), itemId = item.trim();
  return matches.filter(m=>(!q || `${m.champion} ${m.role} ${m.id} ${new Date(m.date).toISOString().slice(0,10)}`.toLowerCase().includes(q)) && (!c || m.champion.toLowerCase().includes(c)) && (!itemId || (m.items || []).some(id=>itemMatches(id,itemId,itemNames))) && (!queue || String(m.queue)===queue) && (!result || (result==='remake' ? m.remake : !m.remake && m.win===(result==='win'))));
}
