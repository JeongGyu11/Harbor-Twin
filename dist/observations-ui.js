export function initObservations({read,apply}){
 const $=s=>document.querySelector(s);let pending=null,busy=false,lastPoll=0;
 const base=['localhost','127.0.0.1'].includes(location.hostname)&&location.port==='4174'?'http://127.0.0.1:4175':'';
 async function load(){if(busy)return;busy=true;$('#obs-fetch').disabled=true;const port=$('#env-location').value;pending=null;$('#obs-apply').disabled=true;
  try{
   $('#obs-status').textContent='서버에 저장된 최신 관측 조회 중…';
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);let response;
   try{response=await fetch(base+'/api/observations?port='+encodeURIComponent(port),{signal:controller.signal,cache:'no-store'});}finally{clearTimeout(timer);}
   const result=await response.json();if(port!==$('#env-location').value)return;
   if(!response.ok||result.error)throw Error(result.error||'관측 조회 실패');
   const s=result.station;
   $('#obs-station').textContent=`${s.name} (${s.id}) · 항구 대표 좌표에서 직선 ${s.distanceKm.toFixed(1)} km · 부이 좌표 ${s.lat}, ${s.lon}`;
   $('#obs-time').textContent=`측정 ${result.observedAt.replace('T',' ')} / 서버 수집 ${result.fetchedAt.replace('T',' ')} / 현재 관측 지연 ${result.ageMinutes.toFixed(0)}분`;
   $('#obs-values').textContent=`풍속 ${result.data.wind} m/s · 풍향 ${result.data.windDirection}° · 파고 ${result.data.height} m · 주기 ${result.data.period}초 · 파향 ${result.data.direction}°`;
   $('#obs-status').textContent=(result.usable?'서버 저장 관측 · 적용 대기. ':'지연·거리 제한으로 적용 불가. ')+(result.collection?.error?'최근 수집 실패: '+result.collection.error+' · 마지막 정상 자료 표시. ':'')+result.warning;
   if(result.usable){pending={...result,portKey:port};$('#obs-apply').disabled=false;}
  }catch(error){$('#obs-status').textContent='관측 미연결: '+(error.name==='AbortError'?'시간 초과':error.message)+' 기존 실험은 유지됩니다.';$('#obs-station').textContent='관측소 미확정 · 인증된 공식 목록을 조회한 뒤 가까운 해양기상부이를 자동 매칭합니다.';$('#obs-time').textContent='관측 시각·거리 미수신';$('#obs-values').textContent='실제 관측을 수신하기 전에는 값이나 관측소를 생성하지 않습니다.';}
  finally{busy=false;lastPoll=Date.now();$('#obs-fetch').disabled=false;}
 }
 $('#obs-fetch').onclick=load;
 $('#obs-apply').onclick=()=>{try{if(!pending||pending.portKey!==$('#env-location').value)throw Error('관측소를 다시 조회하세요.');const age=(Date.now()-Date.parse(pending.observedAt))/60000;if(age>120||age< -5)throw Error('관측이 오래됐습니다. 다시 조회하세요.');const input=read();const hour=Number(pending.observedAt.slice(11,13));apply({...input,...pending.data,source:'기상청 센서 관측 / 날씨는 사용자 설정',localTime:pending.observedAt.slice(0,16),observation:pending,weatherSource:'부이 API에 날씨 코드 없음 / 사용자 설정 유지',isDay:hour>=6&&hour<18?1:0});$('#obs-status').textContent='센서 바람·파도 적용 완료. 맑음·비 등 날씨와 선수 방향은 입력 설정을 유지합니다. 적용 시각의 관측을 실험 동안 고정합니다.';}catch(e){$('#obs-status').textContent=e.message;}};
 $('#env-location').addEventListener('change',()=>{pending=null;$('#obs-apply').disabled=true;$('#obs-station').textContent='항구 변경 · 관측소 재조회 필요';$('#obs-time').textContent='관측 시각·거리 미수신';$('#obs-values').textContent='새 항구의 관측을 조회하세요.';load();});
 $('#obs-auto').onchange=()=>{load();};
 setInterval(()=>{if($('#obs-auto').checked&&Date.now()-lastPoll>=300000)load();},10000);
 load();

}
