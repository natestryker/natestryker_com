// Preserve the capture's in-game camera angle, orientation and colors.
export class ClueRenderer{
 constructor(canvas){this.canvas=canvas;this.context=canvas.getContext('2d',{alpha:false});this.scene=null;this.version=0;}
 setScene(source,scene){this.source=source;this.scene=scene;return this.draw();}
 async draw(){
  if(!this.scene)return false;
  const width=this.canvas.clientWidth,height=this.canvas.clientHeight;if(!width||!height)return false;
  const version=++this.version,ratio=Math.min(devicePixelRatio||1,2),longest=Math.max(width,height);
  this.canvas.width=Math.round(width*ratio);this.canvas.height=Math.round(height*ratio);
  const worldSpan=this.scene.crop*this.source.width,regionWidth=worldSpan*width/longest,regionHeight=worldSpan*height/longest;
  return this.source.render(this.context,{x:this.scene.x*this.source.width-regionWidth/2,y:this.scene.y*this.source.height-regionHeight/2,width:regionWidth,height:regionHeight},{isCurrent:()=>version===this.version});
 }
}
