import {readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readJson,writeJson,validateMatch,sha256} from './archive.mjs';
import {normalize,parseAccounts} from './collect.mjs';
import {summarizeArchive} from '../../assets/league/stats.mjs';
import {INDEX_COLUMNS} from '../../assets/league/schema.mjs';

export async function publish(root=resolve('data/league'),env={}){
  const previous=await readJson(join(root,'public.json'),{}),config=parseAccounts(env);
  let directories=[];try{directories=(await readdir(join(root,'accounts'),{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name);}catch(e){if(e.code!=='ENOENT')throw e;}
  const ids=config?.map(a=>a.id) || (previous.accounts?.length?previous.accounts.map(a=>a.id):directories.length?directories:['legacy']);
  const all=[],accounts=[],identities=new Set(),metadata=[];
  for(const id of ids){
    if(!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id))throw new Error('Invalid account directory');
    const base=id==='legacy'?'':`accounts/${id}/`,directory=join(root,base);
    const state=await readJson(join(directory,'state.json'),{}),old=await readJson(join(directory,'public.json'),{}),pending=await readJson(join(directory,'pending.json'),[]);
    if(state.puuid){const identity=`${state.platform}:${state.puuid}`;if(identities.has(identity))throw new Error('Two account IDs resolve to the same Riot account; refusing duplicate totals.');identities.add(identity);}
    const snapshots=await readJson(join(directory,'ranked.json'),[]);
    const ranked=[...snapshots].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    let files=[];try{files=(await readdir(join(directory,'matches'))).filter(f=>f.endsWith('.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
    const matches=[],seen=new Set();
    for(const file of files){
      const record=await readJson(join(directory,'matches',file));validateMatch(record,file.slice(0,-5));
      const m=state.puuid?normalize(record.raw,state.puuid):record.match;
      if(seen.has(m.id))throw new Error(`Duplicate archived match ${id}/${m.id}`);seen.add(m.id);
      // Pages receives only this player's full metrics/challenges, not all other participants.
      const detail={schemaVersion:1,match:m},detailHash=sha256(Buffer.from(JSON.stringify(detail)+'\n')).slice(0,16);
      const detailUrl=`views/details/${id}/${m.id}-${detailHash}.json`;
      if(!await readJson(join(root,detailUrl),null))await writeJson(join(root,detailUrl),detail,{immutable:true,compact:true});
      matches.push({...m,accountId:id,detailHash});
    }
    matches.sort((a,b)=>b.date-a.date);all.push(...matches);
    const settings=config?.find(a=>a.id===id),label=settings?`${settings.gameName}#${settings.tagLine}`:old.label || previous.accounts?.find(a=>a.id===id)?.label || id;
    const progress={archived:matches.length,eligible:summarizeArchive(matches).lifetime.games,offset:state.backfillOffset || 0,pending:pending.length,exhausted:!!(state.backfillExhausted ?? state.backfillDone),complete:!!state.backfillDone && pending.length===0,lastAttemptAt:state.lastAttemptAt || null,lastProgressAt:state.lastProgressAt || null,lastSuccessAt:state.lastSuccessAt || old.updatedAt || null,error:state.lastError || null,earliest:matches.at(-1)?.date || null,latest:matches[0]?.date || null};
    const account={id,label,profile:old.profile || null,updatedAt:old.updatedAt || state.lastSuccessAt || null,backfillComplete:progress.complete,collectionFailed:!!progress.error,progress,statistics:summarizeArchive(matches),ranked:ranked.slice(-2),rankedUrl:`${base}ranked.json?v=${sha256(Buffer.from(JSON.stringify(ranked))).slice(0,16)}`,archiveBase:`${base}matches/`,detailBase:`views/details/${id}/`,mastery:old.mastery || []};
    accounts.push(account);metadata.push([join(directory,'public.json'),account]);
    console.log(`${id}: archived=${matches.length}, eligible=${progress.eligible}, backfill offset=${progress.offset}, pending=${pending.length}, exhausted=${progress.exhausted}, complete=${progress.complete}${progress.error?`, error=${progress.error}`:''}`);
  }
  all.sort((a,b)=>b.date-a.date);
  const months=new Map();
  for(const match of all){const month=new Date(match.date).toISOString().slice(0,7);if(!months.has(month))months.set(month,[]);months.get(month).push(INDEX_COLUMNS.map(key=>match[key] ?? null));}
  const indexes=[];
  for(const [month,rows] of months){
    const block={schemaVersion:2,columns:INDEX_COLUMNS,rows},bytes=Buffer.from(JSON.stringify(block)+'\n'),digest=sha256(bytes);
    const url=`views/index-${month}-${digest.slice(0,16)}.json`;
    if(!await readJson(join(root,url),null))await writeJson(join(root,url),block,{immutable:true,compact:true});
    indexes.push({url,count:rows.length,bytes:bytes.length,sha256:digest});
  }
  const result={schemaVersion:2,generatedAt:new Date().toISOString(),updatedAt:accounts.map(a=>a.updatedAt).filter(Boolean).sort().at(-1)||null,backfillComplete:accounts.every(a=>a.backfillComplete),accounts,indexes,matchCount:all.length,statistics:summarizeArchive(all)};
  // Raw archives are never changed. Publish metadata only after every archive has validated.
  for(const [path,value] of metadata)if(path!==join(root,'public.json'))await writeJson(path,value,{compact:true});
  await writeJson(join(root,'public.json'),result,{compact:true});
  const oldBytes=Buffer.byteLength(JSON.stringify(previous)),indexBytes=indexes.reduce((sum,i)=>sum+i.bytes,0);
  console.log(`Frontend: manifest=${Buffer.byteLength(JSON.stringify(result))} bytes, searchable indexes=${indexBytes} bytes, matches=${all.length}; previous summary=${oldBytes} bytes. Full match/challenge payloads load only on expansion.`);
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)publish(resolve('data/league'),process.env).catch(e=>{console.error(e.message);process.exitCode=1;});
