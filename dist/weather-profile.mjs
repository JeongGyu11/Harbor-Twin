import {windResponse} from './wind-model.mjs?v=windbands1';
export function weatherProfile(environment,preview='auto'){
 const e=environment??{},raw=e.weatherData?.data?.raw??e.weatherData?.raw??{};
 const n=k=>{const v=Number(raw[k]);return raw[k]!==undefined&&raw[k]!==null&&String(raw[k]).trim()!==''&&Number.isFinite(v)&&v>=0?v:null;};
 const code=n('WC'),thunder=code!==null&&code>=95&&code<=99;
 const mode=preview==='auto'?(thunder?'thunder':e.weather??'clear'):preview;
 const storm=mode==='typhoon',rain=['rain','thunder','typhoon'].includes(mode),snow=mode==='snow',fog=mode==='fog';
 const wind=storm?Math.max(25,e.wind??0):e.wind??0,angle=((e.windDirection??0)-(e.heading??0))*Math.PI/180;
 const visibility=n('VS');
 const precipitation=precipitationProfile(e,mode,preview);
 return {mode,manual:preview!=='auto',rain,snow,fog,thunder:mode==='thunder'||storm,storm,night:e.isDay===0,wind,dx:-Math.sin(angle),dz:-Math.cos(angle),density:fog?(visibility!==null?Math.min(.009,Math.max(.003,3/(visibility*10+100))):.006):storm?.0028:rain?.0018:snow?.002:.00065,amount:precipitation.amount,precipitation,cloud:rain||snow||fog||mode==='cloud'};
}

export function lightningPulse(time,enabled,thunder){const phase=time%18;return !!enabled&&!!thunder&&((phase>8&&phase<8.12)||(phase>8.3&&phase<8.4));}

export function windVisualProfile(speed){return windResponse(speed);}

// Measured rates and reported intensity classes are distinct; never turn a class into mm/h.
export function precipitationProfile(environment,mode,preview='auto'){
 const snow=mode==='snow',active=snow||['rain','thunder','typhoon'].includes(mode);
 if(!active)return {amount:0,source:'none',label:'',field:null,value:null};
 const fallback=reason=>({amount:snow?.7:.65,source:'default',label:`기본 연출 · ${reason}`,field:null,value:null});
 if(preview!=='auto')return fallback('수동 날씨 시연');
 if(environment?.sourceType==='user_scenario'&&environment.modifiedFields?.includes('weather'))return fallback('날씨를 직접 변경함');
 const raw=environment?.weatherData?.data?.raw??environment?.weatherData?.raw??{};
 const valid=v=>v!==undefined&&v!==null&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0;
 const rate=valid(raw.RN_INT)?Number(raw.RN_INT):null,code=valid(raw.WC)?Number(raw.WC):null;
 if(!snow&&rate!==null)return {amount:rate===0?0:Math.min(1,Math.max(.06,1-Math.exp(-rate/8))),source:'observed-rate',label:`관측 강수강도 ${rate} mm/h · RN_INT`,field:'RN_INT',value:rate};
 const levels=snow?{70:0,71:0,72:1,73:1,74:2,75:2}:{60:0,61:0,62:1,63:1,64:2,65:2};
 if(Number.isInteger(code)&&Object.hasOwn(levels,code)){
  const level=levels[code];return {amount:[.25,.6,1][level],source:'observed-class',label:`관측 ${snow?'눈':'비'} 강도 ${['약함','보통','강함'][level]} · WC ${code} (등급 기반 연출)`,field:'WC',value:code};
 }
 return fallback('유효한 강도 관측 없음');
}
