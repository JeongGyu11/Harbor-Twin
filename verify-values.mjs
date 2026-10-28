import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import * as D from './dist/decision.mjs';
const cargo=[{id:'C1',weight:20,z:5,x:0,tier:0}],model=D.makeModel(cargo),levels=[600,600,600,600],mass=14420;
const m=D.measure(model,[],levels);assert.ok(Math.abs(m.gm-2.4)<1e-12);assert.ok(Math.abs(m.heel-Math.atan(100/(mass*2.4))*180/Math.PI)<1e-12);
const changed=D.measure(model,[],[610,590,600,600]),height=1200/(1.025*28*6),gm=2.4-height/(12*mass);
assert.ok(Math.abs(changed.gm-gm)<1e-12);assert.ok(Math.abs(changed.heel-Math.atan(-80/(mass*gm))*180/Math.PI)<1e-12);
const list=[];for(let i=0;i<12;i++)list.push({id:'C'+i,weight:22+i%3,z:i<6?-7.5:7.5,x:i%3*13-13,tier:0});const ship=D.makeModel(list);
for(const rate of [.35,2.5])for(const mode of ['none','rule','predictive']){const r=D.runComparison(ship,list.map(c=>c.id),{...D.DEFAULTS,levels,rate,interval:7.3},mode);assert.ok(r.complete);assert.ok(Math.abs(r.pumpSeconds-r.moved/rate)<1e-7);assert.ok(Math.abs(r.levels.reduce((a,b)=>a+b)-2400)<1e-7);}
console.log('PASS independent moment/GM/heel calculations, exact pump time = transferred mass / flow, conservation');
const ids=['env-location','weather-fetch','weather-apply','weather-current','weather-time','weather-marine','weather-status'];let now=Date.now(),applied=0,interval;const nodes=Object.fromEntries(ids.map(id=>['#'+id,{value:'busan',disabled:false,textContent:'',addEventListener(){}}]));
const stamp=minutes=>new Date(now-minutes*60000).toISOString();
let payload={complete:true,weather:{weather:'rain',temperature:-99.9,station:{name:'test',id:'1',distanceKm:10},observedAt:stamp(110),fetchedAt:stamp(0),ageMinutes:110},marine:{station:{name:'buoy',distanceKm:20},observedAt:stamp(20),fetchedAt:stamp(0),data:{wind:5,windDirection:90,height:1,period:8,direction:90}}};
class Clock extends Date{static now(){return now;}}
const ctx=vm.createContext({document:{querySelector:s=>nodes[s],addEventListener(){}},location:{hostname:'127.0.0.1',port:'4174'},Date:Clock,AbortSignal,encodeURIComponent,fetch:async()=>({ok:true,json:async()=>payload}),setInterval:fn=>{interval=fn;},onApply:()=>applied++});
vm.runInContext(fs.readFileSync('dist/weather-storage.js','utf8').replace('export function','function')+';initStoredWeather({onApply});',ctx);
await new Promise(resolve=>setImmediate(resolve));
assert.match(nodes['#weather-current'].textContent,/기온 미수신/);nodes['#weather-apply'].onclick();assert.equal(applied,1);
now+=11*60000;nodes['#weather-apply'].onclick();assert.equal(applied,1);assert.match(nodes['#weather-status'].textContent,/다시 조회/);
payload={...payload,weather:{...payload.weather,temperature:-9,observedAt:stamp(0),fetchedAt:stamp(0)},marine:{...payload.marine,observedAt:stamp(0),fetchedAt:stamp(0)}};await nodes['#weather-fetch'].onclick();assert.match(nodes['#weather-current'].textContent,/-9°C/);nodes['#weather-apply'].onclick();assert.equal(applied,2);
payload.weather.observedAt='bad timestamp';nodes['#weather-apply'].onclick();assert.equal(applied,2);
console.log('PASS valid subzero temperature, missing temperature, recheck weather observation age at click, invalid timestamps blocked');
