export {evaluateRisk} from './risk.mjs';
// Deterministic physical look-ahead. No trained AI or operational vessel data.
export const DEFAULTS={levels:[600,600,600,600],rate:2.5,interval:20,horizon:60,wave:'off',threshold:1.5};
// Synthetic roll disturbance in degrees; fixed phase, shared simulation clock.
export const WAVES={off:{label:'파도 끄기',amplitude:0},calm:{label:'잔잔함',amplitude:.25},moderate:{label:'보통',amplitude:.75}};
export function waveAt(time,level='off',environment=null){
 if(environment){const e=environment,r=(e.direction-e.heading)*Math.PI/180,wind=(e.windDirection-e.heading)*Math.PI/180;return e.height*.35*(.25+.75*Math.abs(Math.sin(r)))*(.7*Math.sin(2*Math.PI*time/e.period)+.3*Math.sin(2*Math.PI*time/(e.period*1.625)))+.0008*e.wind**2*Math.sin(wind)*Math.sin(2*Math.PI*time/23);}

 const a=WAVES[level]?.amplitude??0;if(!a)return 0;
 return a*(.7*Math.sin(2*Math.PI*time/8)+.3*Math.sin(2*Math.PI*time/13));
}
export function observedHeel(heel,time,level='off',environment=null){return Number.isFinite(heel)?heel+waveAt(time,level,environment):null;}
const Z=[-9,9,-9,9],X=[28,28,-30,-30],height=1200/(1.025*28*6),fsm=1.025*28*6**3/12;
export function makeModel(cargo){
 const mass=14400+cargo.reduce((s,c)=>s+c.weight,0);
 const kg=(78000+2400*height/4+cargo.reduce((s,c)=>s+c.weight*(13.1+c.tier*4.8),0))/mass;
 return {cargo,km:kg+4*fsm/mass+2.4};
}
export function measure(model,removed,levels){
 let mass=12000,mz=0,mx=0,vertical=78000,free=0;
 const gone=new Set(removed);
 for(const c of model.cargo)if(!gone.has(c.id)){mass+=c.weight;mz+=c.weight*c.z;mx+=c.weight*c.x;vertical+=c.weight*(13.1+c.tier*4.8);}
 levels.forEach((w,i)=>{mass+=w;mz+=w*Z[i];mx+=w*X[i];vertical+=w*height*w/2400;if(w>0&&w<1200)free+=fsm;});
 const gm=model.km-vertical/mass-free/mass,valid=Number.isFinite(gm)&&gm>.2;
 return {heel:valid?Math.atan(mz/(mass*gm))*180/Math.PI:null,gm,mz,trim:mx/(mass*10),valid};
}
function move(model,s,tr,dt){
 if(!tr)return 0;
 const m=measure(model,s.removed,s.levels),delta=Z[tr.to]-Z[tr.from];
 const cap=tr.predictive?Infinity:Math.max(0,-m.mz/delta);
 const amount=Math.max(0,Math.min(tr.remaining,tr.rate*dt,s.levels[tr.from]-80,1120-s.levels[tr.to],cap));
 s.levels[tr.from]-=amount;s.levels[tr.to]+=amount;tr.remaining-=amount;
 if(tr.remaining<1e-7||amount<1e-9)s.transfer=null;
 return amount;
}
function unload(s,cfg,dt){
 if(s.removed.length>=s.queue.length)return;
 s.acc+=dt;
 while(s.acc>=cfg.interval&&s.removed.length<s.queue.length){s.acc-=cfg.interval;s.removed.push(s.queue[s.removed.length]);}
}
export function forecast(model,input,cfg,action=null){
 const s={...input,levels:[...input.levels],removed:[...input.removed],transfer:action?{...action,remaining:action.amount}:input.transfer?{...input.transfer}:null};
 const points=[];let peak=0,exceed=0,moved=0;
 for(let t=0;t<=cfg.horizon;t+=2){
  const m=measure(model,s.removed,s.levels);if(!m.valid)return {valid:false,peak:Infinity,points,exceed,moved};
  peak=Math.max(peak,Math.abs(m.heel));points.push({time:t,heel:m.heel});
  if(t===cfg.horizon)break;
  if(Math.abs(m.heel)>cfg.threshold)exceed+=2;
  moved+=move(model,s,s.transfer,2);unload(s,cfg,2);
 }
 return {valid:true,peak,points,exceed,moved,final:points.at(-1).heel};
}
export function choose(model,input,cfg,mode='predictive'){
 const m=measure(model,input.removed,input.levels);if(!m.valid)return {action:null,candidates:[],valid:false};
 if(mode==='rule'){
  if(Math.abs(m.heel)<.12)return {action:null,candidates:[],valid:true};
  const candidates=[];
  for(const from of m.mz>0?[1,3]:[0,2])for(const to of m.mz>0?[0,2]:[1,3]){
   const amount=Math.min(Math.abs(m.mz)/18,input.levels[from]-80,1120-input.levels[to]);if(amount<.01)continue;
   const levels=[...input.levels];levels[from]-=amount;levels[to]+=amount;
   const next=measure(model,input.removed,levels);if(!next.valid)continue;
   candidates.push({from,to,amount,rate:cfg.rate,duration:amount/cfg.rate,predicted:next.heel,score:Math.abs(next.heel)+Math.abs(next.trim)*.01,predictive:false});
  }
  candidates.sort((a,b)=>a.score-b.score||a.amount-b.amount||a.from-b.from||a.to-b.to);
  return {action:candidates[0]??null,candidates,valid:true};
 }
 const hold=forecast(model,input,cfg),candidates=[{label:'현재 수위 유지',action:null,result:hold,score:hold.peak}];
 // Candidate target is the midpoint of the forecast moment range, not only current heel.
 const future={...input,removed:[...input.removed],levels:[...input.levels]};let low=m.mz,high=m.mz;
 for(let t=0;t<cfg.horizon;t+=2){unload(future,cfg,2);const v=measure(model,future.removed,future.levels).mz;low=Math.min(low,v);high=Math.max(high,v);}
 const target=(low+high)/2;
 for(const from of target>0?[1,3]:[0,2])for(const to of target>0?[0,2]:[1,3])for(const fraction of [.5,1]){
  const amount=Math.min(Math.abs(target)/18*fraction,input.levels[from]-80,1120-input.levels[to],cfg.rate*cfg.horizon);
  if(amount<1)continue;
  const action={from,to,amount,rate:cfg.rate,duration:amount/cfg.rate,predictive:true};
  const result=forecast(model,input,cfg,action);if(!result.valid)continue;
  action.predicted=result.final;
  candidates.push({label:`${from} → ${to}`,action,result,score:result.peak+amount*.00003});
 }
 candidates.sort((a,b)=>a.score-b.score);
 let best=candidates[0],action=best.action&&hold.peak-best.result.peak>.005?best.action:null;
 // Once unloading finishes the horizon peak includes the already-present heel.
 // It cannot improve retroactively. Continue bounded corrections that reduce
 // terminal heel without increasing that peak, rather than declaring completion.
 if(!action&&input.removed.length===input.queue.length&&Math.abs(m.heel)>=.12){
  const settling=candidates.filter(c=>c.action&&c.result.peak<=hold.peak+1e-7&&Math.abs(hold.final)-Math.abs(c.result.final)>.005);
  settling.sort((a,b)=>Math.abs(a.result.final)-Math.abs(b.result.final)||a.action.amount-b.action.amount);
  if(settling.length){best=settling[0];action={...best.action,settling:true};}
 }
 return {action,candidates,hold,selected:action?best:candidates.find(c=>!c.action),valid:true};
}
export function runComparison(model,queue,cfg,mode){
 const s={queue,removed:[...(cfg.initialRemoved??[])],levels:[...cfg.levels],acc:0,transfer:null};
 let peak=0,exceed=0,moved=0,pumpSeconds=0,starts=0,violations=0,time=0,instantPeak=0,instantExceed=0;const points=[];const observationDuration=(queue.length-s.removed.length)*cfg.interval;
 const limit=queue.length*cfg.interval+5000;
 for(;time<=limit;time++){
  const m=measure(model,s.removed,s.levels);
  if(!m.valid)return {mode,complete:false,time,reason:'模型 범위 초과'.replace('模型','모델')};
  if(!s.transfer&&mode!=='none'&&(mode==='rule'||time%5===0||s.removed.length===queue.length)){
   const {action}=choose(model,s,cfg,mode);if(action){s.transfer={...action,remaining:action.amount};starts++;}
  }
  peak=Math.max(peak,Math.abs(m.heel));
  // Common observation window for all policies. Wave sampling is 0.25 s;
  // the quasi-static cargo/ballast state is held per 1 s engine step.
  if(time<observationDuration)for(let j=0;j<4;j++){
   const at=time+j/4+(cfg.waveStart??0),v=observedHeel(m.heel,at,cfg.wave,cfg.environment);
   instantPeak=Math.max(instantPeak,Math.abs(v));if(Math.abs(v)>cfg.threshold)instantExceed+=.25;
  }
  if(time%10===0)points.push({time,heel:m.heel,wave:waveAt(time+(cfg.waveStart??0),cfg.wave,cfg.environment),instant:observedHeel(m.heel,time+(cfg.waveStart??0),cfg.wave,cfg.environment)});
  if(s.levels.some(v=>v<80-1e-7||v>1120+1e-7))violations++;
  if(s.removed.length===queue.length&&!s.transfer)break;
  if(Math.abs(m.heel)>cfg.threshold)exceed++;
  const pumpRate=s.transfer?.rate??cfg.rate;const amount=move(model,s,s.transfer,1);moved+=amount;if(amount>0)pumpSeconds+=amount/pumpRate;
  unload(s,cfg,1);
 }
 return {mode,complete:time<=limit,time,peak,exceed,instantPeak,instantExceed,observationDuration,wave:cfg.wave??'off',environment:cfg.environment??null,waveModel:cfg.environment?'environment-v1 / assumed roll + wind disturbance':'two-sine-v1 / 8s+13s / fixed phase',moved,pumpSeconds,starts,violations,levels:s.levels,points};
}
