// AI 평형수 조정 보조 (Groq LLM via our server). Numbers come from the physics model and
// fixed rule tables; the LLM only explains, writes and extracts. Surfaces:
//  ① briefing card  ② ship mascot chat  ③ work-log writer  ④ pre-unloading weather check
//  ⑤ manifest → unloading plan converter  ⑥ risk response card.
import {plainText} from './ai-plain.mjs?v=plain4';
const $=s=>document.querySelector(s);
const ROOT=(['localhost','127.0.0.1'].includes(location.hostname)?(location.port==='4174'?'http://127.0.0.1:4175':''):'https://harbor-twin-server.onrender.com')+'/api';
const API=ROOT+'/ai';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=s=>esc(plainText(s)).replace(/\n/g,'<br>');
const twin=()=>window.harborTwin;

let status={configured:null},coolUntil=0;
const sleep=(ms,signal)=>new Promise((resolve,reject)=>{if(signal?.aborted)return reject(new DOMException('취소됨','AbortError'));const stop=()=>{clearTimeout(t);reject(new DOMException('취소됨','AbortError'));};const t=setTimeout(()=>{signal?.removeEventListener('abort',stop);resolve();},ms);signal?.addEventListener('abort',stop,{once:true});});
export const aiCoolingDown=()=>Date.now()<coolUntil;
const stateKey=()=>{const c=twin()?.aiContext?.();return JSON.stringify([c?.environment,c?.unloading?.containersUnloaded,c?.recommendation,c?.transferInProgress]);};
const replyHtml=d=>`<p class="ai-source">생성 당시 판정: <strong>${esc(d.assessmentLabel??'자료 부족 · 판정 보류')}</strong> · ${esc(d.generatedAt?new Date(d.generatedAt).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul'}):'시각 미확인')} KST</p>${d.stale?'<p class="ai-error">요청 후 조건 또는 작업 상태가 바뀌었습니다. 이 설명은 생성 당시 기록입니다. 다시 생성하세요.</p>':''}${d.guarded?'<p class="ai-muted">'+(d.guardMode==='partial'?'일부 문장을 수치 근거·표현 기준에 맞게 조정했어요. 나머지 설명은 유지합니다.':'수치·표현 검증으로 원본 표를 안내하는 고정 설명을 표시합니다.')+'</p>':''}<p>${fmt(d.content??'응답 내용이 없습니다.')}</p>`;
async function ask(role,extra={},{onWait,signal}={},retried=false){
 const context=twin()?.aiContext?.()??{},captured=stateKey(),controller=new AbortController();
 const cancel=()=>controller.abort();if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(()=>controller.abort(),45000);let r,data={};
 try{r=await fetch(API+'/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role,context,...extra}),signal:controller.signal});try{data=await r.json();}catch{}}
 catch(e){if(e.name==='AbortError'){if(signal?.aborted)throw e;throw Error('AI 응답 시간 초과 · 시뮬레이션은 유지됩니다. 다시 요청하세요.');}throw e;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 if(r.status===429){const secs=Math.max(3,Math.min(60,Number(data.retryAfter)||10));coolUntil=Date.now()+secs*1000;
  if(!retried&&secs<=15){for(let left=secs;left>0;left--){onWait?.(left);await sleep(1000,signal);}return ask(role,extra,{onWait,signal},true);}}
 if(!r.ok)throw Error(data.error||`AI 요청 실패 (${r.status})`);
 return {...data,stale:captured!==stateKey()};
}

const MASCOT=`<svg viewBox="4 16 88 72" aria-hidden="true" class="harbor-mascot">
 <defs><linearGradient id="hm-hull" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f86c6"/><stop offset="1" stop-color="#2c5c96"/></linearGradient></defs>
 <path d="M58 22h9v14h-9z" fill="#2b3c49"/><rect x="58" y="25" width="9" height="3.2" fill="#63e4c0"/>
 <rect x="24" y="30" width="44" height="26" rx="9" fill="#f4f7f6"/>
 <circle cx="37" cy="42" r="5.2" fill="#0d2234"/><circle cx="55" cy="42" r="5.2" fill="#0d2234"/>
 <circle cx="38.6" cy="40.3" r="1.7" fill="#fff"/><circle cx="56.6" cy="40.3" r="1.7" fill="#fff"/>
 <path d="M41 50q5 4 10 0" fill="none" stroke="#0d2234" stroke-width="2.4" stroke-linecap="round"/>
 <circle cx="30" cy="49" r="2.6" fill="#ff9d8a" opacity=".7"/><circle cx="62" cy="49" r="2.6" fill="#ff9d8a" opacity=".7"/>
 <path d="M10 56h76l-9 16a8 8 0 0 1-7 4H26a8 8 0 0 1-7-4z" fill="url(#hm-hull)"/>
 <path d="M14 63h68" stroke="#f4f7f6" stroke-width="2.2"/><path d="M21 72h54" stroke="#c0392b" stroke-width="3"/>
 <path class="hm-wave" d="M4 82q8-6 16 0t16 0 16 0 16 0 16 0 16 0" fill="none" stroke="#63e4c0" stroke-width="3" stroke-linecap="round"/>
</svg>`;

/* ① briefing card */
function initBriefing(){
 const pad=$('.recommendation .panel-pad');if(!pad)return;
 const card=document.createElement('section');card.className='ai-card ai-briefing';card.setAttribute('aria-live','polite');
 card.innerHTML=`<div class="ai-card-head"><span class="ai-badge">AI</span><strong>평형수 조정 브리핑</strong><button type="button" class="ai-refresh">브리핑 생성</button></div><div class="ai-card-body"><p class="ai-muted">추천 이송안과 현재 기울기·탱크·기상을 AI가 담당자용으로 요약합니다. 새 이송안이 나오면 자동으로 갱신됩니다.</p></div><p class="ai-foot">AI 설명은 참고용 · 수치는 물리 모델 계산값</p>`;
 pad.append(card);
 const body=card.querySelector('.ai-card-body'),btn=card.querySelector('.ai-refresh');
 let busy=false,lastKey='',lastAt=0;
 const run=async(manual=false)=>{
  if(busy)return;busy=true;btn.disabled=true;btn.textContent='작성 중…';body.innerHTML='<p class="ai-loading"><span></span><span></span><span></span> AI가 현재 상황을 정리하고 있어요</p>';
  try{const d=await ask('briefing',{},{onWait:s=>{body.innerHTML=`<p class="ai-muted">AI 사용이 몰려 잠시 쉬고 있어요. ${s}초 뒤 다시 시도할게요…</p>`;}});body.innerHTML=replyHtml(d);lastAt=Date.now();}
  catch(e){body.innerHTML=`<p class="ai-error">${esc(e.message)}</p>`;}
  finally{busy=false;btn.disabled=false;btn.textContent='다시 브리핑';}
 };
 btn.onclick=()=>run(true);
 setInterval(()=>{
  if(document.hidden||!status.configured||busy||!card.offsetParent||aiCoolingDown())return; // only while the panel is visible
  const s=twin()?.aiContext?.();if(!s)return;const r=s.recommendation,t=s.transferInProgress;
  const key=r?`${r.from}>${r.to}:${Math.round(r.amountT/20)}`:t?`T${t.from}>${t.to}`:'none';
  if(key!==lastKey&&Date.now()-lastAt>20000&&(r||t||lastKey)){lastKey=key;run();}
 },2000);
}

/* ⑥ risk response card */
function initRiskGuide(){
 const host=$('#model-risk');if(!host)return;
 const card=document.createElement('section');card.className='ai-card ai-risk';card.hidden=true;card.setAttribute('aria-live','polite');
 card.innerHTML=`<div class="ai-card-head"><span class="ai-badge warn">AI</span><strong>위험 대응 안내</strong><button type="button" class="ai-refresh">다시 안내</button></div><div class="ai-card-body"></div><p class="ai-foot">AI 안내는 참고용 · 최종 판단은 담당자와 선박 승인 자료를 따릅니다</p>`;
 host.append(card);
 const body=card.querySelector('.ai-card-body'),btn=card.querySelector('.ai-refresh');
 let busy=false,lastSig='',lastAt=0;
 const run=async()=>{
  if(busy)return;busy=true;btn.disabled=true;body.innerHTML='<p class="ai-loading"><span></span><span></span><span></span> 원인과 조치를 정리하고 있어요</p>';
  try{const d=await ask('risk',{},{onWait:s=>{body.innerHTML=`<p class="ai-muted">AI 사용이 몰려 잠시 쉬고 있어요. ${s}초 뒤 다시 안내할게요…</p>`;}});body.innerHTML=replyHtml(d);lastAt=Date.now();}
  catch(e){body.innerHTML=`<p class="ai-error">${esc(e.message)}</p>`;}
  finally{busy=false;btn.disabled=false;}
 };
 btn.onclick=run;
 setInterval(()=>{
  if(document.hidden)return;const s=twin()?.aiContext?.();if(!s)return;const sev=s.risk.severity;
  if(sev===0){card.hidden=true;lastSig='';return;}
  card.hidden=false;card.dataset.level=String(sev);
  if(!status.configured){if(!busy)body.innerHTML='<p class="ai-muted">AI 키가 설정되면 원인과 즉시 조치를 안내합니다.</p>';return;}
  const sig=`${sev}|${s.risk.reasons.map(r=>r.slice(0,12)).sort().join(',')}`;
  if(sig!==lastSig&&Date.now()-lastAt>15000&&!aiCoolingDown()){lastSig=sig;run();}
 },1500);
}

/* ② ship mascot chat */
function initChat(){
 const launcher=document.createElement('button');launcher.type='button';launcher.className='harbor-launcher';launcher.setAttribute('aria-label','AI 평형수 보조 하버에게 묻기');launcher.innerHTML=`${MASCOT}<span class="hl-bubble">AI에게 물어보세요</span>`;
 const panel=document.createElement('section');panel.className='harbor-chat';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','AI 평형수 보조 채팅');
 panel.innerHTML=`<header><div class="hc-avatar">${MASCOT}</div><div><strong>하버 · AI 평형수 보조</strong><small>현재 시뮬레이션을 보고 답하고, 필요하면 가상 계산을 돌려요</small></div><button type="button" class="hc-reset" title="대화 초기화" aria-label="대화 초기화">↺ 새 대화</button><button type="button" class="hc-close" aria-label="채팅 닫기">×</button></header>
  <div class="hc-log" aria-live="polite"></div>
  <div class="hc-chips"></div>
  <form class="hc-form"><textarea rows="1" maxlength="600" placeholder="예: 풍속 20m/s면 하역 계속해도 돼?" aria-label="질문 입력"></textarea><button type="submit" aria-label="보내기">➤</button></form>
  <p class="hc-note">AI 답변은 참고용이며 수치는 가정 물리 모델 계산값입니다.</p>`;
 document.body.append(launcher,panel);
 const log=panel.querySelector('.hc-log'),form=panel.querySelector('.hc-form'),input=form.querySelector('textarea'),send=form.querySelector('button'),chips=panel.querySelector('.hc-chips');
 const history=[];let busy=false,session=0;
 const add=(who,html,cls='')=>{const m=document.createElement('div');m.className=`hc-msg ${who} ${cls}`;m.innerHTML=html;log.append(m);log.scrollTop=log.scrollHeight;return m;};
 const greet=()=>add('bot',`안녕하세요, 평형수 보조 <b>하버</b>예요. 지금 하역 상황을 보고 설명하거나, "만약 바람이 세지면?" 같은 질문에 시뮬레이션을 돌려 답해 드릴게요.`);
 greet();
 const suggestions=['지금 상황 요약해줘','풍속 20m/s면 하역 계속해도 돼?','P-A에서 S-A로 200t 옮기면 어때?','다음 화물 내리면 어떻게 돼?'];
 chips.innerHTML=suggestions.map(q=>`<button type="button">${esc(q)}</button>`).join('');
 chips.querySelectorAll('button').forEach(b=>b.onclick=()=>{input.value=b.textContent;submit();});
 let chatRequest=null;
 const submit=async()=>{
  const q=input.value.trim();if(!q||busy)return;
  if(status.configured===false&&!status.unreachable){add('bot','AI 키가 서버에 설정되지 않아 지금은 답할 수 없어요.','error');return;}
  busy=true;chatRequest=new AbortController();send.disabled=true;input.value='';input.style.height='';chips.hidden=true;const mine=++session;
  add('user',esc(q));while(history.length>12){history.shift();while(history.length&&history[0].role!=='user')history.shift();}history.push({role:'user',content:q});
  const wait=add('bot','<span class="ai-loading"><span></span><span></span><span></span></span>','pending');
  try{
   for(let round=0;round<3;round++){
    const d=await ask('chat',{messages:history},{signal:chatRequest.signal,onWait:s=>{if(mine===session)wait.innerHTML=`<span class="hc-tool">⏳ AI 사용이 몰려 잠시 쉬고 있어요. ${s}초 뒤 자동으로 이어서 답할게요…</span>`;}});
    if(mine!==session)return;
    if(d.tool_calls?.length){
     history.push({role:'assistant',content:d.content||'',tool_calls:d.tool_calls});
     for(const call of d.tool_calls){
      let args={};try{args=JSON.parse(call.function.arguments||'{}');}catch{}
      wait.innerHTML=`<span class="hc-tool">⚙ 가상 시뮬레이션 실행 중… ${esc(describe(args))}</span>`;
      let result;try{result=twin().aiWhatIf(args);}catch(e){result={error:'계산 실패: '+e.message};}
      history.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(result)});
      add('bot',`<span class="hc-tool done">⚙ 시뮬레이션 실행: ${esc(describe(args))}</span>`,'tool');
     }
     log.append(wait);if(round===2)throw Error('가상 계산 반복 한도에 도달했습니다. 새 대화에서 조건을 하나씩 질문하세요.');continue;
    }
    history.push({role:'assistant',content:d.content||''});
    wait.classList.remove('pending');wait.innerHTML=replyHtml(d);
    break;
   }
  }catch(e){if(mine!==session)return;wait.classList.remove('pending');wait.classList.add('error');wait.textContent=e.message;history.pop();}
  finally{if(mine===session){busy=false;send.disabled=false;log.scrollTop=log.scrollHeight;input.focus();}}
 };
 const describe=a=>{const p=[];if(a.wind_speed!==undefined)p.push(`풍속 ${a.wind_speed}m/s`);if(a.wind_direction!==undefined)p.push(`풍향 ${a.wind_direction}°`);if(a.wave_height!==undefined)p.push(`파고 ${a.wave_height}m`);if(a.wave_period!==undefined)p.push(`주기 ${a.wave_period}초`);if(a.unload_interval!==undefined)p.push(`하역 간격 ${a.unload_interval}초`);if(a.transfer_from)p.push(`${a.transfer_from}에서 ${a.transfer_to}로 ${a.transfer_amount??''}톤 옮기기`);if(a.horizon)p.push(`${a.horizon}초 예측`);return p.join(' · ')||'현재 조건';};
 form.onsubmit=e=>{e.preventDefault();submit();};
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();submit();}});
 input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,96)+'px';});
 const toggle=open=>{panel.hidden=!open;launcher.classList.toggle('open',open);launcher.querySelector('.hl-bubble').hidden=true;if(open)setTimeout(()=>input.focus(),50);};
 const reset=()=>{chatRequest?.abort();session++;history.length=0;busy=false;send.disabled=false;log.replaceChildren();greet();chips.hidden=false;input.value='';input.style.height='';input.focus();};
 panel.querySelector('.hc-reset').onclick=reset;
 launcher.onclick=()=>toggle(panel.hidden);panel.querySelector('.hc-close').onclick=()=>toggle(false);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.stopPropagation();toggle(false);}},true);
 setTimeout(()=>launcher.querySelector('.hl-bubble')?.classList.add('show'),1500);setTimeout(()=>launcher.querySelector('.hl-bubble')?.classList.remove('show'),9000);
 // Stay reachable in fullscreen: move into the fullscreen element and back.
 const follow=()=>{const fs=document.fullscreenElement||document.webkitFullscreenElement||$('#viewBody.pseudo-fullscreen');const host=fs||document.body;if(launcher.parentElement!==host){host.append(launcher,panel);}};
 document.addEventListener('fullscreenchange',follow);document.addEventListener('webkitfullscreenchange',follow);new MutationObserver(follow).observe($('#viewBody')??document.body,{attributes:true,attributeFilter:['class']});
}

const waitMsg=s=>`<p class="ai-muted">AI 사용이 몰려 잠시 쉬고 있어요. ${s}초 뒤 다시 시도할게요…</p>`;
const loading=t=>`<p class="ai-loading"><span></span><span></span><span></span> ${esc(t)}</p>`;
const num=(v,u='')=>v===null||v===undefined||v===''?'—':`${v}${u}`;
function download(name,text){const url=URL.createObjectURL(new Blob(['﻿'+text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

/* ③ work-log writer: facts table from the simulation record + AI narrative */
function initReport(){
 const panel=$('.log-panel');if(!panel)return;
 const card=document.createElement('section');card.className='ai-card ai-report';card.setAttribute('aria-live','polite');
 card.innerHTML=`<div class="ai-card-head"><span class="ai-badge">AI</span><strong>하역·평형수 작업 일지</strong><button type="button" class="ai-refresh">일지 작성</button><button type="button" class="ai-refresh ai-dl" disabled>내려받기</button></div><div class="ai-card-body"><p class="ai-muted">하역이 끝나면 AI가 조건·주요 경과·최대 기울기·이송량·펌프 가동 시간·다음 작업 제안을 일지로 정리합니다. 진행 중에도 중간 기록을 만들 수 있어요.</p></div><p class="ai-foot">표의 수치는 시뮬레이션 기록값 · 서술은 AI 작성(참고용)</p>`;
 panel.querySelector('.panel-header')?.after(card);
 const body=card.querySelector('.ai-card-body'),btn=card.querySelector('.ai-refresh'),dl=card.querySelector('.ai-dl');
 let busy=false,text='',wasComplete=false;
 const rows=d=>{const r=d.results,u=d.unloading,c=d.conditions,e=c.environment;return [
  ['상태',d.status],['화물 자료',d.cargoSource],['하역',`${u.containersUnloaded} / ${u.containersTotal}개 · ${num(u.cargoUnloadedT,'톤')} · 경과 ${u.elapsed}`],
  ['조건',`${c.strategy} · 하역 간격 ${c.unloadIntervalS}초 · 펌프 ${c.pumpRateTps}톤/초 · 시연 한도 ${c.thresholdDeg}도 · ${c.approval}`],
  ['기상',e.windMps!==undefined?`${e.source} · 바람 ${num(e.windMps,'m/s')} · 파고 ${num(e.waveHeightM,'m')} · 주기 ${num(e.wavePeriodS,'초')}`:`${e.source} · ${e.wave}`],
  ['최대 기울기',r.maxHeelDeg===null?'—':`${r.maxHeelSide} ${r.maxHeelDeg}도 (${r.maxHeelAt})`],['파도 포함 최대',`${num(r.maxInstantWithWavesDeg,'도')} · 한도 초과 ${num(r.secondsOverThresholdWithWaves,'초')}`],
  ['물을 안 옮겼다면',num(r.noAdjustmentMaxHeelDeg,'도')],['마지막 상태',`기울기 ${num(r.finalHeelDeg,'도')} · 복원력(GM) ${num(r.finalGmM,'m')}`],
  ['평형수 이송',`${r.transfersApproved}회 · ${num(r.ballastMovedT,'톤')} · 펌프 약 ${num(r.pumpSecondsEstimate,'초')}`],
  ['탱크',d.tanks.map(t=>`${t.id} ${t.startT}→${t.endT}톤`).join(' / ')],
  ...(d.comparison?d.comparison.map(m=>[`비교 · ${m.method}`,m.peakHeelDeg===undefined?m.result:`최대 ${m.peakHeelDeg}도 · 초과 ${m.secondsOverThreshold}초 · 이송 ${m.movedT}톤 · 펌프 ${m.pumpSeconds}초`]):[])];};
 const run=async()=>{
  const d=twin()?.aiReportData?.();if(!d||busy)return;
  dl.disabled=true;text='';
  if(!d.unloading.containersUnloaded&&!d.results.transfersApproved){body.innerHTML='<p class="ai-muted">아직 기록이 없어요. 시뮬레이션을 시작한 뒤 일지를 만들어 주세요.</p>';return;}
  busy=true;btn.disabled=true;btn.textContent='작성 중…';const table=rows(d);
  const tableHtml=`<table class="ai-table">${table.map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>`;
  body.innerHTML=tableHtml+loading('AI가 작업 일지를 쓰고 있어요');
  try{const r=await ask('report',{context:d},{onWait:s=>{body.innerHTML=tableHtml+waitMsg(s);}});
   const story=plainText(r.content||'');body.innerHTML=tableHtml+`<div class="ai-report-text">${replyHtml(r)}</div>`;
   const now=new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
   text=`HARBOR TWIN 하역·평형수 작업 일지\n작성: ${now} (KST) · AI 보조 작성 · 개념검증용 가정 모델\n선박: ${d.vessel}\n\n[기록 수치]\n${table.map(([k,v])=>`- ${k}: ${v}`).join('\n')}\n\n${story}\n\n[주요 기록 원문]\n${d.events.join('\n')}\n\n※ 수치는 시뮬레이션 기록값, 서술은 AI 작성입니다. 실제 선박 안전 판정이 아닙니다.\n`;
   dl.disabled=false;}
  catch(e){body.innerHTML=tableHtml+`<p class="ai-error">${esc(e.message)}</p>`;}
  finally{busy=false;btn.disabled=false;btn.textContent='다시 작성';}
 };
 btn.onclick=run;dl.onclick=()=>{if(text)download(`작업일지_${new Date().toISOString().slice(0,16).replace(/[-:T]/g,'')}.txt`,text);};
 // Write once automatically when the run finishes (one AI call per completed job).
 setInterval(()=>{const done=!!twin()?.isComplete?.();if(done&&!wasComplete&&status.configured&&!aiCoolingDown())run();wasComplete=done;},2000);
}

/* ④ pre-unloading weather check: verdict from a fixed rule table, explanation by AI */
function initWeatherCheck(){
 const env=$('.environment-panel');if(!env)return;
 const card=document.createElement('section');card.className='ai-card ai-weather';card.setAttribute('aria-live','polite');
 card.innerHTML='<div class="ai-card-head"><span class="ai-badge">AI</span><strong>현재 적용 조건 · 작업 판정</strong><button type="button" class="ai-refresh">AI 설명 받기</button></div><div class="ai-verdict"><span class="ai-light"></span><b>적용 조건 확인 중</b><small></small></div><div class="ai-rules"></div><div class="ai-card-body"></div><p class="ai-foot">채팅·가상 실험과 같은 시연 기준 · 최신 조회나 미적용 입력으로 판정을 덮어쓰지 않습니다.</p>';
 const anchor=env.querySelector('.applied-box')||env.querySelector('#env-applied');anchor?anchor.after(card):env.append(card);
 const verdict=card.querySelector('.ai-verdict'),rules=card.querySelector('.ai-rules'),body=card.querySelector('.ai-card-body'),btn=card.querySelector('.ai-refresh');
 let busy=false,lastKey='',current=null;
 function refresh(){const c=twin()?.aiContext?.();if(!c)return;const a=c.operationAssessment;current=c;
  const key=JSON.stringify([c.environment,a.label]);if(key!==lastKey){body.innerHTML='<p class="ai-muted">현재 적용 조건으로 설명을 생성할 수 있습니다. 조건을 바꾸면 이전 설명을 지웁니다.</p>';lastKey=key;}
  card.dataset.level=String(a.level);verdict.querySelector('b').textContent=a.label;
  verdict.querySelector('small').textContent=`${a.port??'환경 미적용'} · ${a.source} · ${a.conditionAt??'시각 미설정'}`;
  rules.innerHTML=`<table class="ai-table">${a.items.map(i=>`<tr data-level="${i.level??'x'}"><th>${esc(i.name)}</th><td>${i.value===null?'자료 없음':esc(i.value+' '+i.unit)}</td><td>${esc(i.level===null?'판정 보류':['시연 기준 내','주의','중지 검토'][i.level])}</td></tr>`).join('')}</table><p class="ai-src">${esc(a.scope)}${a.missing.length?' · 미확인: '+esc(a.missing.join(', ')):''}</p>`;
 }
 btn.onclick=async()=>{if(busy)return;refresh();if(!current)return;busy=true;btn.disabled=true;body.innerHTML=loading('현재 적용 조건을 설명하고 있어요');const key=lastKey;
  try{const d=await ask('weather',{context:current});if(key===lastKey)body.innerHTML=replyHtml(d);}
  catch(e){if(key===lastKey)body.innerHTML=`<p class="ai-error">${esc(e.message)}</p>`;}
  finally{busy=false;btn.disabled=false;}};
 document.addEventListener('harbor:environment',refresh);
 // This reads applied model data only: it never queries or substitutes a live observation.
 setTimeout(refresh,0);setInterval(()=>{if(!document.hidden&&card.offsetParent)refresh();},2000);
}

/* ⑤ manifest → unloading plan: AI extracts, the browser validates, the operator applies */
const SAMPLE=`[하역 지시서] MV HARBOR ONE · 부산항 신항 3번 선석
1) HDMU4821935  BAY 05 ROW 04 TIER 84  VGM 28,400kg  1순위
2) MSCU7710452  3번 베이 우현 바깥 갑판 2단  31.2t  2순위
3) TGHU5521098  BAY 2 / ROW 2 / TIER 3 / 24.6톤 / 순서 3
4) CMAU3304617  B6-R1-T3  27,900 kg  #4
5) OOLU9128830  BAY 11 ROW 03 TIER 84  22.1 t  하역순서 5
6) SEGU6640021  4번 베이 좌현 안쪽 갑판 위 2단, 33.5톤, 6번째
7) KMTU1187452  BAY 1 ROW 4 TIER 3  26.0t  7
8) TCLU8836105  BAY 03 ROW 03 TIER 06 (창내)  35.2t  8
9) EMCU4471209  위치 미정  25.0t
10) HLXU2093371  BAY 6 ROW 2 TIER 2  29.8 t  9`;
function initManifest(){
 const host=$('#inputMessage');if(!host)return;
 const card=document.createElement('section');card.className='ai-card ai-manifest';card.setAttribute('aria-live','polite');
 card.innerHTML=`<div class="ai-card-head"><span class="ai-badge">AI</span><strong>적하목록 → 하역 계획 변환</strong></div>
 <p class="ai-muted ai-help">적하목록·하역 지시서를 붙여 넣으면 AI가 화물마다 위치(BAY·ROW·TIER)·중량·하역 순서를 뽑아요. 확인 후 적용하면 시뮬레이션이 그 계획으로 다시 시작합니다.</p>
 <textarea class="ai-manifest-input" rows="6" maxlength="6000" placeholder="예) MSCU1234567 BAY 03 ROW 04 TIER 84 28,400kg 1순위"></textarea>
 <label>적용 방식 <select class="ai-manifest-mode"><option value="patch">예제 일부 수정 · 나머지는 합성 화물 유지</option><option value="listed">목록만 적재 · 나머지 칸은 비움</option></select></label><p class="ai-muted">실제 베이플랜을 가상 격자로 축약합니다. 위치와 중량, 하부 지지 화물을 직접 확인하세요.</p><div class="ai-actions"><button type="button" class="outline-btn ai-sample">예시 넣기</button><button type="button" class="primary-btn ai-convert">AI로 변환</button></div>
 <div class="ai-card-body"></div><div class="ai-actions"><button type="button" class="primary-btn ai-apply" hidden>이 계획으로 시뮬레이션 적용</button></div>
 <label><input type="checkbox" class="ai-manifest-confirm"> 변환 위치·중량·제외 항목과 선택한 적용 방식을 확인했습니다.</label><p class="ai-foot">가상 선박 격자: BAY 1(선미)–6(선수) · ROW 1·2 좌현 / 3·4 우현 · TIER 1 창내, 2·3 갑판 위 · 목록에 없는 화물은 예제 중량·기본 순서</p>`;
 host.before(card);
 const input=card.querySelector('textarea'),body=card.querySelector('.ai-card-body'),conv=card.querySelector('.ai-convert'),apply=card.querySelector('.ai-apply');
 let extracted=null,busy=false;
 card.querySelector('.ai-sample').onclick=()=>{input.value=SAMPLE;input.focus();};
 const mode=card.querySelector('.ai-manifest-mode'),confirm=card.querySelector('.ai-manifest-confirm');
 const invalidate=()=>{confirm.checked=false;apply.disabled=true;};mode.onchange=invalidate;confirm.onchange=()=>{apply.disabled=!confirm.checked;};input.addEventListener('input',()=>{extracted=null;apply.hidden=true;invalidate();});
 const parse=t=>{const s=String(t||''),a=s.indexOf('{'),b=s.lastIndexOf('}');if(a<0||b<a)throw Error('AI가 목록을 읽지 못했어요. 다시 시도해 주세요.');return JSON.parse(s.slice(a,b+1));};
 conv.onclick=async()=>{
  const text=input.value.trim();if(text.length<10){body.innerHTML='<p class="ai-error">적하목록 내용을 붙여 넣어 주세요.</p>';return;}
  if(busy)return;invalidate();busy=true;conv.disabled=true;apply.hidden=true;extracted=null;body.innerHTML=loading('AI가 적하목록을 읽고 있어요');
  try{const r=await ask('manifest',{manifest:text,context:{}},{onWait:s=>{body.innerHTML=waitMsg(s);}});
   const data=parse(r.content);const pv=twin().manifestPreview(data.items);
   const notes=(Array.isArray(data.notes)?data.notes:[]).slice(0,5).map(n=>plainText(n));
   extracted=data.items;
   body.innerHTML=`<p><b>${pv.items.length}개</b> 화물을 읽었어요${pv.skipped.length?` · ${pv.skipped.length}개는 제외`:''}.</p>
    ${pv.items.length?`<div class="ai-scroll"><table class="ai-table ai-grid"><tr><th>순서</th><th>식별자</th><th>위치</th><th>현측</th><th>중량</th></tr>${[...pv.items].sort((a,b)=>(a.order||1e9)-(b.order||1e9)).map(i=>`<tr><td>${i.order||'—'}</td><td>${esc(i.label||i.id)}</td><td>BAY ${i.bay}·ROW ${i.row}·TIER ${i.tier}</td><td>${i.side}</td><td>${i.weight}톤</td></tr>`).join('')}</table></div>`:''}
    ${pv.skipped.length?`<p class="ai-error">제외: ${pv.skipped.map(esc).join(' / ')}</p>`:''}
    ${notes.length?`<ul class="ai-notes">${notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`:''}`;
   apply.hidden=!pv.items.length;apply.disabled=!confirm.checked;}
  catch(e){body.innerHTML=`<p class="ai-error">${esc(e.message)}</p>`;}
  finally{busy=false;conv.disabled=false;}
 };
 apply.onclick=()=>{if(!extracted||!confirm.checked)return;try{const res=twin().applyManifest(extracted,{mode:mode.value});apply.hidden=true;
   $('#inputMessage').textContent=`AI 적하목록 변환 적용 완료 · ${res.applied}개 화물의 중량·순서를 반영했어요.${res.reordered?` 같은 칸 위쪽 화물 ${res.reordered}개를 먼저 내리도록 순서를 맞췄어요.`:''} 시작 버튼을 눌러 시뮬레이션하세요.`;
   body.insertAdjacentHTML('beforeend','<p class="ai-ok">✓ 적용 완료 · 시뮬레이션이 이 계획으로 초기화됐어요.</p>');}
  catch(e){body.insertAdjacentHTML('beforeend',`<p class="ai-error">${esc(e.message)}</p>`);}};
}

export async function initAssistant(){
 try{status=await fetch(API+'/status',{signal:AbortSignal.timeout(8000)}).then(r=>r.json());}catch{status={configured:false,unreachable:true};}
 initBriefing();initRiskGuide();initChat();initReport();initWeatherCheck();initManifest();
 if(!status.configured)document.body.classList.add('ai-unconfigured');
}
