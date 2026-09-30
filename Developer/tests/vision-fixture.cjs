// Real production raster/vision modules on the supplied training/reference image.
// Needs @napi-rs/canvas in the module path. This is not an independent accuracy benchmark.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const {createCanvas,loadImage}=require(process.env.CARDVISION_CANVAS_MODULE||'@napi-rs/canvas');
const app=path.resolve(__dirname,'../../App'),C=require(path.join(app,'lib/core.js'));
(async()=>{
 let ocrCalls=0;const api={ocrRanks:async items=>{ocrCalls+=items.length;return items.map(i=>({id:i.id,text:'',confidence:0}));}};
 const context=vm.createContext({window:{},document:{createElement:()=>createCanvas(1,1)},Uint8Array,Int32Array,console,CV:C,CVRegions:require(app+'/lib/regions'),api});
 for(const file of ['raster','templates','vision'])vm.runInContext(fs.readFileSync(path.join(app,'lib',file+'.js'),'utf8'),context);
 const image=await loadImage(path.resolve(__dirname,'../fixtures/actual-table.png'));
 const source=createCanvas(image.width,image.height);source.getContext('2d').drawImage(image,0,0);context.source=source;
 const start=performance.now();const observations=await vm.runInContext('(new Vision(api,window.CARD_TEMPLATES)).observe(source,DEFAULT_REGIONS,4)',context);
 const t=new C.Tracker();t.observeFrame(observations);t.observeFrame(observations);
 assert.equal(t.history.length,6);assert.equal(t.running,-2);assert.equal(t.hands.player4.map(c=>c.rank).join(','),'A,Q,3');assert.equal(t.hands.player3.map(c=>c.rank).join(','),'Q,9');assert.equal(t.hands.dealer[0].rank,'8');assert.equal(t.status.player4,'VERIFIED');assert.equal(t.status.player3,'VERIFIED');assert.equal(C.recommendMove(t.hands.player4,8,t.tc,t.running,{soft17:'H17'}).action,'HIT');
 for(let i=0;i<10;i++)t.observeFrame(observations);assert.equal(t.history.length,6);
 const p4=observations.find(o=>o.key==='player4');assert.equal(p4.total,14);assert.equal(p4.activeSeat,4);assert.equal(p4.activeCards.map(c=>c.rank).join(','),'A,Q,3');
 const blank=createCanvas(image.width,image.height);blank.getContext('2d').fillStyle='#202c34';blank.getContext('2d').fillRect(0,0,blank.width,blank.height);context.blank=blank;
 const empty=await vm.runInContext('(new Vision(api,window.CARD_TEMPLATES)).observe(blank,DEFAULT_REGIONS,4)',context);assert.ok(empty.every(o=>!o.cards.length));
 console.log(JSON.stringify({result:'PASS',reference:'actual-table.png (template training fixture)',cards:t.history.length,runningCount:t.running,seat4:'A Q 3 = 14 VERIFIED',seat3:'Q 9 = 19 VERIFIED',dealer:'8',activePanel:'A Q 3; no double count',blank:'no cards',elapsedMs:Math.round(performance.now()-start),ocrFallbackRequests:ocrCalls,note:'OCR fallback intentionally returns no read; this test validates templates, segmentation and count integration on their reference fixture, not OCR or live speed.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
