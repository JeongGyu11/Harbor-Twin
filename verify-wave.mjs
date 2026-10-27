import assert from 'node:assert/strict';
import {waveAt,observedHeel,makeModel,runComparison,DEFAULTS} from './dist/decision.mjs';
const cargo=[];for(let tier=0;tier<3;tier++)for(let bay=0;bay<6;bay++)for(let row=0;row<4;row++)cargo.push({id:`C${String(cargo.length+1).padStart(3,'0')}`,tier,bay,row,x:-32+bay*13,z:-7.5+row*5,weight:22+((bay*7+row*3+tier*5)%13)});
const queue=cargo.slice().sort((a,b)=>a.z-b.z||b.tier-a.tier||a.bay-b.bay).map(c=>c.id),model=makeModel(cargo);
let checks=0;function test(name,fn){fn();checks++;console.log('PASS',name);}
test('off is exactly zero at all sampled times',()=>{for(let t=0;t<1500;t+=.25)assert.equal(waveAt(t,'off'),0);});
test('bounded amplitude, fixed phase and reproducible wave',()=>{for(let t=0;t<1500;t+=.25){assert.ok(Math.abs(waveAt(t,'calm'))<=.25);assert.ok(Math.abs(waveAt(t,'moderate'))<=.75);assert.ok(Math.abs(waveAt(t,'moderate')-waveAt(t,'calm')*3)<1e-12);assert.equal(waveAt(t,'moderate'),waveAt(t,'moderate'));}});
test('invalid hydrostatics cannot become a numeric instantaneous heel',()=>{assert.equal(observedHeel(null,2,'moderate'),null);assert.equal(observedHeel(NaN,2,'calm'),null);assert.equal(observedHeel(.2,2,'off'),.2);});
const results=[];
for(const mode of ['none','rule','predictive'])test(`${mode}: same controls and water under all waves, shared observation window`,()=>{
 const off=runComparison(model,queue,{...DEFAULTS,wave:'off'},mode);
 for(const wave of ['calm','moderate']){
  const on=runComparison(model,queue,{...DEFAULTS,wave},mode);
  for(const key of ['peak','exceed','moved','pumpSeconds','starts','time','observationDuration','violations'])assert.equal(on[key],off[key],key);
  assert.deepEqual(on.levels,off.levels);assert.equal(on.observationDuration,1440);assert.ok(on.complete);assert.equal(on.violations,0);
  assert.ok(on.instantPeak>off.instantPeak);assert.ok(on.instantExceed<=1440);assert.equal(on.instantExceed*4,Math.round(on.instantExceed*4));
  for(const p of on.points){assert.equal(p.wave,waveAt(p.time,wave));assert.equal(p.instant,p.heel+p.wave);}
  if(wave==='moderate')results.push(on);
 }
});
test('all policies get identical wave samples at identical timestamps',()=>{for(const t of [0,10,20,100,500,1000,1400]){const values=results.map(r=>r.points.find(p=>p.time===t).wave);assert.ok(values.every(v=>v===values[0]));}});
console.log(JSON.stringify({checks,moderateResults:results.map(({points,levels,...r})=>r)},null,2));
