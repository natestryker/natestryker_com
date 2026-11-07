import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,relative,dirname,isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {archiveFiles,verifyArchive,readJson,writeJson,sha256} from './archive.mjs';

export async function createBackup(outputParent,{repository=process.cwd()}={}){
  const root=resolve(repository,'data/league'),parent=resolve(outputParent);
  if(parent===root || parent.startsWith(root+ (process.platform==='win32'?'\\':'/')))throw new Error('Backup destination must be outside the live archive.');
  await verifyArchive(root);
  const destination=join(parent,`league-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`);
  await mkdir(destination,{recursive:true});
  const files=[];
  for(const source of await archiveFiles(root)){
    const path=join('data','league',relative(root,source));
    await mkdir(dirname(join(destination,path)),{recursive:true});await copyFile(source,join(destination,path));files.push(path);
  }
  // A bundle includes committed Git history but no remotes, auth configuration or environment.
  execFileSync('git',['bundle','create',join(destination,'repository.bundle'),'--all'],{cwd:repository,stdio:'pipe'});
  files.push('repository.bundle');
  await writeFile(join(destination,'RESTORE.txt'),'Verify: node scripts/league/backup.mjs verify <this-folder>\nRestore repository: git clone <this-folder>/repository.bundle recovered-site\nThen copy this folder\'s data/league over recovered-site/data/league to recover the snapshot, including any uncommitted match downloads. Rebuild with node scripts/league/publish.mjs. Review and commit. Reconfigure repository secrets manually; no credentials are included. See LEAGUE-OPERATIONS.md in the restored repository.\n');
  files.push('RESTORE.txt');
  const manifest={schemaVersion:1,createdAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{cwd:repository,encoding:'utf8'}).trim(),files:[]};
  for(const file of files)manifest.files.push({path:file.replaceAll('\\','/'),sha256:sha256(await readFile(join(destination,file)))});
  await writeJson(join(destination,'manifest.json'),manifest);
  await verifyBackup(destination);
  return destination;
}
export async function verifyBackup(directory){
  const root=resolve(directory),manifest=await readJson(join(root,'manifest.json'));
  if(manifest?.schemaVersion!==1 || !Array.isArray(manifest.files))throw new Error('Invalid backup manifest');
  for(const file of manifest.files){
    if(typeof file.path!=='string' || isAbsolute(file.path) || file.path.split(/[\\/]/).includes('..'))throw new Error('Unsafe backup path');
    if(sha256(await readFile(join(root,file.path)))!==file.sha256)throw new Error(`Backup checksum mismatch: ${file.path}`);
  }
  const archive=await verifyArchive(join(root,'data/league'));
  execFileSync('git',['bundle','list-heads',join(root,'repository.bundle')],{stdio:'pipe'});
  return archive;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [command,target]=process.argv.slice(2);
  const action=command==='create' && target ? ()=>createBackup(target) : command==='verify' && target ? ()=>verifyBackup(target) : ()=>{throw new Error('Usage: node scripts/league/backup.mjs create|verify <directory>');};
  Promise.resolve().then(action).then(result=>console.log(typeof result==='string'?`Verified backup: ${result}`:JSON.stringify(result))).catch(e=>{console.error(e.message);process.exitCode=1;});
}
