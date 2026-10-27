export const WAVE_PARTS=[[.55,.035,.018,.262],[.28,-.022,.052,.161],[.12,.13,.095,.53],[.05,-.28,.17,.87]];
export const strength=level=>typeof level==='object'?level.height*.5:({off:0,calm:.45,moderate:1.25})[level]??0;
export const oceanAngle=level=>typeof level==='object'?(level.direction-level.heading)*Math.PI/180:0;
export const oceanPeriod=level=>typeof level==='object'?8/level.period:1;
export const visualTime=time=>time*.22;
export function surfaceHeight(x,z,time,level){const angle=oceanAngle(level),u=x*Math.cos(angle)+z*Math.sin(angle),v=-x*Math.sin(angle)+z*Math.cos(angle);return strength(level)*WAVE_PARTS.reduce((sum,[a,kx,ky,w])=>sum+a*Math.sin(u*kx-v*ky-visualTime(time)*oceanPeriod(level)*w),0);}
export function hullPose(time,level){
 const h=(x,z)=>surfaceHeight(x,z,time,level),avg=a=>a.reduce((s,v)=>s+v,0)/a.length;
 const xs=[-44,-22,0,22,44],zs=[-10,0,10];
 return {heave:avg(xs.flatMap(x=>zs.map(z=>h(x,z)))),roll:-Math.atan((avg(xs.map(x=>h(x,10)))-avg(xs.map(x=>h(x,-10))))/20),pitch:Math.atan((avg(zs.map(z=>h(44,z)))-avg(zs.map(z=>h(-44,z))))/88)};
}
