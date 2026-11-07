async function json(url,fetcher){
  const response=await fetcher(url,{cache:url.endsWith('public.json')?'no-cache':'default',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Statistics could not be loaded. Please try again later.');
  return response.json();
}
export async function loadDashboardData(fetcher=fetch){
  const data=await json('data/league/public.json',fetcher);
  if(data.schemaVersion!==2)return data; // Existing deployed format remains supported during rollout.
  const matches=[],jobs=[...data.indexes],names=new Map(data.accounts.map(a=>[a.id,a.profile?.riotId || a.label]));
  async function worker(){
    while(jobs.length){
      const part=jobs.shift();
      if(!/^views\/index-[a-z0-9-]+\.json$/.test(part.url))throw new Error('Invalid match index path');
      const block=await json(`data/league/${part.url}`,fetcher);
      if(block.schemaVersion!==2 || !Array.isArray(block.rows) || block.rows.length!==part.count || !Array.isArray(block.columns))throw new Error('Match index is incomplete. Please refresh.');
      for(const row of block.rows){
        if(row.length!==block.columns.length)throw new Error('Invalid match index row');
        const m=Object.fromEntries(block.columns.map((column,i)=>[column,row[i]]));
        m.accountName=names.get(m.accountId);m.recordId=`${m.accountId}--${m.id}`;matches.push(m);
      }
    }
  }
  await Promise.all(Array.from({length:Math.min(4,jobs.length)},worker));
  const unique=new Map();
  for(const m of matches){if(unique.has(m.recordId))throw new Error('Duplicate match in frontend index');unique.set(m.recordId,m);}
  if(matches.length!==data.matchCount)throw new Error('Match index count differs from manifest. Please refresh.');
  matches.sort((a,b)=>b.date-a.date);return {...data,matches};
}
export async function loadMatchDetails(account,id,fetcher=fetch,detailHash){
  if(detailHash){
    if(!/^[a-f0-9]{16}$/.test(detailHash) || !/^[A-Z0-9]+_\d+$/.test(id) || !/^views\/details\/[a-z0-9-]+\/$/.test(account.detailBase))throw new Error('Invalid player detail path');
    const detail=await json(`data/league/${account.detailBase}${id}-${detailHash}.json`,fetcher);
    if(detail?.match?.id!==id)throw new Error('Match detail ID does not match');
    return detail.match;
  }
  if(!/^[A-Z0-9]+_\d+$/.test(id) || !/^(accounts\/[a-z0-9-]+\/)?matches\/$/.test(account.archiveBase))throw new Error('Invalid match archive path');
  const record=await json(`data/league/${account.archiveBase}${id}.json`,fetcher);
  if(record?.match?.id!==id || record.raw?.metadata?.matchId!==id)throw new Error('Match detail ID does not match');
  return record.match;
}
export async function loadRankedHistory(account,fetcher=fetch){
  if(!/^(accounts\/[a-z0-9-]+\/)?ranked\.json\?v=[a-f0-9]+$/.test(account.rankedUrl))throw new Error('Invalid ranked history path');
  const snapshots=await json(`data/league/${account.rankedUrl}`,fetcher);
  if(!Array.isArray(snapshots))throw new Error('Invalid ranked history');
  return snapshots.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
}
