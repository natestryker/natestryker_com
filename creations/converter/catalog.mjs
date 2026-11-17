export const categories = ['All', 'Images', 'PDFs', 'Documents', 'Spreadsheets', 'Data', 'Audio', 'Video', 'Archives'];
export const formats = {
  png:'PNG', jpg:'JPG / JPEG', jpeg:'JPEG', webp:'WebP', bmp:'BMP', gif:'GIF', svg:'SVG', tiff:'TIFF', ico:'ICO',
  pdf:'PDF', txt:'TXT', md:'Markdown', html:'HTML', docx:'DOCX', csv:'CSV', tsv:'TSV', xlsx:'XLSX', ods:'ODS',
  json:'JSON', yaml:'YAML', toml:'TOML', xml:'XML', jsonl:'JSONL / NDJSON', ini:'INI', sql:'SQL inserts',
  mp3:'MP3', wav:'WAV', ogg:'Ogg Vorbis', opus:'Opus (Ogg)', flac:'FLAC', aac:'AAC', m4a:'M4A (AAC)', aiff:'AIFF', sqlite:'SQLite',
  mp4:'MP4', webm:'WebM', mov:'MOV', mkv:'MKV', avi:'AVI',
  wma:'WMA', amr:'AMR', flv:'FLV', wmv:'WMV', mpeg:'MPEG', m4v:'M4V', '3gp':'3GP', ogv:'Ogg video', ts:'MPEG-TS',
  zip:'ZIP', tar:'TAR', tgz:'TAR.GZ / TGZ', gz:'GZIP', extract:'Extract files', unpack:'Decompress file',
  'pdf-json':'JSON (text + metadata)', 'pdf-zip':'ZIP of PNG pages', 'pdf-pages':'Select / reorder pages',
  'pdf-split':'Split into individual PDFs', 'pdf-rotate':'Rotate PDF', 'pdf-watermark':'Watermark PDF', 'pdf-number':'Number PDF pages',
  'frame-png':'PNG thumbnail', 'frame-jpg':'JPG thumbnail', 'frames-png':'PNG frames', 'frames-jpg':'JPG frames',
  'mute-mp4':'MP4 without audio', 'resize-mp4':'Resize / compress MP4',
  'audio-mp3':'MP3 (audio tools)', 'audio-wav':'WAV (audio tools)', 'merge-pdf':'Merged PDF', 'combine-images':'Combined image PDF', 'pack-zip':'ZIP of original files',
};
export const imageInputs = ['png','jpg','webp','bmp','gif','svg','tiff','ico'];
export const audioInputs = ['mp3','wav','ogg','opus','flac','aac','m4a','aiff','wma','amr'];
export const videoInputs = ['mp4','webm','mov','mkv','avi','flv','wmv','mpeg','m4v','3gp','ogv','ts'];
export const catalog = [];
function add(inputs, outputs, category, engine, warning, extra = {}) {
  for (const source of inputs) for (const target of outputs) {
    if (source === target || (source === 'jpg' && target === 'jpeg')) continue;
    catalog.push({id:`${source}:${target}`, source, target, category, engine,
      title:`${formats[source]} → ${formats[target]}`, warning, ...extra});
  }
}
add(imageInputs, ['png','jpg','jpeg','webp','bmp','ico','tiff'], 'Images', 'image',
  'Image metadata and color profiles are not retained. Animation is flattened to its first frame. JPEG and WebP encoding is lossy. JPG and BMP replace transparency with the selected background. PNG, WebP, TIFF and ICO retain transparency when possible.');
add(['png','jpg'], ['gif'], 'Images', 'media', 'Creates a single-frame GIF. GIF uses a limited color palette and binary transparency, so colors and soft transparency may change. Image metadata is removed.');
add(imageInputs, ['pdf'], 'PDFs', 'image-pdf', 'One image per PDF page. Animation is flattened. Images remain pictures; no OCR is performed. Original image metadata is not embedded.');
add(['pdf'], ['png','jpg','jpeg','webp','txt','html','pdf-json','pdf-zip'], 'PDFs', 'pdf-read',
  'Image exports rasterize pages. Text extraction preserves reading content where available, but not page layout; scanned pages need OCR, which is not included. PDF JSON includes extracted text and document metadata.');
add(['pdf'], ['pdf-pages','pdf-split','pdf-rotate','pdf-watermark','pdf-number'], 'PDFs', 'pdf-edit',
  'PDF editing preserves page content. Signatures, outlines, forms and document-level metadata may not survive copying pages. Encrypted PDFs cannot be edited here.');
add(['txt','md','html','docx'], ['pdf'], 'PDFs', 'document-pdf', 'Creates a paginated plain-text PDF. HTML, Markdown and Word styling, images and complex layout are removed. The bundled font supports Latin, Greek and Cyrillic; unsupported characters produce an error.');
add(['txt'], ['html','md'], 'Documents', 'document', 'Escapes literal text into HTML or Markdown code blocks; text is never executed as markup.');
add(['md'], ['html','txt'], 'Documents', 'document', 'Markdown is parsed into HTML. Plain-text output removes formatting and images. Embedded HTML is sanitized; external images and active content are removed.');
add(['html'], ['txt','md'], 'Documents', 'document', 'Scripts, embedded content, remote images and styling are removed. Complex layout and some formatting may be lost.');
add(['docx'], ['html','txt','md'], 'Documents', 'document', 'DOCX is converted to semantic content, not a copy of its visual layout. Unsupported Word features may be lost. External resources and active content are removed.');
add(['csv','tsv','xlsx','ods'], ['csv','tsv','xlsx','ods','json','html','sql','xml','pdf'], 'Spreadsheets', 'table',
  'Tabular data conversion. CSV, TSV, JSON, XML, SQL and PDF do not preserve workbook styling, formulas, charts or macros. Multi-sheet exports produce a separate file per sheet. Formula results use cached values and are not recalculated.');
add(['html'], ['csv','xlsx'], 'Spreadsheets', 'html-table', 'Converts actual HTML tables only. Styling, scripts, layout and non-table content are not retained. Each table becomes a separate worksheet.');
add(['json','yaml','toml','xml','jsonl','ini'], ['json','yaml','toml','xml','jsonl','ini'], 'Data', 'data',
  'Types are retained where the destination supports them. TOML and INI have restricted data models; incompatible values produce an error. JSONL requires an array. XML uses a typed mapping for JSON round trips; ordinary XML uses @attributes and #text.');
add(['json','yaml','jsonl','xml'], ['csv','tsv','xlsx','sql'], 'Data', 'data-table',
  'Requires a flat array of records or rows. Nested structures are rejected rather than silently flattened. Missing cells become empty; CSV cannot preserve data types.');
add(['csv','tsv'], ['yaml','jsonl'], 'Data', 'table', 'The first row supplies field names. Cell values are exported as text to preserve IDs, leading zeros and large numbers.');
add(['csv'], ['txt'], 'Documents', 'table', 'Creates an aligned plain-text table. Delimiters and quoting are replaced with readable columns; spreadsheet formatting is not retained.');
add(['csv','xlsx'], ['sqlite'], 'Data', 'sqlite', 'Creates one SQLite table per worksheet, with text columns to preserve cell content and identifiers. Formatting and formulas are not retained.');
add(['sqlite'], ['csv','json','xlsx'], 'Data', 'sqlite', 'Exports each user table. Queries, indexes, triggers and schema constraints are not included. Tables containing binary BLOB values cannot be exported to these formats.');
add(audioInputs, ['mp3','wav','ogg','flac','aac','m4a','aiff'], 'Audio', 'media',
  'MP3, AAC and Vorbis encoding is lossy. WAV, FLAC and AIFF cannot restore detail from a lossy source. Common tags are copied where possible; artwork and container-specific metadata may be lost.');
add(audioInputs,['audio-mp3','audio-wav'],'Audio','media','Audio is actually re-encoded. Use clip, bitrate, sample-rate, channel and normalization settings. MP3 is lossy; compressed output may not be smaller than an already optimized source.',{keywords:'trim compress normalize volume change bitrate sample rate stereo mono audio'});
add(videoInputs, ['mp4','webm','mov','mkv','avi'], 'Video', 'media',
  'Video is re-encoded and may lose quality, subtitles, extra audio tracks and metadata. MP4/MOV/MKV use H.264 + AAC; WebM uses VP8 + Vorbis. Browser processing is slower than desktop software.',{needsVideo:true});
add(videoInputs, ['mp3','wav','flac','m4a'], 'Audio', 'media', 'Extracts the first audio track. MP3/M4A are lossy. A video without a decodable audio track has no audio conversion options.', {needsAudio:true});
add(videoInputs, ['gif','frame-png','frame-jpg','frames-png','frames-jpg','mute-mp4','resize-mp4'], 'Video', 'media',
  'GIF has no audio and limited colors. Frames are raster images without source metadata. Video changes re-encode the picture and may lose quality. Frame exports are limited to 200 frames.', {needsVideo:true});
add(['gif'], ['mp4'], 'Video', 'media', 'Animation becomes an H.264 video with no audio. Transparency is replaced by black.');
add(['zip'], ['tar','tgz','extract'], 'Archives', 'archive', 'Archive contents are preserved as regular files. Encrypted archives, links, unsafe paths and unsupported TAR records are rejected. Extracted files are never opened or executed.');
add(['tar'], ['zip','tgz','extract'], 'Archives', 'archive', 'Supports USTAR regular files and directories. Links and unsupported TAR records are rejected. File permission and ownership metadata are not preserved.');
add(['tgz'], ['zip','tar','extract'], 'Archives', 'archive', 'Decompresses a GZIP-compressed TAR archive. File bytes and folder paths are preserved; file permission metadata is not.');
add(['gz'], ['unpack'], 'Archives', 'archive', 'Decompresses the file bytes. The output is not opened automatically.');
// Generic compression works on arbitrary bytes and is a real conversion.
catalog.push({id:'any:gz',source:'any',target:'gz',category:'Archives',engine:'archive',title:'Any file → GZIP',warning:'Lossless file compression. Already compressed media may get slightly larger.'});
catalog.push(
  {id:'tool:merge-pdf',source:'pdf',target:'merge-pdf',category:'PDFs',engine:'batch',batch:'merge-pdf',title:'Merge PDFs',warning:'Add two or more unencrypted PDFs. Pages are joined in the shown file order.'},
  {id:'tool:combine-images',source:'images',target:'combine-images',category:'PDFs',engine:'batch',batch:'combine-images',title:'Multiple images → one PDF',keywords:'combine merge pictures',warning:'Add supported images. They become separate PDF pages in the shown file order.'},
  {id:'tool:pack-zip',source:'files',target:'pack-zip',category:'Archives',engine:'batch',batch:'pack-zip',title:'Files → ZIP',keywords:'package create archive',warning:'Packages the original file bytes and filenames into a ZIP.'}
);

export function availableCatalog(capabilities = {}) {
  return catalog.filter(item => capabilities.workers !== false && !(item.target === 'webp' && capabilities.webp === false)
    && !(['media','sqlite'].includes(item.engine) && capabilities.wasm === false)
    && !((['image','image-pdf'].includes(item.engine)||item.batch==='combine-images') && capabilities.offscreen === false));
}
export function compatible(info, capabilities) {
  return availableCatalog(capabilities).filter(item => !item.batch && (item.source === info.format || item.source === 'any')
    && !(item.needsAudio && info.hasAudio === false)
    && !(item.needsVideo && info.hasVideo === false)
    && !(item.engine === 'media' && info.mediaUnsupported)
    && !(item.engine === 'data-table' && info.tabular === false)
    && !(item.engine === 'html-table' && info.hasTables === false)
    && !(item.target === 'ini' && info.canINI === false)
    && !(item.target === 'toml' && info.canTOML === false)
    && !(item.target === 'jsonl' && info.canJSONL === false)
    && !(info.encrypted && item.engine === 'pdf-edit'));
}
export function searchCatalog(query, category, capabilities) {
  const normalize=value=>value.toLowerCase().replace(/jpeg/g,'jpg').replace(/ndjson/g,'jsonl').trim();
  const direction=query.match(/^\s*(.+?)\s*(?:→|->|\bto\b)\s*(.+?)\s*$/i);
  const key=value=>({text:'txt',markdown:'md',excel:'xlsx',word:'docx',gzip:'gz','tar.gz':'tgz','ogg vorbis':'ogg'})[normalize(value)]||normalize(value);
  const underlying={jpeg:'jpg','pdf-json':'json','pdf-zip':'zip','pdf-pages':'pdf','pdf-split':'pdf','pdf-rotate':'pdf','pdf-watermark':'pdf','pdf-number':'pdf','merge-pdf':'pdf','combine-images':'pdf','pack-zip':'zip','audio-mp3':'mp3','audio-wav':'wav','frame-png':'png','frames-png':'png','frame-jpg':'jpg','frames-jpg':'jpg','mute-mp4':'mp4','resize-mp4':'mp4'};
  const typeMatches=(term,type)=>Object.hasOwn(formats,key(term))?key(term)===(underlying[type]||type):normalize(formats[type]||type).includes(normalize(term));
  const words = normalize(query).replace(/→|->/g,' ').split(/\s+/).filter(word => word && word !== 'to');
  return availableCatalog(capabilities).filter(item => item.target!=='jpeg' && (category === 'All' || item.category === category)
    && (direction?typeMatches(direction[1],item.source)&&typeMatches(direction[2],item.target):words.every(word => normalize(`${item.title} ${item.source} ${item.target} ${item.category} ${item.keywords||''}`).includes(word))));
}
