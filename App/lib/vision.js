/* SportsBetting 7-seat profile, normalized to the untouched supplied browser capture.
   All crops can be adjusted without altering the live video. */
const DEFAULT_REGIONS={
 dealer:[.126,.514,.076,.064],active:[.127,.417,.077,.057],activeSeat:[.1478,.3908,.0101,.0132],
 dealerTotal:[.176,.488,.030,.019],
 player1:[.592,.337,.050,.107],total1:[.602,.466,.028,.019],
 player2:[.529,.385,.050,.115],total2:[.539,.514,.028,.019],
 player3:[.464,.427,.050,.104],total3:[.478,.543,.019,.012],
 player4:[.400,.420,.050,.111],total4:[.418,.5513,.016,.0092],
 player5:[.334,.427,.050,.104],total5:[.347,.542,.028,.019],
 player6:[.271,.385,.050,.115],total6:[.282,.514,.028,.019],
 player7:[.208,.337,.050,.107],total7:[.220,.466,.028,.019]
};
function cropCanvas(source,r,scale=1){
 const c=document.createElement('canvas');const x=Math.round(r[0]*source.width),y=Math.round(r[1]*source.height),w=Math.max(1,Math.round(r[2]*source.width)),h=Math.max(1,Math.round(r[3]*source.height));
 c.width=Math.round(w*scale);c.height=Math.round(h*scale);c.getContext('2d').drawImage(source,x,y,w,h,0,0,c.width,c.height);return c;
}
function imageHash(c){const d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data;let hash=2166136261;for(let i=0;i<d.length;i+=4){hash=Math.imul(hash^(d[i]>>3),16777619);hash=Math.imul(hash^(d[i+1]>>3),16777619);hash=Math.imul(hash^(d[i+2]>>3),16777619);}return hash>>>0;}
function glyphVector(canvas){
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),{data}=ctx.getImageData(0,0,canvas.width,canvas.height),w=canvas.width,h=canvas.height;
 const mask=new Uint8Array(w*h);let minX=w,minY=h,maxX=-1,maxY=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];if((r<150&&g<150&&b<150)||(r>110&&r>g*1.35&&r>b*1.35)){mask[y*w+x]=1;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
 if(maxX<minX)return null;
 const v=[];for(let y=0;y<24;y++)for(let x=0;x<16;x++){const sx=minX+Math.min(maxX-minX,Math.floor(x*(maxX-minX+1)/16)),sy=minY+Math.min(maxY-minY,Math.floor(y*(maxY-minY+1)/24));v.push(mask[sy*w+sx]);}return v;
}
class Vision {
 constructor(api,templates){this.api=api;this.templates=templates;this.cache=new Map();this.geometry=null;this.scanRegions={};this.searchRegions={};this.regionIssues={};this.splitRegions={};this.splitBases={};this.overrides={};}
 clear(){this.cache.clear();this.splitRegions={};this.splitBases={};}
 prepare(source,regions,overrides={}){
  this.overrides=overrides;this.scanRegions=JSON.parse(JSON.stringify(regions));this.searchRegions={};this.regionIssues={};this.splitRegions={};this.splitBases={};
  const cw=(this.geometry?.cardWidth||source.width*.026)/source.width,ch=(this.geometry?.cardHeight||source.height*.051)/source.height;
  const playerKeys=Object.keys(regions).filter(k=>/^player\d$/.test(k));
  const occupied=new Set(playerKeys.filter(key=>this.raster(source,regions[key],key).groups.length));
  for(const key of playerKeys){
   const r=regions[key],search=CVRegions.envelope(key,regions,cw,ch,occupied);this.searchRegions[key]=search;
   const {c,groups}=this.raster(source,search,key),x0=Math.round(search[0]*source.width),y0=Math.round(search[1]*source.height);
   const found=groups.map(g=>({g,r:[(x0+g.x)/source.width,(y0+g.y)/source.height,g.w/source.width,g.h/source.height]}));
   const seed=found.filter(v=>CVRegions.overlap(r,v.r));
   if(seed.length){const top=Math.min(...seed.map(v=>v.r[1])),bottom=Math.max(...seed.map(v=>v.r[1]+v.r[3]));
    const relevant=found.filter(v=>v.r[1]<=bottom+ch*.35 && v.r[1]+v.r[3]>=top-ch*.35);
    let expanded=[...r];for(const v of relevant){expanded=CVRegions.union(expanded,v.r);if(v.g.x<=1||v.g.x+v.g.w>=c.width-1||v.g.y<=1||v.g.y+v.g.h>=c.height-1)this.regionIssues[key]='CARDS AT SEARCH EDGE — RESIZE OUTLINE';}
    const pad=2/source.width,py=2/source.height;const left=Math.max(search[0],expanded[0]-pad),top2=Math.max(search[1],expanded[1]-py),right=Math.min(search[0]+search[2],expanded[0]+expanded[2]+pad),bottom2=Math.min(search[1]+search[3],expanded[1]+expanded[3]+py);
    this.scanRegions[key]=[left,top2,right-left,bottom2-top2];
   }
  }
  const players=playerKeys.filter(key=>this.raster(source,this.scanRegions[key],key).groups.length);
  for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++)if(CVRegions.overlap(this.scanRegions[players[i]],this.scanRegions[players[j]])){
   this.regionIssues[players[i]]=this.regionIssues[players[j]]='OVERLAPPING SEATS — ADJUST OUTLINES';
  }
  return this.scanRegions;
 }
 async readText(source,r,key,mode='number'){
  const crop=cropCanvas(source,r,3),hash=imageHash(crop),old=this.cache.get(key);
  const c=document.createElement('canvas');c.width=crop.width+24;c.height=crop.height+24;const pc=c.getContext('2d');pc.fillStyle='white';pc.fillRect(0,0,c.width,c.height);
  if(mode==='number'){const ic=crop.getContext('2d'),im=ic.getImageData(0,0,crop.width,crop.height),brightness=[];for(let i=0;i<im.data.length;i+=4)brightness.push((im.data[i]+im.data[i+1]+im.data[i+2])/3);brightness.sort((a,b)=>a-b);const light=brightness[Math.floor(brightness.length/2)]>110;for(let i=0;i<im.data.length;i+=4){const a=(im.data[i]+im.data[i+1]+im.data[i+2])/3;const ink=light?a<100:a>170;im.data[i]=im.data[i+1]=im.data[i+2]=ink?0:255;}ic.putImageData(im,0,0);}
  pc.drawImage(crop,12,12);
  if(mode==='number'){const vector=glyphVector(crop);this.onText?.(key,vector);if(vector){const scores=(window.TEXT_TEMPLATES||[]).map(t=>({text:t.text,score:1-vector.reduce((s,n,j)=>s+Math.abs(n-t.vector[j]),0)/vector.length})).sort((a,b)=>b.score-a.score);if(scores[0]?.score>=.97 && scores[0].score-(scores.find(t=>t.text!==scores[0].text)?.score||0)>=.025){const value={text:scores[0].text,confidence:Math.round(scores[0].score*100)};this.cache.set(key,{hash,value});return value;}}}
  if(old?.hash===hash && old.value.confidence>=85)return old.value;
  const [v]=await this.api.ocrRanks([{id:key,mode,dataUrl:c.toDataURL('image/png')}]);const value=v||{text:'',confidence:0};this.cache.set(key,{hash,value});return value;
 }
 raster(source,r,key){
  const c=cropCanvas(source,r);
  const ctx=c.getContext('2d',{willReadFrequently:true}),w=c.width,h=c.height,d=ctx.getImageData(0,0,w,h).data,mask=new Uint8Array(w*h);
  for(let i=0;i<mask.length;i++){const a=i*4,lo=Math.min(d[a],d[a+1],d[a+2]),hi=Math.max(d[a],d[a+1],d[a+2]);if(lo>205&&hi-lo<45)mask[i]=1;}
  const baseW=this.geometry?.cardWidth||source.width*.026,baseH=this.geometry?.cardHeight||source.height*.051;
  let groups=smallComponents(mask,w,h).filter(g=>g.w>baseW*.25&&g.h>baseH*.55&&g.area/(g.w*g.h)>.58).sort((a,b)=>a.x-b.x);
  if(key==='active' && groups.length>1){const x=Math.min(...groups.map(g=>g.x)),y=Math.min(...groups.map(g=>g.y)),right=Math.max(...groups.map(g=>g.x+g.w)),bottom=Math.max(...groups.map(g=>g.y+g.h));groups=[{x,y,w:right-x,h:bottom-y}];}
  return {c,baseW,baseH,groups};
 }
 presence(source,regions){let count=0;for(const key of ['dealer',...Array.from({length:7},(_,i)=>`player${i+1}`)]){if(this.raster(source,regions[key],key).groups.length)count++;}return count;}
 async readHand(source,r,key){
  const c=cropCanvas(source,r),hash=imageHash(c),old=this.cache.get(key);
  if(old?.hash===hash && old.value.cards.length && old.value.cards.every(x=>x.confidence>=85))return old.value;
  const {baseW,baseH,groups}=this.raster(source,r,key);
  const items=[];let ambiguous=groups.length>1 && key.startsWith('player');
  for(const g of groups){
   const horizontal=g.w>baseW*1.4;
   const count=Math.max(1,Math.min(10,1+Math.round(horizontal?(g.w-baseW)/(baseW*.52):(g.h-baseH)/(baseH*.30))));
   for(let i=0;i<count;i++){
    const gx=horizontal?g.x+i*(g.w-baseW)/Math.max(1,count-1):g.x;
    const gy=horizontal||i===0?g.y:g.y+baseH+(i-1)*(g.h-baseH)/Math.max(1,count-1);
    const exposed=!horizontal&&i>0;
    const rect=exposed?{x:gx+baseW*.57,y:gy,w:baseW*.40,h:Math.min(baseH*.30,g.y+g.h-gy)}:{x:gx+1,y:gy+1,w:baseW*.43,h:baseH*.30};
    const glyph=document.createElement('canvas');glyph.width=Math.max(2,Math.round(rect.w));glyph.height=Math.max(2,Math.round(rect.h));glyph.getContext('2d').drawImage(c,rect.x,rect.y,rect.w,rect.h,0,0,glyph.width,glyph.height);
    const vector=glyphVector(glyph);if(!vector)continue;this.onGlyph?.(`${key}:${items.length}`,vector);
    const scores=this.templates.map(t=>({rank:t.rank,score:1-vector.reduce((s,n,j)=>s+Math.abs(n-t.vector[j]),0)/vector.length})).sort((a,b)=>b.score-a.score);
    const best=scores[0],second=scores.find(x=>x.rank!==best?.rank);
    const match=best?.score>=.93&&best.score-(second?.score||0)>=.035;
    const enlarged=document.createElement('canvas');enlarged.width=80;enlarged.height=100;const ec=enlarged.getContext('2d');ec.fillStyle='#fff';ec.fillRect(0,0,80,100);ec.drawImage(glyph,12,12,56,76);
    // Only exposed, confidently matching suit glyphs are named.
    let suit='?';if(!exposed){const sc=document.createElement('canvas');sc.width=Math.round(baseW*.43);sc.height=Math.round(baseH*.38);sc.getContext('2d').drawImage(c,gx+2,gy+baseH*.32,baseW*.43,baseH*.38,0,0,sc.width,sc.height);const sv=glyphVector(sc);if(sv){this.onSuit?.(`${key}:${items.length}`,sv);const ss=(window.SUIT_TEMPLATES||[]).map(t=>({suit:t.suit,score:1-sv.reduce((n,x,j)=>n+Math.abs(x-t.vector[j]),0)/sv.length})).sort((a,b)=>b.score-a.score);if(ss[0]?.score>=.95&&ss[0].score-(ss.find(t=>t.suit!==ss[0].suit)?.score||0)>=.04)suit=ss[0].suit;}}
    items.push({id:`${key}:${items.length}`,rank:match?best.rank:null,confidence:match?Math.round(best.score*100):0,suit,dataUrl:enlarged.toDataURL('image/png'),mode:'rank'});
   }
  }
  const ocr=items.filter(x=>!x.rank);
  if(ocr.length){const result=await this.api.ocrRanks(ocr);for(const item of ocr){const v=result.find(x=>x.id===item.id),rank=String(v?.text||'').toUpperCase().replace(/\s/g,'');if(CV.ranks.includes(rank)){item.rank=rank;item.confidence=v.confidence;}}}
  const cards=items.filter(x=>x.rank).map(({rank,suit,confidence})=>({rank,suit,confidence}));
  if(key==='active')cards.reverse();
  if(cards.length!==items.length || ambiguous)cards.forEach(x=>x.confidence=0);
  const value={cards,groups:groups.length,ambiguous};this.cache.set(key,{hash,value});return value;
 }
 async observe(source,regions,mySeat,callback){
  const configured=regions;regions=this.scanRegions.player1?this.scanRegions:regions;
  const seatText=await this.readText(source,regions.activeSeat,'activeSeat');
  const activeSeat=seatText.confidence>=80?Number(seatText.text.match(/[1-7]/)?.[0]):null;
  const active=activeSeat?await this.readHand(source,regions.active,'active'):{cards:[]};
  const keys=[`player${mySeat}`,'dealer',...Array.from({length:7},(_,i)=>`player${i+1}`).filter(k=>k!==`player${mySeat}`)];
  const observations=[];
  for(const key of keys){
   const hand=await this.readHand(source,regions[key],key);let total=null;
   if(hand.cards.length && key!=='dealer'){
    const t=await this.readText(source,regions['total'+key.slice(6)],'total'+key.slice(6));
    const match=t.text.trim().match(/^\d{1,2}(?:\/\d{1,2})?$/);if(match&&t.confidence>=80)total=Number(t.text.split('/').pop());
   }
   let splitHands=null;
   if(hand.groups===2 && /^player\d$/.test(key) && !this.regionIssues[key]){
    const r=regions[key],{groups}=this.raster(source,r,key),totalBase=configured['total'+key.slice(6)],x0=Math.round(r[0]*source.width),y0=Math.round(r[1]*source.height);
    splitHands=[];
    for(let i=0;i<groups.length;i++){
     const g=groups[i],childKey=key+'/'+(i+1),child=CVRegions.rect([(x0+g.x-1)/source.width,(y0+g.y-1)/source.height,(g.w+2)/source.width,(g.h+2)/source.height]);
     // Each separated stack must have its own displayed total. The guessed badge
     // crop can be moved directly on the live feed; no shared parent total is used.
     const totalKey=childKey+'-total',base=CVRegions.rect([child[0]+child[2]/2-totalBase[2]/2,totalBase[1],totalBase[2],totalBase[3]]);
     const tr=CVRegions.applyOne(base,this.overrides[totalKey]);this.splitBases[totalKey]=base;this.splitRegions[childKey]=child;this.splitRegions[totalKey]=tr;
     const h=await this.readHand(source,child,childKey),t=await this.readText(source,tr,totalKey),match=t.text.trim().match(/^\d{1,2}(?:\/\d{1,2})?$/);
     splitHands.push({key:childKey,cards:h.cards,total:match&&t.confidence>=80?Number(t.text.split('/').pop()):null,ambiguous:h.ambiguous});
    }
    if(CVRegions.overlap(this.splitRegions[key+'/1-total'],this.splitRegions[key+'/2-total']))this.regionIssues[key]='SPLIT TOTAL BOXES OVERLAP — ADJUST OUTLINES';
   }
   const observation={key,cards:hand.cards,total,activeSeat,activeCards:active.cards,ambiguous:hand.ambiguous,splitHands,issue:this.regionIssues[key]};
   observations.push(observation);if(callback)callback([observation]);
  }
  return observations;
 }
}
