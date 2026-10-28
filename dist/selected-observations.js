export function initSelectedObservations({read,apply,onApplied}){
 const $=s=>document.querySelector(s),base=['localhost','127.0.0.1'].includes(location.hostname)&&location.port==='4174'?'http://127.0.0.1:4175':'';
 let pending=null,signature='',busy=false;
 const stamp=r=>`${r.observedAt.replace('T',' ')} / ${r.offsetMinutes===0?'선택 시각과 일치':`선택보다 ${Math.abs(r.offsetMinutes)}분 ${r.offsetMinutes<0?'이전':'이후'}`} / ${r.station.name} (${r.station.id}) · ${r.station.distanceKm} km`;
 const invalidate=()=>{pending=null;$('#selected-weather').textContent='날씨 관측: 항구·시간 변경 · 조회 필요';$('#selected-marine').textContent='해양 관측: 항구·시간 변경 · 조회 필요';$('#selected-marine-apply').disabled=true;$('#selected-status').textContent='항구·시간 변경 · 실제 관측을 다시 조회하세요. 기존 적용 조건 유지';};
 for(const id of ['#env-location','#env-time'])$(id).addEventListener('change',invalidate);
 const applyResult=marineOnly=>{
  if(!pending||JSON.stringify(read())!==signature)throw Error('입력이 바뀌었습니다. 관측을 다시 조회하세요.');
  const r=pending,m=r.marine,w=marineOnly?null:r.weather;
  if(!m||(!marineOnly&&!w))throw Error('필수 관측이 없어 통합 적용하지 않습니다.');
  const input=read(),env={...input,...m.data,weather:w?w.data.weather:input.weather,source:w?'기상청 실제 날씨·해양 관측':'기상청 해양 관측 / 날씨 사용자 설정 유지',weatherSource:w?'기상청 ASOS 실제 관측':'실제 날씨 미적용 / 사용자 설정',weatherData:w,observation:m,selectedObservations:r,appliedAt:new Date().toISOString(),isDay:Number(input.localTime.slice(11,13))>=6&&Number(input.localTime.slice(11,13))<18?1:0};
  apply(env);onApplied(env);signature=JSON.stringify(read());$('#selected-status').textContent=marineOnly?'해양 관측만 적용 완료 · 날씨는 사용자 설정 유지 · 시뮬레이션 초기화':'실제 날씨·해양 관측 통합 적용 완료 · 관측 시각과 차이는 위에 표시 · 시뮬레이션 초기화';
 };
 $('#selected-marine-apply').onclick=()=>{try{applyResult(true);}catch(e){$('#selected-status').textContent=e.message;}};
 $('#selected-fetch-apply').onclick=async()=>{
  if(busy)return;busy=true;pending=null;$('#selected-fetch-apply').disabled=true;$('#selected-marine-apply').disabled=true;
  $('#selected-weather').textContent='날씨 관측: 조회 중';$('#selected-marine').textContent='해양 관측: 조회 중';
  try{
   const input=read();signature=JSON.stringify(input);
   if(Date.parse(input.localTime+'+09:00')>Date.now())throw Error('미래 시각의 실제 관측은 없습니다. 현재·과거 시각을 선택하세요.');
   $('#selected-status').textContent='기상청 실제 관측 조회 중… 최대 120초, 예보로 대체하지 않습니다.';
   const response=await fetch(base+'/api/observations/selected?'+new URLSearchParams({port:$('#env-location').value,time:input.localTime}),{cache:'no-store',signal:AbortSignal.timeout(120000)}),r=await response.json();
   if(JSON.stringify(read())!==signature)throw Error('조회 중 입력이 바뀌었습니다. 다시 조회하세요.');
   if(!response.ok||r.error)throw Error(r.error||'관측 조회 실패');pending=r;
   $('#selected-weather').textContent=r.weather?'날씨 실제 관측: '+stamp(r.weather)+' / '+r.weather.data.weather+' / '+r.weather.data.classificationBasis:'날씨 관측 미수신: '+r.errors.weather;
   $('#selected-marine').textContent=r.marine?'해양 실제 관측: '+stamp(r.marine)+` / 풍속 ${r.marine.data.wind} m/s · 풍향 ${r.marine.data.windDirection}° · 파고 ${r.marine.data.height} m · 주기 ${r.marine.data.period}초 · 파향 ${r.marine.data.direction}°`:'해양 관측 미수신: '+r.errors.marine;
   $('#selected-marine-apply').disabled=!r.marine;
   if(r.complete)applyResult(false);else $('#selected-status').textContent='통합 적용 안 됨 · 일부 관측 미수신. 해양 자료가 있으면 해양만 적용 버튼을 사용할 수 있습니다. 기존 시뮬레이션 조건 유지';
  }catch(e){pending=null;$('#selected-weather').textContent='날씨 관측: 적용하지 않음';$('#selected-marine').textContent='해양 관측: 적용하지 않음';$('#selected-status').textContent=(e.name==='TimeoutError'?'관측 조회 시간 초과':e.message)+' · 기존 적용 조건 유지';}
  finally{busy=false;$('#selected-fetch-apply').disabled=false;}
 };
}
