import {LIMITS,stem} from './core.mjs';
import {MediaProgress,mediaDuration} from './progress.mjs';
let corePromise,core,logs=[],report=()=>{},encoding=null,inputMounted=false;
export async function mediaCore(progress=()=>{}) {
  report=progress;
  if(!corePromise)corePromise=(async()=>{
    report({fraction:null,remaining:null,phase:'loading',message:'Loading the local media engine (about 32 MB)…'});
    importScripts('./vendor/ffmpeg-core.js');
    const coreURL=new URL('./vendor/ffmpeg-core.js',self.location.href).href;
    const wasmURL=new URL('./vendor/ffmpeg-core.wasm',self.location.href).href;
    core=await self.createFFmpegCore({mainScriptUrlOrBlob:coreURL+'#'+btoa(JSON.stringify({wasmURL}))});
    core.setLogger(data=>{logs.push(data.message);if(logs.length>400)logs.shift();});
    core.FS.mkdir('/input');
    core.setProgress(data=>{if(encoding)report({...encoding.update(data.time),message:'Processing media…'});});
    return core;
  })().catch(error=>{corePromise=null;throw new Error('The local WebAssembly media engine could not load. Refresh this page and try a current browser. '+error.message);});
  return corePromise;
}
function exec(args,timeout=-1){logs=[];core.setTimeout(timeout);try{core.exec('-hide_banner',...args);return {code:core.ret,logs:logs.join('\n')};}finally{core.reset();}}
function cleanup(){
  encoding=null;
  if(inputMounted){core.FS.unmount('/input');inputMounted=false;}
  for(const name of core.FS.readdir('/'))if(/^(output|frame-)/.test(name)){try{core.FS.unlink('/'+name);}catch{}}
}
function mountInput(file,format){
  // WORKERFS reads slices of the original File without duplicating a large
  // input into JavaScript and the engine's in-memory filesystem.
  const name='source.'+format;
  core.FS.mount(core.FS.filesystems.WORKERFS,{blobs:[{name,data:file}]},'/input');inputMounted=true;
  return '/input/'+name;
}
export async function inspectMedia(file,format,progress){
  if(file.size>LIMITS.media)throw new Error('Audio and video files must be 400 MB or less.');
  await mediaCore(progress);cleanup();
  try{
    const path=mountInput(file,format);
    const result=exec(['-protocol_whitelist','file,pipe,crypto,data','-i',path,'-t','0.05','-map','0:v:0?','-map','0:a:0?','-f','null','-'],30000);
    const hasVideo=/Stream #.*Video:/.test(result.logs),hasAudio=/Stream #.*Audio:/.test(result.logs);
    const duration=result.logs.match(/Duration:\s*(\d+):(\d+):([\d.]+)/),seconds=duration?Number(duration[1])*3600+Number(duration[2])*60+Number(duration[3]):0;
    return {format:format==='asf'?(hasVideo?'wmv':'wma'):format,hasVideo,hasAudio,duration:seconds,mediaUnsupported:result.code!==0||(!hasVideo&&!hasAudio)};
  }finally{cleanup();}
}
export async function diagnostics(){await mediaCore();return exec(['-encoders']).logs;}
export async function convertMedia(file,info,target,options={},progress){
  const requestedTarget=target;target=target==='audio-mp3'?'mp3':target==='audio-wav'?'wav':target;
  if(file.size>LIMITS.media)throw new Error('Use a media file of 400 MB or less.');
  const videoTargets=['mp4','webm','mov','mkv','avi','gif','mute-mp4','resize-mp4'];
  const audioTargets=['mp3','wav','ogg','flac','aac','m4a','aiff'];
  const start=Number(options.start)||0,requested=Number(options.duration)||0;
  if(!Number.isFinite(start)||!Number.isFinite(requested)||start<0||requested<0)throw new Error('Start time and duration must be finite, zero or positive numbers.');
  if(info.duration&&start>=info.duration)throw new Error('The start time is beyond the end of this file.');
  const duration=mediaDuration(info,options);
  if(info.hasAudio===false&&audioTargets.includes(target))throw new Error('This video has no audio track.');
  await mediaCore(progress);cleanup();
  const outputExtension=['mute-mp4','resize-mp4'].includes(target)?'mp4':target==='frame-png'||target==='frames-png'?'png':target==='frame-jpg'||target==='frames-jpg'?'jpg':target;
  const frames=target.startsWith('frames-'),singleFrame=target.startsWith('frame-');
  const output=frames?'frame-%03d.'+outputExtension:'output.'+outputExtension;
  const args=[];
  const bitrate=String([128,192,256,320].includes(Number(options.bitrate))?Number(options.bitrate):192)+'k';
  const rate=[22050,44100,48000].includes(Number(options.sampleRate))?Number(options.sampleRate):44100;
  try{
    const path=mountInput(file,info.format);
    if(start)args.push('-ss',String(start));args.push('-protocol_whitelist','file,pipe,crypto,data','-i',path);
    if(requested)args.push('-t',String(requested));
    if(audioTargets.includes(target)){
      args.push('-vn','-map','0:a:0','-map_metadata','0','-ar',String(rate));
      if(options.channels==='mono')args.push('-ac','1');else args.push('-ac','2');
      if(options.normalize)args.push('-af','loudnorm=I=-16:TP=-1.5:LRA=11');
      const codecs={mp3:['libmp3lame','-b:a',bitrate],wav:['pcm_s16le'],ogg:['libvorbis','-q:a','5'],flac:['flac'],aac:['aac','-b:a',bitrate],m4a:['aac','-b:a',bitrate],aiff:['pcm_s16be']};
      const [codec,...rest]=codecs[target];args.push('-c:a',codec,...rest);
    }else if(singleFrame){args.push('-map','0:v:0','-frames:v','1','-update','1');}
    else if(frames){
      const fps=Math.max(.1,Math.min(10,Number(options.fps)||1));
      if(duration&&duration*fps>200)throw new Error('Choose a shorter clip or lower frame rate: frame export is limited to 200 frames.');
      args.push('-map','0:v:0','-vf',`fps=${fps},scale='min(1280,iw)':-2`,'-frames:v','200');
    }else if(target==='gif'){
      const still=['png','jpg'].includes(info.format);
      args.push('-an','-vf',(still?'':'fps=10,')+"scale='min(640,iw)':-1:flags=lanczos",'-loop','0');
      if(still)args.push('-frames:v','1');
    }else if(videoTargets.includes(target)){
      const width=Math.max(160,Math.min(1920,Number(options.videoWidth)||1280));
      args.push('-map','0:v:0','-map','0:a:0?','-map_metadata','0','-vf',`scale='min(${width},iw)':-2,pad=ceil(iw/2)*2:ceil(ih/2)*2`);
      if(target==='webm')args.push('-c:v','libvpx','-deadline','realtime','-cpu-used','8','-lag-in-frames','0','-auto-alt-ref','0','-crf','10','-b:v','1M','-c:a','libvorbis','-q:a','5');
      else if(target==='avi')args.push('-c:v','mpeg4','-q:v','5','-c:a','libmp3lame','-b:a','128k');
      else args.push('-c:v','libx264','-preset','ultrafast','-crf',target==='resize-mp4'?'28':'23','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k');
      if(target==='mute-mp4')args.push('-an');
      if(['mp4','mov','mute-mp4','resize-mp4'].includes(target))args.push('-movflags','+faststart');
    }else throw new Error('Unsupported media output.');
    args.push('-threads','1',output);
    report({fraction:duration>0?0:null,remaining:null,phase:'processing',message:'Processing media…'});
    encoding=new MediaProgress(singleFrame?0:duration);
    const result=exec(args);
    if(result.code!==0){
      if(/no streams|does not contain any stream|matches no streams/i.test(result.logs))throw new Error('The requested video or audio track is missing.');
      throw new Error('This media encoding could not be converted. It may use an unsupported codec or be damaged. Try another file or a shorter clip.');
    }
    const names=frames?core.FS.readdir('/').filter(name=>name.startsWith('frame-')).sort():[output];
    if(!names.length)throw new Error('No output was produced. Choose a start time inside the video.');
    report({fraction:.99,remaining:null,phase:'finalizing',message:'Preparing download…'});
    let total=0;
    return names.map((name,index)=>{
      total+=core.FS.stat('/'+name).size;if(total>LIMITS.outputs)throw new Error('The output exceeds 400 MB. Use a compressed format or select a shorter clip.');
      const bytes=core.FS.readFile(name);if(!bytes.length)throw new Error('No frames or audio were produced. Choose a clip inside the file.');core.FS.unlink('/'+name);
      const mime={mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',opus:'audio/ogg',flac:'audio/flac',m4a:'audio/mp4',aac:'audio/aac',aiff:'audio/aiff',mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',gif:'image/gif',png:'image/png',jpg:'image/jpeg'};
      return {name:stem(file.name)+(frames?'-frame-'+String(index+1).padStart(3,'0'):singleFrame?'-thumbnail':['mute-mp4','resize-mp4'].includes(target)||requestedTarget.startsWith('audio-')?'-converted':'')+'.'+outputExtension,bytes,type:mime[outputExtension]||'application/octet-stream'};
    });
  }finally{cleanup();}
}
