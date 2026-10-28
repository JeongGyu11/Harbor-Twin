// AI 평형수 조정 보조 (Groq LLM via our server). Numbers come from the physics model;
// the LLM only explains, guides and answers. Three surfaces:
//  ① briefing card in the 균형 조정 panel  ⑥ response card in the risk panel  ② ship mascot chat.
import {plainText} from './ai-plain.mjs?v=plain2';
const $=s=>document.querySelector(s);
const API=(['localhost','127.0.0.1'].includes(location.hostname)&&location.port==='4174'?'http://127.0.0.1:4175':'')+'/api/ai';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=s=>esc(plainText(s)).replace(/\n/g,'<br>');
const twin=()=>window.harborTwin;

let status={configured:null};
async function ask(role,extra={}){
 const context=twin()?.aiContext?.()??{};
 const r=await fetch(API+'/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role,context,...extra})});
 let data={};try{data=await r.json();}catch{}
 if(!r.ok)throw Error(data.error||`AI 요청 실패 (${r.status})`);
 return data;
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
  try{const d=await ask('briefing');body.innerHTML=`<p>${fmt(d.content||'응답이 비어 있습니다.')}</p>`;lastAt=Date.now();}
  catch(e){body.innerHTML=`<p class="ai-error">${esc(e.message)}</p>`;}
  finally{busy=false;btn.disabled=false;btn.textContent='다시 브리핑';}
 };
 btn.onclick=()=>run(true);
 setInterval(()=>{
  if(!status.configured||busy||!card.offsetParent)return; // only while the panel is visible
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
  try{const d=await ask('risk');body.innerHTML=`<p>${fmt(d.content)}</p>`;lastAt=Date.now();}
  catch(e){body.innerHTML=`<p class="ai-error">${esc(e.message)}</p>`;}
  finally{busy=false;btn.disabled=false;}
 };
 btn.onclick=run;
 setInterval(()=>{
  const s=twin()?.aiContext?.();if(!s)return;const sev=s.risk.severity;
  if(sev===0){card.hidden=true;lastSig='';return;}
  card.hidden=false;card.dataset.level=String(sev);
  if(!status.configured){if(!busy)body.innerHTML='<p class="ai-muted">AI 키가 설정되면 원인과 즉시 조치를 안내합니다.</p>';return;}
  const sig=`${sev}|${s.risk.reasons.map(r=>r.slice(0,12)).sort().join(',')}`;
  if(sig!==lastSig&&Date.now()-lastAt>15000){lastSig=sig;run();}
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
 const submit=async()=>{
  const q=input.value.trim();if(!q||busy)return;
  if(status.configured===false){add('bot','AI 키가 서버에 설정되지 않아 지금은 답할 수 없어요.','error');return;}
  busy=true;send.disabled=true;input.value='';input.style.height='';chips.hidden=true;const mine=++session;
  add('user',esc(q));history.push({role:'user',content:q});
  const wait=add('bot','<span class="ai-loading"><span></span><span></span><span></span></span>','pending');
  try{
   for(let round=0;round<3;round++){
    const d=await ask('chat',{messages:history});
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
     log.append(wait);continue;
    }
    history.push({role:'assistant',content:d.content||''});
    wait.classList.remove('pending');wait.innerHTML=fmt(d.content||'답변을 만들지 못했어요. 질문을 바꿔 다시 시도해 주세요.');
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
 const reset=()=>{session++;history.length=0;busy=false;send.disabled=false;log.replaceChildren();greet();chips.hidden=false;input.value='';input.style.height='';input.focus();};
 panel.querySelector('.hc-reset').onclick=reset;
 launcher.onclick=()=>toggle(panel.hidden);panel.querySelector('.hc-close').onclick=()=>toggle(false);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.stopPropagation();toggle(false);}},true);
 setTimeout(()=>launcher.querySelector('.hl-bubble')?.classList.add('show'),1500);setTimeout(()=>launcher.querySelector('.hl-bubble')?.classList.remove('show'),9000);
 // Stay reachable in fullscreen: move into the fullscreen element and back.
 const follow=()=>{const fs=document.fullscreenElement||document.webkitFullscreenElement||$('#viewBody.pseudo-fullscreen');const host=fs||document.body;if(launcher.parentElement!==host){host.append(launcher,panel);}};
 document.addEventListener('fullscreenchange',follow);document.addEventListener('webkitfullscreenchange',follow);new MutationObserver(follow).observe($('#viewBody')??document.body,{attributes:true,attributeFilter:['class']});
}

export async function initAssistant(){
 try{status=await fetch(API+'/status').then(r=>r.json());}catch{status={configured:false,unreachable:true};}
 initBriefing();initRiskGuide();initChat();
 if(!status.configured)document.body.classList.add('ai-unconfigured');
}
