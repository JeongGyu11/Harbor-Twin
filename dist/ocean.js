import {windWaveAmplitude,WIND_PARTS,MAX_WIND} from './wind-model.mjs?v=windbands1';
import * as THREE from './vendor/three.module.js';
import {OCEAN_LEVEL,WAVE_PARTS,strength,visualTime,oceanAngle,oceanPeriod} from './ocean-motion.mjs?v=windbands1';

// Concentrate geometry around the vessel and stretch distant cells beyond the camera range.
export function createOceanGeometry(){
 const geometry=new THREE.PlaneGeometry(2,2,220,220),position=geometry.attributes.position;
 const stretch=v=>Math.sign(v)*35*Math.expm1(Math.abs(v)*Math.log1p(20000/35));
 for(let i=0;i<position.count;i++)position.setXYZ(i,stretch(position.getX(i)),stretch(position.getY(i)),0);
 position.needsUpdate=true;geometry.computeBoundingSphere();return geometry;
}
// Visual ocean only: these waves do not alter the vessel hydrostatics.
export function createOcean(renderer){
 const uniforms={oceanGloom:{value:0},oceanTime:{value:0},oceanStrength:{value:0},oceanAngle:{value:0},oceanWind:{value:5},windAmplitude:{value:0},windAngle:{value:0},windTime:{value:0}};
 const faces=Array.from({length:6},(_,i)=>{const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');const g=ctx.createLinearGradient(0,0,0,128);g.addColorStop(0,i===3?'#172e36':'#648eab');g.addColorStop(.65,'#c1d8df');g.addColorStop(1,'#779aa7');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);if(i===0){const sun=ctx.createRadialGradient(70,35,0,70,35,30);sun.addColorStop(0,'rgba(255,249,222,1)');sun.addColorStop(1,'rgba(255,249,222,0)');ctx.fillStyle=sun;ctx.fillRect(0,0,128,128);}return c;});
 const sky=new THREE.CubeTexture(faces);sky.needsUpdate=true;sky.colorSpace=THREE.SRGBColorSpace;
 const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromCubemap(sky);pmrem.dispose();sky.dispose();
 const material=new THREE.MeshPhysicalMaterial({color:0x14707e,roughness:.12,metalness:0,ior:1.333,clearcoat:.6,clearcoatRoughness:.08,envMap:environment.texture,envMapIntensity:.45,specularIntensity:1});
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  const common=`
   uniform float oceanTime;
   uniform float oceanAngle;
   uniform float oceanStrength;
   uniform float oceanWind;
   uniform float windAmplitude;
   uniform float windAngle;
   uniform float windTime;
   varying float oceanHeight;
   varying vec2 oceanUV;
   float swell(vec2 p){
    vec2 wp=mat2(cos(windAngle),sin(windAngle),-sin(windAngle),cos(windAngle))*p;
    float windSwell=windAmplitude*(${WIND_PARTS.map(([a,x,z,r])=>`${a}*sin(dot(wp,vec2(${x},${z}))-windTime*(${r}+oceanWind*.004))`).join('+')});
    p=mat2(cos(oceanAngle),sin(oceanAngle),-sin(oceanAngle),cos(oceanAngle))*p;
    return (windSwell+oceanStrength*(
     ${WAVE_PARTS.map(([a,x,y,w])=>`${a}*sin(dot(p,vec2(${x},${y}))-oceanTime*${w})`).join('+')} ))*(1.-smoothstep(800.,4000.,length(p)));
   }
  `;
  shader.vertexShader=common+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`
   float hx=(swell(position.xy+vec2(.15,0.))-swell(position.xy-vec2(.15,0.)))/.3;
   float hy=(swell(position.xy+vec2(0.,.15))-swell(position.xy-vec2(0.,.15)))/.3;
   vec3 objectNormal=normalize(vec3(-hx,-hy,1.));
  `).replace('#include <begin_vertex>',`
   vec3 transformed=vec3(position);
   oceanHeight=swell(position.xy);
   oceanUV=position.xy;
   transformed.z+=oceanHeight;
  `);
  shader.fragmentShader=`uniform float oceanGloom; uniform float windAmplitude; uniform float oceanWind; uniform float oceanTime; uniform float oceanStrength; varying float oceanHeight; varying vec2 oceanUV;\nfloat oHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}\nfloat oNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(oHash(i),oHash(i+vec2(1,0)),f.x),mix(oHash(i+vec2(0,1)),oHash(i+vec2(1,1)),f.x),f.y);}\n`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
   #include <color_fragment>
   float crest=oceanHeight/max(oceanStrength+windAmplitude,.001);
   vec3 deep=vec3(.006,.035,.055);
   vec3 shallow=vec3(.02,.15,.16);
   diffuseColor.rgb=mix(deep,shallow,smoothstep(-.6,1.,crest));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(dot(diffuseColor.rgb,vec3(.3,.59,.11)))*vec3(.8,1.,1.)*.75,oceanGloom*.65);
   float dist=length(oceanUV);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.012,.06,.08),smoothstep(150.,1400.,dist));
   // Foam where swell laps against the hull (superellipse around the vessel footprint).
   vec2 hp=vec2(oceanUV.x/64.5,oceanUV.y/16.6);
   float hullD=pow(pow(abs(hp.x),4.)+pow(abs(hp.y),4.),.25);
   float lap=fract(sin(dot(floor(oceanUV*1.6),vec2(12.9898,78.233)))*43758.5453);
   float br=.5+.5*sin(oceanUV.x*.9+sin(oceanUV.y*1.3)*2.+oceanTime*.7)*sin(oceanUV.y*1.7-oceanUV.x*.4);
   float hullFoam=smoothstep(1.13,1.0,hullD)*smoothstep(.97,1.01,hullD)*smoothstep(.25,.75,br*.7+lap*.3)*(.3+.7*min(oceanStrength+windAmplitude*2.,1.));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.8,.87,.89),hullFoam*.75);
   float breakup=.5+.5*sin(oceanUV.x*.7+sin(oceanUV.y*.9)+oceanTime*.2);
   float foam=smoothstep(.84,.99,crest)*smoothstep(.45,.9,breakup)*min(oceanStrength,1.);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.67,.85,.85),foam*(.22+.16*smoothstep(5.,113.2,oceanWind)));
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
   #include <normal_fragment_maps>
   float rw=clamp(oceanWind/12.,.25,7.6);
   float ripples=max(oceanStrength,.22)*rw*(.028*sin(oceanUV.x*1.9+oceanUV.y*.8-oceanTime*1.5)+.018*sin(oceanUV.x*-.9+oceanUV.y*2.4+oceanTime*1.1));
   float near=1.-smoothstep(40.,260.,length(oceanUV));
   ripples+=rw*(.012*sin(oceanUV.x*3.7-oceanUV.y*2.3+oceanTime*2.3)+.008*sin(oceanUV.x*-2.6-oceanUV.y*4.9-oceanTime*2.9)+near*(.005*sin(oceanUV.x*7.3+oceanUV.y*5.1+oceanTime*3.7)));
   ripples*=1.-smoothstep(70.,520.,length(oceanUV));
   vec2 q=oceanUV*.075+vec2(oceanTime*.11,oceanTime*.07);
   float chop=oNoise(q)*.6+oNoise(q*2.3+vec2(5.2,1.3)-oceanTime*.05)*.3+oNoise(q*5.1-vec2(2.7,8.1))*.1;
   ripples+=(chop-.5)*(.55+.45*rw)*(.6+min(oceanStrength,1.5))*(1.-smoothstep(300.,2200.,length(oceanUV)));
   vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition);
   vec3 r1=cross(sy,normal),r2=cross(normal,sx);
   float det=dot(sx,r1);
   vec3 gradient=sign(det)*(dFdx(ripples)*r1+dFdy(ripples)*r2);
   normal=normalize(abs(det)*normal-gradient);
  `);
 };
 const mesh=new THREE.Mesh(createOceanGeometry(),material);
 mesh.receiveShadow=true;
 mesh.rotation.x=-Math.PI/2;mesh.position.y=OCEAN_LEVEL;
 mesh.frustumCulled=false;mesh.name='visual-ocean';
 return {mesh,setGloom(v){uniforms.oceanGloom.value+=(v-uniforms.oceanGloom.value)*.06;},setEnvironment(){material.envMap=null;material.envMapIntensity=1.05;material.needsUpdate=true;environment.texture.dispose();},update(time,level){material.roughness=.14+Math.min(.26,(typeof level==='object'?level.wind:5)/MAX_WIND*.3);uniforms.windAmplitude.value=typeof level==='object'?windWaveAmplitude(level.wind):0;uniforms.windAngle.value=typeof level==='object'?(level.windDirection-level.heading)*Math.PI/180:0;uniforms.windTime.value=visualTime(time);uniforms.oceanTime.value=visualTime(time)*oceanPeriod(level);uniforms.oceanAngle.value=oceanAngle(level);uniforms.oceanStrength.value=strength(level);uniforms.oceanWind.value=typeof level==='object'?level.wind:5;}};
}
