import * as THREE from './vendor/three.module.js';
import {weatherProfile,lightningPulse,windVisualProfile} from './weather-profile.mjs?v=precip1';
import {surfaceHeight,OCEAN_LEVEL} from './ocean-motion.mjs?v=windbands1';
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
 const capGeo=new THREE.PlaneGeometry(1,1);capGeo.rotateX(-Math.PI/2);
 const caps=new THREE.InstancedMesh(capGeo,new THREE.MeshBasicMaterial({map:texture,color:0xd6ecec,transparent:true,opacity:.55,depthWrite:false,side:THREE.DoubleSide}),220);caps.frustumCulled=false;group.add(caps);
 const sprayPositions=new Float32Array(540*3),sprayGeo=new THREE.BufferGeometry();sprayGeo.setAttribute('position',new THREE.BufferAttribute(sprayPositions,3));const sprayMaterial=snow.material.clone();sprayMaterial.uniforms.uOpacity.value=.35;sprayMaterial.vertexShader=sprayMaterial.vertexShader.replace('330.','150.').replace('1.5,7.','1.,4.');const spray=new THREE.Points(sprayGeo,sprayMaterial);spray.frustumCulled=false;group.add(spray);
 const windPositions=new Float32Array(90*6),windGeo=new THREE.BufferGeometry();windGeo.setAttribute('position',new THREE.BufferAttribute(windPositions,3));const windLines=new THREE.LineSegments(windGeo,new THREE.LineBasicMaterial({color:0xc6e1e9,transparent:true,opacity:.1,depthWrite:false}));windLines.frustumCulled=false;group.add(windLines);
 const flash=new THREE.DirectionalLight(0xd9e8ff,0);flash.position.set(-75,110,-80);flash.userData.weatherLight=true;group.add(flash);
 const boltPositions=[];let x=-100,y=110,z=-100;for(let i=0;i<9;i++){boltPositions.push(x,y,z);x+=(i%2?1:-1)*(4+seed(i,3)*10);y-=10;z+=2;boltPositions.push(x,y,z);}const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(boltPositions,3));const bolt=new THREE.LineSegments(bg,new THREE.LineBasicMaterial({color:0xe6efff,transparent:true,opacity:.95}));group.add(bolt);
 const lights=[];scene.traverse(o=>{if(o.isLight&&!o.userData.weatherLight)lights.push({light:o,intensity:o.intensity});});
 return {update(time,environment,preview='auto',flashes=false){
  const p=weatherProfile(environment,preview),windFX=windVisualProfile(p.wind),e=environment??{height:0,period:8,direction:0,heading:0},t=time;
  scene.fog.color.set(p.night?0x243b50:p.fog?0x95abb5:p.cloud?0x526b7d:0x203b50);scene.fog.density=p.density;
  scene.background=new THREE.Color(p.night?0x0c1d30:p.fog?0x95abb5:p.storm?0x253c50:p.cloud?0x526b7d:0x203b50);
  const lightScale=p.night?.38:p.fog?.85:p.cloud?.7:1;for(const {light,intensity} of lights)light.intensity=intensity*lightScale;
  rain.visible=p.rain;snow.visible=p.snow;snow.geometry.setDrawRange(0,Math.floor(snowCount*p.amount));rain.geometry.setDrawRange(0,Math.floor(rainCount*p.amount)*2);
  if(p.rain){for(let i=0;i<rainCount;i++){const y=95-((seed(i,2)*95+t*(30+p.wind*.4))%95),drift=t*p.wind*.8,x=((seed(i,1)*320+p.dx*drift)%320+320)%320-160,z=((seed(i,3)*300+p.dz*drift)%300+300)%300-150,len=2.2+seed(i,4)*2.8,k=i*6;ra[k]=x;ra[k+1]=y;ra[k+2]=z;ra[k+3]=x-p.dx*p.wind*.045;ra[k+4]=y+len;ra[k+5]=z-p.dz*p.wind*.045;}rg.attributes.position.needsUpdate=true;rain.material.opacity=p.storm?.56:.38;}
  if(p.snow){for(let i=0;i<snowCount;i++){sn[i*3]=((seed(i,1)*300+p.dx*t*p.wind*.2+Math.sin(t*.9+i)*windFX.snowSway)%300+300)%300-150;sn[i*3+1]=90-((seed(i,2)*90+t*(1.1+seed(i,4)*1.5))%90);sn[i*3+2]=((seed(i,3)*280+p.dz*t*p.wind*.2+Math.cos(t*.6+i)*windFX.snowSway)%280+280)%280-140;}sg.attributes.position.needsUpdate=true;}
  ripples.count=Math.floor(120*p.amount);ripples.visible=p.rain&&ripples.count>0;for(let i=0;p.rain&&i<ripples.count;i++){const age=(t*1.2+seed(i,4))%1,x=seed(i,1)*240-120,z=seed(i,2)*200-100;dummy.position.set(x,OCEAN_LEVEL+surfaceHeight(x,z,t,e)+.12,z);dummy.scale.setScalar(age*2.4+.05);dummy.updateMatrix();ripples.setMatrixAt(i,dummy.matrix);}if(p.rain)ripples.instanceMatrix.needsUpdate=true;
  for(let i=0;i<clouds.length;i++){const o=clouds[i];o.visible=p.cloud;o.position.set(((seed(i,1)*380+t*p.dx*(p.wind*.12+1))%380+380)%380-190,p.fog?4+seed(i,2)*20:68+seed(i,2)*35,-80-seed(i,3)*160);o.material.color.set(p.fog?0xb3c6ce:p.storm?0x354b60:0x869cae);o.material.opacity=p.fog?.18:p.storm?.52:.3;}
  const gust=.8+.2*Math.sin(t*.4),gustDistance=p.wind*(.8*t+.5*(1-Math.cos(t*.4)));
  caps.visible=windFX.whitecaps>0;caps.count=Math.floor(220*windFX.whitecaps);caps.material.opacity=.25+windFX.whitecaps*.4;
  for(let i=0;i<caps.count;i++){const age=(t*(.25+windFX.whitecaps*.4)+seed(i,7))%1,fade=Math.sin(age*Math.PI),x=((seed(i,1)*320+p.dx*t*p.wind*.3)%320+320)%320-160,z=((seed(i,2)*280+p.dz*t*p.wind*.3)%280+280)%280-140;dummy.position.set(x,OCEAN_LEVEL+surfaceHeight(x,z,t,e)+.18,z);dummy.rotation.set(0,Math.atan2(-p.dz,p.dx),0);dummy.scale.set((2+windFX.whitecaps*5)*fade*gust,1,(.4+windFX.whitecaps)*fade);dummy.updateMatrix();caps.setMatrixAt(i,dummy.matrix);}if(caps.visible)caps.instanceMatrix.needsUpdate=true;
  spray.visible=windFX.spray>0;sprayGeo.setDrawRange(0,Math.floor(540*windFX.spray));
  for(let i=0;spray.visible&&i<540;i++){const age=(t*(.3+windFX.spray*.5)+seed(i,4))%1,x=seed(i,1)*280-140+p.dx*age*p.wind*.5,z=seed(i,2)*240-120+p.dz*age*p.wind*.5;sprayPositions[i*3]=x;sprayPositions[i*3+1]=OCEAN_LEVEL+surfaceHeight(x,z,t,e)+.3+Math.sin(age*Math.PI)*(1+windFX.spray*5);sprayPositions[i*3+2]=z;}if(spray.visible)sprayGeo.attributes.position.needsUpdate=true;
  windLines.visible=windFX.streaks>0;windGeo.setDrawRange(0,Math.floor(90*windFX.streaks)*2);windLines.material.opacity=.04+windFX.streaks*.12;
  for(let i=0;windLines.visible&&i<90;i++){const x=((seed(i,1)*320+p.dx*gustDistance)%320+320)%320-160,z=((seed(i,2)*280+p.dz*gustDistance)%280+280)%280-140,y=1+seed(i,3)*18,len=2+windFX.streaks*10,k=i*6;windPositions[k]=x;windPositions[k+1]=y;windPositions[k+2]=z;windPositions[k+3]=x-p.dx*len;windPositions[k+4]=y+.15;windPositions[k+5]=z-p.dz*len;}if(windLines.visible)windGeo.attributes.position.needsUpdate=true;
  // At most two brief pulses every 18 simulation seconds, explicitly enabled by the user.
  flash.intensity=lightningPulse(t,flashes,p.thunder)?5:0;bolt.visible=flash.intensity>0;
  return {...p,windVisual:windFX};
 },dispose(){group.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});texture.dispose();scene.remove(group);}};
}
