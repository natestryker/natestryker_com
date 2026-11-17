import {decode,encode,validateData,isTabular,rowsOf,recordsOf,escapeHtml,sqlOf,stem,LIMITS} from './core.mjs';
let yaml,toml,papa,xlsx;
async function libs(kind){
  if(kind==='yaml'&&!yaml){importScripts('./vendor/js-yaml.min.js');yaml=self.jsyaml;}
  if(kind==='toml'&&!toml)toml=await import('./vendor/smol-toml/index.js');
  if(kind==='csv'&&!papa){importScripts('./vendor/papaparse.min.js');papa=self.Papa;}
  if(kind==='xlsx'&&!xlsx){importScripts('./vendor/xlsx.full.min.js');xlsx=self.XLSX;}
}
function xmlNode(value,key='item') {
  const attrs=key===null?'':` key="${escapeHtml(key)}"`;
  if(value===null)return `<item${attrs} type="null"/>`;
  if(Array.isArray(value))return `<item${attrs} type="array">${value.map(v=>xmlNode(v,null)).join('')}</item>`;
  if(typeof value==='object')return `<item${attrs} type="object">${Object.entries(value).map(([k,v])=>xmlNode(v,k)).join('')}</item>`;
  return `<item${attrs} type="${typeof value}">${escapeHtml(value)}</item>`;
}
export function toXML(value){return '<?xml version="1.0" encoding="UTF-8"?>\n<converted-data version="1">'+xmlNode(value,null)+'</converted-data>\n';}
export async function parseData(text,format,prepared){
  let value;
  if(format==='xml'){if(!prepared||!('xmlData'in prepared))throw new Error('The XML parser could not prepare this document.');value=prepared.xmlData;}
  else if(format==='json')value=JSON.parse(text);
  else if(format==='jsonl'){const lines=text.split(/\r?\n/).filter(line=>line.trim());if(!lines.length)throw new Error('This JSONL file is empty.');value=lines.map((line,index)=>{try{return JSON.parse(line);}catch{throw new Error(`Invalid JSON on line ${index+1}.`);}});}
  else if(format==='yaml'){await libs('yaml');value=yaml.load(text,{schema:yaml.JSON_SCHEMA,json:false});if(value===undefined)throw new Error('This YAML file has no value.');}
  else if(format==='toml'){await libs('toml');value=toml.parse(text);}
  else if(format==='ini') {
    value=Object.create(null);let section=value;
    for(const line of text.split(/\r?\n/)){
      const trimmed=line.trim();if(!trimmed||/^[;#]/.test(trimmed))continue;
      const heading=trimmed.match(/^\[([^\]]+)\]$/);
      if(heading){if(Object.hasOwn(value,heading[1]))throw new Error('Duplicate INI section.');value[heading[1]]=Object.create(null);section=value[heading[1]];continue;}
      const eq=trimmed.indexOf('=');if(eq<1)throw new Error('INI must contain key=value lines and optional [sections].');
      const key=trimmed.slice(0,eq).trim();if(Object.hasOwn(section,key))throw new Error('Duplicate INI key.');section[key]=trimmed.slice(eq+1).trim();
    }
  } else throw new Error('Unsupported structured data format.');
  return validateData(value);
}
function toINI(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INI needs an object containing string values or one level of sections.');
  const lines=[],sections=[];
  const line=(key,val)=>{if(!key||/[\r\n=\[\]]/.test(key)||typeof val!=='string'||/[\r\n]/.test(val)||val!==val.trim())throw new Error('INI supports single-line strings only. Other types or nested values would lose information.');return `${key}=${val}`;};
  for(const [key,val]of Object.entries(value)){
    if(val&&typeof val==='object'&&!Array.isArray(val)){if(/[\r\n\[\]]/.test(key))throw new Error('Invalid INI section name.');sections.push(`[${key}]\n`+Object.entries(val).map(([k,v])=>line(k,v)).join('\n'));}
    else lines.push(line(key,val));
  }
  return [...lines,...sections].join('\n')+'\n';
}
export async function dataOutput(value,target){
  validateData(value);
  if(target==='json')return JSON.stringify(value,null,2)+'\n';
  if(target==='yaml'){await libs('yaml');return yaml.dump(value,{schema:yaml.JSON_SCHEMA,noRefs:true,lineWidth:120});}
  if(target==='toml'){await libs('toml');if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('TOML needs a top-level object.');const rejectNull=node=>{if(node===null)throw new Error('TOML has no null value. This conversion would lose information.');if(node&&typeof node==='object')Object.values(node).forEach(rejectNull);};rejectNull(value);return toml.stringify(value);}
  if(target==='xml')return toXML(value);
  if(target==='ini')return toINI(value);
  if(target==='jsonl'){if(!Array.isArray(value))throw new Error('JSONL requires a top-level array.');return value.map(item=>JSON.stringify(item)).join('\n')+'\n';}
  throw new Error('Unsupported data output.');
}
export async function convertData(file,info,target,options,prepared={}){
  const text=decode(new Uint8Array(await file.arrayBuffer())),value=await parseData(text,info.format,prepared);
  if(['csv','tsv','xlsx','sql'].includes(target))return exportTables([{name:'Data',rows:rowsOf(value)}],file.name,target,options);
  return [{name:stem(file.name)+'.'+target,bytes:encode(await dataOutput(value,target)),type:target==='json'?'application/json':'text/plain;charset=utf-8'}];
}
export async function readTables(file,info,prepared={}) {
  await libs('xlsx');
  if(info.format==='html'){
    if(!prepared.tables?.length)throw new Error('This HTML document contains no tables.');
    return prepared.tables.map((rows,index)=>({name:`Table ${index+1}`,rows}));
  }
  if(['csv','tsv'].includes(info.format)){
    await libs('csv');const parsed=papa.parse(decode(new Uint8Array(await file.arrayBuffer())),{delimiter:info.format==='tsv'?'\t':',',skipEmptyLines:'greedy',dynamicTyping:false});
    if(parsed.errors.length)throw new Error('Malformed delimited text: '+parsed.errors[0].message);
    if(parsed.data.length>100000||parsed.data.some(row=>row.length>1000))throw new Error('Use a table of at most 100,000 rows and 1,000 columns.');
    const width=parsed.data[0]?.length;if(!width||parsed.data.some(row=>row.length!==width))throw new Error('Rows must have a consistent number of columns.');
    return [{name:'Data',rows:parsed.data}];
  }
  const book=xlsx.read(await file.arrayBuffer(),{type:'array',cellDates:false,cellFormula:true});
  if(book.SheetNames.length>100)throw new Error('Use a workbook with at most 100 sheets.');
  return book.SheetNames.map(name=>{
    const sheet=book.Sheets[name],range=sheet['!ref']?xlsx.utils.decode_range(sheet['!ref']):null;
    if(range&&((range.e.r+1)*(range.e.c+1)>1000000||range.e.r>100000||range.e.c>999))throw new Error('A worksheet exceeds the 1,000,000-cell / 100,000-row limit.');
    return {name,rows:xlsx.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false,blankrows:false}),sheet};
  });
}
export async function exportTables(tables,originalName,target,options={}){
  await libs('xlsx');const base=stem(originalName);
  if(['xlsx','ods'].includes(target)){
    const book=xlsx.utils.book_new();tables.forEach((table,index)=>xlsx.utils.book_append_sheet(book,table.sheet||xlsx.utils.aoa_to_sheet(table.rows),table.name.slice(0,31)||`Sheet ${index+1}`));
    return [{name:base+'.'+target,bytes:new Uint8Array(xlsx.write(book,{type:'array',bookType:target,compression:true})),type:target==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/vnd.oasis.opendocument.spreadsheet'}];
  }
  const outputs=[];
  for(const table of tables){
    const name=base+(tables.length>1?'-'+stem(table.name):'');let text;
    if(['csv','tsv'].includes(target)){await libs('csv');text=papa.unparse(table.rows,{delimiter:target==='tsv'?'\t':',',newline:'\r\n'});}
    else if(['json','yaml','jsonl','xml'].includes(target))text=await dataOutput(recordsOf(table.rows),target);
    else if(target==='html')text='<!doctype html><html lang="en"><meta charset="utf-8"><title>'+escapeHtml(table.name)+'</title><table>'+table.rows.map((row,i)=>'<tr>'+row.map(value=>`<${i?'td':'th'}>${escapeHtml(value)}</${i?'td':'th'}>`).join('')+'</tr>').join('\n')+'</table></html>';
    else if(target==='sql')text=sqlOf(table.rows,options.tableName||'converted_data');
    else if(target==='txt'){
      const widths=Array.from({length:table.rows[0]?.length||0},(_,i)=>Math.min(50,Math.max(...table.rows.slice(0,1000).map(row=>String(row[i]??'').replace(/[\r\n\t]/g,' ').length))));
      text=table.rows.map(row=>row.map((value,i)=>String(value).replace(/[\r\n\t]/g,' ').padEnd(widths[i])).join(' | ').trimEnd()).join('\n')+'\n';
    }
    else if(target==='pdf'){
      const {textPDF}=await import('./pdf-write.mjs');
      const rows=table.rows;
      if(rows.some(row=>row.length>12))throw new Error('Simple table PDFs support up to 12 columns. Choose CSV/XLSX for wider tables.');
      outputs.push({name:name+'.pdf',bytes:await textPDF(rows.map(row=>row.join(' | ')).join('\n')),type:'application/pdf'});continue;
    }else throw new Error('Unsupported table output.');
    const bytes=encode(text);if(bytes.length>LIMITS.outputs)throw new Error('The output is too large.');
    outputs.push({name:name+'.'+target,bytes,type:target==='html'?'text/html;charset=utf-8':'text/plain;charset=utf-8'});
  }
  return outputs;
}
export async function convertTable(file,info,target,options,prepared){return exportTables(await readTables(file,info,prepared),file.name,target,options);}
export {isTabular};
