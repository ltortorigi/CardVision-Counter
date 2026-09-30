const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const {createCanvas,loadImage}=require(process.env.CARDVISION_CANVAS_MODULE||'@napi-rs/canvas');
const app=path.resolve(__dirname,'../../App'),A=require(app+'/lib/autocalibrate'),C=require(app+'/lib/core');
const ctx=vm.createContext({window:{},document:{createElement:()=>createCanvas(1,1)},Uint8Array,Int32Array,CV:C,CVRegions:require(app+'/lib/regions'),api:{ocrRanks:async items=>items.map(i=>({id:i.id,text:'',confidence:0}))}});
for(const n of ['raster','templates','vision'])vm.runInContext(fs.readFileSync(app+'/lib/'+n+'.js','utf8'),ctx);
const regions=vm.runInContext('DEFAULT_REGIONS',ctx);
const inspect=c=>A.locate(c.getContext('2d').getImageData(0,0,c.width,c.height),regions);
const contains=(r,x,y,w,h)=>x/w>=r[0]&&x/w<=r[0]+r[2]&&y/h>=r[1]&&y/h<=r[1]+r[3];
(async()=>{
 const reference=await loadImage(path.resolve(__dirname,'../fixtures/actual-table.png'));let checks=0;
 for(const [scale,padX,padY] of [[1,0,0],[.75,80,30],[1.25,30,60],[1.5,50,20]]){
  const c=createCanvas(Math.ceil(reference.width*scale+padX+20),Math.ceil(reference.height*scale+padY+20));c.getContext('2d').drawImage(reference,padX,padY,reference.width*scale,reference.height*scale);
  const r=inspect(c);assert.equal(r.found,true,`Detection at scale ${scale}`);assert.ok(contains(r.regions.player4,padX+506*scale,padY+465*scale,c.width,c.height));assert.ok(contains(r.regions.player3,padX+582*scale,padY+465*scale,c.width,c.height));assert.ok(contains(r.regions.dealer,padX+217*scale,padY+537*scale,c.width,c.height));assert.equal('round' in r.regions,false);assert.equal('shuffle' in r.regions,false);checks++;
 }
 const im=await loadImage(path.resolve(__dirname,'../fixtures/resized-table.png'));const c=createCanvas(im.width,im.height);c.getContext('2d').drawImage(im,0,0);const r=inspect(c);assert.equal(r.found,true);assert.ok(contains(r.regions.player5,306,250,c.width,c.height));assert.ok(contains(r.regions.player2,450,248,c.width,c.height));assert.ok(contains(r.regions.dealer,175,305,c.width,c.height));checks++;
 const blank=createCanvas(1280,720);assert.equal(inspect(blank).found,false);checks++;
 const alt=await loadImage(path.resolve(__dirname,'../fixtures/alternate-layout.png')),ac=createCanvas(alt.width,alt.height);ac.getContext('2d').drawImage(alt,0,0);assert.equal(inspect(ac).found,false);checks++;
 // Full reference auto-locate -> geometry -> recognizer -> ledger integration.
 const original=createCanvas(reference.width,reference.height);original.getContext('2d').drawImage(reference,0,0);ctx.source=original;ctx.layout=inspect(original);
 const obs=await vm.runInContext('(async()=>{const v=new Vision(api,window.CARD_TEMPLATES);v.geometry=layout;return v.observe(source,layout.regions,4)})()',ctx);const t=new C.Tracker();t.observeFrame(obs);t.observeFrame(obs);assert.equal(t.history.length,6);assert.equal(t.running,-2);checks++;
 console.log(JSON.stringify({result:'PASS',checks,original:'automatic alignment and six unique cards; RC -2',transforms:'0.75x, 1x, 1.25x, 1.5x plus translated/padded captures',userScreenshot:'dealer and occupied seats 2/5 inside automatically aligned regions; no manual rectangles',blank:'rejected',unsupportedFourSeat:'rejected',note:'Screenshot alignment regression checks, not live desktop or broad recognition accuracy tests.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
