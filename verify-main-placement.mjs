import * as Placement from './dist/placement-model.mjs';
import * as Decision from './dist/decision.mjs';
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const full=fs.readFileSync('dist/app.js','utf8').replace(/^\uFEFF/,'');const html=fs.readFileSync('dist/index.html','utf8');
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);const core=full.split('// Shared vessel coordinates')[0].replace(/import [^\n]+\n/g,'');const handlers=full.slice(full.indexOf("$('#play').onclick="),full.indexOf('const precipitationStatus='));
function setup(){const nodes=Object.fromEntries(ids.map(id=>[id,{textContent:'',innerHTML:'',checked:false,disabled:false,value:'port',style:{},classList:{toggle(){},add(){},remove(){}},close(){}}]));const ctx=vm.createContext({Decision,Placement,environmentUI:{restore(){}},setView(){},setDeck(){},initWorkspaceUI(){},renderPrecipitationStatus(){},document:{querySelector:s=>s.startsWith('#')?nodes[s.slice(1)]??null:null,querySelectorAll:()=>[]},updateModel(){},drawPlan(){},toast(){},modelInfo(){}});vm.runInContext(core,ctx);vm.runInContext(handlers,ctx);vm.runInContext("strategy='rule';state.scenario='port';config.wave='off';reset()",ctx);return {nodes,run:s=>vm.runInContext(s,ctx)};}

const t=setup();t.run('initDecisionUI()');
const plan=t.run('({slots:cargo.map(c=>({...c,loaded:false})),levels:[500,700,550,650],km:referenceKM,simulationTime:13.5,environment:null,wave:"moderate",threshold:1.5})');
let p=Placement.editSlot(plan,'C001',100,true);p=Placement.editSlot(p,'C025',40,true);p=Placement.editSlot(p,'C002',20,true);
t.run('state.running=true;advance(.1)');t.run('state.running=false');
// Pass only JSON-safe copies into the VM's application boundary.
t.run('globalThis.testPlan='+JSON.stringify(p));t.run('applyPlacement(testPlan)');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
assert.equal(t.run('initialCount()'),3);assert.equal(t.run('state.removed.length'),69);assert.equal(t.run('state.running'),false);assert.equal(t.nodes.cargoCount.textContent,'3 / 3');assert.equal(t.nodes.progress.textContent,0);
near(t.run('metrics().heel'),Placement.assessPlan(p).heel);near(t.run('metrics().gm'),Placement.assessPlan(p).gm);near(t.run('referenceKM'),p.km);near(t.run('state.time'),13.5);
assert.equal(t.run('new Set(state.queue).size'),72);assert.equal(t.run('state.queue.slice(69).join(",")'),'C025,C001,C002');
const result=Decision.runComparison({cargo:p.slots,km:p.km},JSON.parse(t.run('JSON.stringify(state.queue)')),{...Decision.DEFAULTS,levels:p.levels,initialRemoved:JSON.parse(t.run('JSON.stringify(initialRemoved)')),wave:'moderate',waveStart:13.5},'none');
assert.equal(result.complete,true);assert.equal(result.observationDuration,60);near(result.points[0].heel,t.run('metrics().heel'));near(result.points[0].instant,Decision.observedHeel(result.points[0].heel,13.5,'moderate'));
t.run('state.running=true;advance(1)');assert.equal(t.nodes.cargoCount.textContent,'2 / 3');assert.equal(t.nodes.progress.textContent,33);assert.equal(t.run('state.removed.includes("C025")'),true);assert.equal(t.run('state.removed.includes("C001")'),false);
for(let i=0;i<3;i++)t.run('advance(1)');assert.equal(t.run('state.removed.length'),72);assert.equal(t.nodes.progress.textContent,100);
t.nodes.reset.onclick();assert.equal(t.nodes.cargoCount.textContent,'3 / 3');near(t.run('state.time'),13.5);near(t.run('metrics().heel'),Placement.assessPlan(p).heel);assert.equal(t.run('state.history.length'),1);
const before=t.run('JSON.stringify([cargo,state,referenceKM,config])');assert.throws(()=>t.run('applyPlacement({...testPlan,levels:[1201,600,600,600]})'));assert.equal(t.run('JSON.stringify([cargo,state,referenceKM,config])'),before);
t.run('applyPlacement({...testPlan,slots:testPlan.slots.map(c=>({...c,loaded:false})),levels:[0,0,0,0]})');assert.equal(t.nodes.cargoCount.textContent,'0 / 0');assert.equal(t.nodes.progress.textContent,100);assert.ok(!String(t.nodes.progressBar.style.width).includes('NaN'));assert.ok(t.nodes.statusPill.textContent.includes('탱크'));
t.nodes.restorePlan.onclick();assert.equal(t.nodes.cargoCount.textContent,'72 / 72');assert.equal(t.run('initialTime'),0);assert.equal(t.run('initialRemoved.length'),0);
for(const scenario of ['balanced','port'])for(const strategy of ['rule','predictive']){const q=setup();q.run('globalThis.testPlan='+JSON.stringify(p));q.run(`state.scenario='${scenario}';globalThis.environmentUI={restore(){}};applyPlacement(testPlan);strategy='${strategy}';state.running=true`);q.nodes.auto.checked=true;for(let i=0;i<5000&&q.run('state.running');i++)q.run('advance(.1)');assert.equal(q.run('state.removed.length'),72);assert.equal(q.run('state.running'),false);near(q.run('state.tanks.reduce((a,b)=>a+b,0)'),2400);assert.ok(q.run('complete()'));}
console.log('PASS main placement: partial cargo/upper-first queue, fixed KM and exact metrics, preserved phase and water, live unloading progress, immutable validation, reset and empty plan, comparison baseline and original restore');

