import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {PRESETS,validateEnvironment} from './dist/environment.mjs';
const nodes={};const node=(value='')=>({value,checked:true,disabled:false,textContent:'',selectedOptions:[{textContent:'부산항 북항 인근 해역'}],addEventListener(){}});
for(const [k,v] of Object.entries({location:'busan',wind:'5',windDirection:'90',height:'1',period:'8',direction:'90',heading:'0',weather:'clear',refresh:'900','auto-time':'now'}))nodes['#env-'+k]=node(v);
for(const k of ['time','fetch','fetch-apply','apply','clear','now','message','applied','auto','auto-apply','auto-status'])nodes['#env-'+k]??=node();
for(const n of Object.values(nodes)){let value=String(n.value);Object.defineProperty(n,'value',{get:()=>value,set:v=>{value=String(v);}});}
let now=Date.now(),tick,calls=0;const applied=[];class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
const source=fs.readFileSync('dist/environment-ui.js','utf8').replace(/^import[^\n]+\n/gm,'').replace('export function','function');
const context=vm.createContext({initSelectedObservations(){},initStoredWeather(){},initObservations(){},PRESETS,validateEnvironment,fetchEnvironment:async e=>{calls++;return {...e,source:'Open-Meteo 예보',fetchedAt:new Clock().toISOString(),isDay:1};},document:{querySelector:s=>nodes[s],addEventListener(){}},Date:Clock,setInterval:fn=>{tick=fn;},applied});
vm.runInContext(source+';initEnvironment({apply:e=>applied.push(e)});',context);const flush=()=>new Promise(resolve=>setImmediate(resolve));await flush();
assert.equal(calls,1);assert.equal(applied.length,0);assert.equal(nodes['#env-auto-apply'].disabled,false);
now+=900001;tick();await flush();assert.equal(calls,2);assert.equal(applied.length,0);
nodes['#env-auto-apply'].onclick();assert.equal(applied.length,1);assert.equal(nodes['#env-auto-apply'].disabled,true);
nodes['#env-auto'].checked=false;nodes['#env-auto'].onchange();now+=900001;tick();await flush();assert.equal(calls,2);
console.log('PASS initial auto fetch, 15-minute scheduled refresh, no overwrite before apply, explicit apply, disable stops refresh');

