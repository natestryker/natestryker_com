import {mkdir,open,rename,link,unlink,readFile,readdir} from 'node:fs/promises';
import {dirname,join,resolve,relative} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export async function readJson(path,fallback){
  try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}
}
export async function writeJson(path,value,{immutable=false}={}){
  await mkdir(dirname(path),{recursive:true});
  const temporary=`${path}.${randomUUID()}.tmp`;
  const handle=await open(temporary,'wx');
  try{
    await handle.writeFile(JSON.stringify(value,null,2)+'\n');
    await handle.sync();
  }finally{await handle.close();}
  try{
    // link() publishes the complete file atomically and refuses to replace an existing record.
    if(immutable){try{await link(temporary,path);}catch(e){if(e.code!=='EEXIST')throw e;}}
    else await rename(temporary,path);
  }finally{await unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
export async function archiveFiles(root){
  const files=[];
  async function visit(directory){
    for(const entry of await readdir(directory,{withFileTypes:true})){
      const path=join(directory,entry.name);
      if(entry.isSymbolicLink())throw new Error('Archive must not contain symbolic links');
      if(entry.isDirectory())await visit(path);
      else if(entry.name.endsWith('.json'))files.push(path);
    }
  }
  await visit(root);return files.sort();
}
export function validateMatch(record,id){
  if(!/^[A-Z0-9]+_\d+$/.test(id) || record?.match?.id!==id || record?.raw?.metadata?.matchId!==id || !Array.isArray(record.raw.info?.participants) || !Number.isFinite(record.match.date))throw new Error(`Invalid archived match ${id}`);
}
export async function verifyArchive(root=resolve('data/league'),{repository=process.cwd(),checkGit=false}={}){
  const files=await archiveFiles(root);let matches=0;
  for(const file of files){
    const record=await readJson(file);
    if(file.replaceAll('\\','/').includes('/matches/')){validateMatch(record,file.split(/[\\/]/).at(-1).slice(0,-5));matches++;}
  }
  if(checkGit){
    const prefix=relative(repository,root).replaceAll('\\','/');
    // One diff covers both staged and unstaged changes, including deletions and EOL conversion.
    const changed=execFileSync('git',['diff','--name-only','--no-renames','HEAD','--',prefix],{cwd:repository,encoding:'utf8',maxBuffer:20*1024*1024}).trim().split('\n').filter(path=>/\/matches\/[^/]+\.json$/.test(path));
    // New staged matches are allowed; only existing HEAD records are immutable.
    const tracked=new Set(execFileSync('git',['ls-tree','-r','--name-only','HEAD','--',prefix],{cwd:repository,encoding:'utf8',maxBuffer:20*1024*1024}).trim().split('\n'));
    for(const path of changed)if(tracked.has(path))throw new Error(`Refusing to commit modified or deleted archived match: ${path}`);
  }
  return {files:files.length,matches};
}
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  verifyArchive(resolve('data/league'),{checkGit:true}).then(result=>console.log(`Verified ${result.matches} immutable matches (${result.files} JSON files).`)).catch(e=>{console.error(e.message);process.exitCode=1;});
}
