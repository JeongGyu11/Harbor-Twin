// Control hint over the 3D view. It never blocks the canvas (pointer-events: none) and stays
// until the user actually operates the 3D view: drag, wheel, pinch, F key or view buttons.
// Clicks elsewhere on the page, plain clicks on the ship and time passing do not hide it.
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
 let hidden=false;
 const hide=()=>{if(hidden)return;hidden=true;hint.classList.add('vh-out');setTimeout(()=>hint.remove(),500);};
 const show=()=>{if(hidden||hint.classList.contains('vh-in'))return;hint.classList.add('vh-in');};
 // Show once the 3D view is actually on screen (not behind the intro, tutorial, or scrolled away).
 const visible=()=>{if(scene.hidden||view.classList.contains('onboard-stage')||document.body.classList.contains('tutorial-docked'))return false;const r=view.getBoundingClientRect(),h=Math.min(innerHeight,r.bottom)-Math.max(0,r.top);return r.height>0&&h>=Math.min(220,r.height*.4);};
 const poll=setInterval(()=>{if(hidden){clearInterval(poll);return;}if(!hint.classList.contains('vh-in')&&visible())show();},400);
 // Hide only on a real camera operation: a drag of a few pixels (not a plain click), wheel or pinch.
 let down=null;
 scene.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};},{passive:true,capture:true});
 window.addEventListener('pointermove',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)hide();},{passive:true,capture:true});
 window.addEventListener('pointerup',()=>{down=null;},{passive:true,capture:true});
 scene.addEventListener('wheel',hide,{passive:true,capture:true});
 scene.addEventListener('touchmove',hide,{passive:true,capture:true});
 for(const id of ['#zoomIn','#zoomOut','#resetCamera','#fullscreenToggle','#fullscreen-simulation'])$(id)?.addEventListener('click',hide);
 document.addEventListener('keydown',e=>{const typing=e.target.closest?.('input,textarea,select,[contenteditable="true"]');if(!typing&&(e.key==='f'||e.key==='F'))hide();});
 // The hint describes the 3D view: keep it out of sight while the 2D plan is open.
 new MutationObserver(()=>{hint.style.visibility=scene.hidden?'hidden':'';if(!scene.hidden)show();}).observe(scene,{attributes:true,attributeFilter:['hidden']});
}
