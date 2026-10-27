export function weatherProfile(environment,preview='auto'){
 const e=environment??{},raw=e.weatherData?.data?.raw??e.weatherData?.raw??{};
 const n=k=>{const v=Number(raw[k]);return raw[k]!==undefined&&raw[k]!==null&&Number.isFinite(v)&&v>=0?v:null;};
 const code=n('WC'),thunder=code!==null&&code>=95&&code<=99;
 const mode=preview==='auto'?(thunder?'thunder':e.weather??'clear'):preview;
 const storm=mode==='typhoon',rain=['rain','thunder','typhoon'].includes(mode),snow=mode==='snow',fog=mode==='fog';
 const wind=storm?Math.max(25,e.wind??0):e.wind??0,angle=((e.windDirection??0)-(e.heading??0))*Math.PI/180;
 const visibility=n('VS'),intensity=n('RN_INT');
 return {mode,manual:preview!=='auto',rain,snow,fog,thunder:mode==='thunder'||storm,storm,night:e.isDay===0,wind,dx:-Math.sin(angle),dz:-Math.cos(angle),density:fog?(visibility!==null?Math.min(.009,Math.max(.003,3/(visibility*10+100))):.006):storm?.0028:rain?.0018:snow?.002:.00065,amount:rain?(intensity===null?.65:Math.min(1,Math.max(.25,intensity/15))):snow?.7:0,cloud:rain||snow||fog||mode==='cloud'};
}

export function lightningPulse(time,enabled,thunder){const phase=time%18;return !!enabled&&!!thunder&&((phase>8&&phase<8.12)||(phase>8.3&&phase<8.4));}
