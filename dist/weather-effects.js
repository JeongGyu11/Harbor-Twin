import * as THREE from './vendor/three.module.js';
import {weatherProfile,lightningPulse} from './weather-profile.mjs';
import {surfaceHeight} from './ocean-motion.mjs?v=env2';
export function createWeatherEffects(scene){
 const group=new THREE.Group();group.name='weather-effects';scene.add(group);
 const seed=(i,k)=>{const x=Math.sin(i*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};
 const rainCount=2200,snowCount=1300,ra=new Float32Array(rainCount*6),sn=new Float32Array(snowCount*3);
 const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.BufferAttribute(ra,3));
 const rain=new THREE.LineSegments(rg,new THREE.LineBasicMaterial({color:0xbad4e5,transparent:true,opacity:.36,depthWrite:false}));rain.frustumCulled=false;group.add(rain);
 const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sn,3));
 const snow=new THREE.Points(sg,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uOpacity:{value:.85}},vertexShader:`void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(330./max(1.,-p.z),1.5,7.);}`,fragmentShader:`uniform float uOpacity;void main(){float r=length(gl_PointCoord-.5)*2.;float a=(1.-smoothstep(.2,1.,r))*uOpacity;if(a<.02)discard;gl_FragColor=vec4(.92,.96,1.,a);}`}));snow.frustumCulled=false;group.add(snow);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),grad=ctx.createRadialGradient(64,64,0,64,64,64);grad.addColorStop(0,'rgba(255,255,255,.45)');grad.addColorStop(.45,'rgba(255,255,255,.22)');grad.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);const texture=new THREE.CanvasTexture(canvas);
 const clouds=[];for(let i=0;i<18;i++){const o=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:0x8497a6,transparent:true,opacity:.24,depthWrite:false}));o.scale.set(90+seed(i,1)*100,25+seed(i,2)*25,1);group.add(o);clouds.push(o);}
 const rippleGeo=new THREE.RingGeometry(.55,.65,24);rippleGeo.rotateX(-Math.PI/2);const ripples=new THREE.InstancedMesh(rippleGeo,new THREE.MeshBasicMaterial({color:0xb6dbe4,transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false}),120);ripples.frustumCulled=false;group.add(ripples);const dummy=new THREE.Object3D();
 const flash=new THREE.DirectionalLight(0xd9e8ff,0);flash.position.set(-75,110,-80);flash.userData.weatherLight=true;group.add(flash);
 const boltPositions=[];let x=-100,y=110,z=-100;for(let i=0;i<9;i++){boltPositions.push(x,y,z);x+=(i%2?1:-1)*(4+seed(i,3)*10);y-=10;z+=2;boltPositions.push(x,y,z);}const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(boltPositions,3));const bolt=new THREE.LineSegments(bg,new THREE.LineBasicMaterial({color:0xe6efff,transparent:true,opacity:.95}));group.add(bolt);
 const lights=[];scene.traverse(o=>{if(o.isLight&&!o.userData.weatherLight)lights.push({light:o,intensity:o.intensity});});
 return {update(time,environment,preview='auto',flashes=false){
  const p=weatherProfile(environment,preview),e=environment??{height:0,period:8,direction:0,heading:0},t=time;
  scene.fog.color.set(p.night?0x243b50:p.fog?0x95abb5:p.cloud?0x526b7d:0x203b50);scene.fog.density=p.density;
  scene.background=new THREE.Color(p.night?0x0c1d30:p.fog?0x95abb5:p.storm?0x253c50:p.cloud?0x526b7d:0x203b50);
  const lightScale=p.night?.38:p.fog?.85:p.cloud?.7:1;for(const {light,intensity} of lights)light.intensity=intensity*lightScale;
  rain.visible=p.rain;snow.visible=p.snow;rain.geometry.setDrawRange(0,Math.floor(rainCount*p.amount)*2);
  if(p.rain){for(let i=0;i<rainCount;i++){const y=95-((seed(i,2)*95+t*(30+p.wind*.4))%95),drift=t*p.wind*.8,x=((seed(i,1)*320+p.dx*drift)%320+320)%320-160,z=((seed(i,3)*300+p.dz*drift)%300+300)%300-150,len=2.2+seed(i,4)*2.8,k=i*6;ra[k]=x;ra[k+1]=y;ra[k+2]=z;ra[k+3]=x-p.dx*p.wind*.045;ra[k+4]=y+len;ra[k+5]=z-p.dz*p.wind*.045;}rg.attributes.position.needsUpdate=true;rain.material.opacity=p.storm?.56:.38;}
  if(p.snow){for(let i=0;i<snowCount;i++){sn[i*3]=((seed(i,1)*300+p.dx*t*p.wind*.2+Math.sin(t*.9+i)*2)%300+300)%300-150;sn[i*3+1]=90-((seed(i,2)*90+t*(1.1+seed(i,4)*1.5))%90);sn[i*3+2]=((seed(i,3)*280+p.dz*t*p.wind*.2+Math.cos(t*.6+i)*2)%280+280)%280-140;}sg.attributes.position.needsUpdate=true;}
  ripples.visible=p.rain;for(let i=0;p.rain&&i<120;i++){const age=(t*1.2+seed(i,4))%1,x=seed(i,1)*240-120,z=seed(i,2)*200-100;dummy.position.set(x,surfaceHeight(x,z,t,e)+.12,z);dummy.scale.setScalar(age*2.4+.05);dummy.updateMatrix();ripples.setMatrixAt(i,dummy.matrix);}if(p.rain)ripples.instanceMatrix.needsUpdate=true;
  for(let i=0;i<clouds.length;i++){const o=clouds[i];o.visible=p.cloud;o.position.set(((seed(i,1)*380+t*p.dx*(p.wind*.12+1))%380+380)%380-190,p.fog?4+seed(i,2)*20:68+seed(i,2)*35,-80-seed(i,3)*160);o.material.color.set(p.fog?0xb3c6ce:p.storm?0x354b60:0x869cae);o.material.opacity=p.fog?.18:p.storm?.52:.3;}
  // At most two brief pulses every 18 simulation seconds, explicitly enabled by the user.
  flash.intensity=lightningPulse(t,flashes,p.thunder)?5:0;bolt.visible=flash.intensity>0;
  return p;
 },dispose(){group.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});texture.dispose();scene.remove(group);}};
}
