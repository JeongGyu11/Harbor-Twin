// One prototype policy shared by cards, chat context and hypothetical tools.
// These are demonstration thresholds, not certified ship/terminal limits.
export const WEATHER_RULES=Object.freeze({wind:{caution:10,stop:15},wave:{caution:1,stop:2},vis:{caution:3,stop:1}});
export const OPERATION_LABELS=Object.freeze(['시연 기준 내','주의','중지 검토']);
const finite=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
export function assessOperation({environment=null,risk=null,peak=null,threshold=1.5}={}){
 const e=environment,w=e?.weatherData,raw=w?.raw??w?.data?.raw??{},wind=finite(e?.wind),height=finite(e?.height),visibility=finite(raw.VS),rain=finite(raw.RN);
 const weather=e?.weather??null,visKm=visibility!==null&&visibility>0?visibility/10:null;
 const items=[];
 const add=(name,value,unit,level,rule)=>items.push({name,value,unit,level,rule});
 add('바람',wind,'m/s',wind===null?null:wind>=15?2:wind>=10?1:0,'10 m/s 이상 주의 · 15 m/s 이상 중지 검토 (시연용)');
 add('파도',height,'m',height===null?null:height>=2?2:height>=1?1:0,'1 m 이상 주의 · 2 m 이상 중지 검토 (시연용)');
 add('시정',visKm,'km',visKm===null?(weather==='fog'?1:null):visKm<1?2:visKm<3?1:0,'3 km 미만 주의 · 1 km 미만 중지 검토 (시연용)');
 add('날씨',({clear:'맑음',cloud:'흐림',rain:'비',snow:'눈',fog:'안개'})[weather]??weather,'',weather===null?null:['rain','snow','fog'].includes(weather)?1:0,'비·눈·안개는 주의 (시연용)');
 if(rain!==null&&rain>=0)add('누적 강수량',rain,'mm',rain>0?1:0,'누적값이며 현재 강수강도가 아닙니다');
 if(peak!==null&&Number.isFinite(peak))add('예측 기울기',peak,'도',peak>threshold?2:peak>=threshold*.8?1:0,'현재 시연 한도와 비교');
 if(risk&&risk.severity>0)add('선박 모델',risk.label,'',risk.severity>=2?2:1,'기울기·GM·탱크 가정 범위');
 const missing=items.filter(i=>i.level===null).map(i=>i.name),level=Math.max(0,...items.filter(i=>i.level!==null).map(i=>i.level));
 const label=level?OPERATION_LABELS[level]:missing.length?'자료 부족 · 판정 보류':OPERATION_LABELS[0];
 return {level,label,verdict:label,missing,items,source:environment?.source??'적용 환경 없음',port:environment?.port??null,
  conditionAt:environment?.localTime??null,appliedAt:environment?.appliedAt??null,
  scope:'현재 적용 조건에 대한 시연용 판정 · 실제 선박 안전·하역 허가 판정이 아닙니다.'};
}
