// Visual-only deck crew. Five low-poly crew members walk or work on deck while the vessel
// is idle; when the run starts they walk to the accommodation doors and go inside, and
// they come back out after a reset. No effect on the physics model.
const DECK_Y=6.68,WALK=2.4,RUN=9,SIDE=12.6,DOOR_X=-46,DOOR_Z=11.0,BOW=[[49.4,0],[51.0,0]],WAIT_MAX=6;

function person(THREE,{vest,helmet,pants}){
 const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.75,metalness:.05});
 const g=new THREE.Group(),skin=mat(0xd9a882),dark=mat(pants),vestM=mat(vest),strip=new THREE.MeshStandardMaterial({color:0xe8ece9,roughness:.3,metalness:.2,emissive:0x333333});
 const part=(geo,m,x,y,z,parent=g)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;};
 const limb=(x,y,len,w,m)=>{const pivot=new THREE.Group();pivot.position.set(x,y,0);g.add(pivot);part(new THREE.BoxGeometry(w,len,w*1.05),m,0,-len/2,0,pivot);return pivot;};
 const legL=limb(-.19,1.02,1.02,.3,dark),legR=limb(.19,1.02,1.02,.3,dark);
 part(new THREE.BoxGeometry(.24,.12,.4),mat(0x1c1c1c),-.19,.06,.06);part(new THREE.BoxGeometry(.24,.12,.4),mat(0x1c1c1c),.19,.06,.06);
 const torso=part(new THREE.BoxGeometry(.78,.9,.44),vestM,0,1.47,0);
 part(new THREE.BoxGeometry(.8,.09,.46),strip,0,1.36,0);part(new THREE.BoxGeometry(.8,.09,.46),strip,0,1.62,0);
 const armL=limb(-.5,1.86,.82,.2,vestM),armR=limb(.5,1.86,.82,.2,vestM);
 part(new THREE.SphereGeometry(.21,14,10),skin,0,2.13,0);
 const hat=part(new THREE.SphereGeometry(.25,14,8,0,Math.PI*2,0,Math.PI/2),mat(helmet),0,2.19,0);
 part(new THREE.CylinderGeometry(.29,.29,.04,16),mat(helmet),0,2.19,.03);
 return {g,legL,legR,armL,armR,torso,hat};
}

// Each routine is a list of steps: {to:[x,z]} walks, {work:s} does a task, {look:s,face:a} looks around.
const CREW=[
 {side:-1,start:[-30,-SIDE],look:{vest:0xff7a1a,helmet:0xf4f4f0,pants:0x22344d},route:[{to:[4,-SIDE]},{look:2.2,face:Math.PI},{to:[-34,-SIDE]},{look:2.2,face:Math.PI}]},
 {side:1,start:[-20,SIDE],look:{vest:0xf2d22e,helmet:0xff8a1f,pants:0x2c3b2f},route:[{to:[-32,SIDE]},{work:3.2},{to:[-18,SIDE]},{work:3.2},{to:[-4,SIDE]},{work:3.2}]},
 {side:-1,door:'bow',start:[48.2,-4.2],look:{vest:0xff5a3c,helmet:0xf4f4f0,pants:0x1f2a38},route:[{work:4},{look:2,face:Math.PI/2},{to:[48.2,4.2]},{work:3.5},{to:[48.2,-4.2]}]},
 {side:-1,start:[-40.8,-5],look:{vest:0x2f8fdc,helmet:0xffffff,pants:0x1d2733},route:[{look:3,face:Math.PI/2},{to:[-40.8,4.5]},{look:3,face:Math.PI/2},{to:[-40.8,-5]}]},
 {side:1,start:[-52,SIDE],look:{vest:0xff7a1a,helmet:0x2a7de1,pants:0x22344d},route:[{to:[-41,SIDE]},{look:1.8,face:0},{to:[-55,SIDE]},{look:1.8,face:0}]},
 {side:-1,start:[-54,-SIDE],look:{vest:0xf2d22e,helmet:0xf4f4f0,pants:0x22344d},route:[{to:[-41.5,-SIDE]},{look:2,face:Math.PI},{to:[-54,-SIDE]},{look:2,face:Math.PI}]},
 {side:1,start:[-10,SIDE],look:{vest:0xff7a1a,helmet:0xf4f4f0,pants:0x2c3b2f},route:[{work:3.5},{to:[6,SIDE]},{work:3.5},{to:[-10,SIDE]}]},
 {side:1,door:'bow',start:[47.6,6.4],look:{vest:0x2f8fdc,helmet:0xffd23a,pants:0x1d2733},route:[{look:2.5,face:Math.PI/2},{work:3},{to:[48.2,9]},{look:2,face:Math.PI/2},{to:[47.6,6.4]}]},
 {side:1,start:[-60.5,8.6],exit:[[-56.5,11.9]],look:{vest:0xff5a3c,helmet:0xffffff,pants:0x1f2a38},route:[{look:3,face:-Math.PI/2},{to:[-61,5]},{work:3},{to:[-60.5,8.6]}]},
 {side:-1,door:'bow',start:[41.2,-6],exit:[[41.2,-12.6],[48.4,-12.6],[48.4,-1.6]],look:{vest:0xf2d22e,helmet:0x2a7de1,pants:0x22344d},route:[{look:3,face:-Math.PI/2},{to:[41.2,6]},{look:3,face:-Math.PI/2},{to:[41.2,-6]}]}
];

export function createCrew(THREE,ship){
 const group=new THREE.Group();group.name='crew';ship.add(group);
 const crew=CREW.map((c,i)=>{const p=person(THREE,c.look);p.g.position.set(c.start[0],DECK_Y,c.start[1]);p.g.scale.setScalar(1.4);group.add(p.g);
  return {...c,p,mode:'post',step:0,t:0,phase:i*1.3,path:[],heading:0};});
 const doorPath=m=>{if(m.exit)return [...m.exit,...(m.door==='bow'?BOW:[[DOOR_X,m.side*SIDE],[DOOR_X,m.side*DOOR_Z]])].map(p=>[...p]);if(m.door==='bow')return BOW.map(p=>[...p]);const [x,z]=[m.p.g.position.x,m.p.g.position.z],s=m.side*SIDE,path=[];
  if(Math.abs(Math.abs(z)-SIDE)>.3)path.push([x,s]);path.push([DOOR_X,s],[DOOR_X,m.side*DOOR_Z]);return path;};
 const backPath=m=>{if(m.exit){const full=[...m.exit,...(m.door==='bow'?BOW:[[DOOR_X,m.side*SIDE],[DOOR_X,m.side*DOOR_Z]])];return [...full.slice(0,-1).reverse(),m.start].map(p=>[...p]);}if(m.door==='bow')return [[...BOW[0]],[...m.start]];const s=m.side*SIDE,[sx,sz]=m.start;const path=[[DOOR_X,s],[sx,s]];if(Math.abs(Math.abs(sz)-SIDE)>.3)path.push([sx,sz]);return path;};
 const doorPos=m=>m.door==='bow'?BOW[1]:[DOOR_X,m.side*DOOR_Z];
 const pose=(m,walk,work,dt)=>{m.phase+=dt*(walk?6.5:work?3.2:1.2);const s=Math.sin(m.phase);const {legL,legR,armL,armR,torso}=m.p;
  legL.rotation.x=walk?s*.55:0;legR.rotation.x=walk?-s*.55:0;
  armL.rotation.x=walk?-s*.5:work?-1.1+Math.sin(m.phase)*.35:Math.sin(m.phase*.5)*.04;armR.rotation.x=walk?s*.5:work?-1.3+Math.cos(m.phase)*.35:0;
  torso.rotation.x=work?.22:0;m.p.g.position.y=DECK_Y+(walk?Math.abs(s)*.05:0);};
 const turnTo=(m,a,dt)=>{let d=a-m.heading;d=Math.atan2(Math.sin(d),Math.cos(d));m.heading+=d*Math.min(1,dt*7);m.p.g.rotation.y=m.heading;};
 const walkTo=(m,[x,z],dt,speed=WALK)=>{const g=m.p.g.position,dx=x-g.x,dz=z-g.z,d=Math.hypot(dx,dz);if(d<.05){g.x=x;g.z=z;return true;}
  const k=Math.min(d,speed*dt);g.x+=dx/d*k;g.z+=dz/d*k;turnTo(m,Math.atan2(dx,dz),dt);return false;};
 let started=false,pending=null,waited=0;
 const evacuate=()=>{started=true;crew.forEach(m=>{if(m.mode!=='inside'){m.mode='in';m.path=doorPath(m);}});};
 return {
  group,
  onDeck:()=>crew.some(m=>m.mode!=='inside'),
  // Send everyone inside, then call done() (at most WAIT_MAX seconds later).
  evacuate(done){evacuate();pending=done;waited=0;const mine=done;
   // Real-time cap: also fires when the 3D view is not rendering (2D plan, hidden tab, slow GPU).
   setTimeout(()=>{if(pending===mine){pending=null;mine();}},WAIT_MAX*1000);},
  cancel(){pending=null;},
  update(dt,{active,visible}){
   group.visible=visible;
   if(active&&!started)evacuate();
   if(!active&&started&&!pending){started=false;crew.forEach(m=>{m.mode='out';m.p.g.visible=true;const [dx,dz]=doorPos(m);m.p.g.position.set(dx,DECK_Y,dz);m.path=backPath(m);});}
   if(pending&&!crew.some(m=>m.mode!=='inside')){const done=pending;pending=null;done();}
   for(const m of crew){
    if(m.mode==='inside')continue;
    if(m.mode==='in'||m.mode==='out'){
     if(walkTo(m,m.path[0],dt,m.mode==='in'?RUN:WALK))m.path.shift();
     pose(m,true,false,dt*(m.mode==='in'?1.6:1));
     if(!m.path.length){if(m.mode==='in'){m.mode='inside';m.p.g.visible=false;}else{m.mode='post';m.step=0;m.t=0;}}
     continue;}
    const step=m.route[m.step%m.route.length];let walking=false,working=false,done=false;
    if(step.to){walking=true;done=walkTo(m,step.to,dt);}
    else{m.t+=dt;working=!!step.work;if(step.face!==undefined)turnTo(m,step.face,dt);if(step.work)turnTo(m,m.side<0?0:Math.PI,dt);done=m.t>=(step.work??step.look);}
    pose(m,walking,working,dt);
    if(done){m.step++;m.t=0;}
   }
  }
 };
}
