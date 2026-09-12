const {app,BrowserWindow,Menu,dialog}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {startServer}=require('./server.cjs');
let server,origin,window;
const smoke=process.argv.includes('--smoke-test');
app.setName('Paper Voice');
if(!app.requestSingleInstanceLock()){app.quit();}else{
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
 async function openWindow(){
  window=new BrowserWindow({width:1280,height:920,minWidth:640,minHeight:600,title:'Paper Voice',backgroundColor:'#101722',show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});
  window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  window.once('ready-to-show',()=>{if(!smoke)window.show();});
  window.on('closed',()=>{window=null;});
  await window.loadURL(origin);
  if(smoke){const health=await fetch(origin+'/api/speech').then(r=>r.json());const asset=await fetch(origin+'/pdf.worker.min.mjs');fs.writeFileSync(path.join(app.getPath('userData'),'smoke-test.json'),JSON.stringify({loaded:true,configured:Object.fromEntries((health.providers||[]).map(p=>[p.id,p.configured])),workerStatus:asset.status,packaged:app.isPackaged}));app.quit();}
 }
 app.whenReady().then(async()=>{
  const portFile=path.join(app.getPath('userData'),'local-port.json');let port=0;try{port=JSON.parse(fs.readFileSync(portFile,'utf8')).port;}catch{}
  const backend=await startServer(path.resolve(__dirname,'../desktop-dist'),Number.isInteger(port)&&port>0&&port<65536?port:0);fs.mkdirSync(app.getPath('userData'),{recursive:true});fs.writeFileSync(portFile,JSON.stringify({port:Number(new URL(backend.origin).port)}));server=backend.server;origin=backend.origin;
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Paper Voice',submenu:[{role:'about'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]},{label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},{label:'View',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]},{role:'windowMenu'}]));
  await openWindow();app.on('activate',()=>{if(!window)void openWindow();});
 }).catch(error=>{dialog.showErrorBox('Paper Voice could not start',error.message);app.quit();});
 app.on('before-quit',()=>server?.close());
 app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
}
