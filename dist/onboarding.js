// Cinematic onboarding: the live 3D vessel scene fills the screen while the camera flies
// around the ship, with the product story and entry points on top. Reuses the existing
// renderer (no extra assets). Shown on each visit until "다시 보지 않기" is ticked.
const KEY='harbor-twin.onboarding.v1';
const $=s=>document.querySelector(s);
const view=$('#viewBody');
const ROOT=(['localhost','127.0.0.1'].includes(location.hostname)&&location.port==='4174'?'http://127.0.0.1:4175':'')+'/api';
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let skip=false;try{skip=localStorage.getItem(KEY)==='skip';}catch{}
const forced=new URLSearchParams(location.search).has('intro');

const AI=[
 ['하역 전','작업 조건 판정','적용한 관측·조건을 시연용 기준표로 판정, AI가 설명','◐'],
 ['하역 전','적하목록 → 하역 계획','형식이 제각각인 목록을 AI가 읽어 계획으로','▤'],
 ['하역 중','평형수 조정 브리핑','추천 이송안을 담당자용 짧은 브리핑으로','✧'],
 ['하역 중','하버에게 묻기','“만약 풍속 20m/s면?” 가상 시뮬레이션 답변','⚓'],
 ['하역 중','위험 대응 안내','주의 이상 단계에서 원인과 조치 안내','⚠'],
 ['하역 후','작업 일지 자동 작성','기록 수치 + AI 서술 일지 내려받기','✎']
];

function build(){
 const el=document.createElement('section');el.className='onboard';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','HARBOR TWIN 소개');
 el.innerHTML=`<div class="ob-shade"></div><div class="ob-bars"><i></i><i></i></div>
 <div class="ob-top"><div class="ob-brand">HARBOR <span>TWIN</span><small>MARITIME INTELLIGENCE</small></div><p class="ob-live" aria-live="polite"><span class="ob-dot"></span><span class="ob-live-text">최신 관측 불러오는 중…</span></p></div>
 <div class="ob-hero">
  <p class="ob-eyebrow">2026 해운·항만·물류 AX 프로토타입</p>
  <h1 class="ob-title"><span>화물을 내릴수록</span><span>기우는 배,</span><span><em>AI</em>와 함께 균형을 지킵니다.</span></h1>
  <p class="ob-lead">정박 중 컨테이너를 하역하면 배의 무게중심이 바뀝니다. HARBOR TWIN은 디지털 트윈으로 기울기를 미리 계산하고, AI가 평형수 조정을 설명·안내해 담당자의 판단과 승인을 돕습니다.</p>
  <div class="ob-actions"><button type="button" class="ob-start">▶ 바로 시작하기</button><button type="button" class="ob-guide">◈ 시작 가이드</button><button type="button" class="ob-ai">✦ AI 기능 가이드</button></div>
 </div>
 <div class="ob-flow" aria-label="AI 기능 6가지">${AI.map(([phase,name,desc,icon],i)=>`<article style="--i:${i}"><span class="ob-icon" aria-hidden="true">${icon}</span><small>${phase}</small><b>${name}</b><p>${desc}</p></article>`).join('')}</div>
 <footer class="ob-foot"><label><input type="checkbox" class="ob-never"> 다음부터 바로 시작</label><span>계산·판정은 물리 모델과 시연용 기준표 · AI는 설명·작성·목록 읽기 · 적용과 승인은 담당자</span><button type="button" class="ob-skip">건너뛰기 ✕</button></footer>`;
 return el;
}

// Latest stored KMA buoy observation per port, rotating every 3 s.
const PORTS=[['busanNew','부산항 신항'],['busan','부산항 북항'],['incheon','인천항'],['ulsan','울산항'],['gwangyang','광양항'],['pyeongtaek','평택·당진항'],['pohang','포항 영일만항']];
function liveWeather(el){
 const pill=el.querySelector('.ob-live'),text=el.querySelector('.ob-live-text');let list=[],i=0,timer=0,refresh=0;
 const load=()=>Promise.all(PORTS.map(([key,name])=>fetch(`${ROOT}/environment/latest?port=${key}`,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{const m=d?.marine?.usable?d.marine:null;return m?{name,wind:m.data.wind,height:m.data.height,at:String(m.observedAt).slice(11,16)}:null;}).catch(()=>null))).then(r=>{list=r.filter(Boolean);});
 const show=()=>{if(!el.isConnected){clearInterval(timer);clearInterval(refresh);return;}
  if(!list.length){text.textContent='가정 모델 시뮬레이션 · 관측 대기';pill.classList.add('off');return;}
  const p=list[i%list.length];i++;pill.classList.remove('off');text.classList.add('swap');
  setTimeout(()=>{text.textContent=`${p.name} 인근 · 바람 ${p.wind} m/s · 파고 ${p.height} m · 기상청 ${p.at} 관측`;text.classList.remove('swap');},reduced?0:250);};
 load().then(()=>{show();timer=setInterval(show,3000);});
 refresh=setInterval(load,300000);
}

function open(){
 if(!view||document.querySelector('.onboard'))return;
 const twin=window.harborTwin;const has3d=!!$('#scene canvas');
 if(has3d&&$('#scene').hidden)$('#view3d')?.click();
 const el=build();document.body.append(el);
 document.body.classList.add('onboarding-open');view.classList.add('onboard-stage');
 liveWeather(el);
 // Camera: fly in from high and far, then a slow orbit around the vessel.
 let raf=0,start=performance.now();
 const ease=x=>1-Math.pow(1-Math.min(1,x),3);
 const tick=now=>{
  const t=(now-start)/1000,k=reduced?1:ease(t/6.5);
  const yaw=-0.25+(reduced?0:t*0.045)+k*0.9;
  twin?.setCamera?.(yaw,0.62-0.44*k+(reduced?0:Math.sin(t*.22)*.025),300-130*k);
  raf=requestAnimationFrame(tick);
 };
 if(has3d&&twin?.setCamera)raf=requestAnimationFrame(tick);else el.classList.add('no3d');
 requestAnimationFrame(()=>el.classList.add('in'));
 const close=after=>{
  if(el.classList.contains('out'))return;
  try{if(el.querySelector('.ob-never').checked)localStorage.setItem(KEY,'skip');}catch{}
  el.classList.add('out');cancelAnimationFrame(raf);
  setTimeout(()=>{el.remove();view.classList.remove('onboard-stage');document.body.classList.remove('onboarding-open');
   twin?.setCamera?.(.72,.3,175);window.dispatchEvent(new Event('resize'));after?.();},reduced?0:650);
 };
 el.querySelector('.ob-start').onclick=()=>close(()=>window.scrollTo({top:0,behavior:'auto'}));
 el.querySelector('.ob-guide').onclick=()=>close(()=>$('.tutorial-launch')?.click());
 el.querySelector('.ob-ai').onclick=()=>close(()=>$('.tutorial-ai-launch')?.click());
 el.querySelector('.ob-skip').onclick=()=>close();
 el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
 setTimeout(()=>el.querySelector('.ob-start').focus({preventScroll:true}),400);
}

window.harborOnboarding={open};
if(!skip||forced)open();
