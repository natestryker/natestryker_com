import {stem,LIMITS} from './core.mjs';
import {readTables,exportTables} from './data.mjs';
let library;
async function sql(){
  if(!library){importScripts('./vendor/sql-wasm.js');library=await self.initSqlJs({locateFile:name=>new URL('./vendor/'+name,import.meta.url).href});}
  return library;
}
const quote=name=>'"'+name.replace(/"/g,'""')+'"';
export async function convertSQLite(file,info,target,options,prepared){
  const SQL=await sql();
  if(target==='sqlite'){
    const tables=await readTables(file,info,prepared),db=new SQL.Database();let cells=0;
    try{
      db.run('BEGIN');
      for(const table of tables){
        const rows=table.rows,headings=rows[0]?.map(String);
        if(!headings?.length||headings.some(key=>!key.trim())||new Set(headings.map(key=>key.toLowerCase())).size!==headings.length)throw new Error('SQLite tables need non-empty, unique column headings.');
        db.run(`CREATE TABLE ${quote(table.name)} (${headings.map(key=>quote(key)+' TEXT').join(', ')})`);
        const statement=db.prepare(`INSERT INTO ${quote(table.name)} VALUES (${headings.map(()=>'?').join(', ')})`);
        try{for(const row of rows.slice(1)){cells+=headings.length;if(cells>1000000)throw new Error('SQLite creation is limited to 1,000,000 cells.');statement.run(headings.map((_,i)=>row[i]==null?null:String(row[i])));}}
        finally{statement.free();}
      }
      db.run('COMMIT');return [{name:stem(file.name)+'.sqlite',bytes:db.export(),type:'application/vnd.sqlite3'}];
    }finally{db.close();}
  }
  const db=new SQL.Database(new Uint8Array(await file.arrayBuffer()));
  try{
    const names=db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0]?.values.flat()||[];
    if(!names.length)throw new Error('This SQLite file has no user tables.');
    if(names.length>100)throw new Error('Export at most 100 tables at a time.');
    let cells=0;
    const tables=names.map(name=>{
      const count=db.exec(`SELECT count(*) AS n FROM ${quote(name)}`)[0]?.values[0][0]||0;if(count>100000)throw new Error('A table has more than 100,000 rows.');
      const result=db.exec(`SELECT * FROM ${quote(name)}`)[0];
      const columns=result?.columns||db.exec(`PRAGMA table_info(${quote(name)})`)[0]?.values.map(row=>row[1])||[];
      const values=result?.values||[];cells+=columns.length*(values.length+1);if(cells>1000000)throw new Error('Export at most 1,000,000 cells.');
      if(values.some(row=>row.some(value=>value instanceof Uint8Array)))throw new Error('A table contains binary BLOB data. CSV/JSON/XLSX export would lose that type, so it is not converted.');
      return {name,rows:[columns,...values]};
    });
    return exportTables(tables,file.name,target,options);
  }finally{db.close();}
}
