// One-time-per-visit control hint over the 3D view. It never blocks the canvas
// (pointer-events: none) and fades out on the first interaction or after a few seconds.
const $=s=>document.querySelector(s);
const scene=$('#scene'),view=$('#viewBody');
if(scene&&view){
 const touch=matchMedia('(pointer: coarse)').matches;
 const mouseIcon=`<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="14" y="6" width="20" height="32" rx="10" fill="none" stroke="currentColor" stroke-width="2.4"/><line x1="24" y1="11" x2="24" y2="18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" class="vh-wheel"/></svg>`;
 const dragIcon=`<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 24h32M8 24l6-6M8 24l6 6M40 24l-6-6M40 24l-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
 const handIcon=`<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="7" fill="currentColor" class="vh-finger"/><circle cx="24" cy="24" r="13" fill="none" stroke="currentColor" stroke-width="2" opacity=".5"/></svg>`;
 const items=touch
  ?[[handIcon,'한 손가락 드래그','회전'],[`<span class="vh-key" style="font-size:14px">+−</span>`,'＋ / − 버튼','확대 · 축소'],[`<span class="vh-key">⛶</span>`,'⛶ 버튼','전체화면']]
  :[[dragIcon,'드래그','회전'],[mouseIcon,'마우스 휠','확대 · 축소'],[`<span class="vh-key">F</span>`,'F 키','전체화면']];
 const hint=document.createElement('div');hint.className='view-hint';hint.setAttribute('role','note');hint.setAttribute('aria-label','3D 화면 조작 방법');
 hint.innerHTML=`<div class="vh-card">${items.map(([icon,how,what])=>`<div class="vh-item"><div class="vh-icon">${icon}</div><div><b>${how}</b><span>${what}</span></div></div>`).join('')}<p class="vh-foot">선박을 누르면 화물·탱크 정보를 볼 수 있어요</p></div>`;
 view.append(hint);
 let hidden=false,timer=null;
 const hide=()=>{if(hidden)return;hidden=true;clearTimeout(timer);hint.classList.add('vh-out');setTimeout(()=>hint.remove(),500);};
 const show=()=>{if(hidden||hint.classList.contains('vh-in'))return;hint.classList.add('vh-in');timer=setTimeout(hide,touch?7000:6500);};
 // Start once the 3D view is actually on screen (not behind the tutorial or scrolled away).
 const io=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting&&e.intersectionRatio>.35)&&!scene.hidden){show();io.disconnect();}},{threshold:[0,.35,.6]});io.observe(view);
 for(const type of ['pointerdown','wheel','touchstart'])scene.addEventListener(type,hide,{passive:true,once:true});
 for(const id of ['#zoomIn','#zoomOut','#resetCamera','#fullscreenToggle','#view2d'])$(id)?.addEventListener('click',hide,{once:true});
 document.addEventListener('keydown',e=>{if(e.key==='f'||e.key==='F')hide();});
}
