export function initPanelNavigation(){
 const $=s=>document.querySelector(s),layout=$('.simulation-layout'),drawer=$('.setup-rail');
 const env=$('.environment-panel'),scenario=$('.scenario-panel'),plan=drawer.querySelector('.input-panel:not(.environment-panel)'),recommendation=$('.recommendation'),decision=$('.decision-panel'),chart=$('.bottom-grid'),comparison=$('.experiment'),log=$('.log-panel');
 const definitions=[['environment','환경 설정','◎',[env]],['placement','적재·탱크 실험','▧',[$('.placement-lab')]],['cargo','하역 설정','▦',[scenario,plan]],['recommendation','운전 추천','↔',[recommendation,decision]],['results','결과 비교','▥',[chart,comparison,log]]];
 const nav=document.createElement('nav');nav.className='workspace-menu';nav.setAttribute('aria-label','시뮬레이션 메뉴');
 const header=document.createElement('div');header.className='drawer-header';header.innerHTML='<div><small>HARBOR TWIN / WORKSPACE</small><h2 id="drawer-title">환경 설정</h2></div><button id="close-panel" class="outline-btn" aria-label="설정 패널 닫기">닫기 ×</button>';
 const body=document.createElement('div');body.className='drawer-content';const buttons=new Map(),views=new Map(),scrollPositions=new Map();
 for(const [key,title,icon,contents] of definitions){const button=document.createElement('button');button.type='button';button.id='menu-'+key;button.className='workspace-menu-button';button.setAttribute('aria-label',title);button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','panel-'+key);button.innerHTML=`<span aria-hidden="true">${icon}</span><strong>${title}</strong>`;
  if(key==='recommendation'){const badge=document.createElement('small');badge.id='recommendation-badge';button.append(badge);}
  const view=document.createElement('section');view.id='panel-'+key;view.dataset.panelView=key;view.className='drawer-view';view.setAttribute('aria-label',title);view.hidden=true;for(const n of contents)if(n)view.append(n);body.append(view);nav.append(button);buttons.set(key,button);views.set(key,view);
 }
 drawer.replaceChildren(header,body);drawer.classList.add('workspace-drawer');drawer.id='workspace-drawer';drawer.setAttribute('role','region');drawer.setAttribute('aria-labelledby','drawer-title');layout.prepend(nav);
 const backdrop=document.createElement('button');backdrop.className='drawer-backdrop';backdrop.type='button';backdrop.setAttribute('aria-label','설정 패널 닫기');backdrop.tabIndex=-1;backdrop.hidden=true;layout.append(backdrop);
 let active=null;
 function resize(){window.dispatchEvent(new Event('resize'));}
 function close(focus=true){if(active)scrollPositions.set(active,body.scrollTop);const prior=active;active=null;drawer.hidden=true;backdrop.hidden=true;document.body.dataset.panel='';for(const b of buttons.values()){b.classList.remove('active');b.setAttribute('aria-expanded','false');}if(focus&&prior)buttons.get(prior).focus({preventScroll:true});resize();}
 function open(key,focus=false){if(!views.has(key)){close(focus);return;}if(active===key&&!drawer.hidden)return;if(document.body.classList.contains('simulation-expanded'))$('#expand-simulation').click();if(active)scrollPositions.set(active,body.scrollTop);active=key;drawer.hidden=false;backdrop.hidden=false;document.body.dataset.panel=key;for(const [id,view]of views)view.hidden=id!==key;for(const[id,b]of buttons){b.classList.toggle('active',id===key);b.setAttribute('aria-expanded',String(id===key));}$('#drawer-title').textContent=definitions.find(d=>d[0]===key)[1];body.scrollTop=scrollPositions.get(key)??0;if(focus)$('#close-panel').focus({preventScroll:true});resize();}
 for(const[key,b]of buttons)b.onclick=()=>active===key?close():open(key);
 $('#close-panel').onclick=()=>close();backdrop.onclick=()=>close();
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active&&!document.querySelector('.tutorial-docked')){e.preventDefault();close();}});
 document.addEventListener('harbor:reveal-panel',e=>{const target=$(e.detail.target),view=target?.closest('[data-panel-view]');if(view)open(view.dataset.panelView);});
 document.addEventListener('harbor:set-panel',e=>e.detail.panel?open(e.detail.panel):close(false));
 $('#expand-simulation').addEventListener('click',()=>{if(document.body.classList.contains('simulation-expanded'))close(false);});
 const updateBadge=()=>{const ready=!$('#approve').disabled;$('#recommendation-badge').textContent=ready?'새 운전안':'';buttons.get('recommendation').classList.toggle('has-recommendation',ready);};new MutationObserver(updateBadge).observe($('#approve'),{attributes:true,attributeFilter:['disabled']});updateBadge();
 close(false);
}
