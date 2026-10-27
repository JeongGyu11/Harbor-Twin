import assert from 'node:assert/strict';import {weatherProfile,lightningPulse} from './dist/weather-profile.mjs';
const e={weather:'rain',wind:8,windDirection:90,heading:0,isDay:1,weatherData:{data:{raw:{WC:'61',RN_INT:'-9',VS:'2000'}}}};
const r=weatherProfile(e);assert.ok(r.rain);assert.equal(r.amount,.65);assert.ok(r.dx<0);assert.equal(r.manual,false);
assert.equal(weatherProfile({...e,weatherData:{raw:{WC:'95'}}}).mode,'thunder');assert.equal(weatherProfile({...e,weatherData:{raw:{WC:'91'}}}).mode,'rain');
assert.equal(weatherProfile({...e,wind:40}).mode,'rain');const before=JSON.stringify(e);assert.ok(weatherProfile(e,'typhoon').storm);assert.equal(JSON.stringify(e),before);
assert.ok(weatherProfile({...e,weather:'fog',weatherData:{raw:{VS:'20'}}}).density>weatherProfile({...e,weather:'fog',weatherData:{raw:{VS:'200'}}}).density);
assert.equal(weatherProfile(e,'snow').snow,true);assert.equal(weatherProfile(null).mode,'clear');assert.equal(weatherProfile({...e,isDay:0}).night,true);
console.log('PASS observed weather, missing intensity, incoming wind, thunder code, no wind-only typhoon inference, manual preview does not mutate data, visibility-driven fog, snow/daynight');

assert.ok(lightningPulse(8.05,true,true));assert.ok(lightningPulse(8.35,true,true));assert.equal(lightningPulse(8.05,false,true),false);assert.equal(lightningPulse(8.05,true,false),false);assert.equal(lightningPulse(9,true,true),false);console.log('PASS lightning opt-in and short deterministic pulses');
