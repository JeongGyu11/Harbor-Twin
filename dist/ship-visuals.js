import * as THREE from './vendor/three.module.js';
// Visual detail for the virtual vessel. Geometry positions match the existing model so
// picking, deck views and calculations are unchanged; only appearance is richer.
const canvas=(w,h,draw)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);return c;};
const texture=(c,srgb=true)=>{const t=new THREE.CanvasTexture(c);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;};
const rand=seed=>()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
const shade=(hex,f)=>{const c=new THREE.Color(hex);c.multiplyScalar(f);return `#${c.getHexString()}`;};

// Painted hull: antifouling red below the waterline, black boot-top, dark navy topsides,
// white sheer stripe, faint plate seams. Height is in ship coordinates.
export function hullMaterial(offsetY){
 const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.55,metalness:.35});
 m.onBeforeCompile=s=>{
  s.uniforms.uOffset={value:offsetY};
  s.vertexShader='uniform float uOffset;varying vec3 vHull;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHull=vec3(position.x,position.y+uOffset,position.z);');
  s.fragmentShader='varying vec3 vHull;\n'+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float y=vHull.y;
   vec3 red=vec3(.24,.035,.025),boot=vec3(.012,.014,.016),navy=vec3(.018,.04,.075),white=vec3(.78,.8,.8);
   vec3 c=y<-3.05?red:y<-2.35?boot:navy;
   c=mix(c,white,step(4.75,y)*step(y,5.25));
   float seam=smoothstep(.06,.0,abs(fract(y/1.6)-.5)-.47)+smoothstep(.06,.0,abs(fract(vHull.x/3.8)-.5)-.48);
   c*=1.-.12*clamp(seam,0.,1.);
   float streak=smoothstep(.4,1.,sin(vHull.x*1.7)*sin(vHull.x*.37+1.3))*smoothstep(1.,5.5,y)*.25;
   c=mix(c,vec3(.16,.09,.05),streak*step(-2.35,y));
   diffuseColor.rgb=c;`);
 };
 m.customProgramCacheKey=()=>'hull-paint';
 return m;
}

export function deckMaterial(){
 const c=canvas(512,128,(g,w,h)=>{g.fillStyle='#3b4a43';g.fillRect(0,0,w,h);const r=rand(7);for(let i=0;i<900;i++){g.fillStyle=`rgba(${r()<.5?20:90},${r()<.5?30:80},${r()<.5?25:60},${r()*.18})`;g.fillRect(r()*w,r()*h,1+r()*6,1+r()*3);}g.strokeStyle='rgba(220,200,60,.55)';g.lineWidth=2;for(let x=0;x<w;x+=w/6){g.beginPath();g.moveTo(x+4,0);g.lineTo(x+4,h);g.stroke();}});
 const t=texture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1/40,1/40);
 return new THREE.MeshStandardMaterial({color:0xffffff,map:t,roughness:.85,metalness:.15});
}

// Generic container colours (no line branding).
export const CONTAINER_COLORS=[0x9a2e22,0x2b5a88,0x2e6a4d,0xc7712a,0x7b8085,0xd8d4cb,0x1e4c69,0x8a3a2b,0x3b7d8a,0xb3943a,0x5f3a6e,0x46525e];
const containerCache=new Map();
function corrugated(ctx,w,h,color,ribs,seed,label){
 const r=rand(seed);ctx.fillStyle=color;ctx.fillRect(0,0,w,h);
 const step=w/ribs;for(let i=0;i<ribs;i++){const x=i*step,grad=ctx.createLinearGradient(x,0,x+step,0);grad.addColorStop(0,'rgba(255,255,255,.16)');grad.addColorStop(.35,'rgba(255,255,255,.02)');grad.addColorStop(.55,'rgba(0,0,0,.22)');grad.addColorStop(1,'rgba(255,255,255,.1)');ctx.fillStyle=grad;ctx.fillRect(x,0,step,h);}
 ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(0,0,w,h*.055);ctx.fillRect(0,h*.945,w,h*.055);ctx.fillRect(0,0,w*.022,h);ctx.fillRect(w*.978,0,w*.022,h);
 const grime=ctx.createLinearGradient(0,h*.55,0,h);grime.addColorStop(0,'rgba(60,40,25,0)');grime.addColorStop(1,'rgba(60,40,25,.28)');ctx.fillStyle=grime;ctx.fillRect(0,0,w,h);
 for(let i=0;i<70;i++){ctx.fillStyle=`rgba(${110+r()*50|0},${55+r()*25|0},30,${.12+r()*.25})`;const x=r()*w,y=r()*h;ctx.fillRect(x,y,1+r()*3,2+r()*10);}
 if(label){ctx.fillStyle='rgba(255,255,255,.82)';ctx.font=`bold ${Math.round(h*.085)}px sans-serif`;ctx.fillText(label,w*.72,h*.17);ctx.font=`${Math.round(h*.06)}px sans-serif`;ctx.fillText('45G1',w*.72,h*.26);}
}
export function containerMaterials(index){
 if(containerCache.has(index))return containerCache.get(index);
 const hex=CONTAINER_COLORS[index%CONTAINER_COLORS.length],color=`#${new THREE.Color(hex).getHexString()}`,seed=index*97+13;
 const label=`HTWU ${String(310000+index*7919).slice(0,6)} ${index%10}`;
 const side=canvas(512,194,(g,w,h)=>corrugated(g,w,h,color,40,seed,label));
 const end=canvas(256,274,(g,w,h)=>{corrugated(g,w,h,color,12,seed+1);g.strokeStyle='rgba(0,0,0,.45)';g.lineWidth=3;g.beginPath();g.moveTo(w/2,8);g.lineTo(w/2,h-8);g.stroke();g.strokeStyle='rgba(210,215,215,.75)';g.lineWidth=4;for(const x of [.16,.36,.64,.84]){g.beginPath();g.moveTo(w*x,h*.08);g.lineTo(w*x,h*.92);g.stroke();}g.fillStyle='rgba(30,30,30,.6)';for(const x of [.16,.36,.64,.84])g.fillRect(w*x-6,h*.48,12,18);});
 const top=canvas(512,181,(g,w,h)=>{g.fillStyle=shade(hex,.9);g.fillRect(0,0,w,h);for(let i=0;i<w;i+=10){g.fillStyle='rgba(0,0,0,.12)';g.fillRect(i,0,4,h);}g.fillStyle='rgba(0,0,0,.4)';g.fillRect(0,0,w,6);g.fillRect(0,h-6,w,6);const r=rand(seed+3);for(let i=0;i<60;i++){g.fillStyle=`rgba(70,50,35,${r()*.2})`;g.fillRect(r()*w,r()*h,4+r()*14,2+r()*6);}});
 const bump=canvas(256,64,(g,w,h)=>{for(let i=0;i<40;i++){const grad=g.createLinearGradient(i*w/40,0,(i+1)*w/40,0);grad.addColorStop(0,'#fff');grad.addColorStop(.5,'#000');grad.addColorStop(1,'#fff');g.fillStyle=grad;g.fillRect(i*w/40,0,w/40,h);}});
 const bumpMap=texture(bump,false);
 const base={roughness:.66,metalness:.28};
 const sideMat=new THREE.MeshStandardMaterial({...base,map:texture(side),bumpMap,bumpScale:1.6});
 const endMat=new THREE.MeshStandardMaterial({...base,map:texture(end)});
 const topMat=new THREE.MeshStandardMaterial({...base,map:texture(top),roughness:.75});
 // BoxGeometry face order: +x, -x, +y, -y, +z, -z
 const mats=[endMat,endMat,topMat,topMat,sideMat,sideMat];containerCache.set(index,mats);return mats;
}
export function containerColorIndex(id){let h=2166136261;for(const ch of id){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return Math.abs(h)%CONTAINER_COLORS.length;}

// Superstructure facade with window rows; emissive map lights the windows at night.
export function facadeMaterials(floors=4){
 const draw=(lit)=>canvas(256,256,(g,w,h)=>{g.fillStyle=lit?'#000':'#e9ecea';g.fillRect(0,0,w,h);if(!lit){const r=rand(5);for(let i=0;i<300;i++){g.fillStyle=`rgba(90,80,70,${r()*.06})`;g.fillRect(r()*w,r()*h,2,6+r()*20);}}const rows=floors,rh=h/rows;const r=rand(11);for(let f=0;f<rows;f++)for(let x=10;x<w-14;x+=22){const on=r()<.55;g.fillStyle=lit?(on?'#ffcf80':'#000'):'#20323d';g.fillRect(x,f*rh+rh*.32,14,rh*.34);}g.fillStyle=lit?'#000':'rgba(0,0,0,.08)';for(let f=1;f<rows;f++)g.fillRect(0,f*rh-2,w,3);});
 const map=texture(draw(false)),emissiveMap=texture(draw(true));
 const side=new THREE.MeshStandardMaterial({map,emissiveMap,emissive:0xffffff,emissiveIntensity:0,roughness:.6,metalness:.1});
 const plain=new THREE.MeshStandardMaterial({color:0xe6e9e7,roughness:.6,metalness:.1});
 return {side,plain,faces:[side,side,plain,plain,side,side]};
}

// Extra hull fittings: lashing bridges, forecastle breakwater, mast, superstructure upgrades,
// funnel, radar mast, lifeboat, cranes on quay side absent (gearless vessel).
export function addShipDetails({ship,box,facilityMeshes,cargo}){
 const steel=new THREE.MeshStandardMaterial({color:0x9aa3a6,roughness:.5,metalness:.6});
 const yellow=new THREE.MeshStandardMaterial({color:0xc9a227,roughness:.55,metalness:.4});
 const add=(geo,mat,x,y,z,parent=ship)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const bays=[...new Set(cargo.map(c=>c.x))].sort((a,b)=>a-b);
 // Lashing bridges between bays.
 for(let i=0;i<bays.length-1;i++){const x=(bays[i]+bays[i+1])/2;for(const z of [-12,-6,0,6,12])add(new THREE.BoxGeometry(.3,5.2,.3),yellow,x,9.4,z);add(new THREE.BoxGeometry(.9,.18,27),yellow,x,9.2,0);add(new THREE.BoxGeometry(.9,.18,27),yellow,x,11.8,0);}
 // Hatch coaming end plates.
 for(const x of bays){add(new THREE.BoxGeometry(12.4,.7,.4),steel,x,6.95,-11.2);add(new THREE.BoxGeometry(12.4,.7,.4),steel,x,6.95,11.2);}
 // Forecastle with V breakwater and bow mast.
 const fc=add(new THREE.BoxGeometry(14,1.6,22),new THREE.MeshStandardMaterial({color:0x3b4a43,roughness:.85}),51,7.4,0);
 for(const s of [-1,1]){const plate=add(new THREE.BoxGeometry(.35,3.2,12.5),new THREE.MeshStandardMaterial({color:0xd6dad8,roughness:.6,metalness:.2}),44.5,9.1,s*5.6);plate.rotation.y=s*.42;}
 add(new THREE.CylinderGeometry(.22,.3,13,10),steel,55,14.5,0);add(new THREE.BoxGeometry(.2,.2,4),steel,55,19,0);
 for(const s of [-1,1])for(const x of [50,56])add(new THREE.CylinderGeometry(.9,.9,1.2,14),new THREE.MeshStandardMaterial({color:0x2f3d46,roughness:.5,metalness:.5}),x,8.8,s*7);
 // Superstructure: textured accommodation, bridge with wings, radar mast, funnel, lifeboat.
 const facade=facadeMaterials(4);
 const acc=add(new THREE.BoxGeometry(14.2,14.6,22.2),facade.faces,-50,14,0);facilityMeshes.push(acc);
 const bridgeFacade=facadeMaterials(1);
 const bridge=add(new THREE.BoxGeometry(12,3.6,22.4),bridgeFacade.faces,-48.5,23.1,0);facilityMeshes.push(bridge);
 const wing=add(new THREE.BoxGeometry(5,.45,34),new THREE.MeshStandardMaterial({color:0xe3e6e4,roughness:.6}),-46,21.4,0);facilityMeshes.push(wing);
 const glass=new THREE.MeshStandardMaterial({color:0x10202a,roughness:.08,metalness:.9});
 const win=add(new THREE.BoxGeometry(.2,1.6,21),glass,-42.4,23.4,0);facilityMeshes.push(win);
 const roof=add(new THREE.BoxGeometry(13,.4,23),new THREE.MeshStandardMaterial({color:0xcfd3d1,roughness:.7}),-48.5,25.1,0);facilityMeshes.push(roof);
 const mast=add(new THREE.CylinderGeometry(.25,.35,8,10),steel,-49,29,0);facilityMeshes.push(mast);
 for(const [y,w] of [[30.5,6],[32.2,4]]){const radar=add(new THREE.BoxGeometry(.4,.25,w),new THREE.MeshStandardMaterial({color:0x2a2f33,roughness:.4}),-49,y,0);radar.userData.spin=y>31?.9:-1.3;facilityMeshes.push(radar);}
 const funnelMat=new THREE.MeshStandardMaterial({color:0x26323b,roughness:.55,metalness:.3});
 const funnel=add(new THREE.CylinderGeometry(3.2,3.8,9,24),funnelMat,-58,28,0);funnel.scale.z=1.5;facilityMeshes.push(funnel);
 const band=add(new THREE.CylinderGeometry(3.32,3.42,1.6,24),new THREE.MeshStandardMaterial({color:0xd7dcda,roughness:.5}),-58,29.6,0);band.scale.z=1.5;facilityMeshes.push(band);
 const stripe=add(new THREE.CylinderGeometry(3.36,3.4,.6,24),new THREE.MeshStandardMaterial({color:0x2a8f88,roughness:.5}),-58,29.6,0);stripe.scale.set(1.01,1,1.51);facilityMeshes.push(stripe);
 const top=add(new THREE.CylinderGeometry(3.15,3.2,1.2,24),new THREE.MeshStandardMaterial({color:0x0b0d0f,roughness:.9}),-58,33,0);top.scale.z=1.5;facilityMeshes.push(top);
 const boat=add(new THREE.CapsuleGeometry(1.5,5.5,6,14),new THREE.MeshStandardMaterial({color:0xe2611c,roughness:.5}),-62.2,13,0);boat.rotation.z=Math.PI/2-.55;facilityMeshes.push(boat);
 const ramp=add(new THREE.BoxGeometry(9,.4,3.6),steel,-61.5,11.2,0);ramp.rotation.z=-.55;facilityMeshes.push(ramp);
 for(const s of [-1,1]){const raft=add(new THREE.CylinderGeometry(.8,.8,1.6,12),new THREE.MeshStandardMaterial({color:0xf2f2ef,roughness:.6}),-44,20.6,s*15.5);raft.rotation.x=Math.PI/2;facilityMeshes.push(raft);}
 // Bow name boards (fictional vessel name used throughout the app).
 const name=canvas(512,96,(g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle='#f1f1ec';g.font='bold 64px sans-serif';g.textBaseline='middle';g.fillText('HARBOR ONE',14,h/2);});
 const nameMat=new THREE.MeshStandardMaterial({map:texture(name),transparent:true,roughness:.6,depthWrite:false});
 for(const s of [-1,1]){const p=new THREE.Mesh(new THREE.PlaneGeometry(14,2.6),nameMat);p.position.set(36,2.6,s*15.68);if(s<0){p.rotation.y=Math.PI;}ship.add(p);}
 const stern=canvas(512,96,(g,w,h)=>{g.fillStyle='#f1f1ec';g.font='bold 54px sans-serif';g.textBaseline='middle';g.textAlign='center';g.fillText('HARBOR ONE',w/2,h*.38);g.font='30px sans-serif';g.fillText('BUSAN',w/2,h*.8);});
 const sternPlate=new THREE.Mesh(new THREE.PlaneGeometry(12,2.4),new THREE.MeshStandardMaterial({map:texture(stern),transparent:true,depthWrite:false}));sternPlate.position.set(-65.75,3.6,0);sternPlate.rotation.y=-Math.PI/2;ship.add(sternPlate);
 // Navigation and deck lights, only visible at night.
 const glowTex=texture(canvas(64,64,(g)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.25,'rgba(255,255,255,.6)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64);}));
 const lights=[];const light=(color,x,y,z,size=3)=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));s.position.set(x,y,z);s.scale.setScalar(size);s.visible=false;ship.add(s);lights.push(s);return s;};
 light(0xff3030,-46,21.9,-17.2);light(0x30ff70,-46,21.9,17.2);light(0xffffff,-49,33.4,0,3.5);light(0xffffff,55,21,0,3.5);light(0xffffff,-64,9,0,2.5);
 for(const x of [-30,-4,22])for(const s of [-1,1])light(0xffe2a8,x,13,s*14.5,5);
 const radars=[];ship.traverse(o=>{if(o.userData.spin)radars.push(o);});
 return {
  setNight(on){facade.side.emissiveIntensity=on?1.4:0;bridgeFacade.side.emissiveIntensity=on?1.4:0;lights.forEach(l=>l.visible=on);},
  animate(t){radars.forEach(r=>r.rotation.y=t*r.userData.spin);}
 };
}
