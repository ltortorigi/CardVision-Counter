// Transparent canvas drawn over the unchanged video. All rectangles use source-normalized
// coordinates; object-fit letterboxing, display scaling and device pixel ratio stay separate.
class FeedEditor {
 constructor(canvas,getModel,onChange,onSelect){
  this.canvas=canvas;this.getModel=getModel;this.onChange=onChange;this.onSelect=onSelect;this.selected='player4';this.drag=null;
  canvas.addEventListener('pointerdown',e=>this.down(e));canvas.addEventListener('pointermove',e=>this.motion(e));
  canvas.addEventListener('pointerup',e=>this.end(e));canvas.addEventListener('pointercancel',e=>this.end(e,true));
  canvas.addEventListener('lostpointercapture',e=>{if(this.drag)this.end(e,true);});
  canvas.addEventListener('keydown',e=>this.key(e));
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>this.draw()).observe(canvas.parentElement);
  window.addEventListener?.('resize',()=>this.draw());
 }
 geometry(){const m=this.getModel(),b=this.canvas.getBoundingClientRect();return {m,b,fit:CVRegions.fit(m.width||1,m.height||1,b.width,b.height)};}
 screenRect(r,fit){return [fit.x+r[0]*fit.w,fit.y+r[1]*fit.h,r[2]*fit.w,r[3]*fit.h];}
 handles(r,fit){const [x,y,w,h]=this.screenRect(r,fit);return {nw:[x,y],n:[x+w/2,y],ne:[x+w,y],e:[x+w,y+h/2],se:[x+w,y+h],s:[x+w/2,y+h],sw:[x,y+h],w:[x,y+h/2]};}
 down(e){const {m,b,fit}=this.geometry();if(!m.editing||e.button!==0||this.drag||e.isPrimary===false)return;const x=e.clientX-b.left,y=e.clientY-b.top;let handle=null,key=this.selected;
  if(m.regions[key])handle=Object.entries(this.handles(m.regions[key],fit)).find(([,p])=>Math.abs(x-p[0])<=8&&Math.abs(y-p[1])<=8)?.[0];
  if(!handle){const [nx,ny]=CVRegions.point(x,y,fit);const hits=Object.entries(m.regions).filter(([,r])=>CVRegions.contains(r,nx,ny)).sort((a,b)=>a[1][2]*a[1][3]-b[1][2]*b[1][3]);key=hits[0]?.[0];}
  if(!key)return;this.selected=key;this.onSelect(key);this.drag={key,handle,r:[...m.regions[key]],x,y,fit,pointer:e.pointerId};this.canvas.setPointerCapture(e.pointerId);this.canvas.focus();e.preventDefault();this.draw();
 }
 motion(e){if(!this.drag||e.pointerId!==this.drag.pointer){return;}const b=this.canvas.getBoundingClientRect(),d=this.drag,dx=(e.clientX-b.left-d.x)/d.fit.w,dy=(e.clientY-b.top-d.y)/d.fit.h;
  const r=d.handle?CVRegions.resize(d.r,d.handle,dx,dy):CVRegions.move(d.r,dx,dy);this.onChange(d.key,r,false);e.preventDefault();this.draw();
 }
 end(e,cancel=false){if(!this.drag||(e.pointerId!==undefined&&e.pointerId!==this.drag.pointer))return;const d=this.drag;this.drag=null;if(cancel)this.onChange(d.key,d.r,true);else this.onChange(d.key,this.getModel().regions[d.key],true);if(this.canvas.hasPointerCapture?.(d.pointer))this.canvas.releasePointerCapture(d.pointer);this.draw();}
 key(e){const m=this.getModel();if(!m.editing)return;if(e.key==='Escape'&&this.drag){this.end(e,true);e.preventDefault();return;}const step=e.shiftKey?10:1,delta={ArrowLeft:[-step/m.width,0],ArrowRight:[step/m.width,0],ArrowUp:[0,-step/m.height],ArrowDown:[0,step/m.height]}[e.key];if(delta&&m.regions[this.selected]){this.onChange(this.selected,CVRegions.move(m.regions[this.selected],...delta),true);e.preventDefault();this.draw();}}
 draw(){if(!this.canvas.getContext||!this.canvas.getBoundingClientRect)return;const {m,b,fit}=this.geometry(),dpr=window.devicePixelRatio||1;if(!b.width||!b.height)return;this.canvas.width=Math.round(b.width*dpr);this.canvas.height=Math.round(b.height*dpr);const c=this.canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,b.width,b.height);this.canvas.style.pointerEvents=m.editing?'auto':'none';this.canvas.style.touchAction=m.editing?'none':'auto';if(!m.visible)return;
  const draw=(key,r,color,dashed=false,label=true)=>{const [x,y,w,h]=this.screenRect(r,fit);c.strokeStyle=color;c.lineWidth=key===this.selected?2:1.2;c.setLineDash(dashed?[5,4]:[]);c.strokeRect(x,y,w,h);if(label){const text=CVRegions.label(key)+(m.issues?.[key]?' !':'');c.font='11px sans-serif';const tw=c.measureText(text).width+8,tx=Math.max(fit.x,Math.min(x,fit.x+fit.w-tw)),ty=y>fit.y+17?y-17:y+h+1;c.fillStyle='rgba(10,18,29,.90)';c.fillRect(tx,ty,tw,15);c.fillStyle=color;c.fillText(text,tx+4,ty+11);}};
  if(m.search?.[this.selected])draw(this.selected,m.search[this.selected],'#ffc45b',true,false);
  for(const [key,r]of Object.entries(m.regions)){const isTotal=/total|Seat/i.test(key);draw(key,r,m.issues?.[key]?'#ff737d':key.includes('/')?'#f4a7ff':isTotal?'#8dafff':'#5fe6c6',false,key===this.selected||!isTotal);}
  if(m.editing&&m.regions[this.selected]){c.setLineDash([]);for(const p of Object.values(this.handles(m.regions[this.selected],fit))){c.fillStyle='#fff';c.fillRect(p[0]-4,p[1]-4,8,8);c.strokeStyle='#182635';c.strokeRect(p[0]-4,p[1]-4,8,8);}}
 }
}
