import assert from 'node:assert/strict';import {makeModel} from './dist/decision.mjs';import {clonePlan,validatePlan,editSlot,assessPlan,searchLevels} from './dist/placement-model.mjs';
const slots=[];for(let tier=0;tier<3;tier++)for(let bay=0;bay<6;bay++)for(let row=0;row<4;row++)slots.push({id:'C'+(slots.length+1),bay,row,tier,x:-32+bay*13,z:-7.5+row*5,weight:20,loaded:true});
const p={slots,levels:[600,600,600,600],km:makeModel(slots).km,wave:'off',environment:null,threshold:1.5};
assert.equal(assessPlan(p).loadedCount,72);assert.ok(Math.abs(assessPlan(p).heel)<1e-12);assert.ok(Math.abs(assessPlan(p).gm-2.4)<1e-12);
assert.throws(()=>editSlot(p,'C1',20,false),/상부|하역/);const top=slots.find(c=>c.bay===0&&c.row===0&&c.tier===2);assert.equal(editSlot(p,top.id,20,false).slots.find(c=>c.id===top.id).loaded,false);
const empty={...clonePlan(p),slots:p.slots.map(c=>({...c,loaded:false}))};assert.throws(()=>editSlot(empty,top.id,20,true),/하부/);assert.throws(()=>editSlot(empty,'C1',0,true));assert.throws(()=>editSlot(empty,'C1',101,true));
const asymmetric=editSlot(empty,'C1',100,true);asymmetric.threshold=.1;const current=assessPlan(asymmetric);assert.ok(current.heel<0);assert.equal(current.passes,false);
const before=JSON.stringify(asymmetric),search=searchLevels(asymmetric);assert.ok(search.checked>100);assert.ok(search.within>0);assert.ok(search.candidates[0].peak<current.peak);assert.equal(JSON.stringify(asymmetric),before);
for(const c of search.candidates){assert.ok(c.levels.every(v=>v>=80&&v<=1120));assert.ok(Math.abs(c.levels.reduce((a,b)=>a+b)-2400)<1e-6);assert.ok(Math.abs(assessPlan({...asymmetric,levels:c.levels}).peak-c.peak)<1e-10);}
const high=editSlot(p,top.id,100,true),low=editSlot(p,'C1',100,true);assert.equal(high.km,p.km);assert.ok(assessPlan(high).gm<assessPlan(low).gm);assert.notEqual(assessPlan(high).gm,2.4);
assert.throws(()=>assessPlan({...p,levels:[NaN,600,600,600]}));assert.throws(()=>assessPlan({...p,levels:[1201,600,600,600]}));assert.equal(assessPlan({...empty,levels:[0,0,0,0]}).tankWithinRange,false);assert.equal(searchLevels({...empty,levels:[0,0,0,0]}).candidates.length,0);
assert.equal(assessPlan({...p,slots:p.slots.map(c=>({...c,weight:100}))}).valid,false);assert.throws(()=>assessPlan({...p,simulationTime:NaN}));
const rough={...asymmetric,environment:{wind:25,windDirection:90,height:2,period:5,direction:90,heading:0}};assert.ok(assessPlan(rough).peak>Math.abs(current.heel));
console.log('PASS placement load/unload support, capacity/weight/NaN guards, fixed KM and height effect, asymmetric cargo/tank correction, conserved search total, common wave window, immutable inputs');
console.log(JSON.stringify({beforeHeel:current.heel,bestHeel:search.candidates[0].heel,levels:search.candidates[0].levels,checked:search.checked,within:search.within}));
