(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.CVRegions=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rect(r){const w=clamp(r[2],.002,1),h=clamp(r[3],.002,1);return [clamp(r[0],0,1-w),clamp(r[1],0,1-h),w,h];}
function applyOne(base,delta){return delta?rect([base[0]+delta[0]*base[2],base[1]+delta[1]*base[3],base[2]*delta[2],base[3]*delta[3]]):[...base];}
function apply(base,overrides={}){return Object.fromEntries(Object.entries(base).map(([k,r])=>[k,applyOne(r,overrides[k])]));}
function relative(base,r){return [(r[0]-base[0])/base[2],(r[1]-base[1])/base[3],r[2]/base[2],r[3]/base[3]];}
function move(r,dx,dy){return rect([r[0]+dx,r[1]+dy,r[2],r[3]]);}
function resize(r,handle,dx,dy,minW=.004,minH=.004){let [x,y,w,h]=r;const right=x+w,bottom=y+h;if(handle.includes('w'))x=clamp(x+dx,0,right-minW);if(handle.includes('n'))y=clamp(y+dy,0,bottom-minH);w=handle.includes('e')?clamp(w+dx,minW,1-x):right-x;h=handle.includes('s')?clamp(h+dy,minH,1-y):bottom-y;return [x,y,w,h];}
function fit(sw,sh,w,h){const scale=Math.min(w/sw,h/sh);return {x:(w-sw*scale)/2,y:(h-sh*scale)/2,w:sw*scale,h:sh*scale};}
function point(x,y,box){return [(x-box.x)/box.w,(y-box.y)/box.h];}
function contains(r,x,y){return x>=r[0]&&y>=r[1]&&x<=r[0]+r[2]&&y<=r[1]+r[3];}
function overlap(a,b){return Math.min(a[0]+a[2],b[0]+b[2])>Math.max(a[0],b[0])&&Math.min(a[1]+a[3],b[1]+b[3])>Math.max(a[1],b[1]);}
function union(a,b){const x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]);return [x,y,Math.max(a[0]+a[2],b[0]+b[2])-x,Math.max(a[1]+a[3],b[1]+b[3])-y];}
// Search adjacent pixels, but stop at the midpoint toward another occupied seat.
// Explicit manual overlap is flagged by the reader instead of silently assigning cards twice.
function envelope(key,regions,cw,ch,occupied=null){const r=regions[key];let left=Math.max(0,r[0]-cw*1.05),right=Math.min(1,r[0]+r[2]+cw*1.05);const center=r[0]+r[2]/2;
 for(const [other,b]of Object.entries(regions)){if(!/^player\d$/.test(other)||other===key||(occupied&&!occupied.has(other)))continue;const bc=b[0]+b[2]/2,mid=(bc+center)/2;if(bc<center)left=Math.max(left,Math.min(r[0],mid));else right=Math.min(right,Math.max(r[0]+r[2],mid));}
 const top=Math.max(0,r[1]-ch*.18),bottom=Math.min(1,r[1]+r[3]+ch*2.4);return [left,top,right-left,bottom-top];
}
function label(key){if(/^player\d\/\d-total$/.test(key))return `Seat ${key[6]} · split ${key[8]} total`;if(/^player\d\/\d$/.test(key))return `Seat ${key[6]} · split ${key[8]}`;if(/^player/.test(key))return `Seat ${key.slice(6)}`;if(/^total/.test(key))return `Seat ${key.slice(5)} total`;return {dealer:'Dealer cards',dealerTotal:'Dealer total',active:'Active hand copy',activeSeat:'Active seat number'}[key]||key;}
return {rect,applyOne,apply,relative,move,resize,fit,point,contains,overlap,union,envelope,label};
});
