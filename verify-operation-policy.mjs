import assert from 'node:assert/strict';
import {assessOperation} from './dist/operation-policy.mjs';

// Known KMA observations and threshold boundaries, expressed independently in km.
const observation=VS=>({wind:4.1,height:.3,weather:'cloud',weatherData:{raw:{VS}}});
const cases=[[4616,46.16,0],[90,.9,2],[99,.99,2],[100,1,1],[299,2.99,1],[300,3,0],[0,0,2]];
for(const [raw,km,level] of cases){
 const env=observation(raw),before=JSON.stringify(env),result=assessOperation({environment:env});
 const item=result.items.find(i=>i.name==='시정');
 assert.equal(item.value,km);assert.equal(item.unit,'km');assert.equal(item.level,level);assert.equal(result.level,level);
 assert.equal(JSON.stringify(env),before,'raw observation must be preserved');
}
for(const missing of [-9,-99,null,undefined,'', ' ', 'invalid',Infinity]){
 const result=assessOperation({environment:observation(missing)});
 assert.equal(result.items.find(i=>i.name==='시정').value,null);assert.ok(result.missing.includes('시정'));
 assert.equal(result.label,'자료 부족 · 판정 보류');
}
const nested=observation('4616');nested.weatherData={data:{raw:{VS:'4616'}}};
assert.equal(assessOperation({environment:nested}).items.find(i=>i.name==='시정').value,46.16);
console.log('PASS ASOS visibility units, zero/missing distinction, caution/stop boundaries and raw observation preservation');
