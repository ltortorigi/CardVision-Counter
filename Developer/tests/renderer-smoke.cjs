// Logic/startup smoke test with DOM stubs; deliberately not a browser/layout test.
const vm=require('vm'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const app=path.resolve(__dirname,'../../App'),html=fs.readFileSync(path.join(app,'index.html'),'utf8'),elements=new Map();
class Element{
 constructor(id){this.id=id;this.value='';this.checked=false;this.hidden=false;this.dataset={};this.options=[];this.classList={toggle(){}};this.style={};this.innerHTML='';this.textContent='';}
 add(x){this.options.push(x);if(!this.value)this.value=x.value;}
 replaceChildren(...xs){this.options=xs;this.value=xs[0]?.value||'';}
 querySelectorAll(){return [];}querySelector(){return {remove(){}};}
 addEventListener(){}showModal(){this.open=true;}close(){this.open=false;}click(){this.onclick?.();}
}
for(const m of html.matchAll(/id="([^"]+)"/g))elements.set(m[1],new Element(m[1]));
const document={getElementById:id=>{assert.ok(elements.has(id),'Missing element '+id);return elements.get(id);},body:{classList:{toggle(){}}},querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){}};
const storage={getItem:()=>null,setItem(){}};
const api={getSources:async()=>[{id:'test',name:'test'}],warmOcr:async()=>({}),overlayData(){},ocrRanks:async()=>[],exportSession:async d=>{api.exported=d;return {saved:true};}};
const context=vm.createContext({console,window:{cardvision:api},document,localStorage:storage,Option:function(text,value){return {text,value};},CV:require(path.join(app,'lib/core.js')),CVAuto:require(path.join(app,'lib/autocalibrate.js')),CVRegions:require(path.join(app,'lib/regions.js')),DEFAULT_REGIONS:{dealer:[0,0,1,1]},Vision:class{clear(){}},setTimeout:()=>0,clearTimeout(){},performance,confirm:()=>true});
if(process.env.CARDVISION_CANVAS_MODULE){const {createCanvas}=require(process.env.CARDVISION_CANVAS_MODULE);document.createElement=()=>createCanvas(1,1);for(const name of ['raster','templates','vision'])vm.runInContext(fs.readFileSync(path.join(app,'lib',name+'.js'),'utf8'),context);}
vm.runInContext(fs.readFileSync(path.join(app,'lib/feed-editor.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(app,'renderer.js'),'utf8'),context);
(async()=>{await Promise.resolve();assert.equal(elements.get('recommendedMove').textContent,'WAITING');assert.equal(elements.get('settingsDialog').open,true);
 vm.runInContext("tracker.setManual('player4',[{rank:'A',suit:'♣'},{rank:'Q',suit:'♦'},{rank:'3',suit:'♣'}]);tracker.setManual('dealer',[{rank:'8',suit:'♠'}]);render();",context);
 assert.equal(elements.get('recommendedMove').textContent,'HIT');assert.equal(String(elements.get('runningCount').textContent),'-1');
 vm.runInContext("exportSession('json')",context);await Promise.resolve();const out=JSON.parse(api.exported.text);assert.equal(out.ledger.length,4);assert.equal(out.events.length,2);
 vm.runInContext("undo()",context);assert.equal(elements.get('recommendedMove').textContent,'VERIFYING HAND...');
 if(process.env.CARDVISION_CANVAS_MODULE){const {createCanvas,loadImage}=require(process.env.CARDVISION_CANVAS_MODULE);const im=await loadImage(path.join(app,'../Developer/fixtures/actual-table.png'));Object.defineProperty(im,'naturalWidth',{value:im.width});Object.defineProperty(im,'naturalHeight',{value:im.height});elements.set('fixtureImage',im);elements.set('captureCanvas',createCanvas(1,1));vm.runInContext('tracker=new CV.Tracker(6);fixture=true;ocrReady=true;profile.calibrated=false;autoLocator.reset();handCycle.reset();',context);for(let i=0;i<3;i++)await vm.runInContext('scanOnce()',context);assert.equal(elements.get('tableStatus').textContent,'TABLE: AUTO-ALIGNED');assert.equal(String(elements.get('cardsSeen').textContent),'6');assert.equal(String(elements.get('runningCount').textContent),'-2');vm.runInContext("startOutlineEdit();const base=baseRegions.player4;profile.regionOverrides.player4=CVRegions.relative(base,CVRegions.move(base,.003,0));profile.regions=CVRegions.apply(baseRegions,profile.regionOverrides);finishOutlineEdit();",context);assert.ok(vm.runInContext('Math.abs(vision.scanRegions.player4[0]-profile.regions.player4[0])<1e-8',context));await vm.runInContext('scanOnce()',context);assert.ok(vm.runInContext('Math.abs(profile.regions.player4[0]-baseRegions.player4[0]-.003)<1e-8',context));vm.runInContext("startOutlineEdit();profile.regionOverrides.player4=[1,1,2,2];finishOutlineEdit(true);",context);assert.ok(vm.runInContext('Math.abs(profile.regions.player4[0]-baseRegions.player4[0]-.003)<1e-8',context));assert.equal(String(elements.get('cardsSeen').textContent),'6');console.log('PASS: renderer edit/apply/cancel retains count, preserves saved offsets after automatic realignment, and does not discard adjustments.');console.log('PASS: actual scanOnce automatically aligns an uncalibrated profile and counts six unique fixture cards in three scans.');}
 console.log('PASS: real renderer initialization, element IDs, setup dialog, selected recommendation, JSON export and undo using DOM stubs. No browser/layout or Electron IPC validation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
