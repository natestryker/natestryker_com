import {readFile,readdir,writeFile,rename} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {randomUUID} from 'node:crypto';
import {optimizePng} from './lib/png.mjs';
const root=process.cwd(),apply=process.argv.includes('--write');
const files=(await readdir('assets/league/items')).filter(name=>/^\d+\.png$/.test(name)).map(name=>join('assets/league/items',name));
for(const file of ['images/pfp.png','images/favicon.png','YEP.png'])try{await readFile(file);files.push(file);}catch(e){if(e.code!=='ENOENT')throw e;}
let before=0,after=0,changed=0;
for(const file of files){
  const input=await readFile(file),output=optimizePng(input);before+=input.length;after+=output.length;
  if(output.length<input.length){
    changed++;
    if(apply){
      const target=resolve(file);if(relative(root,target).startsWith('..'))throw new Error('Asset outside workspace');
      const temporary=`${target}.${randomUUID()}.tmp`;await writeFile(temporary,output);await rename(temporary,target);
    }
  }
}
console.log(`${apply?'Applied':'Available'} lossless PNG optimization: ${changed}/${files.length} files; ${before} -> ${after} bytes (${before-after} saved).`);
