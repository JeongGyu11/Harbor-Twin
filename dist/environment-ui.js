import {initSelectedObservations} from './selected-observations.js?v=fix1028';
import {initStoredWeather} from './weather-storage.js?v=fix1028';
import {initObservations} from './observations-ui.js?v=fix1028';
import {PRESETS,validateEnvironment,fetchEnvironment} from './environment.mjs?v=windbands1';
export function initEnvironment({apply:onApply}){
 let observationBaseline=null;
 const apply=env=>{if(env?.observation&&env.source.includes('기상청'))observationBaseline=JSON.parse(JSON.stringify(env));onApply(env);document.dispatchEvent?.(new Event('harbor:environment'));};
 const $=s=>document.querySelector(s);let forecast=null,latest=null,autoBusy=false,epoch=0,nextRefresh=Date.now(),lastAuto='',applyingForecast=false;
 function applyForecast(){applyingForecast=true;try{$('#env-apply').onclick();}finally{applyingForecast=false;}}
 const fields=['wind','windDirection','height','period','direction','heading'];
 const read=()=>({...validateEnvironment(Object.fromEntries([...fields.map(k=>{const raw=$('#env-'+k).value;if(!raw.trim())throw Error('환경 값을 모두 입력하세요.');return [k,Number(raw)];}),['lat',PRESETS[$('#env-location').value][0]],['lon',PRESETS[$('#env-location').value][1]],['localTime',$('#env-time').value],['weather',$('#env-weather').value]])),port:$('#env-location').selectedOptions[0].textContent});
 // Full observations replace these values; an unapplied invalid manual wind must not block a valid observation.
 const readObservation=(overrides={})=>{const location=$('#env-location'),[lat,lon]=PRESETS[location.value];const values={wind:0,windDirection:0,height:0,period:8,direction:0};const limits={wind:[0,113.2],windDirection:[0,360],height:[0,10],period:[2,30],direction:[0,360]};for(const key of Object.keys(values)){const raw=$('#env-'+key).value,v=Number(raw),[min,max]=limits[key];if(raw.trim()&&Number.isFinite(v)&&v>=min&&v<=max)values[key]=v;}return {...validateEnvironment({...values,lat,lon,heading:Number($('#env-heading').value),localTime:overrides.localTime??$('#env-time').value,weather:$('#env-weather').value}),port:location.selectedOptions[0].textContent};};
 const write=e=>{for(const k of fields)$('#env-'+k).value=e[k];$('#env-weather').value=e.weather;$('#env-wind').dispatchEvent?.(new Event('input'));};
 $('#env-time').value=new Date(Date.now()+9*3600000).toISOString().slice(0,13)+':00';
 $('#env-now').onclick=()=>{$('#env-time').value=new Date(Date.now()+9*3600000).toISOString().slice(0,13)+':00';$('#env-message').textContent='현재 한국시간의 정각을 선택했습니다. 예보 조회 후 적용을 누르세요.';};
 $('#env-fetch-apply').onclick=async()=>{const result=await $('#env-fetch').onclick();if(result)applyForecast();};
 $('#env-location').onchange=e=>{epoch++;latest=null;$('#env-auto-apply').disabled=true;nextRefresh=Date.now();forecast=null;$('#env-message').textContent='항구를 변경했습니다. 최신 또는 과거 관측을 확인한 뒤 적용하세요. 기존 적용 환경은 유지됩니다.';};
 $('#env-fetch').onclick=async()=>{const button=$('#env-fetch');try{const input=read();button.disabled=true;$('#env-fetch-apply').disabled=true;$('#env-message').textContent='날씨·해양 예보 조회 중…';const result=await fetchEnvironment(input);if(JSON.stringify(read())!==JSON.stringify(input))throw Error('조회 중 입력이 바뀌었습니다. 다시 조회하세요.');forecast=result;write(result);$('#env-message').textContent='예보를 불러왔습니다. 값을 수정하거나 환경 적용 버튼을 누르세요. 아직 시뮬레이션에 적용되지 않았습니다.';return true;}catch(error){$('#env-message').textContent='조회 실패: '+(error.name==='AbortError'?'20초 시간 초과':error.message)+' 기존 적용 환경은 유지됩니다.';}finally{button.disabled=false;$('#env-fetch-apply').disabled=false;}};
 $('#env-apply').onclick=()=>{document.querySelector('#env-message')?.setAttribute?.('role','status');try{const input=read(),same=forecast&&[...fields,'localTime','weather'].every(k=>input[k]===forecast[k]);const env={...input,source:same?'Open-Meteo 예보':forecast?'사용자 변경':'사용자 직접 입력',forecast:forecast?{...forecast}:null,appliedAt:new Date().toISOString(),sourceType:same?'model_forecast':'user_scenario',isDay:same?forecast.isDay:Number(input.localTime.slice(11,13))>=6&&Number(input.localTime.slice(11,13))<18?1:0};if(!applyingForecast&&document.querySelector('#mode-manual')?.getAttribute('aria-pressed')==='true'){
 const baseline=observationBaseline?.port===input.port?observationBaseline:null,keys=[...fields,'weather','localTime'];
 env.modifiedFields=baseline?keys.filter(k=>input[k]!==baseline[k]):keys;env.sourceType='user_scenario';env.baselineObservation=baseline;
 const names={wind:'풍속',windDirection:'풍향',height:'파고',period:'파주기',direction:'파향',heading:'선수 방향',weather:'날씨',localTime:'시각'};
 env.source=baseline?'실제 관측 기반 · 사용자 수정'+(env.modifiedFields.length?' ('+env.modifiedFields.map(k=>names[k]).join('·')+')':' (변경 없음)'):'사용자 직접 입력';env.weatherSource='사용자 조건';
 }apply(env);$('#env-applied').textContent=`적용: ${env.port} / ${env.source} / ${env.localTime.replace('T',' ')} KST / ${({clear:'맑음',cloud:'흐림',rain:'비',snow:'눈',fog:'안개'})[env.weather]??env.weather} / 바람 ${env.wind} m/s · ${env.windDirection}° / 파고 ${env.height} m · ${env.period}초 · ${env.direction}° / 선수 ${env.heading}°`;$('#env-message').textContent='환경을 적용하고 초기화했습니다. 선택 시각의 조건을 전체 실험 동안 고정합니다.';}catch(error){$('#env-message').textContent='적용되지 않았습니다: '+error.message+' 이전에 적용된 시뮬레이션 조건을 유지합니다.';document.querySelector('#env-message')?.setAttribute('role','alert');}};
 $('#env-clear').onclick=()=>{apply(null);$('#env-applied').textContent='수동 환경 해제 · 기존 파도 세기 사용';$('#env-message').textContent='환경 적용을 해제했습니다. 입력값은 유지됩니다.';};
 const kstHour=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,13)+':00';
 const resetAuto=()=>{epoch++;latest=null;$('#env-auto-apply').disabled=true;nextRefresh=Date.now();if(!$('#env-auto').checked)$('#env-auto-status').textContent='자동 갱신 꺼짐 · 적용된 실험 조건은 유지됩니다.';};
 $('#env-auto').onchange=resetAuto;$('#env-refresh').onchange=resetAuto;$('#env-auto-time').onchange=resetAuto;
 $('#env-time').addEventListener('change',()=>{if($('#env-auto-time').value==='selected')resetAuto();});
 async function refreshAuto(){
  if(autoBusy||$('#env-fetch').disabled||!$('#env-auto').checked)return;
  const token=epoch;autoBusy=true;
  try{
   const input=read();if($('#env-auto-time').value==='now')input.localTime=kstHour();
   $('#env-auto-status').textContent='최신 모델 예보 자동 조회 중…';
   const result=await fetchEnvironment(input);
   if(token!==epoch||!$('#env-auto').checked)return;
   latest=result;lastAuto=new Date().toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul'});
   $('#env-auto-apply').disabled=false;
   $('#env-auto-status').textContent=`자동 조회 성공 ${lastAuto} KST · ${result.port} / ${result.localTime.replace('T',' ')} KST · 바람 ${result.wind} m/s / 파고 ${result.height} m. 새 예보 적용 대기. 값이 이전과 같을 수 있습니다.`;
  }catch(error){if(token===epoch)$('#env-auto-status').textContent='자동 조회 실패: '+(error.name==='AbortError'?'시간 초과':error.message)+'. 기존 적용 조건 유지 · 다음 주기에 재시도합니다.';}
  finally{autoBusy=false;nextRefresh=token===epoch?Date.now()+Number($('#env-refresh').value)*1000:Date.now();}
 }
 $('#env-auto-apply').onclick=()=>{if(!latest)return;forecast=latest;$('#env-time').value=latest.localTime;write(latest);applyForecast();latest=null;$('#env-auto-apply').disabled=true;$('#env-auto-status').textContent=`자동 조회 예보 적용 완료 · 조회 ${lastAuto} KST. 다음 주기까지 대기합니다.`;};
 setInterval(()=>{if($('#env-auto').checked&&Date.now()>=nextRefresh)refreshAuto();},1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('#env-auto').checked&&Date.now()>=nextRefresh)refreshAuto();});
 initStoredWeather({onApply:r=>{forecast=null;const input=readObservation({localTime:r.weather.observedAt.slice(0,16)}),w=r.weather,m=r.marine;const env={...input,...m.data,weather:w.weather,localTime:w.observedAt.slice(0,16),isDay:w.isDay,weatherData:w,observation:m,weatherSource:w.source,source:'기상청 실제 날씨·해양 관측',selectedObservations:r,appliedAt:new Date().toISOString()};apply(env);write(env);$('#env-time').value=env.localTime;$('#env-applied').textContent=`적용: ${env.port} / ${env.source} / 날씨 ${w.observedAt} · 해양 ${m.observedAt} / 바람 ${m.data.wind} m/s · 파고 ${m.data.height} m`;}});
 initObservations({read,apply:env=>{apply(env);$('#env-applied').textContent=`적용: ${env.port} / ${env.source} / 측정 ${env.observation.observedAt} / ${env.observation.station.name} · ${env.observation.station.distanceKm} km`;}});
 initSelectedObservations({read:readObservation,apply,onApplied:env=>{forecast=null;write(env);$('#env-applied').textContent=`적용: ${env.port} / ${env.source} / 선택 ${env.localTime} KST`;}});
 refreshAuto();

 return {restore(env){epoch++;forecast=null;latest=null;observationBaseline=env?.observation?JSON.parse(JSON.stringify(env)):null;$('#env-auto-apply').disabled=true;if(env){write(env);$('#env-time').value=env.localTime;const key=Object.keys(PRESETS).find(k=>Math.abs(PRESETS[k][0]-env.lat)<.00001&&Math.abs(PRESETS[k][1]-env.lon)<.00001);if(key)$('#env-location').value=key;$('#env-applied').textContent=`적용: ${env.port??'실험 위치'} / ${env.source} / ${env.localTime} KST / 바람 ${env.wind} m/s · 파고 ${env.height}m · 실험안 B 환경 복원`;}else $('#env-applied').textContent='실험안 B 적용 · 기본 합성 파도 환경';$('#env-message').textContent='실험안에 저장된 환경을 복원했습니다. 과거 관측 스냅샷일 수 있으며 최신 자료로 자동 대체하지 않습니다.';document.dispatchEvent?.(new Event('harbor:environment'));}};

}
