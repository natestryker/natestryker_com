import {readJson} from './archive.mjs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export function checkHealth(data,now=Date.now()){
  const issues=[];
  const accounts=data.accounts || [data];
  for(const a of accounts){
    const name=a.id || 'account',updated=Date.parse(a.progress?.lastSuccessAt || a.updatedAt || '');
    if(!Number.isFinite(updated) || now-updated>3*3600000)issues.push(`${name}: no successful collection in the last three hours`);
    if(a.collectionFailed || a.progress?.error)issues.push(`${name}: latest collection reported an error`);
    const progress=Date.parse(a.progress?.lastProgressAt || a.updatedAt || '');
    if(!a.backfillComplete && Number.isFinite(progress) && now-progress>24*3600000)issues.push(`${name}: historical backfill has not progressed for 24 hours`);
  }
  return issues;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const issues=checkHealth(await readJson('data/league/public.json',{}));
  for(const issue of issues)console.error(`::error::${issue}`);
  if(issues.length)process.exitCode=1;else console.log('All account collection timestamps are current.');
}
