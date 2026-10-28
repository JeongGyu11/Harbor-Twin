import {initWindSelection} from './wind-selection.js?v=windbands1';
import {initPanelNavigation} from './panel-navigation.js?v=3';
export function initWorkspaceUI(){
 const originalIds=new Map([...document.querySelectorAll('[id]')].map(n=>[n.id,n]));
 const $=s=>document.querySelector(s)??(s.startsWith('#')?originalIds.get(s.slice(1)):null),el=(tag,cls,html='')=>{const n=document.createElement(tag);n.className=cls;n.innerHTML=html;return n;};
 const main=$('main'),env=$('.environment-panel'),old=env.querySelector('details'),rail=el('aside','setup-rail'),stage=el('div','simulation-stage'),layout=el('div','simulation-layout');
 $('.page-title h1').textContent='적재·하역에 따른 균형을 비교하세요.';$('.page-title p').textContent='환경 선택 → 화물·탱크 배치 실험 → 운전 추천·결과 비교';
 const intro=el('details','intro-details');intro.append(el('summary','','서비스 소개와 구현 범위'),$('.mission'));main.append(intro);
 const mode=el('div','environment-modes',`<div class="setup-heading"><span>01 / 환경 조건</span><h2>어떤 조건으로 실험할까요?</h2></div><div class="mode-switch" role="group" aria-label="환경 설정 모드"><button id="mode-observed" class="active" aria-pressed="true">실제 관측 사용</button><button id="mode-manual" aria-pressed="false">사용자 조건 실험</button></div><p id="mode-description">선택한 항구의 실제 날씨와 해양 관측을 사용합니다.</p>`);
 const location=$('#env-location').closest('.input-grid'),manual=$('#env-weather').closest('.input-grid'),selected=$('#selected-observations'),weather=$('.weather-panel'),applied=$('#env-applied');
 const observed=el('div','observed-mode'),manualMode=el('div','manual-mode');observed.id='observed-mode';manualMode.id='manual-mode';manualMode.hidden=true;
 const timeChoice=el('label','time-choice','관측 기준<select id="observation-time-mode" aria-label="관측 기준"><option value="latest">최신 관측</option><option value="selected">과거 날짜·시간 선택</option></select>');observed.append(timeChoice);
 const summary=el('div','observation-summary','<span class="summary-label">조회한 관측 · 조회·적용으로 시뮬레이션 반영</span><div id="observation-cards">관측을 불러오는 중…</div><p id="observation-state" role="status"></p>');observed.append(summary);
 const latestActions=el('div','latest-actions');latestActions.append($('#weather-apply'),$('#weather-fetch'));$('#weather-apply').textContent='최신 관측 적용 · 초기화';$('#weather-fetch').textContent='관측 새로고침';const legacy=el('div','legacy-environment-controls');legacy.hidden=true;legacy.append(latestActions);const runObservation=el('button','primary-btn','관측 조회·적용');runObservation.id='observation-run';observed.append(runObservation);
 const historical=el('div','historical-actions');historical.append($('#selected-fetch-apply'),$('#selected-status'));historical.hidden=true;legacy.append(historical);legacy.append($('#selected-status'));
 const details=el('details','observation-details');details.append(el('summary','','관측소·시각·수집 상태 상세'),weather,selected);observed.append(details);selected.hidden=true;
 manualMode.append(el('p','manual-hint','날씨·바람·파도를 직접 설정해 가정 조건을 시험합니다. 관측값을 바꾸면 사용자 수정 조건으로 표시합니다.'),manual,$('#env-apply'));$('#env-apply').textContent='사용자 조건 적용 · 초기화';
 const heading=$('#env-heading').closest('label');manual.append(heading);const windHelp=el('small','wind-input-help','허용 범위 0–113.2 m/s · 상한은 3초 돌풍 기록 · 평균풍속과 다름');windHelp.id='wind-input-help';windHelp.setAttribute('aria-live','polite');$('#env-wind').setAttribute('aria-describedby','wind-input-help');$('#env-wind').closest('label').append(windHelp);$('#env-wind').addEventListener('input',()=>{const field=$('#env-wind'),invalid=!field.value.trim()||!Number.isFinite(Number(field.value))||Number(field.value)<0||Number(field.value)>113.2;field.setAttribute('aria-invalid',String(invalid));windHelp.classList.toggle('invalid',invalid);windHelp.textContent=invalid?'적용 불가: 풍속은 0–113.2 m/s입니다. 이전 적용값을 유지합니다.':'허용 범위 0–113.2 m/s · 상한은 3초 돌풍 기록 · 평균풍속과 다름';});
 manualMode.append(el('small','manual-hint','풍향·파향은 불어오는 방향이며 북쪽이 0°입니다. 선수 방향과의 상대 각도를 계산합니다.'));
 const advanced=el('details','environment-advanced');advanced.append(el('summary','','고급 설정 · 예보 / 개별 해양 / 시각 시연'));const forecasts=el('details','forecast-details');forecasts.append(el('summary','','모델 예보 · 관측과 별개'));const marineAdvanced=el('details','marine-advanced');marineAdvanced.append(el('summary','','개별 해양 관측 · 날씨 없이 적용'),$('#observation-panel'));const historicalMarine=el('div','historical-marine-actions');historicalMarine.hidden=true;historicalMarine.append($('#selected-marine-apply'));marineAdvanced.append(historicalMarine);
 for(const id of ['#env-now','#env-fetch-apply'])forecasts.append($(id));$('#env-fetch-apply').textContent='모델 예보 조회·적용';legacy.append($('#env-fetch'));advanced.append(forecasts,marineAdvanced,$('#env-clear'));advanced.append(legacy);
 const auto=$('#env-auto').closest('.wave-controls'),repeat=el('details','forecast-refresh-details');repeat.append(el('summary','','예보 반복 조회 · 선택 사항'),auto);forecasts.append(repeat);$('#env-message').textContent='관측을 적용하거나 사용자 조건을 설정하세요.';$('#env-auto').checked=false;
 const appliedBox=el('div','applied-box','<span class="summary-label">현재 시뮬레이션에 적용된 조건</span>');appliedBox.append(applied);
 env.replaceChildren(mode,location,observed,manualMode,$('#env-message'),appliedBox,advanced);rail.append(env);
 const scenario=$('.scenario-panel');rail.append(scenario);const plan=$('.input-panel:not(.environment-panel)');rail.append(plan);const placement=el('section','panel placement-lab');placement.id='placement-lab';rail.append(placement);
 for(const selector of ['.metric-grid','.workspace','.wave-readout','.bottom-grid','.decision-panel','.experiment']){const n=$(selector);if(n)stage.append(n);}
 const toolbar=el('div','stage-toolbar','<div><span class="online-dot"></span> 선박 디지털 트윈 <small>드래그 회전 · 휠 확대</small></div><button id="expand-simulation" class="outline-btn">화면 크게 보기 ⛶</button>');const playback=el('div','stage-playback');playback.append($('#play'),$('#reset'));toolbar.insertBefore(playback,toolbar.lastElementChild);stage.prepend(toolbar);stage.prepend(el('div','applied-strip','<span>적용 조건</span><p id="applied-compact">아직 환경을 적용하지 않았습니다. 기본 합성 조건으로 시작할 수 있습니다.</p>'));
 const vessel=$('.vessel-bar');if(vessel)details.append(vessel);
 layout.append(rail,stage);$('.page-title').after(layout);
 // Keep controls and IDs intact so existing API, simulation and comparison logic remain connected.
 for(const n of [...old.children])if(n.tagName!=='SUMMARY'&&!n.closest('body'))forecasts.append(n);
 const dateLabel=$('#env-time').closest('label');dateLabel.hidden=true;
 const switchMode=manualActive=>{observed.hidden=manualActive;manualMode.hidden=!manualActive;document.body.dataset.environmentMode=manualActive?'manual':'observed';$('#mode-observed').classList.toggle('active',!manualActive);$('#mode-manual').classList.toggle('active',manualActive);$('#mode-observed').setAttribute('aria-pressed',String(!manualActive));$('#mode-manual').setAttribute('aria-pressed',String(manualActive));dateLabel.hidden=!manualActive&&$('#observation-time-mode').value==='latest';$('#mode-description').textContent=manualActive?'직접 입력한 가정 조건으로 실험합니다. 적용 전까지 기존 실험을 유지합니다.':'실제 날씨·해양 관측을 조회하고 적용합니다.';};
 $('#mode-observed').onclick=()=>switchMode(false);$('#mode-manual').onclick=()=>switchMode(true);switchMode(false);
 $('#observation-time-mode').onchange=()=>{const historic=$('#observation-time-mode').value==='selected';dateLabel.hidden=!historic;historical.hidden=!historic;latestActions.hidden=historic;historicalMarine.hidden=!historic;selected.hidden=!historic;weather.hidden=historic;summary.hidden=false;updateSummary();details.open=false;};
 const updateSummary=()=>{
  const historic=$('#observation-time-mode').value==='selected';
  $('#observation-state').textContent=historic?$('#selected-status').textContent:$('#weather-status').textContent;
  const rawText=(historic?$('#selected-weather'):$('#weather-current')).textContent;
  const kind=rawText.match(/\/ (clear|cloud|rain|snow|fog) \//)?.[1];
  const label={clear:'맑음',cloud:'흐림',rain:'비',snow:'눈',fog:'안개'}[kind];
  const missing=rawText.includes('조회 중')?'조회 중…':rawText.includes('미수신')?rawText:rawText.includes('적용하지 않음')?'조회 실패 · 아래 상태 확인':'과거 관측 조회 필요';
  const text=historic?(label?label+(rawText.includes('강수량·운량')?' (관측량 기반 분류)':''):missing):rawText;
  const marine=(historic?$('#selected-marine'):$('#weather-marine')).textContent;
  $('#observation-cards').replaceChildren(...[['날씨',text.split(' · ')[0]],['바람',marine.match(/풍속 ([^·]+) · 풍향 ([^·]+)/)?.slice(1).join(' / ')??'수신 대기'],['파도',marine.match(/파고 ([^·]+) · 주기 ([^·]+)/)?.slice(1).join(' / ')??'수신 대기']].map(([label,value])=>{const n=el('div','observation-card');n.append(el('small','',label));const b=el('strong','');b.textContent=value;n.append(b);return n;}));
 };
 const summaryObserver=new MutationObserver(updateSummary);for(const n of [weather,$('#selected-weather'),$('#selected-marine'),$('#selected-status')])summaryObserver.observe(n,{subtree:true,childList:true,characterData:true});updateSummary();
 let runningObservation=false;const syncObservation=()=>{const historicalMode=$('#observation-time-mode').value==='selected';runObservation.setAttribute('aria-busy',String(runningObservation));runObservation.textContent=runningObservation?'관측 조회·적용 중…':historicalMode?'선택 시각 관측 조회·적용':'최신 관측 조회·적용';runObservation.disabled=runningObservation||(historicalMode?$('#selected-fetch-apply').disabled:$('#weather-fetch').disabled);};
 runObservation.onclick=async()=>{if(runObservation.disabled)return;runningObservation=true;const locked=[$('#env-location'),$('#env-time'),$('#observation-time-mode'),$('#mode-observed'),$('#mode-manual')].map(node=>({node,disabled:node.disabled}));for(const item of locked)item.node.disabled=true;syncObservation();try{if($('#observation-time-mode').value==='selected')await $('#selected-fetch-apply').onclick();else{await $('#weather-fetch').onclick();if(!$('#weather-apply').disabled)$('#weather-apply').onclick();}}finally{for(const item of locked)item.node.disabled=item.disabled;runningObservation=false;syncObservation();}};
 const observationButtons=new MutationObserver(syncObservation);for(const n of [$('#weather-fetch'),$('#selected-fetch-apply')])observationButtons.observe(n,{attributes:true,attributeFilter:['disabled']});$('#observation-time-mode').addEventListener('change',syncObservation);syncObservation();
 new MutationObserver(()=>{$('#applied-compact').textContent=applied.textContent;}).observe(applied,{subtree:true,childList:true,characterData:true});
 const fx=$('.weather-fx-controls'),fxDetails=el('details','weather-fx-details');fxDetails.append(el('summary','','시각 시연 · 관측/계산 조건 유지'));fxDetails.append(fx);advanced.append(fxDetails);
 $('#expand-simulation').onclick=()=>{const big=document.body.classList.toggle('simulation-expanded');$('#expand-simulation').textContent=big?'설정 함께 보기 ↙':'화면 크게 보기 ⛶';window.dispatchEvent(new Event('resize'));};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('simulation-expanded'))$('#expand-simulation').click();});
 initWindSelection();
 initPanelNavigation();
}
