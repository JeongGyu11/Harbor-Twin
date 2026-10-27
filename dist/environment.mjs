export const PRESETS={busan:[35.05,129.12],incheon:[37.42,126.5],ulsan:[35.43,129.43],busanNew:[35.04,128.81],gwangyang:[34.9,127.72],pyeongtaek:[36.97,126.78],pohang:[36.10,129.45]};
export function validateEnvironment(e){
 const ranges={lat:[-90,90],lon:[-180,180],wind:[0,60],windDirection:[0,360],height:[0,10],period:[2,30],direction:[0,360],heading:[0,360]};
 for(const [key,[min,max]] of Object.entries(ranges))if(!Number.isFinite(e[key])||e[key]<min||e[key]>max)throw Error(`${key}: ${min}–${max} 범위로 입력하세요.`);
 if(!['clear','cloud','rain','fog','snow'].includes(e.weather))throw Error('날씨를 선택하세요.');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(e.localTime)||!Number.isFinite(Date.parse(e.localTime+'+09:00')))throw Error('날짜·시간을 정각으로 선택하세요.');
 return {...e};
}
export function weatherName(code){return code===0?'clear':code<=3?'cloud':[45,48].includes(code)?'fog':code>=71&&code<=77||code===85||code===86?'snow':'rain';}
export function makeURLs(e){
 validateEnvironment(e);const utc=new Date(e.localTime+'+09:00').toISOString(),day=utc.slice(0,10);
 const p=new URLSearchParams({latitude:e.lat,longitude:e.lon,start_date:day,end_date:day,timezone:'UTC'});
 return {hour:utc.slice(0,13),weather:'https://api.open-meteo.com/v1/forecast?'+p+'&wind_speed_unit=ms&hourly=weather_code,wind_speed_10m,wind_direction_10m,is_day',marine:'https://marine-api.open-meteo.com/v1/marine?'+p+'&cell_selection=sea&hourly=wave_height,wave_direction,wave_period'};
}
export async function fetchEnvironment(e,fetcher=fetch){
 const urls=makeURLs(e),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
 const request=async url=>{const r=await fetcher(url,{signal:controller.signal,cache:'no-store'});const j=await r.json();if(!r.ok||j.error)throw Error(j.reason||'예보 조회 실패');return j;};
 const [w,m]=await Promise.all([request(urls.weather),request(urls.marine)]);
 const wi=w.hourly?.time.findIndex(t=>t.slice(0,13)===urls.hour),mi=m.hourly?.time.findIndex(t=>t.slice(0,13)===urls.hour);
 if(!(wi>=0&&mi>=0))throw Error('선택한 시각의 예보가 없습니다. 제공 범위 내 시각을 선택하세요.');
 const vals=[w.hourly.weather_code[wi],w.hourly.wind_speed_10m[wi],w.hourly.wind_direction_10m[wi],m.hourly.wave_height[mi],m.hourly.wave_period[mi],m.hourly.wave_direction[mi]];
 if(vals.some(v=>!Number.isFinite(v)))throw Error('해당 좌표·시각의 예보 값이 누락되었습니다. 바다 좌표를 선택하거나 직접 입력하세요.');
 const result=validateEnvironment({...e,weather:weatherName(vals[0]),wind:vals[1],windDirection:vals[2],height:vals[3],period:vals[4],direction:vals[5]});
 return {...result,source:'Open-Meteo 예보',fetchedAt:new Date().toISOString(),isDay:w.hourly.is_day[wi],apiCoordinates:{weather:[w.latitude,w.longitude],marine:[m.latitude,m.longitude]},urls};
 }finally{clearTimeout(timer);}
}
