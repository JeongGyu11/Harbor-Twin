import assert from 'node:assert/strict';import {weatherProfile,lightningPulse,windVisualProfile} from './dist/weather-profile.mjs';
const e={weather:'rain',wind:8,windDirection:90,heading:0,isDay:1,weatherData:{data:{raw:{WC:'61',RN_INT:'-9',VS:'2000'}}}};
const r=weatherProfile(e);assert.ok(r.rain);assert.equal(r.amount,.25);assert.ok(r.dx<0);assert.equal(r.manual,false);
assert.equal(weatherProfile({...e,weatherData:{raw:{WC:'95'}}}).mode,'thunder');assert.equal(weatherProfile({...e,weatherData:{raw:{WC:'91'}}}).mode,'rain');
assert.equal(weatherProfile({...e,wind:40}).mode,'rain');const before=JSON.stringify(e);assert.ok(weatherProfile(e,'typhoon').storm);assert.equal(JSON.stringify(e),before);
assert.ok(weatherProfile({...e,weather:'fog',weatherData:{raw:{VS:'20'}}}).density>weatherProfile({...e,weather:'fog',weatherData:{raw:{VS:'200'}}}).density);
assert.equal(weatherProfile(e,'snow').snow,true);assert.equal(weatherProfile(null).mode,'clear');assert.equal(weatherProfile({...e,isDay:0}).night,true);
console.log('PASS observed weather, missing intensity, incoming wind, thunder code, no wind-only typhoon inference, manual preview does not mutate data, visibility-driven fog, snow/daynight');

assert.ok(lightningPulse(8.05,true,true));assert.ok(lightningPulse(8.35,true,true));assert.equal(lightningPulse(8.05,false,true),false);assert.equal(lightningPulse(8.05,true,false),false);assert.equal(lightningPulse(9,true,true),false);console.log('PASS lightning opt-in and short deterministic pulses');

const speeds=[0,3,8,15,25,40],profiles=speeds.map(windVisualProfile);
for(let i=1;i<profiles.length;i++)for(const key of ['whitecaps','spray','streaks','drift','snowSway'])assert.ok(profiles[i][key]>=profiles[i-1][key]);
assert.equal(profiles[0].spray,0);assert.equal(profiles[0].whitecaps,0);assert.ok(profiles[4].spray>0);assert.equal(windVisualProfile(-5).wind,0);assert.equal(windVisualProfile(NaN).wind,0);
const snapshot=JSON.stringify(e);windVisualProfile(e.wind);assert.equal(JSON.stringify(e),snapshot);console.log('PASS monotonic wind-dependent foam, spray, drift and snow sway; calm has no foam/spray; actual environment remains unchanged');

const observed=(weather,raw)=>({weather,weatherData:{raw}});
const rate=n=>weatherProfile(observed('rain',{RN_INT:String(n)}));
assert.equal(rate(0).amount,0);assert.ok(rate(2).amount<rate(10).amount);assert.ok(rate(10).amount<rate(30).amount);assert.equal(rate(10).precipitation.source,'observed-rate');
for(const [weather,codes]of [['rain',[61,63,65]],['snow',[71,73,75]]]){
 const profiles=codes.map(WC=>weatherProfile(observed(weather,{WC:String(WC),RN_INT:'-9'})));
 assert.ok(profiles[0].amount<profiles[1].amount&&profiles[1].amount<profiles[2].amount);
 assert.ok(profiles.every(p=>p.precipitation.source==='observed-class'));
}
for(const value of ['',null,undefined,'-9','NaN','Infinity'])assert.equal(weatherProfile(observed('rain',{RN_INT:value})).precipitation.source,'default');
assert.equal(weatherProfile(observed('snow',{SD_TOT:'30',SD_DAY:'12',RN:'2'})).precipitation.source,'default');
assert.equal(weatherProfile(observed('snow',{WC:'71'}),'rain').precipitation.source,'default');
assert.equal(weatherProfile({...observed('snow',{WC:'71'}),sourceType:'user_scenario',modifiedFields:['weather']}).precipitation.source,'default');
assert.equal(weatherProfile({...observed('snow',{WC:'71'}),sourceType:'user_scenario',modifiedFields:['wind']}).precipitation.source,'observed-class');
console.log('PASS observed rate and rain/snow classes, monotonic particle density, zero/missing distinctions, no accumulation-as-rate, preview/manual provenance');
