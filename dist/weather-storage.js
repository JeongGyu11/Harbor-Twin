export function initStoredWeather({onApply}){
 const $=s=>document.querySelector(s),labels={clear:'맑음',cloud:'흐림',rain:'비',fog:'안개',snow:'눈'};
 const base=['localhost','127.0.0.1'].includes(location.hostname)&&location.port==='4174'?'http://127.0.0.1:4175':'';
 let pending=null,busy=false,epoch=0;
 async function load(){if(busy)return;busy=true;const port=$('#env-location').value,token=epoch;$('#weather-fetch').disabled=true;
 try{const response=await fetch(base+'/api/environment/latest?port='+encodeURIComponent(port),{cache:'no-store',signal:AbortSignal.timeout(15000)});const data=await response.json();if(token!==epoch)return;if(!response.ok||data.error)throw Error(data.error||'날씨 저장값 조회 실패');pending=data;
 const w=data.weather,m=data.marine;const temperature=w?.temperature;const hasTemperature=temperature!==null&&temperature!==undefined&&String(temperature).trim()!==''&&Number.isFinite(Number(temperature))&&Number(temperature)>=-80&&Number(temperature)<=60;
 $('#weather-current').textContent=w?`${labels[w.weather]??w.weather}${w.classificationBasis?.includes('강수량·운량')?' (관측량 기반 분류)':''} · ASOS ${hasTemperature?`기온 ${Number(temperature)}°C`:'기온 미수신'} · ${w.station.name} (${w.station.id}) · ${w.station.distanceKm} km · ${w.classificationBasis}`:'실제 날씨 관측 미수신';
 $('#weather-time').textContent=w?`실제 관측 ${w.observedAt.replace('T',' ')} / 서버 수집 ${w.fetchedAt.replace('T',' ')} / 관측 지연 ${w.ageMinutes.toFixed(0)}분`:'실제 날씨 관측 시각 미수신';
 $('#weather-marine').textContent=m?`해양 실제 관측 ${m.observedAt.replace('T',' ')} / 서버 수집 ${m.fetchedAt.replace('T',' ')} / ${m.station.name} · ${m.station.distanceKm} km / 풍속 ${m.data.wind} m/s · 풍향 ${m.data.windDirection}° · 파고 ${m.data.height} m · 주기 ${m.data.period}초 · 파향 ${m.data.direction}°`:'실제 해양 관측 미수신';
 $('#weather-status').textContent=`기상청 실제 관측 · ${data.complete?'날씨·해양 통합 적용 가능':'일부 결측·지연으로 통합 적용 불가'}${data.weatherCollection?.error?' · 날씨 최근 수집 실패: '+data.weatherCollection.error+' (저장된 마지막 정상 자료)':''}${m?.collection?.error?' · 해양 최근 수집 실패: '+m.collection.error:''}`;
 $('#weather-apply').disabled=!data.complete;
 }catch(error){if(token===epoch){pending=null;$('#weather-apply').disabled=true;$('#weather-current').textContent='최신 날씨 미수신';$('#weather-time').textContent='수집 시각 미확인';$('#weather-status').textContent='날씨 조회 실패: '+error.message+' 기존 실험 조건 유지';}}
 finally{busy=false;$('#weather-fetch').disabled=false;if(token!==epoch)load();}}
 $('#weather-fetch').onclick=load;
 $('#weather-apply').onclick=()=>{const now=Date.now(),fresh=(stamp,futureMinutes)=>{const age=now-Date.parse(stamp);return Number.isFinite(age)&&age>=-futureMinutes*60000&&age<=7200000;};if(!pending?.complete||!fresh(pending.weather.observedAt,15)||!fresh(pending.weather.fetchedAt,0)||!fresh(pending.marine.observedAt,5)||!fresh(pending.marine.fetchedAt,0)){$('#weather-status').textContent='최신 실제 관측을 다시 조회하세요.';return;}try{onApply(pending);$('#weather-status').textContent='기상청 실제 날씨·해양 통합 적용 완료 · 시뮬레이션 초기화';}catch(e){$('#weather-status').textContent=e.message;}};
 $('#env-location').addEventListener('change',()=>{epoch++;pending=null;$('#weather-apply').disabled=true;load();});
 setInterval(load,300000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});load();
}
