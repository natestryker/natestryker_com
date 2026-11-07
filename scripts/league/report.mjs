import {readJson} from './archive.mjs';
const data=await readJson('data/league/public.json',{});
console.log('\n| Account | Archived | Backfill offset | Pending | Exhausted | Complete | Last progress |\n| --- | ---: | ---: | ---: | --- | --- | --- |');
for(const account of data.accounts || []){
  const p=account.progress || {};
  console.log(`| ${account.id} | ${p.archived ?? account.matches?.length ?? 0} | ${p.offset ?? '?'} | ${p.pending ?? '?'} | ${p.exhausted ?? '?'} | ${account.backfillComplete} | ${p.lastProgressAt || 'not recorded yet'} |`);
}
