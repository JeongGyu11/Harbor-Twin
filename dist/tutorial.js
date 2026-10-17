const STORAGE_KEY = 'harbor-twin.tutorial.v4';

export function initTutorial({ pause, captureView, restoreView, showView }) {
  const help = document.querySelector('#help');
  help.title = '튜토리얼 다시 보기';
  help.setAttribute('aria-label', '튜토리얼 다시 보기');
  const launch = document.createElement('button');
  launch.className = 'tutorial-launch';
  launch.textContent = '◈ 시작 가이드';
  launch.type = 'button';
  document.querySelector('.page-title').append(launch);

  const overlay = document.createElement('div');
  overlay.className = 'tutorial-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `<div class="tutorial-shade"></div><div class="tutorial-spotlight"></div>
    <section class="tutorial-card" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-description" tabindex="-1">
      <div class="tutorial-top"><div class="tutorial-dock-title"><span>HARBOR TWIN / GUIDE</span><small>실제 화면과 나란히 보는 사용 안내</small></div><button type="button" class="tutorial-close" aria-label="튜토리얼 닫기">×</button></div>
      <div class="tutorial-art" aria-hidden="true">◈<span>YOUR FIRST VOYAGE</span></div>
      <label class="tutorial-jump-label" for="tutorial-jump">필요한 기능 바로 찾기</label><select id="tutorial-jump" aria-label="튜토리얼 기능 선택"></select><div class="tutorial-step" aria-live="polite"></div><h2 id="tutorial-title"></h2><p id="tutorial-description"></p>
      <ol class="tutorial-instructions"></ol><div class="tutorial-result"></div><div class="tutorial-tip"></div><div class="tutorial-dots" aria-hidden="true"></div>
      <div class="tutorial-actions"><button type="button" class="tutorial-skip">건너뛰기</button><div><button type="button" class="tutorial-back">이전</button><button type="button" class="tutorial-next">다음 →</button></div></div>
      <div class="tutorial-keyboard">← → 단계 이동 <span>·</span> Esc 닫기 <span>·</span> 언제든 시작 가이드로 다시 보기</div>
    </section>`;
  document.body.append(overlay);
  const find = selector => overlay.querySelector(selector);
  const card = find('.tutorial-card');
  const spotlight = find('.tutorial-spotlight');
  const steps = [
    { title: '필수 기능을 차근차근 익혀보세요.', text: '이 웹은 화물을 내릴 때 생기는 배의 기울기와 평형수 조정 효과를 보여줍니다. 화면은 간단하게, 사용 방법은 기능별로 자세히 안내합니다.', instructions: ['평형수(밸러스트)는 선박의 균형을 조절하는 물입니다. 좌현은 배가 앞으로 향할 때 왼쪽, 우현은 오른쪽입니다.', '아래 다음·이전 버튼으로 따라가거나, 위의 기능 선택 메뉴로 필요한 설명에 바로 이동하세요.', '안내 중에는 시뮬레이션이 멈추고 배경 조작이 잠깁니다. 설명을 마치거나 닫은 뒤 직접 조작하세요.'], result: '전체 흐름: 선박 탐색 → 하역 시작 → 평형수 조정 → 효과 비교', tip: '건너뛰기나 ×로 닫아도 언제든 시작 가이드와 ? 버튼에서 다시 볼 수 있습니다. 안내를 마친 뒤에는 재생 버튼을 직접 눌러야 합니다.' },
    { target: '.metric-grid', title: '현재 상태: 세 가지 숫자를 읽어요.', text: '상단 숫자는 하역과 평형수 이송에 따라 함께 갱신됩니다. 먼저 각각의 의미를 알아두세요.', instructions: ['좌우 기울기(°): 배가 옆으로 기운 정도의 절댓값입니다. 0°에 가까울수록 좌우가 수평입니다. 어느 쪽으로 기우는지는 3D 화면과 추천 설명을 함께 보세요.', '평형수 총량(t): 네 탱크에 담긴 물의 합계입니다. 탱크 사이로 물을 옮기므로 총량은 그대로이고 각 탱크의 양이 바뀝니다.', '하역 진행률(%): 처음 72개 중 내린 컨테이너의 비율입니다. 100%면 모든 화물을 내린 상태입니다.'], result: '조정 전후에는 좌우 기울기를, 작업 진행은 하역 진행률을 확인하세요.', tip: '주의 표시는 시연용 기준 1.5°를 넘으면 나타납니다. 시연 기준 내라는 표시는 전체 선박 안전을 뜻하지 않습니다. 추정 GM은 화물의 적재 높이와 탱크 수위로 계산한 초기 복원성 지표이며, 실제 선박 자료의 값은 아닙니다.' },
    { target: '#viewBody', view: ['3d', 'all'], title: '3D 선박: 회전·확대·시점 초기화', text: '3D 화면은 선박 전체와 화물 배치, 기울어지는 방향을 이해하는 용도입니다.', instructions: ['빈 화면이나 선박을 누른 채 드래그하면 보는 각도가 바뀝니다. 모바일에서는 한 손가락으로 드래그하세요.', '마우스 휠 또는 화면 오른쪽 ＋ / − 버튼으로 확대·축소합니다. 모바일에서는 ＋ / − 버튼을 사용하세요.', '⌖ 버튼을 누르면 회전 각도와 확대 배율이 처음 시점으로 돌아옵니다. 하역 진행이나 탱크 수위는 초기화되지 않습니다.'], result: '선박을 여러 방향에서 살펴보며 화물과 탱크의 위치를 파악할 수 있습니다.', tip: '작은 변화를 쉽게 보도록 3D 선박의 기울기를 8배 확대해 표현합니다. 정확한 각도는 상단 숫자를 보세요.' },
    { target: '.deck-selector', view: ['3d', 'all'], title: '층 선택: 필요한 구역만 살펴봐요.', text: '보기 선택은 선박을 보는 범위를 바꾸는 메뉴입니다. 표시 범위를 바꿔도 계산에는 남아 있는 모든 화물과 탱크가 반영됩니다.', instructions: ['전체 선박: 선체와 화물, 탱크를 한 번에 봅니다.', '상부 갑판: 위쪽 두 적재 층을 봅니다. 하부 화물창: 가장 아래 적재 층을 봅니다.', '밸러스트: 네 개의 평형수 탱크를 봅니다. 3D에서는 선체가 반투명해져 내부 탱크를 찾기 쉽습니다.'], result: '3D와 2D 모두 같은 보기 선택을 사용하므로 선택한 구역을 두 방식으로 확인할 수 있습니다. 화물 높이는 추정 무게중심 계산에도 반영됩니다.', tip: '탱크의 선수는 배의 앞쪽, 선미는 뒤쪽입니다. 탱크 이름의 좌현·우현과 선수·선미를 함께 읽으세요.' },
    { target: '.exploded-control', view: ['3d', 'all'], title: '분해 보기: 적재 층을 펼쳐봐요.', text: '분해 보기는 겹쳐 있는 화물의 높이별 배치를 구분하기 위한 시각화 기능입니다.', instructions: ['3D 화면 아래의 분해 보기 체크박스를 켭니다.', '위쪽 적재 층이 위로 떨어져 표시됩니다. 드래그해 층 사이의 위치 관계를 살펴보세요.', '체크를 해제하면 원래 배치로 돌아옵니다. 2D에서 켜면 3D 화면으로 전환됩니다.'], result: '화물의 적재 층을 구분할 수 있고, 시뮬레이션의 무게·하역 순서는 바뀌지 않습니다.', tip: '분해된 높이는 설명을 위한 표현입니다. 실제로 화물이 움직이거나 무게중심 계산이 달라지는 기능이 아닙니다.' },
    { target: '#viewBody', view: ['2d', 'upper'], title: '2D 화물 도면: 무게와 위치 확인', text: '2D 도면 버튼을 누르면 선택 구역을 위에서 내려다본 평면도로 봅니다. 3D 선박 버튼으로 다시 돌아갈 수 있습니다.', instructions: ['보기 선택에서 상부 갑판 또는 하부 화물창을 고릅니다.', '색이 채워진 컨테이너 칸을 클릭하면 화물 번호, 무게(t), 적재 위치가 열립니다. BAY는 길이 방향 구역, ROW는 좌우 줄, TIER는 적재 높이입니다.', '상부 도면은 기본적으로 각 칸의 가장 위에 남은 화물을 표시합니다. 3D에서 특정 화물을 선택하면 해당 화물을 강조합니다. 하역된 빈 칸은 점선입니다.'], result: '하역이 진행되면 같은 데이터에 따라 3D 화물과 2D 도면이 함께 갱신됩니다.', tip: '3D에서 컨테이너를 클릭해도 해당 구역의 2D 도면으로 이동합니다. 상세 창이 열리면 시뮬레이션이 멈추며, 닫은 뒤 재생을 눌러 계속하세요.' },
    { target: '#viewBody', view: ['2d', 'tank'], title: '2D 탱크 도면: 물의 양 확인', text: '밸러스트를 선택한 뒤 2D 도면을 열면 네 탱크의 위치와 채워진 정도를 확인할 수 있습니다.', instructions: ['각 탱크의 숫자는 현재 물의 양 / 용량입니다. 이 모델에서 탱크 한 개의 용량은 1,200 t입니다.', '초록색으로 채워진 길이와 백분율은 탱크가 얼마나 차 있는지 나타냅니다.', '탱크를 클릭하면 현재 평형수, 용량, 채워진 비율이 열립니다. 추천안을 적용하고 재생하면 보내는 탱크는 줄고 받는 탱크는 늘어납니다.'], result: '균형 조정이 어떤 탱크 사이에서 진행되는지 숫자와 도면으로 확인할 수 있습니다.', tip: '탱크 상세 창은 정보 확인용입니다. 수위를 직접 입력하는 기능은 없으며, 추천 운전안으로 물을 이송합니다.' },
    { target: '.scenario-panel', title: '하역 시나리오: 비교할 상황 선택', text: '같은 선박에서 두 가지 하역 순서를 비교할 수 있습니다. 처음에는 기본값인 한쪽 먼저 하역을 사용하세요.', instructions: ['한쪽 먼저 하역: 왼쪽 화물을 우선 내려 좌우 하중 차이가 생기는 상황입니다. 평형수 조정 효과를 보기 쉽습니다.', '양쪽 번갈아 하역: 양쪽 화물을 번갈아 내려 하중 차이를 줄이는 순서입니다.', '시나리오를 바꾸면 진행 중인 하역, 탱크 수위, 그래프가 처음부터 다시 시작됩니다. 현재 결과를 보고 난 뒤 변경하세요.'], result: '하역 순서 자체의 차이와 평형수 조정 효과를 구분해서 관찰할 수 있습니다.', tip: '이 안내에서는 시나리오를 바꾸지 않습니다. 가이드를 닫은 뒤 직접 선택하세요. 자동 조정 체크 상태는 시나리오 변경 후에도 유지됩니다.' },
    { target: '#play', title: '시작·일시정지·재개', text: '선택한 시나리오를 시간에 따라 진행하는 버튼입니다. 하역과 평형수 이송은 같은 시뮬레이션 시간을 사용합니다.', instructions: ['시뮬레이션 시작을 누르면 컨테이너를 순서대로 내리고 상단 기울기와 진행률을 갱신합니다.', '재생 중에는 같은 버튼이 일시정지로 바뀝니다. 누르면 하역과 물의 이송이 모두 멈춥니다. 다시 시작을 누르면 멈춘 지점부터 이어집니다.', '하역이 100%여도 마지막 평형수 이송이 남아 있으면 작업은 계속됩니다. 이때도 일시정지·재개할 수 있습니다. 하역과 조정이 모두 끝난 뒤 다시 시뮬레이션을 누르면 새로 시작합니다.'], result: '버튼 아래 상태 문구가 하역 중, 마지막 평형수 조정 중, 조정 승인 대기, 전체 완료를 구분합니다. 원하는 순간에 멈춰 도면을 살펴볼 수 있습니다.', tip: '처음에는 자동 조정을 끈 채 몇 개의 화물을 내려 기울기를 본 다음, 추천안을 적용해 보세요. 탱크·화물 상세 창과 시작 가이드를 열어도 재생은 멈춥니다.' },
    { target: '.recommendation', title: '수동 승인: 추천안을 읽고 적용', text: '기울기가 생기면 어느 탱크에서 어느 탱크로 물을 옮길지 제안합니다. 추천안은 현재 상태를 기준으로 계산됩니다.', instructions: ['화살표 왼쪽은 물을 보내는 탱크, 오른쪽은 받는 탱크입니다. 화살표 아래의 t는 옮길 물의 양입니다.', '예상 기울기와 소요시간을 확인한 뒤 추천 운전안 적용을 누릅니다. 재생 중이면 이송이 진행되고, 멈춰 있으면 다음 재생부터 진행됩니다.', '이송 중에는 버튼이 비활성화되고 남은 양이 줄어듭니다. 완료하면 현재 상태를 다시 계산합니다. 받는 탱크가 가득 차면 다른 가능한 탱크 조합도 비교합니다.'], result: '각 탱크의 양과 선박 기울기가 점차 변합니다. 하역 100% 뒤에도 추천안이 남으면 먼저 승인하고 재생해 마무리하세요. 추천안 승인은 물을 즉시 옮기는 버튼이 아닙니다.', tip: '버튼이 비활성화된 것은 조정이 필요하지 않거나, 이미 이송 중인 경우입니다. 소요시간은 시뮬레이션 시간 기준입니다. 예상 기울기는 추천 당시 상태 기준이며 이후 하역이 이어지면 실제 결과는 달라질 수 있습니다.' },
    { target: '.auto-label', title: '자동 조정: 이후 추천을 자동 승인', text: '하역이 이어질 때 매번 승인하지 않고 추천안을 적용하는 편의 기능입니다. 수동 방식과 같은 규칙으로 추천합니다.', instructions: ['자동으로 균형 조정을 체크한 뒤 재생하면 새로 발생하는 추천안을 자동으로 승인합니다. 이미 추천안이 있으면 체크하는 즉시 승인합니다.', '해제하면 이후 추천은 직접 승인해야 합니다. 이미 승인된 이송은 계속됩니다. 다만 하중 변화로 이송 방향이 부적절해지거나 수위 제한에 걸리면 이송을 종료하고 다시 평가합니다.', '이송까지 멈추려면 일시정지를 누르세요. 모든 이송과 하역을 취소하고 처음으로 돌아가려면 ↺ 초기화를 사용합니다.'], result: '연속 하역 중에도 탱크 수위와 기울기 변화를 관찰하는 데 집중할 수 있습니다.', tip: '자동 조정은 학습된 AI의 자율운항 기능이 아닙니다. 이 프로토타입에서는 규칙 기반 계산 결과를 자동 승인합니다.' },
    { target: '.chart-panel', title: '그래프: 조정 효과를 정확히 비교', text: '그래프는 같은 화물을 같은 순서로 하역할 때 평형수를 옮긴 경우와 옮기지 않은 경우를 비교합니다.', instructions: ['가로축은 시뮬레이션 진행 시간, 세로축은 부호가 있는 좌우 기울기(°)입니다. 가운데 0선에 가까울수록 좌우가 수평입니다.', '민트색 실선은 현재 조정 상태입니다. 점선은 초기 평형수를 유지한 채 똑같이 하역한 무조정 기준입니다. 두 선이 겹치면 그 시점의 차이가 작다는 뜻입니다.', '기준선보다 민트색 선이 0에 가까우면 그 순간의 기울기가 줄어든 것입니다. 두 선이 반대쪽에 있어도 절댓값을 비교해야 합니다.'], result: '하역 순서가 같을 때 평형수 조정이 기울기에 어떤 차이를 만드는지 확인할 수 있습니다.', tip: '위쪽 좌우 기울기 숫자는 절댓값, 그래프는 방향을 구분하는 부호를 포함합니다. 그래프는 하역 사이의 물 이송과 마지막 조정 완료까지 기록하고, 가로 간격은 실제 가상 시간에 비례합니다. 그래프 아래에서 최대 기울기 비교값도 볼 수 있습니다. 세로 범위는 자동으로 바뀌므로 눈금도 함께 읽으세요. 이 결과가 실제 선박의 검증된 성능을 뜻하지는 않습니다.' },
    { target: '#reset', title: '초기화: 같은 조건으로 다시 실험', text: '처음부터 비교하려면 ↺ 버튼을 사용합니다. 현재 카메라 시점을 되돌리는 ⌖ 버튼과는 역할이 다릅니다.', instructions: ['↺를 누르면 재생이 멈추고 하역한 화물이 모두 복구됩니다. 네 탱크는 각각 600 t, 총 2,400 t로 돌아갑니다.', '진행 중인 이송과 추천, 하역 진행률과 그래프 기록도 초기 상태로 되돌아갑니다. 선택한 하역 시나리오는 유지됩니다.', '조정 전후를 비교하려면 먼저 자동 조정을 끄고 재생한 뒤 그래프를 관찰하세요. 초기화 후 자동 조정을 켜고 같은 시나리오를 다시 재생합니다.'], result: '하역 순서와 초기 상태가 같은 조건에서 조정 여부를 비교할 수 있습니다.', tip: '자동 조정 체크 상태와 화면 보기 선택은 초기화해도 유지됩니다. 다시 실험하기 전에 체크 상태를 꼭 확인하세요.' },
    { target: '#modelInfo', title: '이제 직접 실험할 준비가 됐어요.', text: '추천 시연 순서: 한쪽 먼저 하역 → 재생 → 기울기 확인 → 추천안 적용 → 그래프 비교입니다.', instructions: ['가이드를 닫으면 원래 보던 구역으로 돌아옵니다. 시뮬레이션 시작을 눌러 직접 진행하세요.', '계산 기준이 궁금하면 화면 아래 모델 및 계산 기준을 여세요. 적재 높이·수위에 따른 KG, 고정 KM과 자유표면 보정으로 추정한 GM의 수식·가정을 확인할 수 있습니다. 실제 선형 자료에 따른 완전한 복원성 계산은 아닙니다.', '필요한 기능을 잊었을 때는 시작 가이드를 다시 열고 위의 기능 선택 메뉴로 바로 이동하세요.'], result: '3D·2D 탐색, 하역 제어, 수동·자동 평형수 조정, 결과 비교까지 필수 기능 안내를 마쳤습니다.', tip: '합성 데이터와 단순화된 계산을 사용하는 개념 검증용 웹입니다. 실제 운전·안전 판단에 사용할 수 없으며, 학습된 AI 모델은 아직 적용되지 않았습니다.' }
  ];
  find('#tutorial-jump').innerHTML=steps.map((step,i)=>`<option value="${i}">${String(i+1).padStart(2,'0')}. ${step.title}</option>`).join('');
  find('#tutorial-jump').onchange=e=>{index=Number(e.target.value);render();};
  let index = 0, savedView, savedScroll, savedFocus, active = false, frame = 0;
  const stage = document.querySelector('.app');
  function remember() { try { localStorage.setItem(STORAGE_KEY, 'seen'); } catch {} }
  function revealTarget() {
    const target = steps[index].target && document.querySelector(steps[index].target);
    if (target) target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
  }
  function position() {
    if (!active) return;
    const target = steps[index].target && document.querySelector(steps[index].target);
    find('.tutorial-shade').hidden = true;
    spotlight.hidden = !target;
    if (!target) return;
    const r = target.getBoundingClientRect(), bounds = stage.getBoundingClientRect(), pad = 5;
    const left = Math.max(bounds.left+3,r.left-pad), top = Math.max(bounds.top+3,r.top-pad);
    const right = Math.min(bounds.right-3,r.right+pad), bottom = Math.min(bounds.bottom-3,r.bottom+pad);
    spotlight.hidden = right<=left || bottom<=top;
    Object.assign(spotlight.style,{left:`${left}px`,top:`${top}px`,width:`${Math.max(0,right-left)}px`,height:`${Math.max(0,bottom-top)}px`});
  }
  function schedulePosition() { cancelAnimationFrame(frame); frame=requestAnimationFrame(position); }
  function onResize(){revealTarget();schedulePosition();}
  function render() {
    const step=steps[index];
    if(step.view) showView(...step.view);
    find('.tutorial-art').hidden=!!step.target;
    find('.tutorial-step').textContent=`STEP ${String(index+1).padStart(2,'0')} / ${String(steps.length).padStart(2,'0')}`;
    find('#tutorial-title').textContent=step.title;
    find('#tutorial-description').textContent=step.text;
    find('.tutorial-tip').textContent=step.tip;
    find('.tutorial-instructions').replaceChildren(...step.instructions.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
    find('.tutorial-result').textContent=step.result;
    find('#tutorial-jump').value=String(index);
    card.scrollTop=0;
    find('.tutorial-dots').innerHTML=steps.map((_,i)=>`<i class="${i===index?'current':i<index?'done':''}"></i>`).join('');
    find('.tutorial-back').hidden=index===0;
    find('.tutorial-next').textContent=index===steps.length-1?'직접 시작하기 ✓':index===0?'둘러보기 시작 →':'다음 →';
    find('.tutorial-skip').hidden=index===steps.length-1;
    stage.querySelectorAll('.tutorial-target').forEach(el=>el.classList.remove('tutorial-target'));
    const target=step.target&&document.querySelector(step.target);
    if(target)target.classList.add('tutorial-target');
    revealTarget();
    position();
    find('.tutorial-next').focus({preventScroll:true});
  }
  function open() {
    if(active) return;
    savedFocus=document.activeElement; savedView=captureView(); savedScroll=scrollY;
    pause(); index=0; active=true; overlay.hidden=false;
    document.body.classList.add('tutorial-docked');
    stage.scrollTop=savedScroll;
    document.querySelector('.app').inert=true;
    document.querySelector('.rail')?.setAttribute('inert','');
    document.addEventListener('keydown',onKey,true);
    window.addEventListener('resize',onResize);
    stage.addEventListener('scroll',schedulePosition,{passive:true,capture:true});
    window.addEventListener('scroll',schedulePosition,{passive:true});
    render();
  }
  function close() {
    if(!active)return;
    active=false;overlay.hidden=true;remember();cancelAnimationFrame(frame);
    document.body.classList.remove('tutorial-docked');
    stage.querySelectorAll('.tutorial-target').forEach(el=>el.classList.remove('tutorial-target'));
    document.querySelector('.app').inert=false;
    document.querySelector('.rail')?.removeAttribute('inert');
    document.removeEventListener('keydown',onKey,true);
    window.removeEventListener('resize',onResize);
    stage.removeEventListener('scroll',schedulePosition,true);
    window.removeEventListener('scroll',schedulePosition);
    restoreView(savedView);window.scrollTo({top:savedScroll,behavior:'instant'});
    savedFocus?.focus({preventScroll:true});
  }
  function move(delta) { index=Math.max(0,Math.min(steps.length-1,index+delta));render(); }
  function onKey(e) {
    if(!active)return;
    if(e.target.tagName==='SELECT'&&e.key!=='Tab')return;
    if(['Escape','ArrowRight','ArrowLeft','Tab'].includes(e.key)){
      e.preventDefault();e.stopPropagation();
      if(e.key==='Escape')close();
      else if(e.key==='ArrowRight'){if(index===steps.length-1)close();else move(1);}
      else if(e.key==='ArrowLeft')move(-1);
      else { const controls=[...card.querySelectorAll('button,select')].filter(el=>!el.hidden&&!el.disabled);const current=controls.indexOf(document.activeElement);controls[(current+(e.shiftKey?-1:1)+controls.length)%controls.length].focus(); }
    }
  }
  find('.tutorial-next').onclick=()=>index===steps.length-1?close():move(1);
  find('.tutorial-back').onclick=()=>move(-1);
  find('.tutorial-close').onclick=close;find('.tutorial-skip').onclick=close;
  overlay.addEventListener('wheel',e=>{if(!active||card.contains(e.target))return;e.preventDefault();stage.scrollTop+=e.deltaY;stage.scrollLeft+=e.deltaX;},{passive:false});
  let touchY=null;
  overlay.addEventListener('touchstart',e=>{touchY=active&&!card.contains(e.target)&&e.touches.length===1?e.touches[0].clientY:null;},{passive:true});
  overlay.addEventListener('touchmove',e=>{if(touchY===null||e.touches.length!==1)return;e.preventDefault();const y=e.touches[0].clientY;stage.scrollTop+=touchY-y;touchY=y;},{passive:false});
  overlay.addEventListener('touchend',()=>{touchY=null;});
  overlay.addEventListener('touchcancel',()=>{touchY=null;});
  help.onclick=open;launch.onclick=open;
  let seen=false;try{seen=localStorage.getItem(STORAGE_KEY)==='seen';}catch{}
  if(!seen)requestAnimationFrame(open);
}
