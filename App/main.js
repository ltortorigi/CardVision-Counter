const {app,BrowserWindow,desktopCapturer,ipcMain,dialog,shell,systemPreferences}=require('electron');
const path=require('path');
const fs=require('fs/promises');
const https=require('https');
const {createWorker}=require('tesseract.js');
let win,overlay,workersPromise,ocrQueue=Promise.resolve();
const repo='https://github.com/ltortorigi/CardVision-Counter';
const appIcon=path.join(__dirname,'assets',process.platform==='darwin'?'mac_chip.png':'windows_chip.png');
async function workers(){
 if(!workersPromise) workersPromise=Promise.all([0,1].map(()=>createWorker('eng',1,{cachePath:app.getPath('userData')}))).catch(e=>{workersPromise=null;throw e;});
 return workersPromise;
}
async function recognize(items){
 const pool=await workers();
 const groups=await Promise.all(pool.map(async(worker,i)=>{
  const out=[];
  for(const item of items.filter((_,n)=>n%pool.length===i)){
   try{
    const mode=item.mode||'rank';
    await worker.setParameters({tessedit_char_whitelist:mode==='rank'?'0123456789AJQK':mode==='number'?'0123456789/':mode==='round'?'0123456789X':'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ',tessedit_pageseg_mode:mode==='rank'?'10':'7'});
    const result=await worker.recognize(item.dataUrl);
    out.push({id:item.id,text:result.data.text.trim(),confidence:result.data.confidence});
   }catch(e){out.push({id:item.id,text:'',confidence:0,error:e.message});}
  }return out;
 }));return groups.flat();
}
function secure(w){w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',e=>e.preventDefault());}
function createWindow(){
 win=new BrowserWindow({width:1440,height:900,minWidth:1000,minHeight:650,backgroundColor:'#09121d',icon:appIcon,title:'CardVision Counter — Development',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false}});
 secure(win);win.loadFile('index.html');win.on('closed',()=>{overlay?.close();win=null;});
}
ipcMain.handle('desktop-sources',async()=> (await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:240,height:135}})).filter(s=>!s.name.startsWith('CardVision')).map(s=>({id:s.id,name:s.name})));
ipcMain.handle('warm-ocr',async()=>{await workers();return {ready:true};});
ipcMain.handle('ocr-ranks',(_e,items)=>{
 if(!Array.isArray(items)||items.length>100||items.some(i=>!/^data:image\/png;base64,/.test(i.dataUrl)||i.dataUrl.length>2e6))throw Error('Invalid cropped image batch.');
 const task=ocrQueue.then(()=>recognize(items));ocrQueue=task.catch(()=>{});return task;
});
ipcMain.handle('toggle-overlay',()=>{
 if(overlay&&!overlay.isDestroyed()){overlay.close();overlay=null;return false;}
 overlay=new BrowserWindow({width:310,height:390,resizable:true,alwaysOnTop:true,title:'CardVision Overlay',icon:appIcon,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'overlay-preload.js'),contextIsolation:true,nodeIntegration:false}});
 secure(overlay);overlay.loadFile('overlay.html');overlay.on('closed',()=>{overlay=null;});return true;
});
ipcMain.on('overlay-data',(_e,data)=>{if(overlay&&!overlay.isDestroyed())overlay.webContents.send('overlay-data',data);});
ipcMain.handle('export-session',async(_e,{format,text})=>{
 if(!['csv','json'].includes(format)||typeof text!=='string'||text.length>10e6)throw Error('Invalid export.');
 const result=await dialog.showSaveDialog(win,{defaultPath:`CardVision-session.${format}`,filters:[{name:format.toUpperCase(),extensions:[format]}]});
 if(result.canceled)return {canceled:true};await fs.writeFile(result.filePath,text,'utf8');return {saved:true};
});
ipcMain.handle('diagnostics',()=>({version:app.getVersion(),electron:process.versions.electron,node:process.versions.node,platform:process.platform,capturePermission:process.platform==='darwin'?systemPreferences.getMediaAccessStatus('screen'):'Check Connect for capture access',ocr:workersPromise?'Initialized or initializing':'Not loaded',privacy:'Cropped images are recognized on this computer. First OCR startup downloads English language data; update checks contact GitHub. No screenshot uploads or automatic screenshot storage.'}));
ipcMain.handle('open-project',(_e,section)=>shell.openExternal(repo+({releases:'/releases',issues:'/issues',docs:'#readme'}[section]||'')));
ipcMain.handle('check-updates',()=>new Promise(resolve=>{
 const request=https.get('https://api.github.com/repos/ltortorigi/CardVision-Counter/releases/latest',{headers:{'User-Agent':'CardVision-Counter','Accept':'application/vnd.github+json'}},res=>{
  let body='';res.on('data',d=>{body+=d;if(body.length>1e6)request.destroy();});res.on('end',()=>{
   try{if(res.statusCode!==200)throw Error(`GitHub returned ${res.statusCode}. View releases manually.`);const j=JSON.parse(body),current=app.getVersion();const parse=s=>String(s).replace(/^v/,'').split(/[.-]/).slice(0,3).map(Number);const a=parse(j.tag_name),b=parse(current);let newer=false;for(let i=0;i<3;i++){if(a[i]!==b[i]){newer=a[i]>b[i];break;}}if(a.join('.')===b.join('.')&&current.includes('-')&&!String(j.tag_name).includes('-'))newer=true;resolve({current,latest:j.tag_name,newer});}catch(e){resolve({error:e.message});}
  });
 });request.setTimeout(10000,()=>request.destroy(Error('Update check timed out.')));request.on('error',e=>resolve({error:e.message}));
}));
app.whenReady().then(()=>{if(process.platform==='darwin')app.dock?.setIcon(appIcon);createWindow();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',()=>{workersPromise?.then(ws=>ws.forEach(w=>w.terminate())).catch(()=>{});});
app.on('activate',()=>{if(!win)createWindow();});
