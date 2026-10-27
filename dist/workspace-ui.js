export function initWorkspaceUI(){
 const originalIds=new Map([...document.querySelectorAll('[id]')].map(n=>[n.id,n]));
 const $=s=>document.querySelector(s)??(s.startsWith('#')?originalIds.get(s.slice(1)):null),el=(tag,cls,html='')=>{const n=document.createElement(tag);n.className=cls;n.innerHTML=html;return n;};
 const main=$('main'),env=$('.environment-panel'),old=env.querySelector('details'),rail=el('aside','setup-rail'),stage=el('div','simulation-stage'),layout=el('div','simulation-layout');
 $('.page-title h1').textContent='항구를 선택하고, 하역을 시작하세요.';$('.page-title p').textContent='환경 선택 → 관측 적용 → 시뮬레이션 → 운전안 비교';
 const intro=el('details','intro-details');intro.append(el('summary','','서비스 소개와 구현 범위'),$('.mission'));main.append(intro);
 const mode=el('div','environment-modes',`<div class="setup-heading"><span>01 / 환경 조건</span><h2>어떤 조건으로 실험할까요?</h2></div><div class="mode-switch" role="group" aria-label="환경 설정 모드"><button id="mode-observed" class="active" aria-pressed="true">실제 관측 사용</button><button id="mode-manual" aria-pressed="false">사용자 조건 실험</button></div><p id="mode-description">선택한 항구의 실제 날씨와 해양 관측을 사용합니다.</p>`);
 const location=$('#env-location').closest('.input-grid'),manual=$('#env-weather').closest('.input-grid'),selected=$('#selected-observations'),weather=$('.weather-panel'),applied=$('#env-applied');
 const observed=el('div','observed-mode'),manualMode=el('div','manual-mode');observed.id='observed-mode';manualMode.id='manual-mode';manualMode.hidden=true;
 const timeChoice=el('label','time-choice','관측 기준<select id="observation-time-mode" aria-label="관측 기준"><option value="latest">최신 관측</option><option value="selected">과거 날짜·시간 선택</option></select>');observed.append(timeChoice);
 const summary=el('div','observation-summary','<span class="summary-label">조회한 관측 · 적용 버튼으로 반영</span><div id="observation-cards">관측을 불러오는 중…</div><p id="observation-state" role="status"></p>');observed.append(summary);
 const latestActions=el('div','latest-actions');latestActions.append($('#weather-apply'),$('#weather-fetch'));$('#weather-apply').textContent='최신 관측 적용 · 초기화';$('#weather-fetch').textContent='관측 새로고침';observed.append(latestActions);
 const historical=el('div','historical-actions');historical.append($('#selected-fetch-apply'),$('#selected-status'));historical.hidden=true;observed.append(historical);
 const details=el('details','observation-details');details.append(el('summary','','관측소·시각·수집 상태 상세'),weather,selected,$('#observation-panel'));observed.append(details);
 manualMode.append(el('p','manual-hint','날씨·바람·파도를 직접 설정해 가정 조건을 시험합니다. 관측값을 바꾸면 사용자 수정 조건으로 표시합니다.'),manual,$('#env-apply'));$('#env-apply').textContent='사용자 조건 적용 · 초기화';
 const heading=$('#env-heading').closest('label');manual.append(heading);manualMode.append(el('small','manual-hint','풍향·파향은 불어오는 방향이며 북쪽이 0°입니다. 선수 방향과의 상대 각도를 계산합니다.'));
 const forecasts=el('details','forecast-details');forecasts.append(el('summary','','고급 설정 · 모델 예보 / 환경 해제'));
 for(const id of ['#env-now','#env-fetch-apply','#env-fetch','#env-clear'])forecasts.append($(id));
 const auto=$('#env-auto').closest('.wave-controls');forecasts.append(auto);$('#env-message').textContent='관측을 적용하거나 사용자 조건을 설정하세요.';$('#env-auto').checked=false;
 const appliedBox=el('div','applied-box','<span class="summary-label">현재 시뮬레이션에 적용된 조건</span>');appliedBox.append(applied);
 env.replaceChildren(mode,location,observed,manualMode,$('#env-message'),appliedBox,forecasts);rail.append(env);
 const scenario=$('.scenario-panel');rail.append(scenario);const plan=$('.input-panel:not(.environment-panel)');rail.append(plan);
 for(const selector of ['.metric-grid','.workspace','.wave-readout','.bottom-grid','.decision-panel','.experiment']){const n=$(selector);if(n)stage.append(n);}
 const toolbar=el('div','stage-toolbar','<div><span class="online-dot"></span> 선박 디지털 트윈 <small>드래그 회전 · 휠 확대</small></div><button id="expand-simulation" class="outline-btn">화면 크게 보기 ⛶</button>');const playback=el('div','stage-playback');playback.append($('#play'),$('#reset'));toolbar.insertBefore(playback,toolbar.lastElementChild);stage.prepend(toolbar);stage.prepend(el('div','applied-strip','<span>적용 조건</span><p id="applied-compact">아직 환경을 적용하지 않았습니다. 기본 합성 조건으로 시작할 수 있습니다.</p>'));
 const vessel=$('.vessel-bar');if(vessel)details.append(vessel);
 layout.append(rail,stage);$('.page-title').after(layout);
 // Keep controls and IDs intact so existing API, simulation and comparison logic remain connected.
 for(const n of [...old.children])if(n.tagName!=='SUMMARY'&&!n.closest('body'))forecasts.append(n);
 const dateLabel=$('#env-time').closest('label');dateLabel.hidden=true;
 const switchMode=manualActive=>{observed.hidden=manualActive;manualMode.hidden=!manualActive;document.body.dataset.environmentMode=manualActive?'manual':'observed';$('#mode-observed').classList.toggle('active',!manualActive);$('#mode-manual').classList.toggle('active',manualActive);$('#mode-observed').setAttribute('aria-pressed',String(!manualActive));$('#mode-manual').setAttribute('aria-pressed',String(manualActive));dateLabel.hidden=!manualActive&&$('#observation-time-mode').value==='latest';$('#mode-description').textContent=manualActive?'직접 입력한 가정 조건으로 실험합니다. 적용 전까지 기존 실험을 유지합니다.':'실제 날씨·해양 관측을 조회하고 적용합니다.';};
 $('#mode-observed').onclick=()=>switchMode(false);$('#mode-manual').onclick=()=>switchMode(true);switchMode(false);
 $('#observation-time-mode').onchange=()=>{const historic=$('#observation-time-mode').value==='selected';dateLabel.hidden=!historic;historical.hidden=!historic;latestActions.hidden=historic;summary.hidden=false;updateSummary();details.open=false;};
 const updateSummary=()=>{$('#observation-state').textContent=$('#observation-time-mode').value==='selected'?'':$('#weather-status').textContent;const historic=$('#observation-time-mode').value==='selected',rawText=(historic?$('#selected-weather'):$('#weather-current')).textContent,kind=rawText.match(/\/ (clear|cloud|rain|snow|fog) \//)?.[1],text=historic?({clear:'맑음',cloud:'흐림',rain:'비',snow:'눈',fog:'안개'}[kind]??'조회 대기'):rawText,marine=(historic?$('#selected-marine'):$('#weather-marine')).textContent;$('#observation-cards').replaceChildren(...[['날씨',text.split(' · ')[0]],['바람',marine.match(/풍속 ([^·]+) · 풍향 ([^·]+)/)?.slice(1).join(' / ')??'수신 대기'],['파도',marine.match(/파고 ([^·]+) · 주기 ([^·]+)/)?.slice(1).join(' / ')??'수신 대기']].map(([label,value])=>{const n=el('div','observation-card');n.append(el('small','',label));const b=el('strong','');b.textContent=value;n.append(b);return n;}));};
 const summaryObserver=new MutationObserver(updateSummary);for(const n of [weather,$('#selected-weather'),$('#selected-marine')])summaryObserver.observe(n,{subtree:true,childList:true,characterData:true});updateSummary();new MutationObserver(()=>{$('#applied-compact').textContent=applied.textContent;}).observe(applied,{subtree:true,childList:true,characterData:true});
 const fx=$('.weather-fx-controls'),fxDetails=el('details','weather-fx-details');fxDetails.append(el('summary','','날씨 시각 효과 · 고급'));fx.before(fxDetails);fxDetails.append(fx);
 $('#expand-simulation').onclick=()=>{const big=document.body.classList.toggle('simulation-expanded');$('#expand-simulation').textContent=big?'설정 함께 보기 ↙':'화면 크게 보기 ⛶';window.dispatchEvent(new Event('resize'));};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('simulation-expanded'))$('#expand-simulation').click();});
}
