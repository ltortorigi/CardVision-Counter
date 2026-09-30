// Deliberately constructed pixels made from the supplied reference, not a live split capture.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const {createCanvas,loadImage}=require(process.env.CARDVISION_CANVAS_MODULE||'@napi-rs/canvas');
const app=path.resolve(__dirname,'../../App'),CV=require(app+'/lib/core'),R=require(app+'/lib/regions'),A=require(app+'/lib/autocalibrate');
(async()=>{
 const ctx=vm.createContext({window:{},document:{createElement:()=>createCanvas(1,1)},CV,CVRegions:R,api:{ocrRanks:async items=>items.map(i=>({id:i.id,text:'',confidence:0}))}});
 for(const file of ['raster','templates','vision'])vm.runInContext(fs.readFileSync(app+'/lib/'+file+'.js','utf8'),ctx);
 const original=await loadImage(path.resolve(__dirname,'../fixtures/actual-table.png')),regions=JSON.parse(vm.runInContext('JSON.stringify(DEFAULT_REGIONS)',ctx));
 const fresh=()=>{const c=createCanvas(original.width,original.height);c.getContext('2d').drawImage(original,0,0);return c;};
 const v=vm.runInContext('new Vision(api,window.CARD_TEMPLATES)',ctx);v.geometry={cardWidth:31,cardHeight:50};
 const c=fresh(),p=c.getContext('2d');p.fillStyle='#123880';p.fillRect(466,413,79,230);p.fillStyle='white';p.fillRect(490,426,31,135);
 v.prepare(c,regions);assert.ok(v.scanRegions.player4[1]+v.scanRegions.player4[3]>.57,'Hit extends beyond original bottom');assert.equal(v.regionIssues.player4,undefined);assert.ok(!R.overlap(v.scanRegions.player4,v.scanRegions.player3));
 p.fillRect(490,426,31,225);v.prepare(c,regions);assert.match(v.regionIssues.player4,/SEARCH EDGE/);
 const overrides={player4:[...regions.player3]};v.prepare(fresh(),{...regions,...overrides});assert.match(v.regionIssues.player4,/OVERLAPPING/);assert.match(v.regionIssues.player3,/OVERLAPPING/);
 const split=fresh(),sc=split.getContext('2d');sc.fillStyle='#123880';sc.fillRect(466,413,79,154);
 // Two copies of the real Q,9 stack; their individual 19 badges are copied separately.
 for(const x of [471,509]){sc.drawImage(original,567,434,32,63,x,434,32,63);sc.drawImage(original,569,535,23,12,x+5,543,23,12);}
 regions.total4=[0,543/985,23/1191,12/985];
 const located=A.locate(sc.getImageData(0,0,split.width,split.height),regions);assert.equal(located.found,true,'Two supported split stacks retain table lock');
 v.clear();v.prepare(split,regions);assert.equal(v.regionIssues.player4,undefined);
 const observations=await v.observe(split,regions,4),o=observations.find(o=>o.key==='player4');
 assert.equal(o.splitHands?.length,2);assert.deepEqual(Array.from(o.splitHands,h=>h.cards.map(c=>c.rank).join(',')),['Q,9','Q,9']);assert.deepEqual(Array.from(o.splitHands,h=>h.total),[19,19]);assert.ok(o.splitHands.every(h=>h.cards.every(c=>c.confidence>=85)));
 const t=new CV.Tracker();const pair=[{rank:'Q',confidence:99},{rank:'Q',confidence:99}];for(let i=0;i<2;i++)t.observeFrame([{key:'player4',cards:pair,total:20}]);for(let i=0;i<8;i++)t.observeFrame([o]);assert.equal(t.history.length,4);assert.equal(t.running,-2);assert.equal(t.status['player4/1'],'VERIFIED');
 // Moving only split 1's total crop must not affect split 2's crop.
 const delta={'player4/1-total':[1,0,1,1]};v.prepare(split,regions,delta);await v.observe(split,regions,4);assert.ok(v.splitRegions['player4/1-total'][0]>v.splitBases['player4/1-total'][0]);assert.deepEqual(v.splitRegions['player4/2-total'],v.splitBases['player4/2-total']);
 console.log('PASS: real raster expansion beyond original outline, clipped-edge hold, overlapping-seat hold, retained table lock, two synthetic Q/9 stacks with independent 19 totals, pair migration to four cards without duplication, and independent draggable split-total overrides. No live split footage or OCR fallback validation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
