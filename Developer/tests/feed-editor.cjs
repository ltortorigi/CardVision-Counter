// Production pointer handlers and canvas rendering with a minimal event surface.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {createCanvas,loadImage}=require(process.env.CARDVISION_CANVAS_MODULE||'@napi-rs/canvas'),R=require('../../App/lib/regions');
const app=path.resolve(__dirname,'../../App'),canvas=createCanvas(1,1),listeners={};let captured=null,changes=0;
canvas.style={};canvas.parentElement={};canvas.addEventListener=(n,f)=>listeners[n]=f;canvas.getBoundingClientRect=()=>({left:10,top:20,width:600,height:400});canvas.setPointerCapture=id=>captured=id;canvas.hasPointerCapture=id=>id===captured;canvas.releasePointerCapture=()=>captured=null;canvas.focus=()=>{};
const model={width:1200,height:600,editing:true,visible:true,regions:{player4:[.2,.2,.1,.2]},search:{},issues:{}};
const ctx=vm.createContext({window:{devicePixelRatio:2},CVRegions:R,canvas,model,onChange:(k,r)=>{model.regions[k]=r;changes++;}});vm.runInContext(fs.readFileSync(app+'/lib/feed-editor.js','utf8'),ctx);const editor=vm.runInContext('new FeedEditor(canvas,()=>model,onChange,()=>{})',ctx);editor.draw();assert.equal(canvas.width,1200);assert.equal(canvas.height,800);
const event=(x,y,more={})=>({clientX:10+x,clientY:20+y,button:0,pointerId:1,preventDefault(){},...more});
// Source 1200x600 is letterboxed to 600x300, with 50px above and below.
listeners.pointerdown(event(150,140));assert.equal(captured,1);listeners.pointermove(event(180,170));listeners.pointerup(event(180,170));assert.ok(Math.abs(model.regions.player4[0]-.25)<1e-9);assert.ok(Math.abs(model.regions.player4[1]-.3)<1e-9);
listeners.pointerdown(event(210,200));listeners.pointermove(event(240,230));listeners.pointerup(event(240,230));assert.ok(Math.abs(model.regions.player4[2]-.15)<1e-9);assert.ok(Math.abs(model.regions.player4[3]-.3)<1e-9);
const before=[...model.regions.player4];listeners.pointerdown(event(185,185));listeners.pointermove(event(300,250));listeners.pointercancel(event(300,250));assert.deepEqual(Array.from(model.regions.player4),before);
listeners.keydown({key:'ArrowRight',shiftKey:true,preventDefault(){}});assert.ok(Math.abs(model.regions.player4[0]-before[0]-10/1200)<1e-9);
model.editing=false;const count=changes;listeners.pointerdown(event(180,170));listeners.pointermove(event(300,200));assert.equal(changes,count);
(async()=>{const im=await loadImage(path.resolve(__dirname,'../fixtures/actual-table.png'));const source=createCanvas(im.width,im.height);source.getContext('2d').drawImage(im,0,0);
 const vctx=vm.createContext({window:{},document:{createElement:()=>createCanvas(1,1)},CVRegions:R});for(const file of ['raster','vision'])vm.runInContext(fs.readFileSync(app+'/lib/'+file+'.js','utf8'),vctx);const v=vm.runInContext('new Vision({},[])',vctx),regions=vm.runInContext('DEFAULT_REGIONS',vctx);v.prepare(source,regions);
 Object.assign(model,{width:im.width,height:im.height,regions:v.scanRegions,search:v.searchRegions,issues:v.regionIssues});canvas.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:650});ctx.window.devicePixelRatio=1;editor.draw();const output=createCanvas(1000,650),p=output.getContext('2d'),fit=R.fit(im.width,im.height,1000,650);p.fillStyle='#0b121b';p.fillRect(0,0,1000,650);p.drawImage(im,fit.x,fit.y,fit.w,fit.h);p.drawImage(canvas,0,0);fs.writeFileSync(path.resolve(__dirname,'../previews/Live-Feed-Outlines.png'),output.toBuffer('image/png'));
 console.log('PASS: actual pointer drag, southeast resize, pointer cancellation, keyboard nudge, view-only non-interaction, letterbox mapping, high-DPI canvas, and production outline rendering. Native browser event delivery and live capture remain untested.');
})().catch(e=>{console.error(e);process.exitCode=1;});
