import * as THREE from './vendor/three.module.js';
import {WAVE_PARTS,strength,visualTime,oceanAngle,oceanPeriod} from './ocean-motion.mjs?v=env1';

// Concentrate geometry around the vessel and stretch distant cells beyond the camera range.
export function createOceanGeometry(){
 const geometry=new THREE.PlaneGeometry(2,2,220,220),position=geometry.attributes.position;
 const stretch=v=>Math.sign(v)*35*Math.expm1(Math.abs(v)*Math.log1p(20000/35));
 for(let i=0;i<position.count;i++)position.setXYZ(i,stretch(position.getX(i)),stretch(position.getY(i)),0);
 position.needsUpdate=true;geometry.computeBoundingSphere();return geometry;
}
// Visual ocean only: these waves do not alter the vessel hydrostatics.
export function createOcean(renderer){
 const uniforms={oceanTime:{value:0},oceanStrength:{value:0},oceanAngle:{value:0},oceanWind:{value:5}};
 const faces=Array.from({length:6},(_,i)=>{const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');const g=ctx.createLinearGradient(0,0,0,128);g.addColorStop(0,i===3?'#172e36':'#648eab');g.addColorStop(.65,'#c1d8df');g.addColorStop(1,'#779aa7');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);if(i===0){const sun=ctx.createRadialGradient(70,35,0,70,35,30);sun.addColorStop(0,'rgba(255,249,222,1)');sun.addColorStop(1,'rgba(255,249,222,0)');ctx.fillStyle=sun;ctx.fillRect(0,0,128,128);}return c;});
 const sky=new THREE.CubeTexture(faces);sky.needsUpdate=true;sky.colorSpace=THREE.SRGBColorSpace;
 const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromCubemap(sky);pmrem.dispose();sky.dispose();
 const material=new THREE.MeshPhysicalMaterial({color:0x14707e,roughness:.23,metalness:.03,clearcoat:.8,clearcoatRoughness:.14,envMap:environment.texture,envMapIntensity:.45});
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  const common=`
   uniform float oceanTime;
   uniform float oceanAngle;
   uniform float oceanStrength;
   varying float oceanHeight;
   varying vec2 oceanUV;
   float swell(vec2 p){
    p=mat2(cos(oceanAngle),sin(oceanAngle),-sin(oceanAngle),cos(oceanAngle))*p;
    return oceanStrength*(
     ${WAVE_PARTS.map(([a,x,y,w])=>`${a}*sin(dot(p,vec2(${x},${y}))-oceanTime*${w})`).join('+')} )*(1.-smoothstep(800.,4000.,length(p)));
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
  shader.fragmentShader=`uniform float oceanWind; uniform float oceanTime; uniform float oceanStrength; varying float oceanHeight; varying vec2 oceanUV;\n`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
   #include <color_fragment>
   float crest=oceanHeight/max(oceanStrength,.001);
   vec3 deep=vec3(.018,.095,.14);
   vec3 shallow=vec3(.055,.32,.36);
   diffuseColor.rgb=mix(deep,shallow,smoothstep(-.8,.85,crest));
   float breakup=.5+.5*sin(oceanUV.x*.7+sin(oceanUV.y*.9)+oceanTime*.2);
   float foam=smoothstep(.84,.99,crest)*smoothstep(.45,.9,breakup)*min(oceanStrength,1.);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.67,.85,.85),foam*.28);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
   #include <normal_fragment_maps>
   float ripples=max(oceanStrength,.18)*clamp(oceanWind/5.,.2,3.)*(.028*sin(oceanUV.x*1.9+oceanUV.y*.8-oceanTime*1.5)+.018*sin(oceanUV.x*-.9+oceanUV.y*2.4+oceanTime*1.1));
   ripples*=1.-smoothstep(250.,1800.,length(oceanUV));
   vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition);
   vec3 r1=cross(sy,normal),r2=cross(normal,sx);
   float det=dot(sx,r1);
   vec3 gradient=sign(det)*(dFdx(ripples)*r1+dFdy(ripples)*r2);
   normal=normalize(abs(det)*normal-gradient);
  `);
 };
 const mesh=new THREE.Mesh(createOceanGeometry(),material);
 mesh.rotation.x=-Math.PI/2;mesh.position.y=-4;
 mesh.frustumCulled=false;mesh.name='visual-ocean';
 return {mesh,update(time,level){uniforms.oceanTime.value=visualTime(time)*oceanPeriod(level);uniforms.oceanAngle.value=oceanAngle(level);uniforms.oceanStrength.value=strength(level);uniforms.oceanWind.value=typeof level==='object'?level.wind:5;}};
}
