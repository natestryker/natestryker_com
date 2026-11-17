export function mediaDuration(info,options={}){
  const remaining=Math.max(0,(info.duration||0)-(Number(options.start)||0)),requested=Number(options.duration)||0;
  return requested>0?(remaining>0?Math.min(requested,remaining):requested):remaining;
}

// FFmpeg reports encoded output time in microseconds. Use the selected clip's
// duration rather than its source-file progress ratio, which is wrong for trims.
export class MediaProgress {
  constructor(duration,now=()=>performance.now()){
    this.duration=Number.isFinite(duration)&&duration>0?duration:0;
    this.now=now;this.started=now();this.seconds=0;
  }
  update(microseconds){
    if(Number.isFinite(microseconds))this.seconds=Math.max(this.seconds,microseconds/1e6,0);
    if(!this.duration)return {fraction:null,remaining:null,phase:'processing'};
    const fraction=Math.min(.99,this.seconds/this.duration),elapsed=(this.now()-this.started)/1000;
    const finishing=this.seconds>=this.duration;
    const remaining=!finishing&&elapsed>=3&&this.seconds>=.5?elapsed/this.seconds*Math.max(0,this.duration-this.seconds):null;
    return {fraction,remaining,phase:finishing?'finalizing':'processing'};
  }
}

export function timeRemaining(seconds){
  if(!Number.isFinite(seconds)||seconds<0)return 'Estimating time remaining…';
  if(seconds<60)return 'Less than a minute remaining';
  const minutes=Math.ceil(seconds/60);
  if(minutes<60)return `About ${minutes} min remaining`;
  const hours=Math.floor(minutes/60),rest=minutes%60;
  return `About ${hours} hr${rest?` ${rest} min`:''} remaining`;
}
