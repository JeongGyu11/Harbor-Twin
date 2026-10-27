import {initSelectedObservations} from './selected-observations.js';
import {initStoredWeather} from './weather-storage.js';
import {initObservations} from './observations-ui.js?v=collector1';
import {PRESETS,validateEnvironment,fetchEnvironment} from './environment.mjs?v=auto1';
export function initEnvironment({apply:onApply}){
 let observationBaseline=null;
 const apply=env=>{if(env?.observation&&env.source.includes('기상청'))observationBaseline=JSON.parse(JSON.stringify(env));onApply(env);};
 const $=s=>document.querySelector(s);let forecast=null,latest=null,autoBusy=false,epoch=0,nextRefresh=Date.now(),lastAuto='';
 const fields=['wind','windDirection','height','period','direction','heading'];
 const read=()=>({...validateEnvironment(Object.fromEntries([...fields.map(k=>{const raw=$('#env-'+k).value;if(!raw.trim())throw Error('환경 값을 모두 입력하세요.');return [k,Number(raw)];}),['lat',PRESETS[$('#env-location').value][0]],['lon',PRESETS[$('#env-location').value][1]],['localTime',$('#env-time').value],['weather',$('#env-weather').value]])),port:$('#env-location').selectedOptions[0].textContent});
 const write=e=>{for(const k of fields)$('#env-'+k).value=e[k];$('#env-weather').value=e.weather;};
 $('#env-time').value=new Date(Date.now()+9*3600000).toISOString().slice(0,13)+':00';
 $('#env-now').onclick=()=>{$('#env-time').value=new Date(Date.now()+9*3600000).toISOString().slice(0,13)+':00';$('#env-message').textContent='현재 한국시간의 정각을 선택했습니다. 예보 조회 후 적용을 누르세요.';};
 $('#env-fetch-apply').onclick=async()=>{const result=await $('#env-fetch').onclick();if(result)$('#env-apply').onclick();};
 $('#env-location').onchange=e=>{epoch++;latest=null;$('#env-auto-apply').disabled=true;nextRefresh=Date.now();forecast=null;$('#env-message').textContent='위치를 변경했습니다. 기준 시각을 선택하고 예보 조회 후 적용을 누르세요. 기존 적용 환경은 유지됩니다.';};
 $('#env-fetch').onclick=async()=>{const button=$('#env-fetch');try{const input=read();button.disabled=true;$('#env-fetch-apply').disabled=true;$('#env-message').textContent='날씨·해양 예보 조회 중…';const result=await fetchEnvironment(input);if(JSON.stringify(read())!==JSON.stringify(input))throw Error('조회 중 입력이 바뀌었습니다. 다시 조회하세요.');forecast=result;write(result);$('#env-message').textContent='예보를 불러왔습니다. 값을 수정하거나 환경 적용 버튼을 누르세요. 아직 시뮬레이션에 적용되지 않았습니다.';return true;}catch(error){$('#env-message').textContent='조회 실패: '+(error.name==='AbortError'?'20초 시간 초과':error.message)+' 기존 적용 환경은 유지됩니다.';}finally{button.disabled=false;$('#env-fetch-apply').disabled=false;}};
 $('#env-apply').onclick=()=>{try{const input=read(),same=forecast&&[...fields,'localTime','weather'].every(k=>input[k]===forecast[k]);const env={...input,source:same?'Open-Meteo 예보':forecast?'사용자 변경':'사용자 직접 입력',forecast:forecast?{...forecast}:null,appliedAt:new Date().toISOString(),isDay:same?forecast.isDay:Number(input.localTime.slice(11,13))>=6&&Number(input.localTime.slice(11,13))<18?1:0};if(document.querySelector('#mode-manual')?.getAttribute('aria-pressed')==='true'){
 const baseline=observationBaseline?.port===input.port?observationBaseline:null,keys=[...fields,'weather','localTime'];
 env.modifiedFields=baseline?keys.filter(k=>input[k]!==baseline[k]):keys;env.sourceType='user_scenario';env.baselineObservation=baseline;
 const names={wind:'풍속',windDirection:'풍향',height:'파고',period:'파주기',direction:'파향',heading:'선수 방향',weather:'날씨',localTime:'시각'};
 env.source=baseline?'실제 관측 기반 · 사용자 수정'+(env.modifiedFields.length?' ('+env.modifiedFields.map(k=>names[k]).join('·')+')':' (변경 없음)'):'사용자 직접 입력';env.weatherSource='사용자 조건';
 }apply(env);$('#env-applied').textContent=`적용: ${env.port} / ${env.source} / ${env.localTime.replace('T',' ')} KST / ${({clear:'맑음',cloud:'흐림',rain:'비',snow:'눈',fog:'안개'})[env.weather]??env.weather} / 바람 ${env.wind} m/s · ${env.windDirection}° / 파고 ${env.height} m · ${env.period}초 · ${env.direction}° / 선수 ${env.heading}°`;$('#env-message').textContent='환경을 적용하고 초기화했습니다. 선택 시각의 조건을 전체 실험 동안 고정합니다.';}catch(error){$('#env-message').textContent=error.message;}};
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
 $('#env-auto-apply').onclick=()=>{if(!latest)return;forecast=latest;$('#env-time').value=latest.localTime;write(latest);$('#env-apply').onclick();latest=null;$('#env-auto-apply').disabled=true;$('#env-auto-status').textContent=`자동 조회 예보 적용 완료 · 조회 ${lastAuto} KST. 다음 주기까지 대기합니다.`;};
 setInterval(()=>{if($('#env-auto').checked&&Date.now()>=nextRefresh)refreshAuto();},1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('#env-auto').checked&&Date.now()>=nextRefresh)refreshAuto();});
 initStoredWeather({onApply:r=>{const input=read(),w=r.weather,m=r.marine;const env={...input,...m.data,weather:w.weather,localTime:w.observedAt.slice(0,16),isDay:w.isDay,weatherData:w,observation:m,weatherSource:w.source,source:'기상청 실제 날씨·해양 관측',selectedObservations:r,appliedAt:new Date().toISOString()};apply(env);write(env);$('#env-time').value=env.localTime;$('#env-applied').textContent=`적용: ${env.port} / ${env.source} / 날씨 ${w.observedAt} · 해양 ${m.observedAt} / 바람 ${m.data.wind} m/s · 파고 ${m.data.height} m`;}});
 initObservations({read,apply:env=>{apply(env);$('#env-applied').textContent=`적용: ${env.port} / ${env.source} / 측정 ${env.observation.observedAt} / ${env.observation.station.name} · ${env.observation.station.distanceKm} km`;}});
 initSelectedObservations({read,apply,onApplied:env=>{write(env);$('#env-applied').textContent=`적용: ${env.port} / ${env.source} / 선택 ${env.localTime} KST`;}});
 refreshAuto();

}
