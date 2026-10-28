// Extreme scenario bound: WMO non-tornadic 3-second surface gust record.
// This is not a sustained-wind limit or a wind-to-sea forecasting model.
export const MAX_WIND=113.2;
export const WIND_PARTS=[[.68,.08,-.025,.65],[.32,.035,.10,.95]];
export const boundedWind=value=>Math.max(0,Math.min(MAX_WIND,Number.isFinite(Number(value))?Number(value):0));
export const WIND_MODEL_VERSION='wind-bands-v1';
// Saved scenario bands. Endpoints interpolate continuously, so there are no jumps at boundaries.
export const WIND_BANDS=Object.freeze([
 {id:'calm',label:'잔잔',min:0,max:3,preset:1.5,wave:[0,.01],foam:[0,0],spray:[0,0],streak:[0,0],sway:[.5,.6],description:'약한 잔물결'},
 {id:'breeze',label:'보통 바람',min:3,max:8,preset:5,wave:[.01,.045],foam:[0,.08],spray:[0,0],streak:[0,.04],sway:[.6,.85],description:'잔물결과 약한 표류'},
 {id:'strong',label:'강한 바람',min:8,max:17,preset:12,wave:[.045,.14],foam:[.08,.28],spray:[0,.18],streak:[.04,.22],sway:[.85,1.3],description:'흰 물결·흔들림 증가'},
 {id:'gale',label:'매우 강한 바람',min:17,max:33,preset:25,wave:[.14,.38],foam:[.28,.55],spray:[.18,.45],streak:[.22,.5],sway:[1.3,2],description:'포말·물보라 증가'},
 {id:'severe',label:'폭풍 실험',min:33,max:54,preset:40,wave:[.38,.8],foam:[.55,.7],spray:[.45,.62],streak:[.5,.66],sway:[2,3],description:'큰 바람 물결과 선체 반응'},
 {id:'extreme',label:'극한 실험',min:54,max:80,preset:65,wave:[.8,1.45],foam:[.7,.85],spray:[.62,.8],streak:[.66,.82],sway:[3,4.1],description:'강한 출렁임·물보라'},
 {id:'record',label:'기록급 실험',min:80,max:MAX_WIND,preset:100,wave:[1.45,2.4],foam:[.85,1],spray:[.8,1],streak:[.82,1],sway:[4.1,5.5],description:'최대 극한 시각 시나리오'}
].map(b=>Object.freeze({...b,wave:Object.freeze(b.wave),foam:Object.freeze(b.foam),spray:Object.freeze(b.spray),streak:Object.freeze(b.streak),sway:Object.freeze(b.sway)})));
export function windBand(value){const wind=boundedWind(value);return WIND_BANDS.find(b=>wind<b.max)??WIND_BANDS.at(-1);}
const interpolate=(range,ratio)=>range[0]+(range[1]-range[0])*ratio;
export function windResponse(value){const wind=boundedWind(value),band=windBand(wind),ratio=(wind-band.min)/(band.max-band.min);return {version:WIND_MODEL_VERSION,bandId:band.id,label:band.label,wind,waveAmplitude:interpolate(band.wave,ratio),whitecaps:interpolate(band.foam,ratio),spray:interpolate(band.spray,ratio),streaks:interpolate(band.streak,ratio),drift:wind*.8,snowSway:interpolate(band.sway,ratio)};}
export const windWaveAmplitude=value=>{const wind=boundedWind(value),b=windBand(wind);return interpolate(b.wave,(wind-b.min)/(b.max-b.min));};
export function windSurfaceHeight(x,z,time,e){
 if(!e||typeof e!=='object')return 0;
 const wind=boundedWind(e.wind),angle=((e.windDirection??0)-(e.heading??0))*Math.PI/180,u=x*Math.cos(angle)+z*Math.sin(angle),v=-x*Math.sin(angle)+z*Math.cos(angle);
 return windWaveAmplitude(wind)*WIND_PARTS.reduce((sum,[a,kx,kz,rate])=>sum+a*Math.sin(u*kx-v*kz-time*.22*(rate+wind*.004)),0);
}
