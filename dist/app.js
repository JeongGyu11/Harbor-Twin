import * as Placement from './placement-model.mjs?v=2';
import {initPlacementLab} from './placement-ui.js?v=main1';
import {weatherProfile} from './weather-profile.mjs?v=precip1';
import {windResponse} from './wind-model.mjs?v=windbands1';
import {initWorkspaceUI} from './workspace-ui.js?v=placement2';
import {createWeatherEffects} from './weather-effects.js?v=real1';
import * as THREE from './vendor/three.module.js';
import * as Decision from './decision.mjs?v=risk1';
import { createOcean } from './ocean.js?v=real1';
import { hullPose } from './ocean-motion.mjs?v=windbands1';
import { initEnvironment } from './environment-ui.js?v=main1';
import { createSky, SUN_DIRECTION } from './sky.js?v=real1';
import { hullMaterial, deckMaterial, containerMaterials, containerColorIndex, addShipDetails } from './ship-visuals.js?v=real1';
initWorkspaceUI();
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const state={running:false,time:0,speed:2,scenario:'balanced',view:'3d',deck:'all',exploded:false,removed:[],queue:[],tanks:[600,600,600,600],history:[],events:[],transfer:null,applied:0,selected:null,transferred:0,notice:null};
const cargo=[];for(let tier=0;tier<3;tier++)for(let bay=0;bay<6;bay++)for(let row=0;row<4;row++)cargo.push({id:`C${String(cargo.length+1).padStart(3,'0')}`,tier,bay,row,x:-32+bay*13,z:-7.5+row*5,weight:22+((bay*7+row*3+tier*5)%13)});
const tanks=[{id:'P-F',name:'左현 선수 탱크'.replace('左','좌'),x:28,z:-9},{id:'S-F',name:'우현 선수 탱크',x:28,z:9},{id:'P-A',name:'좌현 선미 탱크',x:-30,z:-9},{id:'S-A',name:'우현 선미 탱크',x:-30,z:9}];
let recommendation=null,simAccumulator=0;const MAX_STEPS=72;let STEP_SECONDS=20;
let config={...Decision.DEFAULTS,levels:[...Decision.DEFAULTS.levels],wave:'moderate'},strategy='predictive',customOrder=null,lastDecision=null,lastDecisionAt=-Infinity,comparisonWorker=null,comparisonResult=null;
const originalCargo=cargo.map(c=>({...c}));
let initialRemoved=[],initialTime=0,placementActive=false;
const mainModel=()=>({cargo,km:referenceKM});
const initialCount=()=>MAX_STEPS-initialRemoved.length;
const unloadProgress=()=>initialCount()?(state.removed.length-initialRemoved.length)/initialCount():1;
function fmtTime(t){return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`}
// Illustrative hydrostatics: fixed KM calibrated to initial GM; not ship-certified data.
const MODEL={baseMass:12000,baseKG:6.5,waterDensity:1.025,tankLength:28,tankBreadth:6,tankCapacity:1200,minTank:80,maxTank:1120,minGM:.2,initialGM:2.4};
const tankHeight=MODEL.tankCapacity/(MODEL.waterDensity*MODEL.tankLength*MODEL.tankBreadth);
const cargoHeight=c=>13.1+c.tier*4.8;
const referenceMass=MODEL.baseMass+2400+cargo.reduce((sum,c)=>sum+c.weight,0);
const referenceKG=(MODEL.baseMass*MODEL.baseKG+2400*tankHeight/4+cargo.reduce((sum,c)=>sum+c.weight*cargoHeight(c),0))/referenceMass;
const surfaceMoment=MODEL.waterDensity*MODEL.tankLength*MODEL.tankBreadth**3/12;
let referenceKM=referenceKG+4*surfaceMoment/referenceMass+MODEL.initialGM;
function metrics(withTransfer=true,levels=state.tanks){
 let mass=MODEL.baseMass,mz=0,mx=0,vertical=MODEL.baseMass*MODEL.baseKG,freeMoment=0;
 for(const c of cargo)if(!state.removed.includes(c.id)){mass+=c.weight;mz+=c.weight*c.z;mx+=c.weight*c.x;vertical+=c.weight*cargoHeight(c);}
 tanks.forEach((t,i)=>{const w=withTransfer?levels[i]:config.levels[i];mass+=w;mz+=w*t.z;mx+=w*t.x;vertical+=w*tankHeight*(w/MODEL.tankCapacity)/2;if(w>0&&w<MODEL.tankCapacity)freeMoment+=surfaceMoment;});
 const kg=vertical/mass,freeSurface=freeMoment/mass,gm=referenceKM-kg-freeSurface,valid=Number.isFinite(gm)&&gm>MODEL.minGM;
 return {heel:valid?Math.atan(mz/(mass*gm))*180/Math.PI:null,trim:mx/(mass*10),mass,mz,mx,kg,gm,freeSurface,valid};
}
function currentRisk(){const m=metrics();return Decision.evaluateRisk({metrics:m,levels:state.tanks,threshold:config.threshold,instant:Decision.observedHeel(m.heel,state.time,config.wave,config.environment)});}
function enforceRiskStop(){const r=currentRisk();if(!r.stop)return false;const active=state.running||!!state.transfer;state.running=false;state.transfer=null;recommendation=null;lastDecision=null;lastDecisionAt=-Infinity;state.notice=r.guidance;if(active)event('가정 모델 계산 범위 밖 · 하역과 평형수 이송 중지',true);return true;}
function renderRisk(){const host=$('#model-risk');if(!host)return;const r=currentRisk(),m=metrics(),n=v=>Number.isFinite(v)?v.toFixed(2):'계산 불가';host.dataset.level=String(r.severity);host.style.setProperty('--risk-color',r.color);$('#risk-level').textContent=r.label;$('#risk-direction').textContent=`기울기 방향: ${r.direction}`;$('#risk-values').textContent=`하역 ${Number.isFinite(m.heel)?n(m.heel)+'°':'계산 불가'} · 순간 ${Number.isFinite(Decision.observedHeel(m.heel,state.time,config.wave,config.environment))?n(Decision.observedHeel(m.heel,state.time,config.wave,config.environment))+'°':'계산 불가'} · 추정 GM ${n(m.gm)}m · 시연 한도 ${n(config.threshold)}°`;$('#risk-causes').replaceChildren(...(r.reasons.length?r.reasons:[{text:'현재 기울기·GM·탱크 수량은 표시 기준 이내입니다.'}]).map(x=>{const li=document.createElement('li');li.textContent=x.text;return li;}));$('#risk-guidance').textContent=r.guidance;const overlay=$('#risk-3d');if(overlay){overlay.hidden=r.severity===0;overlay.dataset.level=String(r.severity);overlay.style.setProperty('--risk-color',r.color);overlay.textContent=`가정 모델 경고 · ${r.label} · ${r.direction}`;}}
function complete(){return state.removed.length===MAX_STEPS&&!state.transfer&&!recommendation;}
function recordHistory(){const m=metrics(),base=metrics(false);const point={time:state.time,heel:m.heel,baseline:base.heel,wave:Decision.waveAt(state.time,config.wave,config.environment),instant:Decision.observedHeel(m.heel,state.time,config.wave,config.environment)};const last=state.history.at(-1);if(last&&Math.abs(last.time-point.time)<1e-7)state.history[state.history.length-1]=point;else state.history.push(point);}
function event(message,warning=false){state.events.unshift({time:fmtTime(state.time-initialTime),message,warning});state.events=state.events.slice(0,100);renderEvents()}
function renderEvents(){const e=$('#operationLog');if(e)e.innerHTML=state.events.map(v=>`<li><time>${v.time}</time><span>${v.message}</span></li>`).join('');}
function buildQueue(){const absent=new Set(initialRemoved);let order=customOrder?customOrder.map(id=>cargo.find(c=>c.id===id)):cargo.slice();order=order.filter(c=>!absent.has(c.id));if(!customOrder){if(['port','pump'].includes(state.scenario))order.sort((a,b)=>a.z-b.z||b.tier-a.tier||a.bay-b.bay);else order.sort((a,b)=>b.tier-a.tier||a.bay-b.bay||Math.abs(a.z)-Math.abs(b.z)||a.z-b.z);}state.queue=[...initialRemoved,...order.map(c=>c.id)];}
function applyPlacement(plan){
 const next=Placement.validatePlan(Placement.clonePlan(plan));Placement.assessPlan(next);
 if(next.slots.some(c=>!cargo.some(v=>v.id===c.id)))throw Error('현재 선박의 화물 ID와 맞지 않습니다.');
 // Validate everything before replacing the current run. Empty slots prefix the queue,
 // so both the live engine and look-ahead count only the remaining loaded slots.
 state.running=false;for(const slot of next.slots)Object.assign(cargo.find(c=>c.id===slot.id),slot);
 initialRemoved=next.slots.filter(c=>!c.loaded).map(c=>c.id);initialTime=next.simulationTime??0;placementActive=true;customOrder=null;referenceKM=next.km;
 config={...config,levels:[...next.levels],threshold:next.threshold,wave:next.wave??'off',environment:next.environment??null};
 for(let i=0;i<4;i++){$('#level'+i).value=String(next.levels[i]);$('#level'+i).min='0';$('#level'+i).max='1200';}
 $('#inputThreshold').value=String(next.threshold);$('#waveLevel').value=config.wave;$('#scenario').disabled=false;$('#weather-preview').value='auto';
 environmentUI.restore(config.environment);$('#dataSource').textContent=`적재 실험 B · ${initialCount()}개 화물 · 고정 KM`;
 invalidateComparison();reset();state.exploded=false;$('#explode').checked=false;setDeck('all');setView('3d');
 event(`실험안 B 적용 · 화물 ${initialCount()}개 · 평형수 ${config.levels.reduce((a,b)=>a+b,0).toFixed(1)}t · 가상 파도 ${initialTime.toFixed(1)}초부터`);
 $('#inputMessage').textContent='실험안 B를 새 하역의 시작 상태로 적용했습니다. 초기화하면 이 배치로 돌아갑니다. 합성 예제 복원은 별도 버튼을 사용하세요.';update();
}
function reset(){state.running=false;state.time=initialTime;state.removed=[...initialRemoved];state.tanks=[...config.levels];lastDecision=null;lastDecisionAt=-Infinity;state.history=[];state.events=[];state.transfer=null;state.applied=0;state.transferred=0;state.notice=null;state.selected=null;simAccumulator=0;recommendation=null;buildQueue();event(`선박 모델 준비 완료 · ${Decision.WAVES[config.wave??'off'].label} · 동일 위상 파도`);recordHistory();recommend();update();}
function recommendRule(){
 recommendation=null;state.notice=null;
 if(state.transfer)return;
 const m=metrics();if(!m.valid){state.notice='가정한 계산 범위를 벗어나 자동 이송을 중지했습니다.';return;}
 if(Math.abs(m.heel)<.12)return;
 const donors=m.mz>0?[1,3]:[0,2],receivers=m.mz>0?[0,2]:[1,3];const candidates=[];
 for(const from of donors)for(const to of receivers){
  const leverage=Math.abs(tanks[to].z-tanks[from].z),amount=Math.min(Math.abs(m.mz)/leverage,state.tanks[from]-MODEL.minTank,MODEL.maxTank-state.tanks[to]);
  if(amount<.01)continue;
  const levels=[...state.tanks];levels[from]-=amount;levels[to]+=amount;const predictedState=metrics(true,levels);if(!predictedState.valid)continue;
  const rate=state.scenario==='pump'?.35:config.rate;
  candidates.push({from,to,amount,rate,predicted:predictedState.heel,duration:amount/rate,score:Math.abs(predictedState.heel)+Math.abs(predictedState.trim)*.01});
 }
 candidates.sort((a,b)=>a.score-b.score||a.amount-b.amount||a.from-b.from||a.to-b.to);
 recommendation=candidates[0]??null;if(!recommendation)state.notice='수위 제한으로 이송 가능한 탱크 조합이 없습니다.';
}
function decisionInput(){return {levels:[...state.tanks],removed:[...state.removed],queue:[...state.queue],acc:simAccumulator,transfer:state.transfer};}
function recommend(){
 if(currentRisk().stop){recommendation=null;state.notice=currentRisk().guidance;return;}
 if(strategy==='rule'){recommendRule();return;}
 recommendation=null;state.notice=null;if(state.transfer)return;
 if(!metrics().valid){state.notice='가정한 계산 범위를 벗어나 자동 이송을 중지했습니다.';return;}
 if(state.time-lastDecisionAt>=5||!lastDecision){lastDecision=Decision.choose(mainModel(),decisionInput(),config);lastDecisionAt=state.time;}
 recommendation=lastDecision.action?{...lastDecision.action}:null;
}
function approve(refresh=true){if(state.transfer)return;lastDecisionAt=-Infinity;recommend();if(!recommendation)return;state.transfer={...recommendation,remaining:recommendation.amount};state.applied++;event(`${tanks[recommendation.from].id} → ${tanks[recommendation.to].id} ${recommendation.amount.toFixed(1)} t ${$('#auto').checked?'시연 자동 승인':'담당자 승인'} · ${strategy==='predictive'?'60초 예측 비교':'현재 상태 규칙'}`);recommendation=null;recordHistory();if(refresh)update();}
function advance(dt){
 if(!state.running||!Number.isFinite(dt)||dt<=0)return;
 let remaining=dt*state.speed*10;
 while(remaining>1e-8&&state.running){
  if(enforceRiskStop()){recordHistory();break;}
  const step=Math.min(1,remaining,state.removed.length<MAX_STEPS?Math.max(.000001,STEP_SECONDS-simAccumulator):1);
  state.time+=step;remaining-=step;
  if(state.transfer){
   const tr=state.transfer,m=metrics(),delta=tanks[tr.to].z-tanks[tr.from].z;
   if(!tr.predictive&&m.mz*delta>=0){state.transfer=null;event('하중 변화로 기존 이송안을 종료하고 다시 평가합니다.');}
   else {const amount=Math.max(0,Math.min(tr.remaining,tr.rate*step,(tr.predictive?Infinity:Math.abs(m.mz/delta)),state.tanks[tr.from]-MODEL.minTank,MODEL.maxTank-state.tanks[tr.to]));state.tanks[tr.from]-=amount;state.tanks[tr.to]+=amount;tr.remaining-=amount;state.transferred+=amount;if(tr.remaining<1e-7||amount<1e-9||(!tr.predictive&&Math.abs(metrics().mz)<1e-7)){state.transfer=null;event('이송 완료 · 현재 상태 재평가');}}
  }
  if(state.removed.length<MAX_STEPS){simAccumulator+=step;if(simAccumulator>=STEP_SECONDS-1e-7){simAccumulator=0;const next=state.queue.find(id=>!state.removed.includes(id));if(next){state.removed.push(next);lastDecisionAt=-Infinity;}}}
  recommend();if($('#auto').checked&&recommendation)approve(false);
  recordHistory();
  if(enforceRiskStop())break;
  else if(state.removed.length===MAX_STEPS&&!state.transfer){state.running=false;event(recommendation?'하역 완료 · 추가 조정 승인 대기':'하역과 평형수 조정 완료');toast(recommendation?'하역 완료 · 남은 추천안을 승인해 마무리할 수 있습니다.':'전체 작업 완료 · 아래 그래프에서 결과를 비교하세요.');}
 }
 update();
}
function update(){
 enforceRiskStop();renderRisk();renderPrecipitationStatus();
 const placementStatus=$('#placement-status');if(placementStatus){placementStatus.hidden=!placementActive;placementStatus.textContent=`실험안 B 적용 · 남은 화물 ${MAX_STEPS-state.removed.length}/${initialCount()}개 · 현재 화물 ${cargo.filter(c=>!state.removed.includes(c.id)).reduce((a,c)=>a+c.weight,0).toFixed(1)}t · 초기화하면 이 배치를 복원합니다.`;}
 const m=metrics(),valid=m.valid,angle=valid?Math.abs(m.heel):null;
 $('#heel').textContent=valid?angle.toFixed(2):'—';$('#ballast').textContent=Math.round(state.tanks.reduce((a,b)=>a+b,0)).toLocaleString();$('#progress').textContent=Math.round(unloadProgress()*100);$('#progressBar').style.width=`${unloadProgress()*100}%`;$('#heelBar').style.width=`${valid?Math.min(100,angle/3*100):100}%`;$('#cargoCount').textContent=`${MAX_STEPS-state.removed.length} / ${initialCount()}`;$('#elapsed').textContent=`${fmtTime(state.time-initialTime)} 경과`;$('#chartTime').textContent=fmtTime(state.time-initialTime);
 $('#play').textContent=state.running?'Ⅱ 일시정지':complete()?'↺ 다시 시뮬레이션':state.removed.length===MAX_STEPS&&!state.transfer?'조정 승인 대기':'▶ 시뮬레이션 시작';
 const tankOutside=state.tanks.some(v=>v<80||v>1120),risk=currentRisk(),warn=risk.severity>0;$('#statusPill').textContent=risk.stop?'● 모델 범위 초과':tankOutside?'● 탱크 운전 범위 밖':`● 모델 ${risk.label}`;$('#statusPill').classList.toggle('warn',warn);$('#heelNote').textContent=`추정 GM ${m.gm.toFixed(2)} m`;$('#heelNote').style.color=warn?'var(--amber)':'var(--mint)';
 const phase=$('#operationPhase');if(phase)phase.textContent=state.notice??(state.removed.length<MAX_STEPS?(state.running?'화물을 하역하고 있습니다.':state.time>initialTime?'하역 일시정지 · 시작 버튼으로 재개하세요.':'하역 대기 · 시작 버튼을 눌러주세요.'):state.transfer?(state.running?'하역 100% · 마지막 평형수 조정 중':'하역 100% · 평형수 조정 일시정지'):recommendation?'하역 100% · 남은 추천안 승인 대기':'하역과 평형수 조정 모두 완료');
 renderWave();renderRecommendation();drawChart();renderDecision();updateModel();if(state.view==='2d')drawPlan();
}
function renderRecommendation(){const r=recommendation,tr=state.transfer;$('#approve').disabled=!r;$('#play').disabled=currentRisk().stop||(state.removed.length===MAX_STEPS&&!state.transfer&&!!r);$('#approve').textContent=tr?'↻ 밸러스트 이송 진행 중':'✓ 추천 운전안 적용';if(tr){$('#recommendStatus').textContent='승인된 운전안 실행 중';$('#recommendTitle').textContent='탱크 간 평형수를 이송합니다.';$('#recommendText').textContent=`남은 이송량 ${tr.remaining.toFixed(0)} t · 유량 ${tr.rate} t/s · 시뮬레이션 속도로 진행됩니다.`}else if(r){$('#recommendStatus').textContent='새로운 운전안 제안';$('#recommendTitle').textContent=r.settling?'하역 후 남은 기울기를 조정합니다.':'하중 변화에 대응할 시간입니다.';$('#recommendText').textContent=`${r.settling?'하역은 끝났지만 남은 기울기를 줄일 수 있습니다. 이송 후 예측값을 확인하고 승인하세요.':r.predictive?'예정 하역과 이송시간을 반영한 60초 후보 비교 결과입니다. 아래 예측 근거를 확인한 뒤 승인하세요.':`${metrics().heel>0?'우현':'좌현'} 쪽 현재 하중 편차를 줄이는 규칙 기반 추천입니다.`}`}else{$('#recommendStatus').textContent=state.notice?'운전 제한 확인':'운전 상태 모니터링 중';$('#recommendTitle').textContent=state.notice?'이송을 진행할 수 없습니다.':'현재 추가 조정이 필요하지 않습니다.';$('#recommendText').textContent=state.notice??'현재의 하중과 수위를 확인하고 있습니다. 조건이 바뀌면 가능한 조정안을 다시 계산합니다.'}const active=tr||r;if($('#predictedCaption'))$('#predictedCaption').textContent=active?.predictive?'+60초 예상 기울기':'이송량 적용 후 기울기';$('#fromTank').textContent=active?tanks[active.from].name:'좌현 선수 탱크';$('#toTank').textContent=active?tanks[active.to].name:'우현 선수 탱크';$('#fromValue').innerHTML=`${state.tanks[active?.from??0].toFixed(0)} <em>t</em>`;$('#toValue').innerHTML=`${state.tanks[active?.to??1].toFixed(0)} <em>t</em>`;$('#transferValue').textContent=active?`${(tr?tr.remaining:r.amount).toFixed(0)} t`:'대기';$('#predictedHeel').textContent=active?`${Math.abs(active.predicted).toFixed(2)}°`:'—';$('#predictedTime').textContent=active?`${Math.ceil((tr?tr.remaining/tr.rate:r.duration)-1e-9)}초`:'—';}
function renderWave(){
 const m=metrics(),wave=Decision.waveAt(state.time,config.wave,config.environment),instant=Decision.observedHeel(m.heel,state.time,config.wave,config.environment);
 if(!$('#instantHeel'))return;
 $('#instantHeel').textContent=instant===null?'계산 불가':`${instant>=0?'+':''}${instant.toFixed(2)}°`;
 $('#waveHeel').textContent=`${wave>=0?'+':''}${wave.toFixed(2)}°`;
 $('#waveStatus').textContent=`${config.environment?config.environment.source+' · 환경 적용':Decision.WAVES[config.wave??'off'].label} · 가상 시간 ${state.time.toFixed(1)}초 · 시연 기준 ${config.threshold}°`;
 $('#instantHeel').style.color=instant!==null&&Math.abs(instant)>config.threshold?'#edbd83':'#a7baff';
}
function drawChart(){
 const mid=52,values=state.history,finite=values.flatMap(v=>[v.heel,v.baseline,v.instant]).filter(Number.isFinite),max=Math.max(2,...finite.map(Math.abs)),scale=42/max,end=Math.max(STEP_SECONDS,state.time-initialTime);let svg='';
 for(let i=0;i<5;i++){const y=10+i*21;svg+=`<line x1="30" y1="${y}" x2="648" y2="${y}" stroke="${i===2?'#567d85':'#263b49'}" stroke-width="${i===2?1:.6}"/><text x="0" y="${y+3}" fill="#648294" font-size="8">${((mid-y)/scale).toFixed(1)}</text>`;}
 const path=key=>{let open=false;return values.map(v=>{if(!Number.isFinite(v[key])){open=false;return '';}const cmd=open?'L':'M';open=true;return `${cmd}${30+(v.time-initialTime)/end*615},${mid-v[key]*scale}`;}).join(' ');};
 svg+=`<path d="${path('instant')}" fill="none" stroke="#8ca9ff" stroke-width="1" opacity=".8"/><path d="${path('baseline')}" fill="none" stroke="#b99572" stroke-width="1.6" stroke-dasharray="4 4"/><path d="${path('heel')}" fill="none" stroke="#63e4c0" stroke-width="2"/>`;$('#chart').innerHTML=svg;
 const summary=$('#comparisonSummary');if(summary){const peak=key=>Math.max(0,...values.map(v=>v[key]).filter(Number.isFinite).map(Math.abs));summary.textContent=`기록된 최대 |기울기| · 하역 ${peak('heel').toFixed(2)}° / 순간 ${peak('instant').toFixed(2)}° / 무조정 하역 ${peak('baseline').toFixed(2)}°`;}
}
let displayedDecisionAt=-Infinity;
function renderDecision(){
 if(!$('#forecastReason'))return;
 if(state.running&&state.time-displayedDecisionAt<5)return;
 displayedDecisionAt=state.time;
 if(currentRisk().stop){$('#forecastReason').textContent='계산 범위 밖 · 하역·이송과 추천 중지';$('#forecastChart').innerHTML='';$('#alternatives').innerHTML='';return;}
 const input=decisionInput(),model=mainModel();
 const d=Decision.choose(model,{...input,transfer:null},config);
 if(!d.valid){$('#forecastReason').textContent='계산 범위 초과 · 예측과 추천 중지';$('#forecastChart').innerHTML='';$('#alternatives').innerHTML='';return;}
 const hold=Decision.forecast(model,input,config);
 const active=state.transfer?{...state.transfer,amount:state.transfer.remaining}:recommendation;
 const selected=active?Decision.forecast(model,{...input,transfer:null},config,active):hold;
 $('#forecastReason').textContent=state.transfer?`승인된 이송 진행 중 · 남은 ${state.transfer.remaining.toFixed(1)} t. 완료 후 다음 운전안을 재평가합니다.`:strategy==='rule'?`현재 상태 기반 추천 · 아래 후보 비교는 60초 예측 참고 자료입니다. 승인 판단은 현재 기울기에 반응합니다.`:recommendation?.settling?`하역 후 잔여 기울기 보정 · 현재 최대값은 그대로지만 60초 후 |기울기|는 ${Math.abs(hold.final).toFixed(2)}° → ${Math.abs(selected.final).toFixed(2)}°로 줄어드는 후보입니다.`:recommendation?`선택 근거: 수위 80–1,120 t를 지키는 후보 중 예측 최대 기울기와 이송량을 함께 평가했습니다. 현재 수위 유지 ${hold.peak.toFixed(2)}° → 추천 ${selected.peak.toFixed(2)}°. 마지막 평가 ${fmtTime(lastDecisionAt)}.`:'현재 수위 유지 · 60초 예측에서 충분한 개선을 보이는 이송 후보가 없습니다.';
 const points=[...hold.points,...selected.points];const max=Math.max(config.threshold,...points.map(v=>Math.abs(v.heel)),.5)*1.15;
 const y=v=>75-v/max*55;
 let svg=`<line x1="40" y1="75" x2="630" y2="75" stroke="#526c7a"/><text x="4" y="23" fill="#a8bdc7" font-size="10">${max.toFixed(1)}°</text><text x="4" y="130" fill="#a8bdc7" font-size="10">−${max.toFixed(1)}°</text>`;
 for(const v of [config.threshold,-config.threshold])svg+=`<line x1="40" y1="${y(v)}" x2="630" y2="${y(v)}" stroke="#b99572" stroke-dasharray="2 5"/>`;
 for(let t=config.interval-simAccumulator,n=state.removed.length;t<=60&&n<state.queue.length;t+=config.interval,n++)svg+=`<line x1="${40+t/60*590}" y1="15" x2="${40+t/60*590}" y2="132" stroke="#35505d"/>`;
 for(const [r,color,dash] of [[hold,'#d5ad83','5 4'],[selected,'#63e4c0','']])svg+=`<path d="${r.points.map((v,i)=>`${i?'L':'M'}${40+v.time/60*590},${y(v.heel)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="${dash}"/>`;
 svg+='<text x="40" y="148" fill="#a8bdc7" font-size="10">現在</text><text x="590" y="148" fill="#a8bdc7" font-size="10">+60초</text>'.replace('現在','현재');
 $('#forecastChart').innerHTML=svg;
 const rows=state.transfer?[{action:active,result:selected}]:[d.candidates.find(c=>!c.action),...d.candidates.filter(c=>c.action).slice(0,3)].filter(Boolean);
 $('#alternatives').innerHTML=rows.map(c=>`<tr><td>${c.action?`${tanks[c.action.from].id} → ${tanks[c.action.to].id} · ${c.action.amount.toFixed(0)} t`:'현재 수위 유지'}${state.transfer?' · 실행 중':d.selected===c?' · 탐색 선택':''}</td><td>${c.result.peak.toFixed(2)}°</td><td>${c.result.exceed}초</td><td>${c.result.moved.toFixed(1)} t</td></tr>`).join('');
}
function downloadJSON(name,data){downloadFile(name,JSON.stringify(data,null,2),'application/json');}
function downloadFile(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function invalidateComparison(){
 comparisonWorker?.terminate();comparisonWorker=null;comparisonResult=null;displayedDecisionAt=-Infinity;
 $('#experimentRows').innerHTML='';$('#experimentStatus').textContent='조건이 바뀌었습니다. 비교 실험을 다시 실행하세요.';$('#exportResults').disabled=true;$('#runComparison').disabled=false;
}
function readSettings(){
 const get=(id,min,max)=>{const raw=$('#'+id).value;if(!raw.trim())throw Error('설정값을 모두 입력하세요.');const v=Number(raw);if(!Number.isFinite(v)||v<min||v>max)throw Error(`${$('#'+id).parentElement.textContent.trim()}: ${min}–${max} 범위로 입력하세요.`);return v;};
 const interval=get('inputInterval',5,120);if(interval%1)throw Error('하역 간격은 정수 초로 입력하세요.');
 const wave=$('#waveLevel').value;if(!Decision.WAVES[wave])throw Error('파도 세기를 선택하세요.');
 return {environment:config.environment??null,wave,interval,rate:get('inputRate',.1,10),threshold:get('inputThreshold',.1,10),horizon:60,levels:[0,1,2,3].map(i=>get('level'+i,placementActive?0:80,placementActive?1200:1120))};
}
function parseCargoCSV(text){
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 if(lines.shift()?.trim()!=='id,weight,order')throw Error('첫 행은 id,weight,order 이어야 합니다.');
 if(lines.length!==72)throw Error('72개 화물을 모두 입력하세요.');
 const seen=new Set(),orders=new Set(),parsed=[];
 for(const line of lines){const cells=line.split(',').map(v=>v.trim());if(cells.length!==3)throw Error('각 행에는 ID, 중량, 순서 3개 값이 필요합니다.');const [id,w,o]=cells;const source=cargo.find(c=>c.id===id),weight=Number(w),order=Number(o);
  if(!source||seen.has(id)||!w||!o||!Number.isFinite(weight)||weight<1||weight>100||!Number.isInteger(order)||order<1||order>72||orders.has(order))throw Error('ID 중복·누락, 중량(1–100 t), 순서(1–72)를 확인하세요.');
  seen.add(id);orders.add(order);parsed.push({...source,weight,order});
 }
 parsed.sort((a,b)=>a.order-b.order);
 for(const c of parsed)if(parsed.some(top=>top.bay===c.bay&&top.row===c.row&&top.tier>c.tier&&top.order>c.order))throw Error('하역 순서 오류: 같은 위치의 위쪽 화물을 먼저 내려야 합니다.');
 return parsed;
}
function initDecisionUI(){
 try{const saved=localStorage.getItem('harbor-twin.wave');if(Decision.WAVES[saved]){config.wave=saved;$('#waveLevel').value=saved;}}catch{}

 $('#applySettings').onclick=()=>{try{const next=readSettings();config=next;try{localStorage.setItem('harbor-twin.wave',next.wave);}catch{}STEP_SECONDS=next.interval;strategy=$('#strategy').value;invalidateComparison();reset();$('#inputMessage').textContent='운전 조건을 적용하고 초기화했습니다. 비교 실험에도 같은 조건이 적용됩니다.';}catch(error){$('#inputMessage').textContent=error.message;}};
 $('#waveLevel').onchange=()=>{$('#inputMessage').textContent='파도 세기 변경은 설정 적용 버튼을 누르면 반영됩니다.';};
 $('#strategy').onchange=()=>{$('#inputMessage').textContent='추천 방식 변경은 설정 적용 버튼을 누르면 반영됩니다.';};
 $('#downloadPlan').onclick=()=>{if(initialRemoved.length){$('#inputMessage').textContent='부분 적재 상태는 CSV에 빈 칸을 표현할 수 없습니다. 적재·탱크 실험의 입력·결과 JSON 저장을 사용하세요.';return;}buildQueue();downloadFile('harbor-cargo.csv','id,weight,order\n'+state.queue.map((id,i)=>`${id},${cargo.find(c=>c.id===id).weight},${i+1}`).join('\n'),'text/csv;charset=utf-8');};
 $('#cargoFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>100000)throw Error('CSV는 100 KB 이하로 입력하세요.');const parsed=parseCargoCSV(await file.text());for(const c of parsed)cargo.find(v=>v.id===c.id).weight=c.weight;initialRemoved=[];initialTime=0;placementActive=false;customOrder=parsed.map(c=>c.id);referenceKM=Decision.makeModel(cargo).km;invalidateComparison();reset();$('#scenario').disabled=true;$('#dataSource').textContent='사용자 CSV · 가상 위치 / 입력 중량·순서';$('#inputMessage').textContent='CSV 적용 완료 · 학습·검증된 실제 선박 모델은 아닙니다.';}catch(error){$('#inputMessage').textContent=error.message;}finally{e.target.value='';}};
 $('#restorePlan').onclick=()=>{originalCargo.forEach((c,i)=>Object.assign(cargo[i],c));initialRemoved=[];initialTime=0;placementActive=false;customOrder=null;referenceKM=Decision.makeModel(cargo).km;$('#scenario').disabled=false;$('#dataSource').textContent='합성 예제 · 72개 화물';invalidateComparison();reset();$('#inputMessage').textContent='합성 화물 예제를 복원했습니다. 운전 조건은 현재 적용값을 유지합니다.';};
 $('#runComparison').onclick=()=>{
  $('#runComparison').disabled=true;$('#exportResults').disabled=true;$('#experimentStatus').textContent='같은 조건으로 3가지 방식을 계산 중입니다…';
  const payload={km:referenceKM,cargo:cargo.map(c=>({...c})),queue:[...state.queue],cfg:{...config,levels:[...config.levels],initialRemoved:[...initialRemoved],waveStart:initialTime}};
  try{comparisonWorker=new Worker('./comparison-worker.mjs?v=settle1',{type:'module'});
   const fail=message=>{$('#experimentStatus').textContent=message;$('#runComparison').disabled=false;comparisonWorker?.terminate();comparisonWorker=null;};
   comparisonWorker.onerror=()=>fail('비교 계산을 시작하지 못했습니다. 로컬 HTTP 서버 또는 정적 웹 호스팅에서 다시 시도하세요.');
   comparisonWorker.onmessage=({data})=>{if(data.error){fail(data.error);return;}comparisonResult={version:'harbor-twin-wave-1',createdAt:new Date().toISOString(),source:placementActive?'적재 실험 B / 가상 위치':customOrder?'사용자 CSV / 가상 위치':'합성 예제',model:'고정 KM / 물리 모델 / 학습형 AI 미구현',conditions:payload,results:data.results};
    const labels={none:'무조정',rule:'현재 상태 기반 규칙',predictive:'60초 예측 기반 탐색'};
    $('#experimentRows').innerHTML=data.results.map(r=>r.peak===undefined?`<tr><td>${labels[r.mode]}</td><td colspan="9">${r.reason} · 미완료</td></tr>`:`<tr><td>${labels[r.mode]}</td><td>${r.peak.toFixed(2)}°</td><td>${r.exceed}초</td><td>${r.instantPeak.toFixed(2)}°</td><td>${r.instantExceed.toFixed(2)}초</td><td>${r.moved.toFixed(1)} t</td><td>${r.pumpSeconds.toFixed(2)}초</td><td>${r.starts}</td><td>${r.violations}</td><td>${r.complete?'완료':'시간 제한'}</td></tr>`).join('');
    $('#experimentStatus').textContent=`비교 완료 · ${config.environment?config.environment.source+' / 파고 '+config.environment.height+' m':Decision.WAVES[config.wave??'off'].label} / 동일 위상·동일 시간 구간 · 하역 간격 ${config.interval}초 / 유량 ${config.rate} t/s / 시연 기준 ${config.threshold}° / 총 초기 평형수 ${config.levels.reduce((a,b)=>a+b,0)} t. 낮은 기울기와 적은 이송량의 균형을 비교하세요. 최대·초과시간은 표본 계산값(하역 1초·파동 0.25초)이며 펌프 가동은 이송량/유량입니다.`;
    $('#exportResults').disabled=false;$('#runComparison').disabled=false;comparisonWorker.terminate();comparisonWorker=null;};
   comparisonWorker.postMessage(payload);
  }catch(error){$('#experimentStatus').textContent=error.message;$('#runComparison').disabled=false;}
 };
 $('#exportResults').onclick=()=>{if(comparisonResult)downloadJSON('harbor-comparison.json',comparisonResult);};
}

// Shared vessel coordinates drive both the 3D model and 2D drawing.
let ocean,sky,shipDetails;const oceanDecor=[];
let riskVisual;
let scene,camera,renderer,ship,water,grid,containerMeshes=[],tankMeshes=[],pickables=[],deckMeshes=[],facilityMeshes=[],raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let yaw=.72,pitch=.3,distance=175,drag=null,hasMoved=false,webgl=true;
try{scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x0b1824,.0022);camera=new THREE.PerspectiveCamera(34,1,.1,12000);renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x091722,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;$('#scene').append(renderer.domElement);scene.add(new THREE.HemisphereLight(0xcfe6f5,0x1d2a30,1.1));const sun=new THREE.DirectionalLight(0xfff0d8,3.4);sun.position.copy(SUN_DIRECTION).multiplyScalar(140);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0004;sun.shadow.normalBias=.4;sun.shadow.camera.left=-110;sun.shadow.camera.right=110;sun.shadow.camera.top=80;sun.shadow.camera.bottom=-80;scene.add(sun);const rim=new THREE.DirectionalLight(0x9fc4d6,.6);rim.position.set(20,15,-60);scene.add(rim);ship=new THREE.Group();scene.add(ship);
 riskVisual={group:new THREE.Group(),lines:[],arrows:[]};for(const side of [-1,1]){const points=[new THREE.Vector3(-61,5,side*16),new THREE.Vector3(48,5,side*16),new THREE.Vector3(61,5,side*6)];const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xf2c46e,transparent:true,opacity:.9,depthTest:false}));line.renderOrder=20;riskVisual.group.add(line);riskVisual.lines.push(line);const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,side),new THREE.Vector3(0,11,side*17),12,0xf2c46e,4,3);riskVisual.group.add(arrow);riskVisual.arrows.push(arrow);}ship.add(riskVisual.group);riskVisual.group.visible=false;

const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.62,metalness:.25,...extra});const hullmat=hullMaterial(0),deckmat=deckMaterial(),lowerHull=hullMaterial(-5),lineMat=mat(0x9cbac4);
function box(w,h,d,color,x,y,z,parent=ship){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),typeof color==='number'?mat(color):color);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function hullShape(width,length){const shape=new THREE.Shape();shape.moveTo(-length/2,-width*.40);shape.lineTo(length*.34,-width/2);shape.quadraticCurveTo(length*.51,-width*.36,length/2,0);shape.quadraticCurveTo(length*.51,width*.36,length*.34,width/2);shape.lineTo(-length/2,width*.40);shape.quadraticCurveTo(-length*.55,0,-length/2,-width*.40);return shape}
function hull(w,l,height,y,material){const geo=new THREE.ExtrudeGeometry(hullShape(w,l),{depth:height,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.6,bevelThickness:.5});geo.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geo,material);mesh.position.y=y;mesh.castShadow=true;mesh.receiveShadow=true;ship.add(mesh);return mesh}
hull(24,116,6,-5,lowerHull);hull(30,124,6,0,hullmat);const mainDeck=hull(29,123,.65,6,deckmat);deckMeshes.push(mainDeck);
// Long hull rub rails and hatch outlines.
for(const z of [-14.4,14.4]){box(99,.3,.25,0x8da3ae,-4,5.8,z);for(let x=-52;x<43;x+=7){box(.13,1.2,.13,0x9ab6bc,x,7.4,z)}box(94,.12,.12,0x9ab6bc,-5,8,z)}
for(let bay=0;bay<6;bay++){const hatch=box(12,.35,22,mat(0x4f5d63,{roughness:.7,metalness:.35}),-32+bay*13,6.65,0);hatch.userData={kind:'deck',deck:'lower',name:`BAY ${bay+1} 下部 화물창`.replace('下部','하부')};pickables.push(hatch);deckMeshes.push(hatch)}
cargo.forEach((c,i)=>{const mesh=box(11.9,4.5,4.2,containerMaterials(containerColorIndex(c.id)),c.x,9.1+c.tier*4.8,c.z);mesh.userData={kind:'cargo',id:c.id,deck:c.tier===0?'lower':'upper'};containerMeshes.push(mesh);pickables.push(mesh)});
tanks.forEach((t,i)=>{const mesh=box(28,4,5,mat(0x4bd8b4,{transparent:true,opacity:.65,emissive:0x0c5d4c,emissiveIntensity:.5}),t.x,-1,t.z);mesh.userData={kind:'tank',index:i,deck:'tank'};tankMeshes.push(mesh);pickables.push(mesh);const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(28,7,5)),new THREE.LineBasicMaterial({color:0x63e4c0,transparent:true,opacity:.7}));outline.position.set(t.x,-.5,t.z);ship.add(outline);tankMeshes.push(outline)});
// Accommodation block, bridge, funnel and service deck.
shipDetails=addShipDetails({ship,box,facilityMeshes,cargo});const engine=box(12,6,15,0xcd965b,-50,0,0);engine.userData={kind:'facility',deck:'facility',name:'기관실 · 펌프 / BWTS'};pickables.push(engine);facilityMeshes.push(engine);
ocean=createOcean(renderer);water=ocean.mesh;scene.add(water);sky=createSky(renderer,scene);ocean.setEnvironment?.(sky);grid=new THREE.GridHelper(600,75,0x254656,0x18313f);grid.position.y=-3.9;grid.material.transparent=true;grid.material.opacity=.36;scene.add(grid);
for(let i=0;i<9;i++){const curve=new THREE.EllipseCurve(0,0,74+i*13,23+i*9,0,Math.PI*2,false,0);const points=curve.getPoints(100).map(p=>new THREE.Vector3(p.x,-3.8,p.y));const ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x4e8c97,transparent:true,opacity:.07-i*.005}));scene.add(ring);oceanDecor.push(ring)}
ship.children.filter(o=>o.geometry?.type==='BoxGeometry'&&o.position.x < -40&&!containerMeshes.includes(o)&&!tankMeshes.includes(o)).forEach(o=>{if(!facilityMeshes.includes(o))facilityMeshes.push(o)});
pickables=pickables.filter(o=>o.userData.kind!=='facility');
const observer=new ResizeObserver(()=>{const e=$('#scene');if(e.clientWidth&&e.clientHeight){renderer.setSize(e.clientWidth,e.clientHeight);camera.aspect=e.clientWidth/e.clientHeight;camera.updateProjectionMatrix()}});observer.observe($('#scene'));
renderer.domElement.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};hasMoved=false;renderer.domElement.setPointerCapture(e.pointerId)});renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>4)hasMoved=true;yaw+=dx*.006;pitch=Math.max(.04,Math.min(1.25,pitch+dy*.005));drag.x=e.clientX;drag.y=e.clientY});renderer.domElement.addEventListener('pointerup',e=>{if(!hasMoved){const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(pickables.filter(m=>m.visible),false);if(hits.length)selectObject(hits[0].object.userData)}drag=null});renderer.domElement.addEventListener('pointercancel',()=>{drag=null;hasMoved=true});renderer.domElement.addEventListener('lostpointercapture',()=>{drag=null});renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(90,Math.min(300,distance+e.deltaY*.08))},{passive:false});
}catch(error){webgl=false;$('#scene').innerHTML='<div style="padding:130px 30px;color:#9db7c7">此장치에서 3D 화면을 초기화하지 못했습니다. 2D 도면을 이용해 주세요.</div>'.replace('此','이 ');console.error(error)}
let weatherEffects;
function renderPrecipitationStatus(profile=weatherProfile(config.environment,$('#weather-preview').value)){const node=$('#precipitation-status');if(!node)return;node.textContent=profile.precipitation.label?`강수 표현: ${profile.precipitation.label}`:'강수 표현 없음';node.dataset.source=profile.precipitation.source;}
function applyWeather(){
 if(!scene)return;weatherEffects??=createWeatherEffects(scene,{sky,camera});
 const mode=$('#weather-preview').value,p=weatherEffects.update(state.time,config.environment,mode,$('#weather-flashes').checked&&state.running);
 const labels={auto:'관측·설정 날씨',clear:'맑음',cloud:'흐림',rain:'비',snow:'눈',fog:'안개',thunder:'뇌우',typhoon:'태풍'};
 $('#weather-effect-status').textContent=mode==='auto'?`날씨 연출: ${labels[p.mode]??p.mode} · ${p.wind.toFixed(1)} m/s · ${p.windVisual.label} · 바람 추가 물결 ${p.windVisual.waveAmplitude.toFixed(2)}m(연출)`:`${labels[mode]} 시각 시연 · 실제 관측·물리 조건 유지`;
 renderPrecipitationStatus(p);shipDetails?.setNight(!!p.night);ocean?.setGloom?.(p.night?.8:p.storm||p.thunder?.95:p.rain?.75:p.snow||p.fog?.45:p.cloud?.35:0);shipDetails?.animate(performance.now()/1000);
}
function applyOceanPose(m=metrics()){
 if(!ship||currentRisk().stop)return;const pose=hullPose(state.time,config.environment??config.wave);
 ship.position.y=pose.heave;ship.rotation.x=THREE.MathUtils.degToRad((m.heel??0)*8)+pose.roll;
 ship.rotation.z=-Math.atan(m.trim/180)*8+pose.pitch;
}
function updateRiskVisual(){if(typeof riskVisual==='undefined'||!riskVisual)return;const r=currentRisk();riskVisual.group.visible=r.severity>0;riskVisual.lines.forEach((line,i)=>{line.material.color.set(r.color);line.material.opacity=r.side===0||r.side===(i===0?-1:1)?.95:.25;});riskVisual.arrows.forEach((arrow,i)=>{arrow.visible=r.side!==0&&r.side===(i===0?-1:1);arrow.setColor(new THREE.Color(r.color));});}
function updateModel(){if(!ship)return;updateRiskVisual();const m=metrics();applyOceanPose(m);const interior=['tank','facility','lower'].includes(state.deck);ship.children.forEach(o=>{if(o.geometry?.type==='ExtrudeGeometry'){o.material.transparent=interior||state.exploded;o.material.opacity=interior?.14:state.exploded?.32:1;o.material.depthWrite=!interior}});containerMeshes.forEach((mesh,i)=>{const c=cargo[i];mesh.visible=!state.removed.includes(c.id)&&(state.deck==='all'||state.deck==='upper'&&c.tier>0||state.deck==='lower'&&c.tier===0);mesh.position.x=c.x;mesh.position.z=c.z;mesh.position.y=9.1+c.tier*4.8+(state.exploded?c.tier*11+14:0)});tankMeshes.forEach((mesh,i)=>{mesh.visible=state.deck==='tank'||state.exploded;if(i%2===0){const index=i/2;const fill=state.tanks[index]/MODEL.tankCapacity;mesh.scale.y=7*fill/4;mesh.position.y=-4+7*fill/2}});facilityMeshes.forEach(mesh=>{mesh.visible=state.deck==='all'||state.deck==='facility'||state.exploded});}
function setView(view){state.view=view;$('#scene').hidden=view!=='3d';$('#plan').hidden=view!=='2d';$('#view3d').classList.toggle('active',view==='3d');$('#view2d').classList.toggle('active',view==='2d');$('#viewTag').textContent=view==='3d'?'3D 전체 보기':'2D 도면 보기';$('#viewHint').textContent=view==='3d'?'드래그하여 회전 · 스크롤하여 확대 · 구역 클릭':'구역을 클릭해 화물 무게와 탱크의 물 양 확인';$('.compass').hidden=view==='2d';$('.view-controls').hidden=view==='2d';if(view==='2d')drawPlan();}
function setDeck(deck){state.deck=deck;$$('[data-deck]').forEach(b=>b.classList.toggle('active',b.dataset.deck===deck));$('#selectionInfo').textContent={all:'전체 선박 · 화물 및 탱크',upper:'상부 갑판 · TIER 02–03',lower:'하부 화물창 · TIER 01',tank:'밸러스트 · 4개 탱크 / 각 1,200 t',facility:'기관·시설 · 펌프 / BWTS / 선교'}[deck];updateModel();if(state.view==='2d')drawPlan();}
function selectObject(data){state.selected=data;if(data.kind==='cargo'){const c=cargo.find(c=>c.id===data.id);setDeck(data.deck);setView('2d');toast(`${c.id} · BAY ${c.bay+1} · ${c.weight} t · TIER ${c.tier+1}`)}else if(data.kind==='tank'){setDeck('tank');setView('2d');tankModal(data.index)}else{setDeck(data.deck);setView('2d');if(data.kind==='facility')facilityModal(data.name)}update();}
function drawPlan(){const deck=state.deck==='all'?'upper':state.deck;let svg=`<svg viewBox="0 0 760 300" role="img" aria-label="${deck} 선박 평면도"><defs><pattern id="pgrid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M 25 0 L 0 0 0 25" fill="none" stroke="#263d4b" stroke-width=".5"/></pattern></defs><rect width="760" height="300" fill="url(#pgrid)"/><path d="M50 60 L635 60 Q700 75 730 150 Q700 225 635 240 L50 240 Q25 150 50 60Z" fill="#152e3c" stroke="#6d99ac" stroke-width="2"/><path d="M50 150H725" stroke="#416372" stroke-dasharray="5 5"/><text x="675" y="150" fill="#87a6b5" font-size="10">선수 →</text><text x="23" y="30" fill="#728f9e" font-size="10">좌현 PORT</text><text x="23" y="284" fill="#728f9e" font-size="10">우현 STARBOARD</text><rect x="54" y="80" width="70" height="140" rx="3" fill="#2b414d" stroke="#577786"/><text x="89" y="145" text-anchor="middle" fill="#c1d7df" font-size="12">선교</text><text x="89" y="165" text-anchor="middle" fill="#7899a8" font-size="9">BRIDGE</text>`;
if(deck==='upper'||deck==='lower'){for(let bay=0;bay<6;bay++){svg+=`<text x="${163+bay*79}" y="48" fill="#7799ac" font-size="9">BAY 0${bay+1}</text>`;for(let row=0;row<4;row++){const list=cargo.filter(c=>c.bay===bay&&c.row===row&&(deck==='lower'?c.tier===0:c.tier>0)&&!state.removed.includes(c.id));const c=list.find(item=>item.id===state.selected?.id)??list.at(-1);const selected=c&&state.selected?.id===c.id;svg+=`<g class="plan-cell" ${c?`data-cargo="${c.id}"`:''}><rect x="${145+bay*79}" y="${72+row*40}" width="71" height="33" rx="2" fill="${c?(selected?'#ae8653':['#315b76','#326d78','#3e647d'][bay%3]):'#132734'}" stroke="${selected?'#f0bc73':'#537d91'}" stroke-dasharray="${c?'':'3 3'}"/><text x="${180+bay*79}" y="${86+row*40}" text-anchor="middle" fill="${c?'#cfdee7':'#4a6c80'}" font-size="9">${c?c.id:'已하역'.replace('已','')}</text><text x="${180+bay*79}" y="${99+row*40}" text-anchor="middle" fill="#88b0bd" font-size="8">${c?`${c.weight} t · ${list.length}단`:''}</text></g>`}}}
else if(deck==='tank'){tanks.forEach((t,i)=>{const x=t.x>0?416:156,y=t.z<0?73:166,fill=state.tanks[i]/1200;svg+=`<g class="plan-cell" data-tank="${i}"><rect x="${x}" y="${y}" width="205" height="62" rx="4" fill="#102d31" stroke="#4cae9a"/><rect x="${x}" y="${y}" width="${205*fill}" height="62" rx="4" fill="#43c6a7" opacity=".3"/><text x="${x+12}" y="${y+23}" fill="#a4ecda" font-size="12">${t.id} · ${t.name}</text><text x="${x+12}" y="${y+44}" fill="#70b9ac" font-size="11">${state.tanks[i].toFixed(0)} / 1,200 t · ${(fill*100).toFixed(0)}%</text></g>`});svg+='<path d="M258 136V150H518V165M518 136V150M258 150V165" fill="none" stroke="#5cc9b0" stroke-width="2" stroke-dasharray="6 4"/><text x="358" y="145" fill="#75bdaf" font-size="8">TRANSFER LINE</text>'}
else{const rooms=[{x:145,y:76,w:170,h:145,name:'기관실',sub:'ENGINE ROOM'},{x:325,y:76,w:145,h:68,name:'밸러스트 펌프',sub:'2 × 2.5 t/s'},{x:325,y:154,w:145,h:67,name:'BWTS',sub:'평형수 처리 장치'},{x:480,y:76,w:145,h:145,name:'보조 기기실',sub:'AUXILIARY'}];rooms.forEach(r=>{svg+=`<g class="plan-cell" data-facility="${r.name}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="3" fill="#28404b" stroke="#7a9aa5"/><text x="${r.x+r.w/2}" y="${r.y+r.h/2-3}" text-anchor="middle" fill="#c4d7df" font-size="12">${r.name}</text><text x="${r.x+r.w/2}" y="${r.y+r.h/2+17}" text-anchor="middle" fill="#80a6b4" font-size="9">${r.sub}</text></g>`})}svg+='</svg>';$('#plan').innerHTML=svg;$$('[data-cargo]').forEach(e=>e.onclick=()=>{const c=cargo.find(c=>c.id===e.dataset.cargo);state.selected={kind:'cargo',id:c.id};drawPlan();modal(`<h2>${c.id} · 화물 상세</h2><p>BAY ${c.bay+1} / ROW ${c.row+1} / TIER ${c.tier+1}</p><table><tr><td>화물 중량</td><td>${c.weight} t</td></tr><tr><td>선박 중심 기준 좌우 위치</td><td>${c.z} m</td></tr><tr><td>선박 중심 기준 길이 위치</td><td>${c.x} m</td></tr><tr><td>하역 상태</td><td>적재 중</td></tr></table><p>상부 보기의 기본값은 가장 위에 남은 화물입니다. 3D에서 선택한 화물이 있으면 그 화물을 강조합니다. 높이는 TIER로 확인하세요.</p>`) });$$('[data-tank]').forEach(e=>e.onclick=()=>tankModal(+e.dataset.tank));$$('[data-facility]').forEach(e=>e.onclick=()=>facilityModal(e.dataset.facility));}
function tankModal(index){modal(`<h2>${tanks[index].name}</h2><p>선박의 균형을 조절하는 평형수가 담긴 공간입니다.</p><table><tr><td>현재 평형수</td><td>${state.tanks[index].toFixed(0)} t</td></tr><tr><td>탱크 용량</td><td>1,200 t</td></tr><tr><td>채워진 비율</td><td>${(state.tanks[index]/1200*100).toFixed(0)}%</td></tr></table><p>시뮬레이션을 재생하고 추천안을 적용하면 탱크 사이로 물이 이동합니다.</p>`)}
function facilityModal(name){modal(`<h2>${name}</h2><p>선박 내부 시설을 탐색하는 시연용 도면입니다. 실제 배관 및 시설 설계를 재현하지 않습니다.</p><table><tr><td>밸러스트 펌프</td><td>정상 2.5 t/s · 성능 저하 0.35 t/s</td></tr><tr><td>탱크</td><td>4개 · 각 1,200 t</td></tr><tr><td>BWTS</td><td>평형수 처리 시설 위치 표시</td></tr><tr><td>운전 제약</td><td>탱크별 80–1,120 t 내 이송</td></tr></table><p>이 버전은 탱크 간 이송만 계산합니다. 해수 유입·배출 및 BWTS 처리 과정의 시간·수질·전력 모델은 아직 포함하지 않습니다.</p>`)}
function modal(html){const wasRunning=state.running;state.running=false;$('#modalContent').innerHTML=html;if(!$('#modal').open)$('#modal').showModal();update();if(wasRunning)toast('상세 정보를 보는 동안 시뮬레이션을 일시정지했습니다.');}
function modelInfo(){modal(`<h2>계산 기준과 구현 범위</h2><p>합성 화물과 가상 탱크를 사용하는 개념 검증용 시뮬레이션입니다. 실제 선박 설계·운전 자료가 아닙니다.</p><h3>적재 높이와 수위 반영</h3><p>고정 선체 12,000 t, 선체 무게중심 높이 6.5 m, 초기 평형수 2,400 t를 가정합니다. 화물 높이는 기준면 위 13.1 + TIER 인덱스 × 4.8 m입니다. KG는 선체·남은 화물·탱크 물의 수직 모멘트 합을 총중량으로 나눕니다.</p><p>GM = 고정 KM − KG − 자유표면 보정. KM은 처음의 GM이 2.4 m가 되도록 보정한 가정값입니다. 직사각형 탱크 길이 28 m·폭 6 m, 물 밀도 1.025 t/m³, 용량 1,200 t로 자유표면 보정과 물의 무게중심을 근사합니다. 실제 선형에 따른 KM 변화와 GZ 곡선을 재현하지 않습니다.</p><p>좌우 기울기 = atan(횡방향 모멘트 / (총중량 × 추정 GM)). GM이 0.2 m 이하이면 이 모델의 계산 범위를 벗어난 것으로 보고 이송을 중지합니다. 이 수치는 시연용 제한이며 법정 기준이 아닙니다. 트림은 별도의 단순 모멘트 지표이고 최적화 대상이 아닙니다.</p><h3>추천·완료·그래프</h3><p>0.12° 이상이면 수위 80~1,120 t 범위 안에서 가능한 반대편 탱크 조합을 모두 비교합니다. 승인 시 다시 계산하며, 하중이 바뀌어 이송 방향이 부적절해지면 재평가합니다. 하역 100%와 이송 완료를 구분하고, 그래프는 가상 시간 기준으로 이송과 최종 상태까지 기록합니다.</p><h3>가상 파도</h3><p>순간 기울기 = 하역·평형수 기울기 + 합성 파도 성분. 파도는 8초·13초 사인파의 가중합이며 진폭 상한은 잔잔함 0.25°, 보통 0.75°입니다. 위상과 가상 시간을 동일하게 사용합니다. 추천에는 알려진 하역 성분만 전달하며 실측 신호 분리나 AI 추정은 아닙니다. 선박의 관성·감쇠·공진·파고 응답은 계산하지 않습니다.</p><h3>시연 범위</h3><p>1.5°는 기울기 표시용 기준입니다. ‘시연 기준 내’는 선박 전체의 안전을 보장하지 않습니다. 3D는 하역 기울기를 8배 확대하고 수면 높이로 시각적 상하·좌우·앞뒤 움직임을 더합니다. 화면의 순간 기울기 지표는 별도의 합성 외란 모델이며 3D 자세와 같지 않습니다. 선박과 탱크 형상은 모식도입니다. BWTS·센서·실제 펌프 제어, 완전한 복원성 및 구조 강도 검증, 체류 시간·비용·전력 절감 평가는 포함하지 않습니다. 현재 추천은 물리 모델의 60초 예측과 후보 탐색 또는 현재 상태 기반 규칙을 선택합니다. 학습형 AI는 미구현입니다. 초기 수위와 유량·하역 간격은 입력 설정을 따릅니다.</p><p>참고: <a href="https://assets.publishing.service.gov.uk/media/5d2c4bea40f0b64a790de8f9/Tanker_Damage_Stability_MGN_post_consultation_version_260619.pdf" target="_blank" rel="noopener">MCA의 GM·자유표면 보정 정의</a>. 일반 원리를 참고했으며 현재 가정 모델이 승인·인증되었다는 뜻은 아닙니다.</p>`)}
let toastTimer;function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500)}
$('#play').onclick=()=>{if(state.running){state.running=false;event('일시정지');}else{if(complete())reset();if(enforceRiskStop()){update();toast('가정 모델 계산 범위를 확인하세요.');return;}state.running=true;event('시뮬레이션 재생');}update()};
$('#reset').onclick=()=>{reset();toast('처음 상태로 되돌렸습니다.')};
$('#scenario').onchange=e=>{if(customOrder){$('#inputMessage').textContent='CSV 지정 순서가 적용 중입니다. 예제 복원 후 시나리오를 변경하세요.';return;}invalidateComparison();state.scenario=e.target.value;$('#scenarioDesc').textContent=state.scenario==='port'?'왼쪽 화물을 먼저 내립니다. 기울기를 관찰한 뒤 조정안을 적용해 보세요.':'양쪽 화물을 번갈아 내립니다. 균형을 유지하는 하역 방식과 비교해 보세요.';reset()};
$('#approve').onclick=()=>approve();
$('#auto').onchange=()=>{if($('#auto').checked&&recommendation)approve()};
$('#view3d').onclick=()=>setView('3d');$('#view2d').onclick=()=>setView('2d');
$$('[data-deck]').forEach(b=>b.onclick=()=>setDeck(b.dataset.deck));
$('#explode').onchange=e=>{state.exploded=e.target.checked;setView('3d');updateModel()};
$('#resetCamera').onclick=()=>{yaw=.72;pitch=.3;distance=175};
$('#zoomIn').onclick=()=>distance=Math.max(90,distance-18);$('#zoomOut').onclick=()=>distance=Math.min(300,distance+18);
$('#closeModal').onclick=()=>$('#modal').close();$('#modal').onclick=e=>{if(e.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#modal').close()}};
$('#modelInfo').onclick=modelInfo;
const precipitationStatus=document.createElement('p');precipitationStatus.id='precipitation-status';precipitationStatus.setAttribute('role','status');precipitationStatus.textContent='강수 표현 없음';document.querySelector('.stage-toolbar').after(precipitationStatus);
const placementStatus=document.createElement('p');placementStatus.id='placement-status';placementStatus.className='placement-status';placementStatus.hidden=true;placementStatus.setAttribute('role','status');document.querySelector('.stage-toolbar').after(placementStatus);
const riskPanel=document.createElement('section');riskPanel.id='model-risk';riskPanel.className='model-risk';riskPanel.innerHTML='<div class="risk-heading"><strong>현재 모델 위험 상태 · <span id="risk-level"></span></strong><span id="risk-direction"></span></div><p class="risk-scope">가정 모델 기준 · 침몰 확률이나 실제 선박 안전 판정이 아닙니다.</p><p id="risk-values"></p><ul id="risk-causes"></ul><p id="risk-guidance" role="status"></p><details><summary>판정 기준 보기</summary><p>기울기 한도 80%부터 주의, 초과 시 기준 초과. GM 0.20–0.50m는 가정 주의 구간, 0.20m 이하는 계산 범위 밖. 탱크 80–1120t은 가정 운전 범위이며 용량 0–1200t을 벗어나거나 계산값이 유효하지 않으면 중지합니다. 기준 초과만으로 침몰을 판정하거나 자동 중지하지 않습니다. 3D 하역 기울기는 8배 확대 연출입니다.</p></details>';document.querySelector('.stage-toolbar').after(riskPanel);const riskOverlay=document.createElement('div');riskOverlay.id='risk-3d';riskOverlay.hidden=true;$('#scene').append(riskOverlay);
let previous=performance.now(),updateAccum=0;function frame(now){const dt=Math.min((now-previous)/1000,.1);previous=now;updateAccum+=dt;if(updateAccum>(!config.environment&&config.wave==='off'?.15:.025)){advance(updateAccum);updateAccum=0}if(renderer&&state.view==='3d'){ocean?.update(state.time,config.environment??config.wave);applyWeather();applyOceanPose();if(grid)grid.visible=!config.environment&&config.wave==='off';oceanDecor.forEach(o=>o.visible=!config.environment&&config.wave==='off');const fit=Math.min(2.2,Math.max(1,1.2/camera.aspect)),d=distance*fit;camera.position.set(Math.cos(yaw)*Math.cos(pitch)*d,Math.sin(pitch)*d,Math.sin(yaw)*Math.cos(pitch)*d);camera.lookAt(0,5,0);renderer.render(scene,camera)}requestAnimationFrame(frame)}initDecisionUI();const environmentUI=initEnvironment({apply:environment=>{if(environment)environment.windVisualSettings=windResponse(environment.wind);if(environment?.observation&&!environment.selectedObservations&&config.environment?.weatherData&&environment.weather===config.environment.weather){environment.weatherData=config.environment.weatherData;environment.weatherSource=config.environment.weatherSource??(config.environment.forecast?'Open-Meteo 모델 예보':'기존 설정');environment.isDay=config.environment.isDay;environment.source='기상청 해양 관측 / 기존 날씨 조건 유지';}config.environment=environment;invalidateComparison();reset();}});reset();if(!webgl)setView('2d');requestAnimationFrame(frame);
initPlacementLab({applyMain:applyPlacement,pause:()=>{state.running=false;update();},getSnapshot:()=>({slots:cargo.map(c=>({...c,loaded:!state.removed.includes(c.id)})),levels:[...state.tanks],km:referenceKM,simulationTime:state.time,environment:config.environment??null,wave:config.wave,threshold:config.threshold})});
// Read-only snapshot for QA and external prototype inspection.
window.harborTwin={setCamera:(y=yaw,p=pitch,d=distance)=>{yaw=y;pitch=Math.max(.04,Math.min(1.25,p));distance=Math.max(90,Math.min(300,d));},snapshot:()=>({phase:complete()?'complete':state.transfer?'transfer':recommendation?'approval':'unloading',notice:state.notice,applied:state.applied,transferred:state.transferred,running:state.running,time:state.time,removed:state.removed.length,initialRemoved:[...initialRemoved],initialCount:initialCount(),initialTime,cargo:cargo.map(c=>({...c,loaded:!state.removed.includes(c.id)})),tanks:[...state.tanks],metrics:metrics(),baseline:metrics(false),config:{...config},wave:Decision.waveAt(state.time,config.wave,config.environment),instantHeel:Decision.observedHeel(metrics().heel,state.time,config.wave,config.environment),strategy,events:[...state.events],recommendation,transfer:state.transfer,history:[...state.history],risk:currentRisk(),view:state.view,deck:state.deck})};
import { initTutorial } from './tutorial.js?v=home1';
initTutorial({
  pause:()=>{state.running=false;update();},
  captureView:()=>({view:state.view,deck:state.deck}),
  restoreView:saved=>{setDeck(saved.deck);setView(saved.view);},
  showView:(view,deck)=>{setDeck(deck);setView(webgl?view:'2d');}
});

