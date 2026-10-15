import {measureBounds} from './domain.js';
import {reliefCovered,RELIEF_COVERAGE_MESSAGE} from './terrain-coverage.js';
export function remoteAdapters(context,config){
  const base=context.apiBase.replace(/\/$/,'');
  async function api(url,options={}){
    // A request that never answers must not freeze the page: give up after 20 s (callers retry).
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    let res;
    try{res=await fetch(base+url,{...options,signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+context.token,...options.headers}});}
    catch(error){throw error?.name==='AbortError'?Error('連線逾時'):error;}
    finally{clearTimeout(timer);}
    if(!res.ok){const data=await res.json().catch(()=>({}));throw Error(typeof data.detail==='string'?data.detail:'服務暫時無法使用');}
    return res;
  }
  const coverage={status:'partial',gaps:[{message:'建築高度、街廓與地形來源均有限制，請以成果報告為準。'}]};
  let submission=null;
  const adapt=j=>({...j,id:j.job_id,status:({pending:'queued',processing:'running',finalizing:'running',completed:'partial',failed:'failed'})[j.status],coverage,error:j.public_error?{message:j.public_error}:null});
  return {
    config:{get:async()=>config},
    geocoder:{search:async(query,{signal}={})=>{
      const response=await fetch('https://photon.komoot.io/api/?'+new URLSearchParams({q:query,limit:'5'}),{signal});
      if(!response.ok)throw Error('地址搜尋暫時無法使用，請改用地圖框選');
      const data=await response.json();
      return {provider:'photon',candidates:(data.features||[]).filter(f=>f.geometry?.type==='Point').map((f,i)=>({id:'photon:'+i,label:[f.properties.name,f.properties.street,f.properties.housenumber,f.properties.city].filter(Boolean).join(' '),lng:f.geometry.coordinates[0],lat:f.geometry.coordinates[1],precision:'unverified',requiresConfirmation:true}))};
    }},
    coverage:{check:async({request})=>{const m=measureBounds(request.bounds);if(m.widthM>2000.001||m.depthM>2000.001)throw Error('範圍上限為 2000 × 2000 公尺');
      if(request.requestedOutputs?.terrainMode==='relief'&&!reliefCovered(request.bounds))throw Error(RELIEF_COVERAGE_MESSAGE);return coverage;}},
    jobs:{create:async({request,idempotencyKey})=>{
      // Preserve consent timestamps as well as geometry when retrying an ambiguous POST.
      if(submission?.key!==idempotencyKey)submission={key:idempotencyKey,body:JSON.stringify({request,request_key:idempotencyKey})};
      return adapt(await(await api('/api/a10-site/jobs',{method:'POST',body:submission.body})).json());
    },get:async id=>adapt(await(await api('/api/a10-site/jobs/'+encodeURIComponent(id))).json())},
    downloads:{get:async id=>{
      const j=await(await api('/api/a10-site/jobs/'+encodeURIComponent(id))).json();
      if(j.status!=='completed')throw Error('成果尚未完成');
      return {jobId:id,status:'partial',bounds:j.bounds,artifacts:Object.fromEntries(['model','report'].map(type=>[type,{status:'available',verified:true,filename:type==='model'?'A10-Site.skp':'A10-Site-report.json',downloadUrl:`/api/jobs/${encodeURIComponent(id)}/download/${type}`}]))};
    },fetch:async(id,type)=>{
      if(!['model','report'].includes(type))throw Error('不支援的成果類型');
      return (await api(`/api/a10-site/jobs/${encodeURIComponent(id)}/files/${type==='model'?'skp':'report'}`)).blob();
    }}
  };
}
