/* A2-3 editor adapted from the supplied prototype. All tools stay independent of other systems. */
'use strict';
window.AiasA23Editor = { async mount(element, platform) {
 const response = await fetch('./a2-3-editor.html', {cache:'no-cache'});
 if (!response.ok) throw new Error('A2-3 編輯器載入失敗，請重新整理。');
 const root=element.attachShadow({mode:'open'});
 root.innerHTML=await response.text();
 const $ = id => root.getElementById(id);
 const stage=$('stage'), host=$('workspace'), ctx=stage.getContext('2d');
 const makeCanvas=()=>document.createElement('canvas');
 const base=makeCanvas(), mask=makeCanvas(), tint=makeCanvas(), edge=makeCanvas();
 const bctx=base.getContext('2d'), mctx=mask.getContext('2d',{willReadFrequently:true});
 const tctx=tint.getContext('2d'), ectx=edge.getContext('2d');
 const state={loaded:false,w:0,h:0,source:null,ops:[],redo:[],tool:'lasso',view:'edit',draft:null,polygon:[],hover:null,pointer:null,panDrag:null,space:false,zoom:1,x:0,y:0,count:0,bounds:null,binary:null,busy:false,preset:null};
 let toastTimer,raf=0,uploadSequence=0;
 const job={id:'',active:false,run:0,original:null,final:null,originalUrl:'',finalUrl:''};
 let accessAllowed=false,accessSequence=0,owner=platform.email();
 const PENDING_KEY='aias-a2-3-pending-job';
 const SUBMISSION_KEY='aias-a2-3-pending-submission';
 let pendingSubmission=null;
 const hints={lasso:'按住滑鼠拖曳圈出範圍，放開後自動閉合並填滿。請以填滿預覽確認實際選區。',polygon:'依序點建築轉角；按「完成圈選」或 Enter 封閉並填滿。按 Esc 可取消尚未完成的多邊形。',rect:'拖曳建立矩形選區，放開滑鼠完成。可重複框選，多個選區共用同一段指令。',brush:'直接塗滿要修改的位置。塗抹不會自動填滿被筆畫包圍的空洞；整棟建築請改用圈選。',erase:'塗抹移除已選取的範圍，不會擦除原始圖片。可用復原還原。',pan:'拖曳移動畫面；滾輪縮放，或按「符合視窗」還原。縮放不會改變匯出座標。'};
 const presets={
  facade:'將選取建築的外牆改為淺灰色石材，保留原本的開窗尺寸、陽台配置及建築量體。',
  construction:'將選取建築的外觀改為施工狀態，外牆包覆施工帆布及鷹架；保持原本建築高度與透視，保留周圍道路及背景。',
  landscape:'在選取範圍內調整為層次自然的喬木及低矮植栽，與原圖光線、尺度及透視一致。',
  remove:'移除選取範圍內的指定物件，依周邊內容補回自然、連續的背景，保持原圖光線與透視。',
  bare_site:'編輯這張建築渲染圖:徹底移除建築物及其整個景觀規劃基地,並在原本的位置留下一塊空白、未整備的建築工地。\n這塊土地應變成平坦、裸露的泥土地與沙地,上面帶有輪胎痕跡、鬆散碎石、零星散落的瓦礫、堆疊的木材、建築廢料,以及部分乾枯的褐色草地。',
  interior_warm:'將圖片轉為真實高品質商業照片，溫馨住宅風格，窗戶進入陽光，窗外有都市景象有陽台及女兒牆，室內材質真實。',
  interior_downlights:'僅編輯影像中紅色輪廓包圍區域。將原有紅色輪廓包圍區域，替換為天花板增加崁燈，崁燈的燈光投射線投射到家具或地面或牆面。保留周圍環境背景、原始光影效果、拍攝角度、構圖及畫面裁切。除指定範圍區域外，不得修改其他任何內容，也不得添加徽章、標誌、圖案或新文字。',
 };
 function toast(text,error=false){$('toast').textContent=text;$('toast').classList.toggle('error',error);$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),5500);}
 function compiledPrompt(){const p=$('prompt').value.trim();return p?'僅修改紅色輪廓所標註的區域內部。紅色輪廓只是定位標記，成圖不得保留紅色標記。\n修改內容：'+p+'\n除本次明確要求的修改外，保留原本拍攝角度、透視、構圖、周圍建築、道路及其他背景。不增加未要求的文字或標誌。':'';}
 function updateUI(){
  root.querySelectorAll('[data-tool]').forEach(b=>{b.disabled=!state.loaded||state.busy;b.classList.toggle('active',b.dataset.tool===state.tool);b.setAttribute('aria-pressed',String(b.dataset.tool===state.tool));});
  root.querySelectorAll('[data-view]').forEach(b=>{b.disabled=!state.loaded||state.busy;b.classList.toggle('active',b.dataset.view===state.view);});
  ['brushSize','opacity','fit','zoomIn','zoomOut'].forEach(id=>$(id).disabled=!state.loaded||state.busy);
  $('undo').disabled=!state.ops.length||state.busy;$('redo').disabled=!state.redo.length||state.busy;$('clear').disabled=!state.count||state.busy;
  $('finish').classList.toggle('hide',state.tool!=='polygon');$('finish').disabled=state.polygon.length<3||state.busy;
  $('export').disabled=!state.count||!$('prompt').value.trim()||state.busy||state.polygon.length>0||!!state.draft;
  $('uploadButton').disabled=state.busy;
  $('emptyUpload').disabled=state.busy;$('prompt').disabled=state.busy;
  root.querySelectorAll('[data-preset]').forEach(b=>b.disabled=state.busy);
  const full=state.count>0&&state.count===state.w*state.h;
  $('fullAckLabel').classList.toggle('hide',!full);
  if(!full)$('fullAck').checked=false;
  $('fullAck').disabled=state.busy;
  $('submit').disabled=!accessAllowed||!state.count||!$('prompt').value.trim()||state.busy||job.active||state.polygon.length>0||!!state.draft||(full&&!$('fullAck').checked);
  $('step4').classList.toggle('current',job.active||!!job.final);
  $('dimensions').textContent=state.loaded?`原圖：${state.w} × ${state.h} px`:'原圖：—';
  $('selectionStatus').textContent=state.count?`已選 ${(100*state.count/(state.w*state.h)).toFixed(2)}% · ${state.count.toLocaleString()} 像素`:state.loaded?'尚未選取修改範圍':'請先上傳圖片';
  $('zoomLabel').textContent=state.loaded?`${Math.round(state.zoom*100)}%`:'—';
  $('toolHint').textContent=state.loaded?hints[state.tool]:'上傳後，建議先用「自由圈選」；放開滑鼠，圈內會自動填滿。';
  $('compiled').textContent=compiledPrompt()||'請輸入修改內容。';$('charCount').textContent=$('prompt').value.length;
  $('step1').classList.toggle('current',!state.loaded);$('step2').classList.toggle('current',state.loaded&&!state.count);$('step3').classList.toggle('current',state.count>0);
 }
 function scheduleDraw(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;draw();});}
 function fit(){if(!state.loaded)return;state.zoom=Math.min((host.clientWidth-38)/state.w,(host.clientHeight-38)/state.h,1);state.x=(host.clientWidth-state.w*state.zoom)/2;state.y=(host.clientHeight-state.h*state.zoom)/2;updateUI();scheduleDraw();}
 function resize(){const d=window.devicePixelRatio||1;stage.width=Math.max(1,Math.round(host.clientWidth*d));stage.height=Math.max(1,Math.round(host.clientHeight*d));scheduleDraw();}
 const observer=new ResizeObserver(resize);observer.observe(host);
 function path(g,points,close){if(!points.length)return;g.beginPath();g.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)g.lineTo(points[i].x,points[i].y);if(close)g.closePath();}
 function drawOperation(g,op,preview=false){
  if(op.type==='clear'){g.clearRect(0,0,state.w,state.h);return;}
  g.save();g.globalCompositeOperation=preview?'source-over':op.type==='erase'?'destination-out':'source-over';
  g.fillStyle=preview?(op.type==='erase'?'rgba(255,255,255,.6)':'rgba(255,73,63,.4)'):'#fff';g.strokeStyle=g.fillStyle;g.lineJoin='round';g.lineCap='round';
  if(op.type==='polygon'){path(g,op.points,true);g.fill('evenodd');if(preview){g.strokeStyle='#ff493f';g.lineWidth=1.5/state.zoom;g.stroke();}}
  else{g.lineWidth=op.width;if(op.points.length===1){g.beginPath();g.arc(op.points[0].x,op.points[0].y,op.width/2,0,Math.PI*2);g.fill();}else{path(g,op.points,false);g.stroke();}}
  g.restore();
 }
 function draw(){
  const d=window.devicePixelRatio||1;ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,host.clientWidth,host.clientHeight);
  if(!state.loaded)return;
  ctx.save();ctx.translate(state.x,state.y);ctx.scale(state.zoom,state.zoom);ctx.fillStyle='#000';ctx.fillRect(0,0,state.w,state.h);
  if(state.view==='mask'){ctx.drawImage(mask,0,0);}else{ctx.drawImage(base,0,0);if(state.view==='edit'){ctx.globalAlpha=Number($('opacity').value)/100;ctx.drawImage(tint,0,0);ctx.globalAlpha=1;}if(state.view==='reference')ctx.drawImage(edge,0,0);}
  ctx.beginPath();ctx.rect(0,0,state.w,state.h);ctx.clip();
  if(state.draft)drawOperation(ctx,state.draft,true);
  if(state.polygon.length){const points=state.hover?[...state.polygon,state.hover]:state.polygon;drawOperation(ctx,{type:'polygon',points},true);ctx.fillStyle='#fff';for(const p of state.polygon){ctx.beginPath();ctx.arc(p.x,p.y,3/state.zoom,0,2*Math.PI);ctx.fill();}}
  if(state.hover&&['brush','erase'].includes(state.tool)&&!state.panDrag){ctx.lineWidth=1/state.zoom;ctx.strokeStyle='#fff';ctx.beginPath();ctx.arc(state.hover.x,state.hover.y,Number($('brushSize').value)/2,0,2*Math.PI);ctx.stroke();}
  ctx.restore();
  stage.style.cursor=state.tool==='pan'||state.space?(state.panDrag?'grabbing':'grab'):'crosshair';
 }
 function rebuildMask(){
  mctx.clearRect(0,0,state.w,state.h);for(const op of state.ops)drawOperation(mctx,op);
  const raw=mctx.getImageData(0,0,state.w,state.h),bin=new Uint8Array(state.w*state.h),overlay=tctx.createImageData(state.w,state.h),edgePixels=ectx.createImageData(state.w,state.h);
  let count=0,minX=state.w,minY=state.h,maxX=-1,maxY=-1;
  for(let i=0;i<bin.length;i++){
   const j=i*4,inside=raw.data[j+3]>=128;bin[i]=inside?1:0;
   raw.data[j]=raw.data[j+1]=raw.data[j+2]=255;raw.data[j+3]=inside?255:0;
   if(inside){count++;const x=i%state.w,y=Math.floor(i/state.w);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);overlay.data[j]=255;overlay.data[j+1]=73;overlay.data[j+2]=63;overlay.data[j+3]=255;}
  }
  // Make the annotation INSIDE the selected region so a strict compositor never needs to copy a red line outside M.
  const radius=Math.max(1,Math.min(10,Math.round(Math.max(state.w,state.h)*.002)));
  for(let y=0;y<state.h;y++)for(let x=0;x<state.w;x++){
   const i=y*state.w+x;if(!bin[i])continue;
   if(x<radius||y<radius||x>=state.w-radius||y>=state.h-radius||!bin[i-radius]||!bin[i+radius]||!bin[i-radius*state.w]||!bin[i+radius*state.w]){const j=i*4;edgePixels.data[j]=255;edgePixels.data[j+1]=30;edgePixels.data[j+2]=20;edgePixels.data[j+3]=255;}
  }
  mctx.putImageData(raw,0,0);tctx.putImageData(overlay,0,0);ectx.putImageData(edgePixels,0,0);
  state.binary=bin;state.count=count;state.bounds=count?{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1}:null;updateUI();scheduleDraw();
 }
 function commit(op){if(state.ops.length>=200){toast('目前最多保留 200 個操作；請匯出資料後重新載入圖片。',true);return;}state.ops.push(op);state.redo=[];rebuildMask();}
 function finishPolygon(){if(state.polygon.length<3)return;const points=state.polygon.map(p=>({...p}));state.polygon=[];commit({type:'polygon',points});}
 function cancelDraft(){state.draft=null;state.polygon=[];state.pointer=null;state.panDrag=null;updateUI();scheduleDraw();}
 function viewPoint(ev){const r=stage.getBoundingClientRect();return{x:(ev.clientX-r.left)*host.clientWidth/r.width,y:(ev.clientY-r.top)*host.clientHeight/r.height};}
 function imagePoint(ev,clamp=true){const p=viewPoint(ev),x=(p.x-state.x)/state.zoom,y=(p.y-state.y)/state.zoom;return{x:clamp?Math.max(0,Math.min(state.w,x)):x,y:clamp?Math.max(0,Math.min(state.h,y)):y};}
 function inside(p){return p.x>=0&&p.x<=state.w&&p.y>=0&&p.y<=state.h;}
 function zoomAt(factor,p={x:host.clientWidth/2,y:host.clientHeight/2}){if(!state.loaded)return;const old=state.zoom,next=Math.min(8,Math.max(.02,old*factor));state.x=p.x-(p.x-state.x)*next/old;state.y=p.y-(p.y-state.y)*next/old;state.zoom=next;updateUI();scheduleDraw();}
 stage.addEventListener('pointerdown',ev=>{
  if(!state.loaded||state.busy||!ev.isPrimary||ev.button!==0)return;
  stage.focus({preventScroll:true});
  ev.preventDefault();const p=imagePoint(ev,false);state.hover=p;
  if(state.tool==='pan'||state.space){state.pointer=ev.pointerId;stage.setPointerCapture(ev.pointerId);state.panDrag={point:viewPoint(ev),x:state.x,y:state.y};scheduleDraw();return;}
  if(!inside(p))return;
  state.view='edit';
  if(state.tool==='polygon'){
   if(state.polygon.length>=3&&Math.hypot(p.x-state.polygon[0].x,p.y-state.polygon[0].y)*state.zoom<10)finishPolygon();
   else state.polygon.push(p);
   updateUI();scheduleDraw();return;
  }
  state.pointer=ev.pointerId;stage.setPointerCapture(ev.pointerId);
  if(state.tool==='rect')state.draft={type:'polygon',points:[p,p,p,p],start:p};
  else if(state.tool==='lasso')state.draft={type:'polygon',points:[p]};
  else state.draft={type:state.tool==='erase'?'erase':'brush',width:Number($('brushSize').value),points:[p]};
  updateUI();scheduleDraw();
 });
 stage.addEventListener('pointermove',ev=>{
  if(!state.loaded||state.busy)return;state.hover=imagePoint(ev);
  if(state.pointer!==null&&ev.pointerId!==state.pointer)return;
  if(state.panDrag){const p=viewPoint(ev);state.x=state.panDrag.x+p.x-state.panDrag.point.x;state.y=state.panDrag.y+p.y-state.panDrag.point.y;scheduleDraw();return;}
  if(state.draft){const p=imagePoint(ev),last=state.draft.points[state.draft.points.length-1];
   if(state.tool==='rect'){const s=state.draft.start;state.draft.points=[s,{x:p.x,y:s.y},p,{x:s.x,y:p.y}];}
   else if(Math.hypot(p.x-last.x,p.y-last.y)>Math.max(.5,1/state.zoom)&&state.draft.points.length<20000)state.draft.points.push(p);
  }scheduleDraw();
 });
 stage.addEventListener('pointerup',ev=>{
  if(ev.pointerId!==state.pointer)return;
  state.pointer=null;if(stage.hasPointerCapture(ev.pointerId))stage.releasePointerCapture(ev.pointerId);
  if(state.panDrag){state.panDrag=null;scheduleDraw();return;}
  const op=state.draft;state.draft=null;
  if(op){delete op.start;if(op.type!=='polygon'||op.points.length>=3)commit(op);else toast('圈選範圍太小，請重新圈出一個完整區域。',true);}
  updateUI();scheduleDraw();
 });
 stage.addEventListener('pointercancel',cancelDraft);
 stage.addEventListener('pointerleave',()=>{if(state.pointer===null){state.hover=null;scheduleDraw();}});
 stage.addEventListener('wheel',ev=>{if(!state.loaded||state.busy||state.draft||state.panDrag)return;ev.preventDefault();zoomAt(Math.exp(-Math.max(-200,Math.min(200,ev.deltaY))*.0015),viewPoint(ev));},{passive:false});
 root.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{cancelDraft();state.tool=b.dataset.tool;state.view='edit';updateUI();scheduleDraw();}));
 root.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.view;updateUI();scheduleDraw();}));
 $('finish').addEventListener('click',finishPolygon);
 function undo(){if(!state.ops.length||state.busy)return;cancelDraft();state.redo.push(state.ops.pop());rebuildMask();}
 function redo(){if(!state.redo.length||state.busy)return;cancelDraft();state.ops.push(state.redo.pop());rebuildMask();}
 $('undo').addEventListener('click',undo);$('redo').addEventListener('click',redo);$('clear').addEventListener('click',()=>{cancelDraft();commit({type:'clear'});});
 $('fit').addEventListener('click',fit);$('zoomIn').addEventListener('click',()=>zoomAt(1.25));$('zoomOut').addEventListener('click',()=>zoomAt(.8));
 $('brushSize').addEventListener('input',()=>{$('brushLabel').textContent=$('brushSize').value;scheduleDraw();});$('opacity').addEventListener('input',()=>{$('opacityLabel').textContent=$('opacity').value;scheduleDraw();});
 $('prompt').addEventListener('input',()=>{state.preset=null;updateUI();});
 root.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{const val=presets[b.dataset.preset];if($('prompt').value.trim()&&$('prompt').value!==val&&!confirm('套用此參考提詞會取代目前的修改內容，確定繼續？'))return;$('prompt').value=val;state.preset=b.dataset.preset;updateUI();}));
 root.addEventListener('keydown',ev=>{if(['INPUT','TEXTAREA'].includes((root.activeElement?.tagName))||state.busy)return;if(ev.code==='Space'){ev.preventDefault();state.space=true;scheduleDraw();}if(ev.key==='Escape')cancelDraft();if(ev.key==='Enter'&&state.tool==='polygon'){ev.preventDefault();finishPolygon();}if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='z'){ev.preventDefault();ev.shiftKey?redo():undo();}if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==='y'){ev.preventDefault();redo();}});
 root.addEventListener('keyup',ev=>{if(ev.code==='Space'){state.space=false;scheduleDraw();}});window.addEventListener('blur',()=>{state.space=false;cancelDraft();});
 async function loadFile(file){
  if(!file||state.busy)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)){toast('請使用 PNG、JPG 或 WebP；目前尚未提供 PDF／CAD 轉圖。',true);return;}
  if(file.size>25*1024*1024){toast('檔案超過 25 MB 上限，請先匯出較小的圖片。',true);return;}
  if(state.count&&!confirm('上傳新圖會清除目前選區。請確認已匯出需要保留的資料。'))return;
  const sequence=++uploadSequence,url=URL.createObjectURL(file);const img=new Image();
  try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('圖片無法解碼，請確認檔案沒有損壞。'));img.src=url;});
   if(sequence!==uploadSequence)return;
   const w=img.naturalWidth,h=img.naturalHeight;
   if(w<8||h<8)throw new Error('圖片寬度與高度都必須至少 8 px，請使用較大的圖片。');
   if(w*h>16000000||Math.max(w,h)>8192)throw new Error('圖片限制為 16 百萬像素、單邊 8192 px；不會偷偷縮放圖說，請另外輸出較小圖片。');
   cancelDraft();Object.assign(state,{loaded:true,w,h,source:file,ops:[],redo:[],count:0,bounds:null,binary:null,view:'edit',tool:'lasso'});
   for(const c of[base,mask,tint,edge]){c.width=w;c.height=h;}
   // The canonical demo image is normalized to the browser's decoded orientation and an opaque white background.
   bctx.fillStyle='#fff';bctx.fillRect(0,0,w,h);bctx.drawImage(img,0,0,w,h);
   $('filename').textContent=file.name;$('filename').title=file.name;$('empty').classList.add('hidden');rebuildMask();resize();fit();toast('圖片已載入。用自由圈選畫一圈，放開後圈內會自動填滿。');
  }catch(err){toast(err.message||'載入失敗。',true);}finally{URL.revokeObjectURL(url);$('file').value='';}
 }
 $('file').addEventListener('change',ev=>loadFile(ev.target.files[0]));$('uploadButton').addEventListener('click',()=>$('file').click());$('emptyUpload').addEventListener('click',()=>$('file').click());
 ['dragenter','dragover'].forEach(t=>host.addEventListener(t,ev=>{ev.preventDefault();host.classList.add('dragover');}));host.addEventListener('dragleave',()=>host.classList.remove('dragover'));host.addEventListener('drop',ev=>{ev.preventDefault();host.classList.remove('dragover');loadFile(ev.dataTransfer.files[0]);});
 const canvasBlob=c=>new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('PNG 匯出失敗，可能是瀏覽器記憶體不足。')),'image/png'));
 function saveBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 // ZIP writer: stored (uncompressed) entries; PNG is already compressed. No third-party code or network.
 const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
 function crc32(data){let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
 async function zip(entries){
  const chunks=[],central=[];let offset=0,centralSize=0;const enc=new TextEncoder();const now=new Date(),dt=((now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1)),dd=(((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate());
  for(const entry of entries){const name=enc.encode(entry.name),data=new Uint8Array(await entry.blob.arrayBuffer()),crc=crc32(data);const local=new Uint8Array(30+name.length),l=new DataView(local.buffer);l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint16(10,dt,true);l.setUint16(12,dd,true);l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,name.length,true);local.set(name,30);chunks.push(local,data);
   const dir=new Uint8Array(46+name.length),d=new DataView(dir.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(12,dt,true);d.setUint16(14,dd,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);dir.set(name,46);central.push(dir);centralSize+=dir.length;offset+=local.length+data.length;
  }
  const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/zip'});
 }
 async function exportPackage(){
  if(!state.count||!$('prompt').value.trim()||state.busy||state.polygon.length||state.draft)return;
  state.busy=true;updateUI();$('export').textContent='正在整理測試資料…';
  try{
   const maskOut=makeCanvas(),refOut=makeCanvas();for(const c of[maskOut,refOut]){c.width=state.w;c.height=state.h;}
   const mc=maskOut.getContext('2d');mc.fillStyle='#000';mc.fillRect(0,0,state.w,state.h);mc.drawImage(mask,0,0);
   const rc=refOut.getContext('2d');rc.drawImage(base,0,0);rc.drawImage(edge,0,0);
   const extension={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[state.source.type];
   const metadata={schema_version:'aias-a2-3-integration-v1',prototype_only:false,export_only:true,inference_executed:false,job_type:'a2_3_local_edit',api_contract_status:'connected_separate_submission',image:{file:'original.png',width:state.w,height:state.h,normalization:'browser decoded orientation; composited onto opaque white; no resize',original_upload_file:'uploaded_original.'+extension,original_upload_name:state.source.name},selection:{coordinate_space:'canonical_image_pixels',mask_file:'mask.png',white_means:'edit',black_means:'preserve',selected_pixels:state.count,bounds:state.bounds,ops:state.ops},model_reference:{file:'reference.png',annotation:'red inner boundary derived from full region mask'},prompt:$('prompt').value.trim(),compiled_prompt:compiledPrompt(),preset_id:state.preset,requested_output_policy:'strict_composite',inward_feather_px:0};
   const readme='AIAS A2-3 圈選測試包\n\n這不是 ComfyUI 工作流，也不會執行 AI。\noriginal.png：瀏覽器解碼後的白底 PNG，未縮放。\nuploaded_original.*：原始上傳檔，位元組不變。\nmask.png：與 original.png 同尺寸，白色(255)可修改，黑色(0)保留；沒有以 alpha 儲存遮罩。\nreference.png：原圖加上選區內側紅色邊界，提供 Qwen 語意定位，不保證模型不修改圈外。\nselection.json：原圖座標、操作序列及提詞，用於檢查與保留本次圈選。網站送出任務另使用 A2-3 專用 API。\n\n正式 Worker 應從可信原圖＋經驗證的區域遮罩重新建立 reference，不信任客戶端上傳的合成圖。\n嚴格合成：final = original*(1-M) + generated*M。M 是完整區域，不是細紅框；M=0 處直接複製原圖像素。\nComfyUI 讀取 mask.png：使用 ImageToMask 的 red 通道，或 LoadImageMask 的 red 通道；不要用一般 LoadImage 的 MASK 輸出讀取這張不透明黑白圖。\n生成前需要對齊原圖、遮罩、參考圖與 latent 尺寸，輸出後反變換再貼回原圖，並以 PNG 保存。\n\n本包沒有模型權重。正式使用 Qwen Image 2.1 作商業服務前，需確認 Qwen Research License 及另行商用授權。\n';
   const entries=[{name:'original.png',blob:await canvasBlob(base)},{name:'mask.png',blob:await canvasBlob(maskOut)},{name:'reference.png',blob:await canvasBlob(refOut)},{name:'selection.json',blob:new Blob([JSON.stringify(metadata,null,2)],{type:'application/json'})},{name:'README.txt',blob:new Blob([readme],{type:'text/plain;charset=utf-8'})},{name:'uploaded_original.'+extension,blob:state.source}];
   const blob=await zip(entries);saveBlob(blob,'AIAS_A2-3_selection_test.zip');toast('測試包已匯出。沒有發送到伺服器，也沒有執行 AI。');
   maskOut.width=maskOut.height=refOut.width=refOut.height=1;
  }catch(err){toast(err.message||'匯出失敗，請使用較小圖片再試。',true);}finally{state.busy=false;$('export').textContent='匯出圈選測試包 ZIP';updateUI();}
 }
 $('export').addEventListener('click',exportPackage);
 // Only this independent adapter connects the supplied editor to model-agnostic platform services.
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const authHeaders=()=>({Authorization:`Bearer ${platform.token()}`});
 const endpoint=path=>`${platform.apiBase()}${path}`;
 const safeError=(data,status=0)=>{
  if(status===401)return '請重新登入會員後，再查詢或送出任務。';
  if(status===403||status===404)return '目前無法存取此 A2-3 功能或任務，請確認會員帳號與使用權限。';
  if(status===429)return '目前額度不足或任務繁忙，請稍後再試。';
 const type=data?.error_type||data?.detail?.error_type;
  return type==='input'?'輸入資料有誤，請檢查原圖、選區與修改內容後再試。':'系統暫時無法完成此任務，請稍後再試。';
 };
 const accessMessages={
  disabled:'A2-3 尚未開放。',
  testers:{available:'A2-3 測試已開放。',unavailable:'請使用已開通 A2-3 測試的會員帳號登入。'},
  members:{available:'A2-3 已開放會員使用。',unavailable:'請使用有效的會員帳號登入後使用 A2-3。'},
 };
 const accessMode=data=>Object.prototype.hasOwnProperty.call(data,'access_mode')?data.access_mode:'testers';
 function accessMessage(data){
  const resolvedMode=accessMode(data);
  const mode=['testers','members'].includes(resolvedMode)?accessMessages[resolvedMode]:null;
  const expected=data.enabled===true&&mode&&typeof mode==='object'
   ?mode[data.available===true?'available':'unavailable']:accessMessages.disabled;
  // Accept only the matching fixed public message; never render arbitrary service text.
  return data.message===expected?data.message:expected;
 }
 function jobMessage(message,error=false){$('jobStatus').classList.remove('hide');$('jobStatus').classList.toggle('error',error);$('jobMessage').textContent=message;$('jobIdentity').textContent=job.id?`任務編號：${job.id}`:'';}
 function clearResult(){
  if(job.originalUrl)URL.revokeObjectURL(job.originalUrl);
  if(job.finalUrl)URL.revokeObjectURL(job.finalUrl);
  Object.assign(job,{original:null,final:null,originalUrl:'',finalUrl:''});
  $('submittedOriginal').removeAttribute('src');$('finalImage').removeAttribute('src');
  $('comparison').classList.add('hide');$('resultControls').classList.add('hide');$('resultPlaceholder').classList.remove('hide');$('resultJobId').textContent='';
 }
 function rememberJob(){try{localStorage.setItem(PENDING_KEY,JSON.stringify({id:job.id,owner}));}catch{/* The active page can still poll when storage is unavailable. */}}
 function forgetJob(){try{const saved=JSON.parse(localStorage.getItem(PENDING_KEY)||'null');if(saved?.id===job.id)localStorage.removeItem(PENDING_KEY);}catch{/* No private image or auth data is stored here. */}}
 async function submissionKey(original,maskBlob,prompt,fullAck,run){
  const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  const hashes=await Promise.all([original.arrayBuffer().then(digest),maskBlob.arrayBuffer().then(digest),digest(new TextEncoder().encode(`${prompt}\n${fullAck}`))]);
  if(run!==job.run)return null;
  const fingerprint=hashes.join(':');
  if(!pendingSubmission){try{pendingSubmission=JSON.parse(localStorage.getItem(SUBMISSION_KEY)||'null');}catch{/* Memory retains the key when storage is unavailable. */}}
  if(pendingSubmission?.owner!==owner||pendingSubmission?.fingerprint!==fingerprint||typeof pendingSubmission?.key!=='string'||!/^[a-f0-9-]{36}$/i.test(pendingSubmission.key)){
   pendingSubmission={owner,fingerprint,key:crypto.randomUUID()};
   try{localStorage.setItem(SUBMISSION_KEY,JSON.stringify(pendingSubmission));}catch{/* No image, prompt, or token is persisted. */}
  }
  return pendingSubmission.key;
 }
 function forgetSubmission(){
  try{const saved=JSON.parse(localStorage.getItem(SUBMISSION_KEY)||'null');if(saved?.key===pendingSubmission?.key)localStorage.removeItem(SUBMISSION_KEY);}catch{/* Storage is optional. */}
  pendingSubmission=null;
 }
 async function request(path,options={}){
  const response=await fetch(endpoint(path),{...options,headers:{...authHeaders(),...(options.headers||{})},signal:AbortSignal.timeout(45000)});
  if(!response.ok){const data=await response.json().catch(()=>({}));const error=new Error(safeError(data,response.status));error.publicMessage=error.message;error.status=response.status;throw error;}
  return response;
 }
 async function refreshAccess(){
  const sequence=++accessSequence;
  const nextOwner=platform.email();
  if(owner!==nextOwner||!platform.token()){
   job.run++;job.active=false;state.busy=false;job.id='';pendingSubmission=null;clearResult();$('jobStatus').classList.add('hide');$('resumeJob').classList.add('hide');
  }
  owner=nextOwner;accessAllowed=false;updateUI();
  if(!platform.token()){$('accessMessage').textContent='請登入會員後使用 A2-3 局部重繪。';$('accessAction').textContent='登入會員';return false;}
  $('accessAction').textContent='重新確認';
  if(!platform.apiBase()){$('accessMessage').textContent='A2-3 服務尚未連線。';return false;}
  $('accessMessage').textContent='正在確認使用權限…';
  try{
   const response=await request('/api/a2-3/status');const data=await response.json();
   if(sequence!==accessSequence)return false;
   // Older status schemas predate access_mode and remain server-enforced tester-only endpoints.
   accessAllowed=data.enabled===true&&data.available===true&&['testers','members'].includes(accessMode(data));
   $('accessMessage').textContent=accessMessage(data);
  }catch(error){if(sequence===accessSequence)$('accessMessage').textContent=error.publicMessage||'暫時無法確認使用權限，請重新確認。';}
  if(sequence!==accessSequence)return false;
  updateUI();
  if(accessAllowed&&!job.id&&!state.busy){
   try{const saved=JSON.parse(localStorage.getItem(PENDING_KEY)||'null');if(saved?.owner===owner&&typeof saved.id==='string'&&saved.id)watchJob(saved.id);}catch{/* Ignore obsolete browser state. */}
  }
  return accessAllowed;
 }
 function validateJob(record,id){
  if(record.job_id!==id||record.system_id!=='A2-3')throw new Error('unexpected_job');
 }
 async function finishJob(record,id,run){
  const images=record.output_images||(record.output_image?[record.output_image]:[]);
  if(!Array.isArray(images)||images.length!==1)throw new Error('missing_final');
  // The authenticated output endpoint indexes this exact job's worker-selected FINAL only.
  const response=await request(`/api/jobs/${encodeURIComponent(id)}/outputs/images/1/A2-3-result-01.png`);
  const blob=await response.blob();
  if(!['image/png','application/octet-stream'].includes(blob.type)||!blob.size)throw new Error('invalid_final');
  if(run!==job.run)return;
  if(!job.original){
   try{const original=await request(`/api/a2-3/jobs/${encodeURIComponent(id)}/original`);const sourceBlob=await original.blob();if(run!==job.run)return;job.original=sourceBlob;}catch{/* The authenticated FINAL remains downloadable if original retrieval is temporarily unavailable. */}
  }
  if(run!==job.run)return;
  const verified=await createImageBitmap(blob);verified.close();
  if(run!==job.run)return;
  job.final=blob;job.finalUrl=URL.createObjectURL(blob);$('finalImage').src=job.finalUrl;
  if(job.original){job.originalUrl=URL.createObjectURL(job.original);$('submittedOriginal').src=job.originalUrl;}
  $('originalFigure').classList.toggle('hide',!job.original);$('comparison').classList.toggle('single',!job.original);
  $('comparison').classList.remove('hide');$('resultControls').classList.remove('hide');$('resultPlaceholder').classList.add('hide');$('resultJobId').textContent=`任務 ${id}`;
  job.active=false;state.busy=false;forgetJob();jobMessage('生成完成。以下顯示這筆任務的最終成果。');updateUI();
  platform.refreshMember().catch(()=>{});
 }
 async function watchJob(id){
  const run=++job.run;job.id=id;job.active=true;state.busy=true;$('resumeJob').classList.add('hide');updateUI();
  let failures=0;
  while(run===job.run){
   try{
    const response=await request(`/api/jobs/${encodeURIComponent(id)}`);const record=await response.json();
    if(run!==job.run)return;validateJob(record,id);
    if(record.status==='completed'){await finishJob(record,id,run);return;}
    if(record.status==='failed'){
     job.active=false;state.busy=false;forgetJob();jobMessage(safeError(record),true);updateUI();platform.refreshMember().catch(()=>{});return;
    }
    failures=0;
    const label={pending:'任務已送出，等待處理中。',queued:'任務已送出，等待處理中。',processing:'正在進行局部重繪，請稍候。',finalizing:'正在整理最終成果。'}[record.status]||'任務處理中，請稍候。';
    jobMessage(label);
   }catch(error){
    if(run!==job.run)return;
    failures++;
    if(error.status===401||error.status===403||error.status===404||failures>=5){
     state.busy=false;jobMessage(error.publicMessage||'暫時無法取得這筆任務的狀態。請重新查詢，無須重複送出。',true);$('resumeJob').classList.remove('hide');updateUI();return;
    }
    jobMessage('連線暫時中斷，正在重新查詢這筆任務。');
   }
   await pause(2500*Math.max(1,failures));
  }
 }
 async function submitJob(){
  if($('submit').disabled)return;
  const run=++job.run;state.busy=true;updateUI();
  try{
   const allowed=await refreshAccess();
   if(run!==job.run)return;
   if(!allowed){state.busy=false;updateUI();return;}
   clearResult();
   job.id='';
   const maskOut=makeCanvas();maskOut.width=state.w;maskOut.height=state.h;
   const mc=maskOut.getContext('2d');mc.fillStyle='#000';mc.fillRect(0,0,state.w,state.h);mc.drawImage(mask,0,0);
   const [original,maskBlob]=await Promise.all([canvasBlob(base),canvasBlob(maskOut)]);maskOut.width=maskOut.height=1;
   if(run!==job.run)return;
   if(original.size>25*1024*1024||maskBlob.size>25*1024*1024){state.busy=false;toast('轉成 PNG 後超過 25 MB，請使用較小圖片再試。',true);updateUI();return;}
   const prompt=$('prompt').value.trim(),fullAck=$('fullAck').checked;
   const requestKey=await submissionKey(original,maskBlob,prompt,fullAck,run);
   if(run!==job.run)return;
   const form=new FormData();form.append('original_image',original,'original.png');form.append('mask_image',maskBlob,'mask.png');form.append('prompt',prompt);form.append('count','1');form.append('full_mask_ack',String(fullAck));form.append('client_id',platform.clientId());form.append('request_key',requestKey);
   jobMessage('正在送出原圖、選區與修改內容…');
   const response=await request('/api/a2-3/jobs',{method:'POST',body:form});const record=await response.json();
   if(run!==job.run)return;
   if(typeof record.job_id!=='string'||!record.job_id||record.system_id!=='A2-3')throw new Error('unexpected_submission');
   job.original=original;job.id=record.job_id;rememberJob();forgetSubmission();jobMessage('任務已送出，等待處理中。');watchJob(job.id);
  }catch(error){if(run!==job.run)return;state.busy=false;jobMessage(error.publicMessage||'無法確認任務是否送出，請先到會員任務紀錄確認，避免重複送出。',true);updateUI();}
 }
 async function openJob(id){
  if(typeof id!=='string'||!id)return;
  if(job.id===id&&job.active)return;
  job.run++;job.active=false;state.busy=false;clearResult();job.id=id;
  if(!await refreshAccess())return;
  rememberJob();watchJob(id);
 }
 $('accessAction').addEventListener('click',()=>{if(!platform.token())platform.login();else refreshAccess();});
 $('fullAck').addEventListener('change',updateUI);$('submit').addEventListener('click',submitJob);
 $('resumeJob').addEventListener('click',async()=>{if(!job.id)return;if(await refreshAccess())watchJob(job.id);});
 $('downloadFinal').addEventListener('click',()=>{if(job.final)saveBlob(job.final,`A2-3-${job.id}-FINAL.png`);});
 window.addEventListener('storage',()=>{if(platform.email()!==owner||!platform.token())refreshAccess();});
 window.addEventListener('beforeunload',event=>{if(state.busy&&!job.id){event.preventDefault();event.returnValue='';}});
 updateUI();resize();
 return {refreshAccess,openJob,resize};
}};
