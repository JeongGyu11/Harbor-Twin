import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {PRESETS,validateEnvironment} from './dist/environment.mjs';import {waveAt} from './dist/decision.mjs';import {hullPose,surfaceHeight} from './dist/ocean-motion.mjs';
const live=JSON.parse(fs.readFileSync(process.argv[2]??'./fixtures/observed-environment.json','utf8'));assert.equal(live.complete,true);assert.equal(live.weather.sourceType,'sensor_observation');
const nodes={},node=(value='')=>({value,checked:false,disabled:false,textContent:'',selectedOptions:[{textContent:'부산항'}],addEventListener(){}});
for(const [k,v] of Object.entries({location:'busan',wind:'1',windDirection:'0',height:'1',period:'8',direction:'0',heading:'0',weather:'rain',refresh:'900','auto-time':'now'}))nodes['#env-'+k]=node(v);
for(const k of ['time','fetch','fetch-apply','apply','clear','now','message','applied','auto','auto-apply','auto-status'])nodes['#env-'+k]??=node();
for(const n of Object.values(nodes)){let value=String(n.value);Object.defineProperty(n,'value',{get:()=>value,set:v=>{value=String(v);}});}
let manual=false;nodes['#mode-manual']={getAttribute:()=>String(manual)};
let callback,applied;
const ctx=vm.createContext({PRESETS,validateEnvironment,initStoredWeather:({onApply})=>{callback=onApply;},initObservations(){},initSelectedObservations(){},document:{querySelector:s=>nodes[s],addEventListener(){}},Date,setInterval(){},fetchEnvironment:async()=>{throw Error('no model fallback');},apply:e=>{applied=e;}});
const source=fs.readFileSync('dist/environment-ui.js','utf8').replace(/^import[^\n]+\n/gm,'').replace('export function','function');vm.runInContext(source+';initEnvironment({apply});',ctx);callback(live);
for(const k of ['wind','windDirection','height','period','direction']){assert.equal(applied[k],live.marine.data[k]);assert.equal(Number(nodes['#env-'+k].value),live.marine.data[k]);}
assert.equal(applied.weather,live.weather.weather);assert.equal(applied.isDay,live.weather.isDay);assert.equal(applied.weatherData.observedAt,live.weather.observedAt);assert.equal(applied.observation.observedAt,live.marine.observedAt);
assert.ok(Object.values(hullPose(10,applied)).every(Number.isFinite));assert.notEqual(waveAt(2,'off',applied),waveAt(2,'off',{...applied,wind:0,height:0}));assert.notEqual(surfaceHeight(10,20,3,applied),surfaceHeight(10,20,3,{...applied,direction:(applied.direction+90)%360}));
const {weatherProfile}=await import('./dist/weather-profile.mjs');const p=weatherProfile(applied);assert.equal(p.mode,applied.weather);assert.equal(p.night,applied.isDay===0);console.log('PASS observation fixture fields, controls, timestamps, wave/water/hull, weather effect profile');

manual=true;nodes['#env-wind'].value='20';nodes['#env-apply'].onclick();assert.equal(applied.sourceType,'user_scenario');assert.ok(applied.modifiedFields.includes('wind'));assert.equal(applied.baselineObservation.wind,live.marine.data.wind);assert.equal(applied.wind,20);assert.equal(applied.weatherSource,'사용자 조건');console.log('PASS manual mode preserves observation baseline and tracks modified wind');
