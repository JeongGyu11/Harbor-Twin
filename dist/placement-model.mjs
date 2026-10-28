import {measure,waveAt} from './decision.mjs?v=settle1';
export const TANK_LAYOUT=Object.freeze([{name:'좌현 선수',x:28,z:-9},{name:'우현 선수',x:28,z:9},{name:'좌현 선미',x:-30,z:-9},{name:'우현 선미',x:-30,z:9}]);
export const LIMITS=Object.freeze({minTank:80,maxTank:1120,capacity:1200,minWeight:1,maxWeight:100,minGM:.2,window:60,step:.25});
export const clonePlan=p=>JSON.parse(JSON.stringify(p));
export function validatePlan(p){
 if(!Array.isArray(p.slots)||p.slots.length!==72||new Set(p.slots.map(c=>c.id)).size!==72)throw Error('화물 72개 칸의 ID를 확인하세요.');
 const positions=new Set();
 for(const c of p.slots){
  if(!Number.isInteger(c.bay)||c.bay<0||c.bay>5||!Number.isInteger(c.row)||c.row<0||c.row>3||!Number.isInteger(c.tier)||c.tier<0||c.tier>2)throw Error('화물 위치 범위를 확인하세요.');
  const key=[c.bay,c.row,c.tier].join(':');if(positions.has(key))throw Error('같은 위치에 화물이 중복됩니다.');positions.add(key);
  if(c.x!==-32+c.bay*13||c.z!==-7.5+c.row*5||typeof c.loaded!=='boolean')throw Error('칸의 좌표 또는 적재 상태가 잘못됐습니다.');
  if(!Number.isFinite(c.weight)||c.weight<1||c.weight>100)throw Error('화물 중량은 칸당 1–100t입니다.');
  if(c.loaded&&c.tier>0){for(let tier=0;tier<c.tier;tier++)if(!p.slots.some(b=>b.loaded&&b.bay===c.bay&&b.row===c.row&&b.tier===tier))throw Error('상부 화물을 싣기 전에 같은 칸의 하부 화물을 적재하세요. 하역은 위쪽부터 하세요.');}
 }
 if(!Array.isArray(p.levels)||p.levels.length!==4||p.levels.some(v=>!Number.isFinite(v)||v<0||v>1200))throw Error('각 탱크 수량은 가정 용량 0–1200t입니다.');
 if(!Number.isFinite(p.km)||p.km<=0)throw Error('기준 KM이 없습니다. 현재 상태를 다시 불러오세요.');
 if(!Number.isFinite(p.threshold)||p.threshold<.1||p.threshold>10)throw Error('시연 기울기 한도는 0.1–10도입니다.');
 if(p.simulationTime!==undefined&&(!Number.isFinite(p.simulationTime)||p.simulationTime<0))throw Error('가상 시각을 확인하세요.');
 return p;
}
export function editSlot(plan,id,weight,loaded){const next=clonePlan(plan),slot=next.slots.find(c=>c.id===id);if(!slot)throw Error('화물 칸을 선택하세요.');slot.weight=weight;slot.loaded=loaded;return validatePlan(next);}
function prepare(plan){
 validatePlan(plan);const model={cargo:plan.slots,km:plan.km},removed=plan.slots.filter(c=>!c.loaded).map(c=>c.id);
 let min=Infinity,max=-Infinity;for(let t=0;t<=60;t+=.25){const w=waveAt(t+(plan.simulationTime??0),plan.wave??'off',plan.environment??null);if(!Number.isFinite(w))throw Error('환경 파형을 계산할 수 없습니다.');min=Math.min(min,w);max=Math.max(max,w);}
 const cargoMass=plan.slots.filter(c=>c.loaded).reduce((s,c)=>s+c.weight,0),cargoLongMoment=plan.slots.filter(c=>c.loaded).reduce((s,c)=>s+c.weight*c.x,0);
 return {model,removed,min,max,cargoMass,cargoLongMoment};
}
function evaluate(plan,levels,prepared){
 const {model,removed,min,max,cargoMass,cargoLongMoment}=prepared,m=measure(model,removed,levels),water=levels.reduce((a,b)=>a+b,0),mass=12000+cargoMass+water;
 const lcg=(cargoLongMoment+levels.reduce((s,v,i)=>s+v*TANK_LAYOUT[i].x,0))/mass;
 const tankWithinRange=levels.every(v=>v>=80&&v<=1120);
 const peak=m.valid?Math.max(Math.abs(m.heel+min),Math.abs(m.heel+max)):null;
 return {...m,mass,cargoMass,water,loadedCount:72-removed.length,lcg,tcg:m.mz/mass,peak,threshold:plan.threshold,tankWithinRange,passes:m.valid&&tankWithinRange&&Math.abs(m.heel)<=plan.threshold&&peak<=plan.threshold,window:60,windowStart:plan.simulationTime??0,sampleStep:.25,levels:[...levels]};
}
export function assessPlan(plan){return evaluate(plan,plan.levels,prepare(plan));}
export function searchLevels(plan){
 const prepared=prepare(plan),total=plan.levels.reduce((a,b)=>a+b,0),sets=plan.levels.slice(0,3).map(v=>[...new Set([v,...Array.from({length:27},(_,i)=>80+i*40)])]);
 let checked=0,within=0;const top=[],seen=new Set();
 function consider(levels){
  levels=levels.map(v=>Math.abs(v-80)<1e-8?80:Math.abs(v-1120)<1e-8?1120:v);
  if(levels.some(v=>!Number.isFinite(v)||v<80-1e-8||v>1120+1e-8)||Math.abs(levels.reduce((a,b)=>a+b,0)-total)>1e-6)return;
  const key=levels.map(v=>v.toFixed(6)).join(',');if(seen.has(key))return;seen.add(key);checked++;
  const r=evaluate(plan,levels,prepared);if(!r.valid)return;if(r.passes)within++;
  const moved=levels.reduce((s,v,i)=>s+Math.abs(v-plan.levels[i]),0)/2;top.push({...r,moved});
  top.sort((a,b)=>a.peak-b.peak||Math.abs(a.heel)-Math.abs(b.heel)||Math.abs(a.lcg)-Math.abs(b.lcg)||a.moved-b.moved);if(top.length>5)top.length=5;
 }
 consider(plan.levels);
 // Exact left/right correction candidates complement the coarse grid.
 const moment=measure(prepared.model,prepared.removed,plan.levels).mz;
 for(const from of moment>0?[1,3]:[0,2])for(const to of moment>0?[0,2]:[1,3]){const levels=[...plan.levels],amount=Math.min(Math.abs(moment)/18,levels[from]-80,1120-levels[to]);levels[from]-=amount;levels[to]+=amount;consider(levels);}
 for(const a of sets[0])for(const b of sets[1])for(const c of sets[2])consider([a,b,c,total-a-b-c]);
 return {candidates:top,checked,within,total,gridStep:40,method:'40t grid plus current quantities and lateral moment correction; no global optimum guarantee'};
}
