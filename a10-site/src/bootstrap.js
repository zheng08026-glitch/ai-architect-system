import {mountSiteModel} from './main.js';
import {remoteAdapters} from './remote-adapters.js';
import publicConfig from './public-config.js';
const root=document.getElementById('site-model-root');
const notice=document.createElement('p');notice.style='padding:16px;background:#fff3cd;margin:0;text-align:center';notice.textContent='本功能使用需管理員開通';root.before(notice);root.inert=true;
const navigation=document.createElement('p');navigation.style='margin:0;padding:8px 16px;text-align:center';
const returnLink=document.createElement('a');returnLink.href='../#workspace';returnLink.textContent='返回主網站／會員登入';navigation.append(returnLink);root.before(navigation);
let started=false;
async function start(context){
  if(started)return;started=true;
  const config=structuredClone(publicConfig);
  let allowed=false,enabled=false,problem='';
  if(context.token&&context.apiBase){
    try{
      const [access,state]=await Promise.all([fetch(context.apiBase+'/api/a10-site/access',{headers:{Authorization:'Bearer '+context.token}}),fetch(context.apiBase+'/api/a10-site/config')]);
      allowed=access.ok&&(await access.json()).allowed===true;enabled=state.ok&&(await state.json()).enabled===true;
      if(access.status===401)problem='登入驗證已過期，請登出並重新登入。';
      else if(!access.ok||!state.ok)problem='服務回覆異常，請稍後重試。';
    }catch{problem='無法連線至工作主機服務，請稍後重試。';}
  }
  config.experimentalLocalWorker.enabled=allowed&&enabled;config.experimentalLocalWorker.configured=allowed&&enabled;
  await mountSiteModel(root,{adapters:remoteAdapters(context,config)});
  root.inert=!(allowed&&enabled);notice.hidden=allowed&&enabled;
  if(allowed&&!enabled)notice.textContent='A10-Site 正在部署驗證，完成後即可使用。';
  if(problem)notice.textContent=problem;
  if(allowed&&enabled){
    const section=document.createElement('section');section.className='panel';section.style='margin:16px;padding:16px';
    const title=document.createElement('h2');title.textContent='我的 A10-Site 任務';section.append(title);root.prepend(section);
    const list=document.createElement('div');section.append(list);
    const refresh=document.createElement('button');refresh.textContent='重新整理任務';section.append(refresh);
    const authHeaders=()=>({Authorization:'Bearer '+context.token});
    async function load(){
      const response=await fetch(context.apiBase+'/api/member/jobs',{headers:authHeaders()});
      if(!response.ok){list.textContent='請重新登入後查看任務。';return;}
      const data=await response.json();list.replaceChildren();
      for(const j of (data.jobs||[]).filter(j=>j.system_id==='A10_SITE').slice(0,20)){
        const row=document.createElement('p');row.textContent=new Date(j.created_at*1000).toLocaleString()+' · '+({pending:'排隊中',processing:'建模中',finalizing:'回傳中',completed:'已完成',failed:'失敗'})[j.status];
        if(j.status==='completed')for(const kind of ['skp','report']){
          const button=document.createElement('button');button.textContent=kind==='skp'?'下載 SKP':'下載報告';
          button.onclick=async()=>{button.disabled=true;try{
            const r=await fetch(context.apiBase+`/api/a10-site/jobs/${encodeURIComponent(j.job_id)}/files/${kind}`,{headers:authHeaders()});
            if(!r.ok)throw Error('下載失敗，請重新登入或稍後重試');
            const u=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=u;a.download=kind==='skp'?'A10-Site.skp':'A10-Site-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);
          }catch(e){notice.hidden=false;notice.textContent=e.message;}finally{button.disabled=false;}};
          row.append(button);
        }
        list.append(row);
      }
      if(!list.childElementCount)list.textContent='尚無 A10-Site 任務。';
    }
    refresh.onclick=()=>load().catch(()=>{list.textContent='暫時無法取得任務，請稍後重試。';});refresh.click();
  }
}
window.addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='a10-site-context')return;
  const context=event.data;
  if(context.apiBase&&!/^https:\/\//.test(context.apiBase))return;
  void start(context);
});
if(parent!==window){
  parent.postMessage({type:'a10-site-ready'},location.origin);
  setTimeout(()=>void start({token:'',apiBase:''}),5000);
}else{
  // Same website and same existing member session; never put credentials in URLs.
  const context={token:localStorage.getItem('architect-ai-auth-token')||'',apiBase:window.ARCHITECT_AI_API_BASE||''};
  async function initialize(){
    if(window.supabase && window.ARCHITECT_AI_SUPABASE_URL && window.ARCHITECT_AI_SUPABASE_ANON_KEY){
      const client=window.supabase.createClient(window.ARCHITECT_AI_SUPABASE_URL,window.ARCHITECT_AI_SUPABASE_ANON_KEY);
      const {data,error}=await client.auth.getSession();
      if(!error)context.token=data.session?.access_token||'';
      client.auth.onAuthStateChange((event,session)=>{
        context.token=session?.access_token||'';
        if(event==='SIGNED_OUT'){root.inert=true;notice.hidden=false;notice.textContent='本功能使用需管理員開通';}
      });
    }
    await start(context);
  }
  void initialize().catch(()=>{notice.textContent='登入服務連線失敗，請返回主網站重新登入。';});
}
