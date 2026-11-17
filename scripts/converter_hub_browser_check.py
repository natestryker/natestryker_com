"""Real browser conversion checks. Uses Python Playwright and installed Chrome."""
import argparse
import base64
import functools
import http.server
import json
from pathlib import Path
import tempfile
import threading
import zipfile
from playwright.sync_api import sync_playwright


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.mjs': 'text/javascript', '.wasm': 'application/wasm'}

    def log_message(self, *_):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--browser', required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(root)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    artifacts = Path(tempfile.mkdtemp(prefix='natestryker-hub-qa-'))
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=args.browser, headless=True)
            context = browser.new_context(viewport={'width':1440,'height':1080}, accept_downloads=True)
            page = context.new_page()
            errors, external, writes = [], [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            context.on('request', lambda request: external.append(request.url) if not request.url.startswith((origin,'blob:','data:')) else None)
            context.on('request', lambda request: writes.append(request.url) if request.method not in ('GET','HEAD') else None)
            try:
                page.goto(origin + '/creations/converter/')
                page.wait_for_function("document.querySelectorAll('.catalog-item').length > 0")
                print('PASS hub boots with searchable catalog',flush=True)
                page.evaluate(r'''async () => {
                  const {ConverterWorker} = await import('/creations/converter/client.mjs');
                  window.qaWorker = new ConverterWorker();
                  window.qa = async (action,payload) => qaWorker.call(action,payload);
                  window.requireQA = (condition,message) => {if(!condition)throw new Error(message);};
                  window.qaFile = (name,text) => new File([text],name,{type:'text/plain'});
                  const canvas = document.createElement('canvas');canvas.width=40;canvas.height=30;
                  const ctx=canvas.getContext('2d');ctx.fillStyle='#e36a16';ctx.fillRect(0,0,20,30);
                  window.qaPNG = new File([await new Promise(r=>canvas.toBlob(r,'image/png'))],'sample.png',{type:'image/png'});
                }''')
                page.evaluate(r'''async () => {
                  const info=await qa('inspect',{file:qaPNG});requireQA(info.format==='png'&&info.width===40,'PNG detection');
                  for(const target of ['jpg','jpeg','webp','bmp','ico','tiff']) {
                    const [out]=await qa('convert',{file:qaPNG,info,target,options:{engine:'image'}});
                    const file=new File([out.bytes],out.name,{type:out.type}), next=await qa('inspect',{file});
                    requireQA(next.width===40&&next.height===30,target+' dimensions');
                    if(!['jpg','jpeg'].includes(target)) {
                      const [png]=await qa('convert',{file,info:next,target:'png',options:{engine:'image'}});
                      requireQA(png.bytes[0]===137,target+' round trip');
                    }
                  }
                  const [png]=await qa('convert',{file:qaPNG,info,target:'webp',options:{engine:'image',quality:1}});
                  const bitmap=await createImageBitmap(new Blob([png.bytes],{type:'image/webp'}));
                  const c=new OffscreenCanvas(40,30);c.getContext('2d').drawImage(bitmap,0,0);bitmap.close();
                  requireQA(c.getContext('2d').getImageData(30,15,1,1).data[3]===0,'Transparency retained');
                }''')
                print('PASS image encoders, TIFF/BMP/ICO round trips and WebP transparency',flush=True)
                page.evaluate(r'''async () => {
                  const value={name:'résumé',rows:[1,true,null],nested:{empty:''}}, file=qaFile('data.json',JSON.stringify(value));
                  const info=await qa('inspect',{file});requireQA(info.format==='json','JSON detection');
                  const [yaml]=await qa('convert',{file,info,target:'yaml',options:{engine:'data'}});
                  const yamlFile=qaFile('data.yaml',yaml.bytes), yi=await qa('inspect',{file:yamlFile});
                  const [back]=await qa('convert',{file:yamlFile,info:yi,target:'json',options:{engine:'data'}});
                  requireQA(JSON.stringify(JSON.parse(new TextDecoder().decode(back.bytes)))===JSON.stringify(value),'YAML round trip');
                  const tomlFile=qaFile('table.toml','title = "Example"\n[owner]\nname = "Nate"\n');
                  const ti=await qa('inspect',{file:tomlFile});
                  const [tj]=await qa('convert',{file:tomlFile,info:ti,target:'json',options:{engine:'data'}});
                  requireQA(JSON.parse(new TextDecoder().decode(tj.bytes)).owner.name==='Nate','TOML parse');
                  const [xml]=await qa('convert',{file,info,target:'xml',options:{engine:'data'}});
                  const {parseXML}=await import('/creations/converter/documents.mjs');
                  requireQA(JSON.stringify(parseXML(new TextDecoder().decode(xml.bytes)))===JSON.stringify(value),'Typed XML round trip');
                  const csv=qaFile('data.csv','id,name,note\r\n001,Alice,"has, comma"\r\n002,Bob,"two\\nlines"\r\n');
                  const ci=await qa('inspect',{file:csv});
                  const [xlsx]=await qa('convert',{file:csv,info:ci,target:'xlsx',options:{engine:'table'}});
                  const book=new File([xlsx.bytes],xlsx.name), bi=await qa('inspect',{file:book});
                  requireQA(bi.format==='xlsx','Content-detected workbook');
                  const [json]=await qa('convert',{file:book,info:bi,target:'json',options:{engine:'table'}});
                  requireQA(JSON.parse(new TextDecoder().decode(json.bytes))[0].id==='001','Leading zero preserved');
                  const [ods]=await qa('convert',{file:book,info:bi,target:'ods',options:{engine:'table'}});
                  const odsFile=new File([ods.bytes],ods.name), oi=await qa('inspect',{file:odsFile});
                  requireQA(oi.format==='ods','ODS detection');
                  const [backCSV]=await qa('convert',{file:odsFile,info:oi,target:'csv',options:{engine:'table'}});
                  requireQA(new TextDecoder().decode(backCSV.bytes).includes('001'),'ODS round trip');
                  const [db]=await qa('convert',{file:csv,info:ci,target:'sqlite',options:{engine:'sqlite'}});
                  const dbFile=new File([db.bytes],db.name),di=await qa('inspect',{file:dbFile});
                  requireQA(di.format==='sqlite','SQLite signature');
                  const [dbJSON]=await qa('convert',{file:dbFile,info:di,target:'json',options:{engine:'sqlite'}});
                  requireQA(JSON.parse(new TextDecoder().decode(dbJSON.bytes))[0].id==='001','SQLite text values retained');
                }''')
                print('PASS YAML/TOML/XML and CSV/XLSX/ODS/SQLite real data round trips',flush=True)
                page.evaluate(r'''async () => {
                  const contents={
                    '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
                    '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
                    'word/document.xml':'<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello from a real Word document</w:t></w:r></w:p></w:body></w:document>'
                  };
                  const [zip]=await qa('zip',{entries:Object.entries(contents).map(([name,text])=>({name,bytes:new TextEncoder().encode(text)}))});
                  const file=new File([zip.bytes],'wrong-extension.bin'),info=await qa('inspect',{file});
                  requireQA(info.format==='docx','DOCX identified by OOXML contents');
                  const doc=await qa('convert',{file,info,target:'html',options:{engine:'document'}});
                  requireQA(doc.html.includes('Hello from a real Word document'),'DOCX conversion');
                  const D=await import('/creations/converter/documents.mjs');
                  const clean=await D.cleanHTML('<h1>Hello</h1><script>window.pwned=1</script><img src="https://example.invalid/leak?file=secret"><iframe src="https://example.invalid/"></iframe>');
                  requireQA(!clean.includes('script')&&!clean.includes('example.invalid')&&!clean.includes('iframe'),'HTML active/external content removed');
                  requireQA(D.htmlText(clean)==='Hello','HTML text conversion');
                  requireQA((await D.markdown('<h1>Hello</h1><p>Some <strong>bold</strong> text.</p>')).includes('# Hello'),'Real Markdown generation');
                  let rejected=false;try{D.parseXML('<!DOCTYPE a [<!ENTITY x SYSTEM "https://example.invalid/">]><a>&x;</a>');}catch{rejected=true;}requireQA(rejected,'XML external entities rejected');
                  const svg=new File(['<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="10" height="10" fill="red"/><image href="https://example.invalid/leak"/></svg>'],'image.svg',{type:'image/svg+xml'});
                  const prepared=await D.prepareFile(svg),si=await qa('inspect',{file:prepared.file,prepared:prepared.prepared});
                  requireQA(si.format==='svg'&&si.width===20&&si.height===10,'Sanitized SVG rasterization');
                  const md=qaFile('readme.md','# Heading\n\n**Strong** text');
                  const mi=await qa('inspect',{file:md}), rendered=await qa('convert',{file:md,info:mi,target:'html',options:{engine:'document'}});
                  requireQA(rendered.html.includes('<h1>Heading</h1>'),'Markdown parsed rather than renamed');
                }''')
                print('PASS DOCX/Markdown parsing, HTML sanitization, SVG rasterization and XML entity rejection',flush=True)
                page.evaluate(r'''async () => {
                  const entries=[{name:'folder/a.txt',bytes:new TextEncoder().encode('one')},{name:'b.json',bytes:new TextEncoder().encode('[]')}];
                  const [zip]=await qa('zip',{entries}), file=new File([zip.bytes],'archive.zip'), info=await qa('inspect',{file});
                  const [tgz]=await qa('convert',{file,info,target:'tgz',options:{engine:'archive'}});
                  const compressed=new File([tgz.bytes],tgz.name), gi=await qa('inspect',{file:compressed});
                  requireQA(gi.format==='tgz','TAR.GZ detected by decompressed header');
                  const extracted=await qa('convert',{file:compressed,info:gi,target:'extract',options:{engine:'archive'}});
                  requireQA(extracted.length===2&&extracted[0].name==='folder/a.txt'&&new TextDecoder().decode(extracted[0].bytes)==='one','Archive contents preserved');
                  const [gzip]=await qa('convert',{file:qaFile('hello.txt','hello'),info:{format:'txt'},target:'gz'});
                  const [unpacked]=await qa('convert',{file:new File([gzip.bytes],'hello.txt.gz'),info:{format:'gz'},target:'unpack',options:{engine:'archive'}});
                  requireQA(new TextDecoder().decode(unpacked.bytes)==='hello','GZIP round trip');
                }''')
                print('PASS ZIP/TAR/GZIP byte and folder preservation',flush=True)
                page.evaluate(r'''async () => {
                  const [out]=await qa('convert',{file:qaFile('hello.txt','Hello résumé Ελληνικά'),info:{format:'txt'},target:'pdf',options:{engine:'document-pdf'},prepared:{plainText:'Hello résumé Ελληνικά'}});
                  requireQA(new TextDecoder().decode(out.bytes.slice(0,5))==='%PDF-','Real Unicode PDF');
                  window.qaPDF=new File([out.bytes],'sample.pdf',{type:'application/pdf'});
                  const [combined]=await qa('combine-images',{files:[qaPNG,qaPNG],infos:[{format:'png'},{format:'png'}],options:{pageSize:'a4',margin:18}});
                  const pdf=new File([combined.bytes],'images.pdf',{type:'application/pdf'});
                  const split=await qa('convert',{file:pdf,info:{format:'pdf'},target:'pdf-split',options:{engine:'pdf-edit'}});
                  requireQA(split.length===2,'Split two-page PDF');
                  const [merged]=await qa('merge-pdf',{files:split.map(o=>new File([o.bytes],o.name)),options:{}});
                  requireQA(merged.bytes.length>0,'Merged PDF');
                }''')
                print('PASS Unicode text PDF, image PDF, splitting and merging',flush=True)
                encoders = page.evaluate("async () => await qa('media-diagnostics')")
                expected=['libx264','libvpx-vp9','libvorbis','libopus','libmp3lame','flac','aac','pcm_s16le']
                assert all(codec in encoders for codec in expected), [codec for codec in expected if codec not in encoders]
                print('PASS single-thread FFmpeg loads without special headers; required encoders exist',flush=True)
                page.evaluate(r'''async () => {
                  const length=44100,bytes=new Uint8Array(44+length*2),view=new DataView(bytes.buffer);
                  const text=(at,value)=>{for(let i=0;i<value.length;i++)bytes[at+i]=value.charCodeAt(i);};
                  text(0,'RIFF');view.setUint32(4,36+length*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,44100,true);view.setUint32(28,88200,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,length*2,true);
                  for(let i=0;i<length;i++)view.setInt16(44+i*2,Math.sin(i*2*Math.PI*440/44100)*12000,true);
                  const file=new File([bytes],'tone.wav',{type:'audio/wav'}),info=await qa('inspect',{file}).catch(e=>{throw new Error('WAV inspect: '+e.message);});
                  requireQA(info.hasAudio&&!info.mediaUnsupported,'WAV audio inspection');
                  const [trimmed]=await qa('convert',{file,info,target:'audio-wav',options:{engine:'media',start:.2,duration:.5,channels:'mono',sampleRate:22050}});
                  const adjusted=await new OfflineAudioContext(1,1,22050).decodeAudioData(trimmed.bytes.buffer);
                  requireQA(adjusted.duration>.45&&adjusted.duration<.6&&adjusted.numberOfChannels===1,'Audio trim and sample-rate/channel tools');
                  for(const target of ['mp3','ogg','flac','aac','m4a','aiff']){
                    const [out]=await qa('convert',{file,info,target,options:{engine:'media',bitrate:192,normalize:true}}).catch(e=>{throw new Error(target+' encode: '+e.message);});
                    requireQA(out.bytes.length>1000,target+' actual encoded bytes');
                    const next=new File([out.bytes],out.name,{type:out.type}),meta=await qa('inspect',{file:next}).catch(e=>{throw new Error(target+' inspect: '+e.message);});
                    requireQA(meta.hasAudio&&!meta.mediaUnsupported,target+' decoded by media engine');
                    const [back]=await qa('convert',{file:next,info:meta,target:'wav',options:{engine:'media'}}).catch(e=>{throw new Error(target+' decode: '+e.message);});
                    const audio=await new OfflineAudioContext(2,1,44100).decodeAudioData(back.bytes.buffer);
                    requireQA(audio.duration>.8&&audio.duration<1.5,target+' duration retained');
                    const samples=audio.getChannelData(0);let energy=0;for(const sample of samples)energy+=sample*sample;
                    requireQA(Math.sqrt(energy/samples.length)>.02,target+' audible signal retained');
                  }
                  const [gif]=await qa('convert',{file:qaPNG,info:{format:'png',hasVideo:true},target:'gif',options:{engine:'media'}});
                  const bitmap=await createImageBitmap(new Blob([gif.bytes],{type:'image/gif'}));requireQA(bitmap.width===40,'Real still GIF output');bitmap.close();
                }''')
                print('PASS all audio encoders, audible round trips, normalization and still GIF output',flush=True)
                page.evaluate(r'''async () => {
                  const audio=new AudioContext(),oscillator=audio.createOscillator(),destination=audio.createMediaStreamDestination();oscillator.frequency.value=440;oscillator.connect(destination);oscillator.start();await audio.resume();
                  const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;const ctx=canvas.getContext('2d');
                  const timer=setInterval(()=>{ctx.fillStyle='#e36a16';ctx.fillRect(0,0,160,90);},40),video=canvas.captureStream(25);
                  const stream=new MediaStream([...video.getTracks(),...destination.stream.getTracks()]);
                  const mime=['video/mp4;codecs=avc1.42001E,mp4a.40.2','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
                  const recorder=new MediaRecorder(stream,{mimeType:mime}),chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
                  const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start(100);await new Promise(resolve=>setTimeout(resolve,1500));recorder.stop();await done;
                  clearInterval(timer);oscillator.stop();stream.getTracks().forEach(track=>track.stop());await audio.close();
                  window.qaVideo=new File(chunks,'tone.mp4',{type:'video/mp4'});const info=await qa('inspect',{file:qaVideo}).catch(e=>{throw new Error('Video inspect: '+e.message);});requireQA(info.hasVideo&&info.hasAudio&&!info.mediaUnsupported,'Actual video and audio streams');
                  for(const target of ['mp4','webm','mov','mkv','avi','gif','frame-png','frame-jpg','frames-png','frames-jpg','mute-mp4','resize-mp4','mp3','webm','webm']){
                    const outputs=await qa('convert',{file:qaVideo,info,target,options:{engine:'media',duration:1,videoWidth:320,fps:1}}).catch(e=>{throw new Error(target+' video encode: '+e.message);});
                    requireQA(outputs.length>0&&outputs.every(o=>o.bytes.length>100),target+' output bytes');
                    if(['mp4','webm','mov','mkv','avi','mute-mp4','resize-mp4'].includes(target)){
                      const output=outputs[0],next=new File([output.bytes],output.name),meta=await qa('inspect',{file:next}).catch(e=>{throw new Error(target+' video inspect: '+e.message);});
                      requireQA(meta.hasVideo&&!meta.mediaUnsupported,target+' decoded output');
                      if(target==='mute-mp4')requireQA(meta.hasAudio===false,'Audio removed');
                    }
                  }
                }''')
                print('PASS real MP4/WebM/MOV/MKV/AVI, GIF, frame, mute, resize and MP3 exports',flush=True)
                fixtures=page.evaluate(r'''async () => ({png:Array.from(new Uint8Array(await qaPNG.arrayBuffer())),pdf:Array.from(new Uint8Array(await qaPDF.arrayBuffer())),mp4:Array.from(new Uint8Array(await qaVideo.arrayBuffer()))})''')

                def upload(payloads):
                    page.locator('#file-input').set_input_files(payloads)
                    page.wait_for_function("!document.getElementById('settings').disabled",timeout=120000)

                def payload(name,data,mime='application/octet-stream'):
                    return {'name':name,'mimeType':mime,'buffer':bytes(data) if not isinstance(data,str) else data.encode()}

                def run_ui():
                    page.locator('#convert').click()
                    page.wait_for_function("!document.getElementById('settings').disabled",timeout=120000)
                    assert 'error' not in (page.locator('#status').get_attribute('class') or ''),page.locator('#status').inner_text()
                    assert page.locator('#results').is_visible()

                upload([payload('picture.not-jpg',fixtures['png']),payload('document.pdf',fixtures['pdf']),payload('records.csv','id,name\n001,Alice\n002,Bob'),payload('settings.json','{"name":"Nate","enabled":true}')])
                assert 'PNG' in page.locator('.file-description small').first.inner_text()
                page.get_by_label('Output for picture.not-jpg').select_option('jpg')
                page.get_by_label('Output for document.pdf').select_option('txt')
                page.get_by_label('Output for records.csv').select_option('xlsx')
                json_options=page.get_by_label('Output for settings.json').locator('option').evaluate_all('(nodes)=>nodes.map(n=>n.value)')
                assert 'ini' not in json_options and 'jsonl' not in json_options
                page.get_by_label('Output for settings.json').select_option('yaml')
                run_ui()
                assert page.locator('.result-card').count()==4
                with page.expect_download() as downloaded:
                    page.locator('.result-card a').first.click()
                assert Path(downloaded.value.path()).read_bytes().startswith(b'\xff\xd8\xff')
                with page.expect_download() as downloaded:
                    page.locator('#download-zip').click()
                with zipfile.ZipFile(downloaded.value.path()) as archive:
                    assert len(archive.namelist())==4
                    assert 'Hello résumé' in archive.read('document.txt').decode('utf-8')
                page.screenshot(path=str(artifacts/'mixed-batch.png'),full_page=True)
                print('PASS mixed batch UI, content detection despite wrong extension, conditional formats, actual downloads and ZIP',flush=True)

                page.locator('#clear-files').click()
                page.evaluate(r'''() => {
                  const transfer=new DataTransfer();transfer.items.add(qaPNG);
                  document.getElementById('drop-zone').dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));
                }''')
                page.wait_for_function("!document.getElementById('settings').disabled")
                assert page.locator('.file-item').count()==1
                upload([payload('second.png',fixtures['png'])])
                page.locator('#batch-mode').select_option('combine-images')
                page.get_by_role('button',name='Move up: second.png',exact=True).click()
                run_ui()
                with page.expect_download() as downloaded:
                    page.locator('.result-card a').click()
                assert Path(downloaded.value.path()).read_bytes().startswith(b'%PDF-')
                page.locator('#clear-files').click()
                upload([payload('one.pdf',fixtures['pdf']),payload('two.pdf',fixtures['pdf'])])
                page.locator('#batch-mode').select_option('merge-pdf')
                run_ui()
                assert page.locator('.result-card').count()==1
                print('PASS drag and drop, ordered image combining and merged PDF UI',flush=True)

                page.locator('#clear-files').click()
                upload([payload('failed.pdf','%PDF-1.7\nnot a real document'),payload('good.png',fixtures['png'])])
                page.get_by_label('Output for failed.pdf').select_option('png')
                page.get_by_label('Output for good.png').select_option('jpg')
                page.locator('#convert').click()
                page.wait_for_function("!document.getElementById('settings').disabled")
                assert page.locator('.result-card').count()==1
                assert 'failed' in page.locator('#status').inner_text()
                assert page.locator('.file-state.error').count()==1
                page.locator('#clear-files').click()
                upload([payload('video.mp4',fixtures['mp4'])])
                page.get_by_label('Output for video.mp4').select_option('mp3')
                page.evaluate("() => {document.getElementById('convert').click();document.getElementById('cancel').click();}")
                page.wait_for_function("!document.getElementById('settings').disabled")
                assert 'canceled' in page.locator('#status').inner_text().lower()
                run_ui()
                with page.expect_download() as downloaded:
                    page.locator('.result-card a').click()
                assert downloaded.value.suggested_filename.endswith('.mp3')
                print('PASS failed-file isolation, cancellation and successful retry with a fresh worker',flush=True)

                page.locator('#catalog-search').fill('JPEG to PNG')
                page.get_by_role('button',name='Images',exact=True).click()
                assert page.locator('.catalog-item').count()==1
                assert 'JPG / JPEG' in page.locator('.catalog-item').inner_text()
                page.locator('#catalog-search').fill('HEIC')
                assert page.locator('.catalog-item').count()==0
                page.locator('#catalog-search').fill('')
                page.get_by_role('button',name='All',exact=True).click()
                page.screenshot(path=str(artifacts/'desktop.png'),full_page=True)
                for route in ('/creations/','/creations/converter/','/creations/converter/support/','/creations/converter/licenses/'):
                    page.set_viewport_size({'width':360,'height':800})
                    page.goto(origin+route)
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),route
                page.goto(origin+'/creations/converter/')
                page.wait_for_function("document.querySelectorAll('.catalog-item').length>0")
                page.screenshot(path=str(artifacts/'mobile.png'),full_page=True)
                page.goto(origin+'/creations/pdf-image-converter/?example=1#catalog')
                page.wait_for_url('**/creations/converter/?example=1#catalog')
                page.goto(origin+'/creations/mp4-to-mp3/')
                page.wait_for_url('**/creations/converter/')
                print('PASS searchable catalog, omitted unsupported formats, mobile layouts and legacy redirects',flush=True)
                assert not errors,errors
                assert not external,external
                assert not writes,writes
                print(json.dumps({'uncaught_errors':errors,'external_requests':external,'uploads':writes,'screenshots':str(artifacts)}),flush=True)
            finally:
                context.close()
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__=='__main__':
    main()
