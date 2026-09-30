(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.CVAuto=api;})(globalThis,()=>{
'use strict';
function components(mask,w,h){const out=[],queue=new Int32Array(mask.length);for(let i=0;i<mask.length;i++){if(mask[i]!==1)continue;let head=0,tail=1;queue[0]=i;mask[i]=2;let x0=w,y0=h,x1=0,y1=0,n=0;while(head<tail){const q=queue[head++],x=q%w,y=Math.floor(q/w);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);n++;for(const k of [q-1,q+1,q-w,q+w]){if(k<0||k>=mask.length||mask[k]!==1||Math.abs(k%w-x)+Math.abs(Math.floor(k/w)-y)!==1)continue;mask[k]=2;queue[tail++]=k;}}out.push({x:x0,y:y0,w:x1-x0+1,h:y1-y0+1,area:n});}return out;}
function clampRegion(r){const x=Math.max(0,Math.min(.999,r[0])),y=Math.max(0,Math.min(.999,r[1]));return [x,y,Math.max(.001,Math.min(1-x,r[2])),Math.max(.001,Math.min(1-y,r[3]))];}
function locate(image,defaults){
 const {data,width:w,height:h}=image,mask=new Uint8Array(w*h);
 // The Dealer strip has a stable slate background and a pale total box.
 // Restrict the palette tightly: arbitrary dark windows must not become tables.
 for(let i=0;i<mask.length;i++){const j=i*4,r=data[j],g=data[j+1],b=data[j+2];if(Math.abs(r-62)<=8&&Math.abs(g-80)<=8&&Math.abs(b-93)<=8&&g-r>=10&&b-g>=7)mask[i]=1;}
 const candidates=components(mask,w,h).filter(c=>c.w>=18&&c.h>=7&&c.w/c.h>2.1&&c.w/c.h<3.7&&c.area/(c.w*c.h)>.50);
 const matches=[];
 for(const c of candidates){
  const scale=c.w/63;if(scale<.28||scale>4)continue;
  let pale=0,total=0;const x0=Math.round(c.x+c.w+2*scale),x1=Math.min(w,Math.round(c.x+100*scale-2*scale));
  for(let y=Math.round(c.y+2*scale);y<Math.min(h,Math.round(c.y+c.h-2*scale));y++)for(let x=x0;x<x1;x++){const j=(y*w+x)*4;total++;if(data[j]>185&&data[j+1]>200&&data[j+2]>200)pale++;}
  if(!total||pale/total<.56)continue;
  // Validate the visible blue felt to the right. Its presence distinguishes
  // a cleared table from an unrelated window or an occluding dialog.
  let blue=0,sampled=0;
  for(let yy=-70;yy<28;yy+=3)for(let xx=140;xx<540;xx+=3){const x=Math.round(c.x+xx*scale),y=Math.round(c.y+yy*scale);if(x<0||x>=w||y<0||y>=h)continue;const j=(y*w+x)*4,r=data[j],g=data[j+1],b=data[j+2];sampled++;if(b>g*1.23&&b>r*1.35&&b>55&&g>20&&r<115)blue++;}
  if(!sampled||blue/sampled<.28)continue;
  const regions={};for(const [key,r]of Object.entries(defaults)){if(key==='round'||key==='shuffle')continue;regions[key]=clampRegion([(c.x+(r[0]*1191-147)*scale)/w,(c.y+(r[1]*985-480)*scale)/h,r[2]*1191*scale/w,r[3]*985*scale/h]);}
  // The full seven-seat playing field must fit in the source.
  if(c.x+635*scale>w+3||c.y-160*scale<0||c.y+100*scale>h+3)continue;
  // Reject alternate arrangements whose visible cards fall outside the
  // supported seat arc. Finding a dealer strip alone is insufficient.
  const cm=new Uint8Array(w*h);
  const left=Math.max(0,Math.round(c.x+110*scale)),right=Math.min(w,Math.round(c.x+630*scale));
  const top=Math.max(0,Math.round(c.y-90*scale)),bottom=Math.min(h,Math.round(c.y+135*scale));
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){const i=(y*w+x)*4;if(Math.min(data[i],data[i+1],data[i+2])>205&&Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])<45)cm[y*w+x]=1;}
  const visible=components(cm,w,h).filter(g=>g.w>12*scale&&g.w<95*scale&&g.h>26*scale&&g.h<130*scale&&g.area/(g.w*g.h)>.58);
  const misplaced=visible.filter(g=>{const x=(g.x+g.w/2)/w,y=(g.y+g.h/2)/h;return !Object.entries(regions).some(([key,r])=>key.startsWith('player')&&x>=r[0]-r[2]*.18&&x<=r[0]+r[2]*1.18&&g.y/h>=r[1]-r[3]*.15&&g.y/h<=r[1]+r[3]*.75);});
  if(misplaced.length>=2)continue;
  matches.push({regions,cardWidth:31*scale,cardHeight:50*scale,anchor:{x:c.x,y:c.y,scale},score:pale/total+blue/sampled});
 }
 matches.sort((a,b)=>b.score-a.score);
 // Never choose arbitrarily between two captured copies/tables.
 if(matches.length!==1)return {found:false,reason:matches.length?'More than one table is visible. Select the casino window only.':'Looking for the dealer panel and table…'};
 return {found:true,...matches[0]};
}
class Stabilizer{
 constructor(){this.reset();}
 reset(){this.previous=null;this.hits=0;}
 update(result){if(!result.found){this.reset();return {...result,ready:false};}const a=result.anchor,p=this.previous;const same=p&&Math.abs(a.x-p.x)<3&&Math.abs(a.y-p.y)<3&&Math.abs(a.scale-p.scale)<.035;this.hits=same?this.hits+1:1;this.previous=a;return {...result,ready:this.hits>=2};}
}
class HandCycle{
 constructor(){this.reset();}
 reset(){this.hasCards=false;this.emptySince=null;this.emptyFrames=0;this.cleared=false;}
 update({tableVisible,cardRegions,now}){
  if(!tableVisible){this.emptySince=null;this.emptyFrames=0;return 'unavailable';}
  if(cardRegions>0){const action=this.cleared?'new-hand':'cards';this.hasCards=true;this.cleared=false;this.emptySince=null;this.emptyFrames=0;return action;}
  if(!this.hasCards)return 'waiting';
  if(this.emptySince===null)this.emptySince=now;this.emptyFrames++;
  if(this.emptyFrames>=3&&now-this.emptySince>=1500)this.cleared=true;
  return this.cleared?'cleared':'clearing';
 }
}
return {locate,Stabilizer,HandCycle};
});
