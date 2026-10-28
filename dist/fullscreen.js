// True fullscreen for the 3D/2D simulation view, with a compact HUD so the run can be
// controlled without leaving fullscreen. Mirrors existing controls; no simulation logic here.
const $=s=>document.querySelector(s);
const view=$('#viewBody');
if(view){
 const native=!!(view.requestFullscreen||view.webkitRequestFullscreen);
 const current=()=>document.fullscreenElement||document.webkitFullscreenElement;
 const isOn=()=>current()===view||view.classList.contains('pseudo-fullscreen');
 const hud=document.createElement('div');hud.className='fs-hud';hud.hidden=true;hud.setAttribute('role','toolbar');hud.setAttribute('aria-label','전체화면 시뮬레이션 조작');
 hud.innerHTML=`<div class="fs-brand"><strong>MV HARBOR ONE</strong><span id="fs-status"></span></div>
  <div class="fs-stats"><div><small>하역 기울기</small><b id="fs-heel">0.00°</b></div><div><small>하역 진행</small><b id="fs-progress">0%</b></div><div><small>남은 화물</small><b id="fs-cargo">72 / 72</b></div><div><small>평형수</small><b id="fs-ballast">2,400 t</b></div></div>
  <div class="fs-actions"><button type="button" id="fs-play" class="fs-primary">▶ 시작</button><button type="button" id="fs-reset" title="초기화">↺</button><button type="button" id="fs-exit" title="전체화면 종료 (Esc)">✕ 나가기</button></div>`;
 view.append(hud);
 const btn=document.createElement('button');btn.type='button';btn.id='fullscreenToggle';btn.title='전체화면 (F)';btn.setAttribute('aria-label','전체화면');btn.textContent='⛶';
 $('.view-controls')?.prepend(btn);
 const toolbarBtn=document.createElement('button');toolbarBtn.type='button';toolbarBtn.id='fullscreen-simulation';toolbarBtn.className='outline-btn';toolbarBtn.textContent='전체화면 ⛶';
 const placeToolbar=()=>{if(toolbarBtn.isConnected)return;const expand=$('#expand-simulation'),toolbar=$('.stage-toolbar');if(expand)expand.after(toolbarBtn);else toolbar?.append(toolbarBtn);};placeToolbar();setTimeout(placeToolbar,500);
 const text=id=>$(id)?.textContent?.trim()??'';
 let timer=null;
 const sync=()=>{
  $('#fs-heel').textContent=`${text('#heel')}°`;$('#fs-progress').textContent=`${text('#progress')}%`;$('#fs-cargo').textContent=text('#cargoCount');$('#fs-ballast').textContent=`${text('#ballast')} t`;
  $('#fs-status').textContent=text('#statusPill').replace(/^●\s*/,'');$('#fs-status').classList.toggle('warn',$('#statusPill')?.classList.contains('warn'));
  const play=$('#play');$('#fs-play').textContent=(play?.textContent?.trim()||'▶ 시작').replace('시뮬레이션 ','');$('#fs-play').disabled=!!play?.disabled;
 };
 const toast=$('#toast'),toastHome=toast?.parentElement,toastNext=toast?.nextSibling;
 const refresh=()=>{const on=isOn();if(toast){if(on&&toast.parentElement!==view)view.append(toast);else if(!on&&toast.parentElement===view)toastHome.insertBefore(toast,toastNext);}hud.hidden=!on;document.body.classList.toggle('sim-fullscreen',on);btn.textContent=on?'⤡':'⛶';btn.title=on?'전체화면 종료 (Esc)':'전체화면 (F)';toolbarBtn.textContent=on?'전체화면 종료':'전체화면 ⛶';clearInterval(timer);if(on){sync();timer=setInterval(sync,250);}else{
  // #scene is content-sized; shrink the canvas back to the panel so the renderer re-measures.
  const c=$('#scene canvas');if(c){c.style.width=view.clientWidth+'px';c.style.height=view.clientHeight+'px';}}
  window.dispatchEvent(new Event('resize'));};
 const enter=async()=>{if($('#scene')?.hidden&&$('#plan')?.hidden)$('#view3d')?.click();
  try{if(native){await (view.requestFullscreen?view.requestFullscreen({navigationUI:'hide'}):view.webkitRequestFullscreen());}else throw Error('unsupported');}
  catch{view.classList.add('pseudo-fullscreen');document.documentElement.classList.add('pseudo-fullscreen-lock');}
  refresh();};
 const exit=async()=>{if(view.classList.contains('pseudo-fullscreen')){view.classList.remove('pseudo-fullscreen');document.documentElement.classList.remove('pseudo-fullscreen-lock');}else if(current()){await (document.exitFullscreen?document.exitFullscreen():document.webkitExitFullscreen());}refresh();};
 const toggle=()=>isOn()?exit():enter();
 btn.onclick=toggle;toolbarBtn.onclick=toggle;$('#fs-exit').onclick=exit;
 $('#fs-play').onclick=()=>{$('#play')?.click();sync();};$('#fs-reset').onclick=()=>{$('#reset')?.click();sync();};
 document.addEventListener('fullscreenchange',refresh);document.addEventListener('webkitfullscreenchange',refresh);
 document.addEventListener('keydown',e=>{
  const typing=e.target.closest?.('input,textarea,select,[contenteditable="true"]');
  if(typing||e.ctrlKey||e.metaKey||e.altKey)return;
  if((e.key==='f'||e.key==='F')&&!document.querySelector('dialog[open]')){e.preventDefault();toggle();}
  else if(e.key==='Escape'&&view.classList.contains('pseudo-fullscreen')){e.preventDefault();exit();}
 });
 window.harborFullscreen={enter,exit,toggle,isOn};
}
