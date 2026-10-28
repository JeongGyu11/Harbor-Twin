import * as THREE from './vendor/three.module.js';
// Procedural sky: gradient atmosphere, sun, drifting fbm clouds, stars at night.
// Visual only. Palettes follow the weather profile and blend smoothly between states.
const PALETTES={
 clear:{zenith:0x2a68ad,horizon:0xb4cfe0,cloud:0xffffff,cloudDark:0x8f9fb2,cover:.22,sun:1,env:1},
 cloud:{zenith:0x66798a,horizon:0xa6b3bc,cloud:0xd9dee2,cloudDark:0x6c7783,cover:.8,sun:.22,env:.75},
 rain:{zenith:0x3e4a55,horizon:0x76838c,cloud:0x96a1aa,cloudDark:0x39434d,cover:.95,sun:.05,env:.5},
 storm:{zenith:0x20272f,horizon:0x4c5761,cloud:0x66717b,cloudDark:0x1b2128,cover:1,sun:0,env:.36},
 snow:{zenith:0x87939d,horizon:0xc6ced3,cloud:0xe2e6e9,cloudDark:0x949ea7,cover:.92,sun:.1,env:.8},
 fog:{zenith:0xa3b0b7,horizon:0xbcc6cb,cloud:0xd6dcdf,cloudDark:0xa6b0b6,cover:.65,sun:.12,env:.75},
 night:{zenith:0x040914,horizon:0x16263a,cloud:0x2a3442,cloudDark:0x0d131b,cover:.2,sun:0,env:.16},
 nightCloud:{zenith:0x080d14,horizon:0x1d2731,cloud:0x262f39,cloudDark:0x0c1117,cover:.9,sun:0,env:.12}
};
export function paletteKey(p){
 if(p.night)return p.cloud||p.rain||p.snow||p.fog?'nightCloud':'night';
 if(p.storm||p.thunder)return 'storm';
 if(p.fog)return 'fog';if(p.snow)return 'snow';if(p.rain)return 'rain';if(p.cloud)return 'cloud';return 'clear';
}
export const SUN_DIRECTION=new THREE.Vector3(-70,62,48).normalize();
const vertexShader=`varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_Position.z=gl_Position.w*.99999;}`;
const fragmentShader=`
uniform vec3 uZenith,uHorizon,uCloud,uCloudDark,uSunDir;uniform float uCover,uSun,uTime,uNight,uFlash;uniform vec2 uWind;
varying vec3 vDir;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 r=mat2(.8,.6,-.6,.8);for(int i=0;i<5;i++){v+=a*noise(p);p=r*p*2.03+11.7;a*=.5;}return v;}
void main(){
 vec3 d=normalize(vDir);float h=d.y;
 vec3 col=mix(uHorizon,uZenith,pow(clamp(h,0.,1.),.55));
 float sd=max(dot(d,uSunDir),0.);
 col+=vec3(1.,.86,.66)*(pow(sd,6.)*.22+pow(sd,48.)*.35)*uSun;
 col+=vec3(1.,.95,.85)*smoothstep(.99935,.99965,sd)*6.*uSun*(1.-uCover*.85);
 if(uNight>.5){vec2 g=floor(d.xz/(abs(h)+.25)*260.);float s=step(.9975,hash(g))*smoothstep(.04,.3,h);col+=vec3(.75,.8,.95)*s*(1.-uCover);}
 if(h>0.){
  vec2 uv=d.xz/(h+.07)*.9+uWind*uTime*.012;
  float n=fbm(uv*1.15);
  float density=smoothstep(1.-uCover-.18,1.-uCover+.32,n)*smoothstep(0.,.14,h);
  float lit=clamp(.55+(n-fbm(uv*1.15+uSunDir.xz*.09))*5.,0.,1.);
  vec3 cloud=mix(uCloudDark,uCloud,lit*.85+.15*smoothstep(.0,.5,h));
  cloud+=vec3(1.,.9,.75)*pow(sd,10.)*.35*uSun;
  col=mix(col,cloud,density*.96);
  col+=vec3(.6,.66,.85)*uFlash*(.35+density*.9);
 }else col=uHorizon;
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export function createSky(renderer,scene){
 const uniforms={uZenith:{value:new THREE.Color()},uHorizon:{value:new THREE.Color()},uCloud:{value:new THREE.Color()},uCloudDark:{value:new THREE.Color()},uSunDir:{value:SUN_DIRECTION.clone()},uCover:{value:.2},uSun:{value:1},uTime:{value:0},uNight:{value:0},uFlash:{value:0},uWind:{value:new THREE.Vector2(1,.3)}};
 const material=new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader,side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false});
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(9000,48,24),material);mesh.name='sky-dome';mesh.renderOrder=-1000;mesh.frustumCulled=false;scene.add(mesh);
 // Separate scene for image-based lighting so ship and sea reflect the current sky.
 const envScene=new THREE.Scene(),envMesh=new THREE.Mesh(mesh.geometry,material);envMesh.scale.setScalar(.1);envScene.add(envMesh);
 const pmrem=new THREE.PMREMGenerator(renderer);let envTarget=null,envKey='',lastEnvAt=-1e9;
 const current={},target={};
 const setTarget=key=>{const p=PALETTES[key];for(const k of ['zenith','horizon','cloud','cloudDark'])target[k]=new THREE.Color(p[k]);target.cover=p.cover;target.sun=p.sun;target.env=p.env;};
 setTarget('clear');for(const k of ['zenith','horizon','cloud','cloudDark'])current[k]=target[k].clone();Object.assign(current,{cover:target.cover,sun:target.sun,env:target.env});
 let key='clear',settled=0;
 const refreshEnvironment=()=>{envTarget?.dispose();envTarget=pmrem.fromScene(envScene,0,.1,2000);scene.environment=envTarget.texture;lastEnvAt=performance.now();};
 const api={mesh,uniforms,get horizon(){return current.horizon},get light(){return current.sun},get envIntensity(){return current.env},
  update(profile,camera,{flash=0,wind=[1,.3],now=performance.now()}={}){
   const nextKey=paletteKey(profile);if(nextKey!==key){key=nextKey;setTarget(key);settled=0;}
   const k=.06;for(const c of ['zenith','horizon','cloud','cloudDark'])current[c].lerp(target[c],k);for(const c of ['cover','sun','env'])current[c]+=(target[c]-current[c])*k;
   uniforms.uZenith.value.copy(current.zenith);uniforms.uHorizon.value.copy(current.horizon);uniforms.uCloud.value.copy(current.cloud);uniforms.uCloudDark.value.copy(current.cloudDark);
   uniforms.uCover.value=current.cover;uniforms.uSun.value=current.sun;uniforms.uNight.value=profile.night?1:0;uniforms.uFlash.value=flash;uniforms.uTime.value=now/1000;uniforms.uWind.value.set(wind[0],wind[1]);
   if(camera)mesh.position.copy(camera.position);
   scene.environmentIntensity=current.env*(1+flash*.6);
   // Re-bake reflections while a weather transition settles, then stop.
   const delta=Math.abs(target.cover-current.cover)+Math.abs(target.env-current.env);
   if(!envTarget||(settled<2&&now-lastEnvAt>700)){refreshEnvironment();if(delta<.01)settled++;}
   envKey=key;return current;
  },dispose(){envTarget?.dispose();pmrem.dispose();material.dispose();mesh.geometry.dispose();scene.remove(mesh);}};
 return api;
}
