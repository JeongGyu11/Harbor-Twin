const STORAGE_KEY = 'harbor-twin.tutorial.v30';
const WELCOME_KEY = 'harbor-twin.welcome.v1';

export function initTutorial({ pause, captureView, restoreView, showView }) {
  const help = document.querySelector('#help');
  help.title = '튜토리얼 다시 보기';
  help.setAttribute('aria-label', '튜토리얼 다시 보기');
  const launch = document.createElement('button');
  launch.className = 'tutorial-launch';
  launch.textContent = '◈ 시작 가이드';
  launch.type = 'button';
  document.querySelector('.page-title').append(launch);
  const aiLaunch=document.createElement('button');aiLaunch.className='tutorial-ai-launch';aiLaunch.type='button';aiLaunch.innerHTML='<span class="ai-spark">✦</span> AI 기능 가이드';document.querySelector('.page-title').append(aiLaunch);
  const detailLaunch=document.createElement('button');detailLaunch.className='tutorial-detail-launch';detailLaunch.type='button';detailLaunch.textContent='상세 안내';document.querySelector('.page-title').append(detailLaunch);

  const overlay = document.createElement('div');
  overlay.className = 'tutorial-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `<div class="tutorial-shade"></div><div class="tutorial-spotlight"></div>
    <section class="tutorial-card" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-description" tabindex="-1">
      <div class="tutorial-top"><div class="tutorial-dock-title"><span>HARBOR TWIN / GUIDE</span><small>실제 화면과 나란히 보는 사용 안내</small></div><button type="button" class="tutorial-close" aria-label="튜토리얼 닫기">×</button></div>
      <div class="tutorial-mode-switch" role="group" aria-label="안내 종류"><button type="button" id="guide-core" aria-pressed="true">핵심 5단계</button><button type="button" id="guide-detail" aria-pressed="false">상세 기능 안내</button><button type="button" id="guide-ai" aria-pressed="false">✦ AI 기능</button></div><div class="tutorial-art" aria-hidden="true">◈<span>YOUR FIRST VOYAGE</span></div>
      <label class="tutorial-jump-label" for="tutorial-jump">필요한 기능 바로 찾기</label><select id="tutorial-jump" aria-label="튜토리얼 기능 선택"></select><div class="tutorial-step" aria-live="polite"></div><h2 id="tutorial-title"></h2><p id="tutorial-description"></p>
      <ol class="tutorial-instructions"></ol><div class="tutorial-result"></div><div class="tutorial-tip"></div><div class="tutorial-dots" aria-hidden="true"></div>
      <div class="tutorial-actions"><button type="button" class="tutorial-skip">건너뛰기</button><div><button type="button" class="tutorial-back">이전</button><button type="button" class="tutorial-next">다음 →</button></div></div>
      <div class="tutorial-keyboard">← → 단계 이동 <span>·</span> Esc 닫기 <span>·</span> 언제든 시작 가이드로 다시 보기</div>
    </section>`;
  document.body.append(overlay);
  const find = selector => overlay.querySelector(selector);
  const card = find('.tutorial-card');
  const spotlight = find('.tutorial-spotlight');
  const detailedSteps = [
    {target:'.applied-strip',title:'실제 관측값과 모델 계산값을 구분해요.',text:'적용 조건은 시뮬레이션의 입력 출처입니다. 실제 관측을 적용해도 선박의 기울기까지 실측값이 되는 것은 아닙니다.',instructions:['실제 관측: ASOS의 날씨 코드·기온·시정과 주변 부이의 풍속·풍향·유의파고·주기·파향입니다. 선택 시각, 실제 관측 시각, 수집 시각과 관측소 거리를 구분하세요. 항구 내부 동일 지점 자료는 아닙니다.','모델 계산: 하역 기울기·추정 GM·평형수 상태·추천·합성 순간 기울기와 비교 지표입니다. 선박·화물·탱크의 가정 조건으로 계산하며 실제 선박 센서 측정값이 아닙니다.','시각 연출: 비·눈 입자 수, 바람 추가 물결과 3D 선체 움직임입니다. 관측 근거가 없으면 기본 연출로 표시합니다. 하역 기울기는 보기 쉽게 8배 확대하므로 화면에서 보이는 각도를 숫자로 읽지 마세요.'],result:'관측값은 입력, 계산값은 모델 결과, 입자·선체 움직임은 시각화입니다. 적용 조건과 강수 표현 표시를 함께 확인하세요.',tip:'기온은 정보 표시용입니다. 낮·밤은 선택 시각 6–18시의 간이 구분이며 실제 일출·일몰 계산이 아닙니다. 예보와 사용자 수정 조건도 실제 관측과 구분합니다.'},
    {target:'#model-risk',title:'현재 위험 상태와 원인을 확인해요.',text:'기준 내·주의·기준 초과·계산 범위 밖은 가정 모델의 표시 상태이며 침몰 확률이나 실제 안전 판정이 아닙니다.',instructions:['하역 기울기·파도 합성 순간 기울기·추정 GM·탱크 수량을 함께 확인하세요. 시연 한도80%부터 주의, 초과 시 기준 초과로 표시합니다. GM 주의 구간과 탱크 운전 범위는 판정 기준 보기에 설명합니다.','3D에는 경고색 선체 윤곽과 기울기 방향 화살표가 표시됩니다. 방향은 숫자 기울기에서 계산하며 화면의8배 확대 각도를 위험 판정에 사용하지 않습니다. 방향을 산정할 수 없으면 화살표를 숨깁니다.','GM0.20m 이하, 유효하지 않은 계산값, 가정 용량 밖 수량이면 하역·이송을 중지하고 재생을 막습니다. 입력을 검토해 유효한 조건을 다시 적용하세요. 단순 기준 초과는 관찰을 위해 재생할 수 있으므로 필요하면 직접 일시정지하세요.'],result:'원인과 대응 안내를 읽고 화물·환경·하역 순서 및 가능한 평형수 조정안을 검토하세요.',tip:'침수·부력·GZ 곡선을 계산하는 침몰 모델이 아닙니다. 주의 표시가 없다고 실제 선박이 안전하다는 의미도 아닙니다.'},
    {target:'.placement-lab',title:'적재·탱크 배치 후보를 비교해요.',text:'화물·탱크 배치를 평가하고 실험안 B를 메인 3D 하역의 시작 상태로 적용합니다.',instructions:['BAY는 길이 방향, ROW는 좌우, 높이는 하부·중간·상부입니다. 칸당1–100t을 입력하고 적재·중량 반영 또는 선택 화물 하역을 누릅니다. 하부 적재와 위쪽 우선 하역을 검사합니다.','탱크는 가정 용량0–1200t까지 실험하고, 기존 운전 범위80–1120t과 GM>0.2m·설정 기울기 한도를 확인합니다. 실제 법정 기준이 아닙니다.','후보 검색은 같은 총량을 유지하며 40t 격자와 모멘트 보정점을 검사합니다. 후보의 탱크별 수량과 증감량을 보고 B에 반영하세요. A 저장·JSON 저장으로 비교 조건을 남길 수 있습니다.'],result:'후보를 B에 반영한 뒤 아래 메인 3D 적용 버튼을 누릅니다. 적용 전에는 메인 상태를 유지합니다.',tip:'환경 설정을 바꾼 뒤에는 현재 상태 불러오기로 새 환경을 가져오세요. 관측 환경과 선박 가정 모델은 구분합니다.'},
    {target:'.wind-selection',title:'풍속은 선택 바와 구간 표로 고를 수 있어요.',text:'환경 설정 → 사용자 조건 실험에서 풍속 숫자·슬라이더·표가 서로 동기화됩니다.',instructions:['허용 범위는 0–113.2m/s입니다. 선택 바를 움직이거나 구간 표의 대표 풍속을 누르세요. 현재 구간과 바람 추가 진폭을 바로 확인할 수 있습니다.','7개 구간의 범위와 연출 계수는 공통 설정으로 저장돼 있습니다. 경계에서도 연속적으로 바뀌며 수면과 배는 같은 바람 파형을 사용합니다. 실제 관측 파고·주기는 보존됩니다.','선택한 사용자 풍속은 브라우저에 저장하고 새로고침 때 복원하지만 실험에는 자동 적용하지 않습니다. 사용자 조건 적용 · 초기화를 눌러 반영하세요. 메뉴를 바꾸거나 닫아도 입력값은 유지됩니다.'],result:'구간은 가정 모델의 시각 연출 구분이며 기상특보·태풍 등급이 아닙니다. 상한은 극한 돌풍 기록을 참고한 실험 한도입니다.',tip:'바람 추가 진폭은 관측된 유의파고가 아닙니다. 입력 범위를 벗어나면 적용을 막고 기존 실험 조건을 유지합니다.'},
    {target:'#lab-apply-main',title:'실험안 B를 메인 3D에서 하역해요.',text:'적재 위치·중량·탱크 수량을 메인 화면과 운전 추천·결과 비교에 함께 반영합니다.',instructions:['화물은 적재·중량 반영을 먼저 누릅니다. 탱크 입력은 메인 3D 적용 버튼에서도 함께 반영합니다. 현재 하역 기록과 이송은 초기화됩니다.','실험에 저장된 환경과 파도 위상, 고정 KM을 유지하고 일시정지 상태로 시작합니다. 패널이 닫히면 시작을 눌러 남아 있는 화물만 하역하세요. 빈 칸은 진행률에 포함하지 않습니다.','초기화는 적용한 배치로 돌아갑니다. 72개 기본 화물로 돌아가려면 하역 설정의 합성 예제 복원을 사용하세요. 자동 조정을 켜면 하역 도중 추천 이송도 실행됩니다. 하역 후 잔여 기울기가 있으면 줄일 수 있는 이송까지 마친 뒤 종료합니다. 탱크 한도 등으로 조정이 제한될 수 있습니다.'],result:'화물 개수·기울기·수위·그래프·3D/2D와 3방식 비교가 같은 시작 배치를 사용합니다.',tip:'순차 하역·물 이송의 가정 모델입니다. 실제 선박의 GZ·강도·흘수/트림·침수 안전을 판정하지 않습니다.'},
    {target:'.workspace-menu',title:'왼쪽 메뉴에서 필요한 패널만 열어요.',text:'환경 설정·적재·탱크 실험·하역 설정·운전 추천·결과 비교 중 하나를 누르면 넓은 패널이 열립니다.',instructions:['환경 설정에는 실제 관측 사용과 사용자 조건 실험이 있습니다. 하역 설정에서는 순서·펌프·초기 수량을 바꿀 수 있습니다.','운전 추천에는 현재 추천과 예측 근거가, 결과 비교에는 기울기 그래프·동일 조건 비교·운전 기록이 모여 있습니다. 새 운전안이 있으면 메뉴에 표시됩니다.','같은 메뉴를 다시 누르거나 닫기·Esc로 패널을 접으세요. 입력·조회값·추천·실행 상태는 유지되며 선박 화면이 넓게 보입니다.'],result:'패널 열기·닫기·전환은 시뮬레이션을 초기화하지 않습니다. 적용 버튼을 누를 때만 조건이 바뀝니다.',tip:'시작·일시정지와 현재 적용 조건은 패널 밖에 항상 있습니다. 작은 화면에서는 위쪽 메뉴와 덮는 패널로 바뀝니다.'},
    {target:'.weather-fx-details',view:['3d','all'],title:'풍속에 따라 바다와 날씨 연출이 바뀌어요.',text:'실제 관측 또는 사용자 조건의 풍속·풍향을 적용하면 바람 물결·물보라·선박 수면 추종과 비·눈의 이동이 달라집니다.',instructions:['약한 바람에서는 흰 물결·물보라가 적고, 강한 바람일수록 흰 물결·물보라·공기 흐름 연출이 늘어납니다. 비·눈도 불어오는 풍향과 선수 방향의 상대 각도를 따릅니다.','고급 설정의 시각 시연을 펼치면 현재 연출 풍속과 단계를 확인할 수 있습니다. 단계는 시각 표현용이며 기상특보 등급이 아닙니다.','사용자 조건 실험에서 풍속만 바꿔 적용하면 같은 파고·파주기를 유지하며 바람 차이를 비교할 수 있습니다. 재생하면 바람 흐름이 보이고 일시정지하면 함께 멈춥니다.'],result:'관측 파고·주기는 원본으로 보존하고, 별도 바람 물결 성분을 가정해 수면과 배에 같은 파형으로 적용합니다. 풍속만으로 태풍을 판정하지 않습니다.',tip:'사용자 풍속은 0–113.2m/s입니다. 상한은 WMO의 3초 돌풍 기록을 참고한 극한 실험 한도이며 평균풍속과 다릅니다. 태풍 시연은 관측과 별개입니다.'},
    {target:'.environment-modes',title:'실제 관측과 사용자 실험을 나눠 시작해요.',text:'왼쪽 환경 설정 메뉴를 열어 실제 관측 사용 또는 사용자 조건 실험을 선택합니다. 패널 옆은 선박 화면입니다.',instructions:['실제 관측 사용이 기본입니다. 항구를 선택하고 최신 관측을 확인한 뒤 최신 관측 조회·적용를 누르세요. 과거 자료는 관측 기준에서 과거 날짜·시간 선택으로 바꿉니다.','사용자 조건 실험은 날씨·풍속·풍향·파고·주기·파향·선수 방향을 직접 입력합니다. 관측을 먼저 적용한 뒤 값을 바꾸면 사용자 수정 항목과 원 관측을 기록합니다.','조회한 관측과 현재 시뮬레이션에 적용된 조건은 다릅니다. 초록색 적용 조건에서 현재 자료를 확인하고 선박 화면 위 시뮬레이션 시작을 누르세요.'],result:'값을 편집하거나 모드를 바꿔도 적용 버튼을 누르기 전에는 진행 중 실험을 바꾸지 않습니다.',tip:'관측소·수집 상태·모델 예보·하역 세부 설정은 접힌 상세 메뉴에 있습니다.'},
    {target:'.stage-toolbar',view:['3d','all'],title:'선박 화면을 전체화면으로 크게 봐요.',text:'전체화면 ⛶은 모니터 전체를 선박 화면으로 채웁니다. 왼쪽 설정 패널을 닫아도 선박 화면을 넓게 쓸 수 있습니다.',instructions:['3D는 드래그로 회전하고 휠로 확대합니다. 2D 도면과 기존 층 선택도 그대로 사용할 수 있습니다.','전체화면은 툴바의 전체화면 ⛶ 버튼, 3D 오른쪽 아래 확대·축소 버튼 위의 ⛶ 버튼, 또는 키보드 F 키로 엽니다. 위쪽 조작바에서 하역 기울기·진행률·남은 화물·평형수·위험 상태를 보며 시작·일시정지와 초기화를 할 수 있습니다.','Esc, ✕ 나가기 버튼 또는 F 키로 전체화면을 닫습니다. 운전 추천·결과 비교 메뉴는 전체화면을 닫은 뒤 사용하세요. 비·눈·태풍 시연은 고급 설정의 시각 시연에 있습니다.'],result:'화면 배치만 바뀌며 관측값이나 시뮬레이션 상태는 바뀌지 않습니다. 전체화면을 열고 닫아도 진행 중인 하역은 그대로 이어집니다.',tip:'F 키는 입력칸에 글자를 쓰는 중에는 동작하지 않습니다. 전체화면을 지원하지 않는 브라우저에서는 화면을 가득 채우는 보기로 대신 열립니다.'},
    {target:'.weather-fx-controls',view:['3d','all'],title:'비·눈·안개와 폭풍 표현을 살펴봐요.',text:'환경 설정 → 고급 설정 → 시각 시연는 기본적으로 관측·설정 날씨를 따릅니다. 하늘·구름·조명·바다 반사도 날씨와 낮밤에 맞춰 함께 바뀝니다.',instructions:['맑으면 해와 흩어진 구름, 흐림·비·뇌우일수록 낮고 어두운 구름과 회녹색 바다로 바뀌고, 밤에는 별과 선박의 창문·항해등·갑판 조명이 켜집니다. 낮밤은 관측의 낮/밤 정보를 따릅니다.','비는 바람 방향으로 기울어진 빗줄기와 수면 파문, 눈은 부드러운 입자와 느린 흩날림으로 표현합니다. 실제 시정 자료가 있으면 안개 농도에 반영합니다.','비·눈·안개·번개·뇌우·태풍 시연을 선택하면 시각 효과만 바뀝니다. 관측 출처, 바람·파고 등 물리 조건을 바꾸지 않으며 관측 기반으로 돌아가려면 관측·설정 따라가기를 선택하세요.','번개 섬광 켜기는 기본 꺼짐입니다. 켠 뒤 시뮬레이션을 시작해야 짧은 번개가 나타납니다. 현재일기 코드가 뇌우를 나타내면 관측 모드에서도 뇌우 효과를 사용합니다.'],result:'태풍 시연은 태풍 관측·경보를 의미하지 않습니다. 실제 태풍 여부를 풍속만으로 판정하지 않습니다.',tip:'배경 구름·조명·안개·강수 연출을 개선한 기능입니다. 비는 RN_INT 관측 강수강도, 수치가 없으면 WC 관측 강도 등급을 사용합니다. 눈은 WC 관측 강도 등급으로 입자 수가 바뀝니다. 둘 다 없거나 수동 시연이면 기본 연출이며 선박 화면 위 강수 표현 표시로 구분합니다. 입자 수는 시각 모델이며 선박 응답은 기존 가정 모델입니다.'},
    {target:'.weather-panel',title:'실제 관측은 서버에서 5분마다 수집해요.',text:'웹을 닫아도 실행 중인 서버가 실제 ASOS 날씨와 해양기상부이 자료를 각각 5분마다 수집하고 SQLite에 저장합니다.',instructions:['항구를 선택하면 최신 실제 관측 · 날씨와 해양 패널에 저장된 자료가 자동 표시됩니다. 화면을 다시 열거나 새로고침해도 서버의 최신 저장값을 읽습니다.','날씨는 육상 ASOS, 바람·파도는 주변 부이 관측입니다. 각 관측소의 이름·거리, 실제 관측 시각과 서버 수집 시각을 따로 확인하세요.','5분은 서버 조회 주기입니다. 제공기관의 새 관측이 아직 발표되지 않으면 관측 시각과 값은 같을 수 있습니다. 수집 실패는 마지막 정상 자료와 오류로 표시하며 오래된 자료는 적용하지 않습니다.'],result:'서버 수집과 화면 갱신은 시뮬레이션 조건을 자동으로 바꾸지 않습니다. 모델 예보로 대체하지 않습니다.',tip:'배포 후에도 서버가 계속 실행되고 영속 저장 공간이 유지돼야 합니다. 정적 웹 호스팅만으로는 수집되지 않습니다. 과거 날짜·시간은 선택 시각 관측 조회를 사용하세요.'},
    {target:'.weather-panel',title:'최신 실제 날씨·해양을 함께 적용해요.',text:'항구 선택 → 최신 관측 시각·값 확인 → 최신 관측 조회·적용 → 시뮬레이션 시작 순서로 진행하세요.',instructions:['최신 관측 조회·적용은 서버 저장값을 다시 읽고 유효한 날씨·해양을 함께 적용합니다. 조회만 하려면 항구 선택 후 관측 요약과 상세를 확인하세요.','최신 관측 조회·적용을 누르면 입력란과 적용 출처가 갱신되고 시뮬레이션이 초기화됩니다. 날씨·낮밤·풍속·풍향·파고·파향·주기를 반영합니다.','튜토리얼을 닫고 시뮬레이션 시작을 누르세요. 날씨는 비·눈·안개·조명에, 바람과 파도는 수면·선체 흔들림 및 외란 계산에 반영됩니다. 새 자료를 적용하기 전까지 실험 조건은 고정됩니다.'],result:'적용 버튼을 누르는 시점에 실제 날씨·해양 관측이 120분 이내인지 다시 검사합니다. 수집 시각만 최근이어도 오래된 관측은 적용하지 않습니다. 기온 결측은 기온 미수신으로 표시하며 실제 영하 기온은 보존합니다.',tip:'날씨와 해양의 관측 시각은 다를 수 있습니다. 적용 요약에서 두 시각과 기상청 실제 날씨·해양 관측 출처를 확인하세요. 결측·지연이면 기존 실험을 유지하고 적용을 막습니다. WC20–29는 지난 1시간에 있었지만 현재는 끝난 현상입니다. 관측량만으로 날씨를 분류할 때는 관측량 기반 분류로 따로 표시합니다.'},
    {target:'#selected-observations',title:'선택 시각의 실제 관측을 적용해요.',text:'항구와 한국시간 정각을 선택한 뒤 선택 시각 관측 조회·적용을 누릅니다.',instructions:['정확한 시각 우선, 없으면 앞뒤 1시간 이내 가장 가까운 유효 관측을 사용합니다. 같은 차이면 이전 관측 우선입니다. 미래 시각은 관측으로 대체하지 않습니다.','날씨는 인근 육상 ASOS, 바람·파도는 인근 부이입니다. 각각 실제 관측 시각·선택 시각과의 차이·관측소 거리와 값을 확인하세요.','날씨·해양 자료가 모두 있으면 통합 적용하고 실험을 초기화합니다. 선택 조건과 원 관측은 결과 JSON에 남습니다.'],result:'한 항목이라도 없으면 자동 통합 적용하지 않습니다. 해양만 적용은 별도 버튼이며 날씨를 실제 관측으로 표시하지 않습니다.',tip:'날씨 HTTP 403이면 API허브 지상관측 → ASOS 시간자료 kma_sfctm3.php 활용신청이 필요합니다. 모델 예보·현재 저장값으로 몰래 대체하지 않습니다.'},
    {target:'#observation-panel',title:'실제 센서 관측을 조회해요.',text:'고급 설정 → 개별 해양 관측에서 항구를 확인하고 서버 저장 관측 새로고침을 누릅니다. 인증키와 로컬 중계 서버가 필요합니다.',instructions:['공식 해양기상부이 목록의 좌표로 가장 가까운 지점을 찾고 관측소명·직선 거리·측정 시각·조회 시각·지연을 표시합니다.','센서 관측 적용으로 바람과 파도 측정값을 고정해 실험합니다. 날씨 코드는 제공되지 않아 입력한 맑음·비 등은 유지됩니다.','관측 지연 120분·거리 150 km 제한을 넘거나 필수 값이 없으면 적용하지 않습니다. 서버가 웹 접속 없이 5분마다 수집·저장합니다. 웹은 최신 저장값을 표시하고 화면 자동 갱신은 실험 조건을 덮어쓰지 않습니다.'],result:'인증 전에는 관측소나 측정값을 만들지 않고 연결 대기를 표시합니다.',tip:'기상청 API허브에서 해양기상부이·지점정보 API를 신청하고 인증키를 서버에 설정하세요. 항구 내부 관측이나 실제 선박 안전 판정이 아닙니다.'},
    {target:'.forecast-details',title:'예보를 자동으로 갱신해요.',text:'자동 갱신을 켜고 5·15·30분 주기와 기준 시각을 선택합니다. 기본은 15분마다 현재 한국시간의 예보 조회입니다.',instructions:['현재 시간 따라가기는 매 조회 시 현재 한국시간 정각을 사용합니다. 선택 시각 유지는 지정한 시각의 예보를 다시 조회합니다.','새 결과는 자동 조회 상태에 표시되며 진행 중 실험이나 직접 수정한 입력을 덮어쓰지 않습니다. 새 예보 적용·초기화를 눌러 반영하세요.','조회 실패 시 기존 조건을 유지하고 다음 주기에 재시도합니다. 페이지가 열려 있어야 하며 백그라운드에서는 갱신이 늦어질 수 있습니다.'],result:'모델 예보를 자동 조회하는 기능이며 실시간 센서 스트림은 아닙니다.',tip:'주기는 웹의 조회 간격입니다. 제공기관의 예보 생산 주기와 다르므로 조회값이 같을 수 있습니다.'},
    {target:'.forecast-details',title:'위치·날짜·시간으로 예보를 조회해요.',text:'부산 북항·신항, 인천·광양·평택·당진·포항 영일만·울산항 인근 해역 중 항구를 선택하고 한국시간을 지정합니다.',instructions:['모델 예보 조회·적용을 누르면 조회와 시뮬레이션 적용이 한 번에 이루어집니다. 현재 시각 버튼으로 지금 시각을 선택할 수 있습니다. 현재 화면은 모델 예보 조회·적용 버튼 하나로 조회와 적용을 처리합니다. API 제공 범위 밖이거나 해양 값이 없으면 오류를 안내합니다.','사용자 조건 실험에서 날짜·시간을 정한 뒤 고급 설정 → 모델 예보 → 모델 예보 조회·적용을 누르세요. 성공하면 초기화하며 모델 예보 출처로 표시합니다.','좌표와 시각은 예보 서비스로 전송됩니다. 해양 격자 좌표와 요청 좌표는 다를 수 있으며 저장 결과에 함께 남습니다.'],result:'실시간 관측이 아닌 모델 예보입니다. 예보 연결 자체는 AI 구현이 아닙니다.',tip:'모든 위치의 날짜·시간 입력은 한국시간입니다. 다른 나라의 현지 시각으로 해석하지 않습니다.'},
    {target:'.manual-mode',title:'날씨·바람·파도를 직접 바꿔요.',text:'예보 없이 직접 입력하거나 불러온 예보 일부를 수정할 수 있습니다.',instructions:['날씨, 풍속·풍향, 유의파고·파주기·파향, 선수 방향을 지정하세요. 방향은 북쪽 0°, 동쪽 90°이고 바람·파도가 오는 방향입니다.','환경 적용은 초기화 후 그 시각의 환경을 고정합니다. 수정값은 사용자 변경으로 구분되며 원래 예보도 저장됩니다.','수면 높이·방향·주기와 선체 시각 움직임, 조명·안개·비·눈 표현 및 합성 외란 지표에 반영됩니다. 수면과 지표는 별도 가정 모델입니다.'],result:'비교 실험은 세 방식에 같은 환경을 적용하고 조건·결과 JSON에 함께 저장합니다.',tip:'환경 해제 시 기존 파도 세기로 돌아갑니다. 현재 추천은 알려진 하역 성분에만 반응하며 실제 바람 하중·선체 동역학은 미구현입니다.'},
    { target: '#viewBody', view: ['3d','all'], title: '수면을 따라 배가 움직여요.', text: '파도를 잔잔함 또는 보통으로 적용하고 안내를 닫은 뒤 재생하면 확인할 수 있습니다.', instructions: ['선체 주변 15개 지점의 수면 높이를 평균해 배가 위아래로 움직이고 좌우·앞뒤로 기울어집니다.', '짧은 잔물결 하나마다 배가 크게 흔들리지 않도록 선체 전체의 수면을 함께 사용합니다. 물과 배는 같은 시각 파형을 공유합니다.', '일시정지하면 물과 배가 함께 멈추고 초기화하면 같은 파형의 처음으로 돌아갑니다. 파도 끄기에서는 수면 추종 움직임이 없습니다.'], result: '하역 기울기만 8배 확대하며 수면 추종 움직임은 별도로 더합니다.', tip: '부력·관성·감쇠를 푸는 동역학 모델은 아닙니다. 그래프의 순간 기울기는 별도의 합성 외란 모델이므로 3D 자세와 일치하지 않습니다.' },
    { target: '#viewBody', view: ['3d','all'], title: '물결·반사·잔물결을 살펴봐요.', text: '큰 물결 위에 잔물결을 겹치고 하늘과 빛의 반사를 더한 수면입니다.', instructions: ['여러 방향으로 진행하는 물결이 수면 높이를 바꾸고 미세한 잔물결은 반사광을 잘게 나눕니다.', '파봉에는 은은한 포말을 표시합니다. 카메라를 드래그해 다른 각도의 물빛과 반사를 확인하세요.', '잔잔함과 보통은 수면의 시각적 높이도 달라집니다. 파도 세기 숫자는 그래프용 합성 기울기이며 실제 파고(m)가 아닙니다.'], result: '3D 수면은 가상 시간에 연동된 시각 연출입니다. 날씨·해양 예보는 환경 설정에서 조회해 적용할 수 있습니다.', tip: '반사는 절차적으로 만든 하늘 환경입니다. 실제 선박 반사·굴절·해양 유체역학은 계산하지 않습니다.' },
    { target: '#waveLevel', title: '파도 세기를 선택해요.', text: '하역 계획 및 운전 조건 설정을 펼쳐 파도 끄기·잔잔함·보통 중 선택하고 설정 적용을 누르세요.', instructions: ['설정 적용은 가상 시간을 0으로 초기화합니다. 파도는 가상 시간에 맞춰 재생되므로 일시정지하면 함께 멈춥니다.', '잔잔함은 0.25°, 보통은 0.75°의 진폭 상한을 갖는 합성 흔들림입니다. 실제 파고를 뜻하지 않습니다.', '3D 선박은 수면 15개 지점을 따라 상하·좌우·앞뒤로 움직입니다. 하역 기울기만 8배 확대합니다. 물 표면도 다중 파형·빛 반사·파봉 포말로 출렁입니다. 수면은 시각 연출이며 실제 선박 동역학은 계산하지 않습니다.'], result: '같은 세기와 가상 시간이면 항상 같은 파도가 재현됩니다.', tip: '파도 설정은 입력 영역을 펼친 뒤 변경할 수 있습니다.' },
    { target: '.wave-readout', title: '순간 흔들림과 하역 기울기를 구분해요.', text: '순간 기울기는 하역·평형수에 의한 기울기와 파도 성분의 합입니다.', instructions: ['상단에서 부호가 있는 순간 기울기와 파도 성분을 확인하세요. +는 우현, −는 좌현입니다.', '하역 기울기 숫자는 평형수 조절을 반영한 정적 기울기의 절댓값입니다. 그래프의 파란 선은 순간 기울기, 민트 선은 하역 기울기입니다.', '추천은 알려진 하역 성분에만 반응하므로 파도 때문에 펌프를 반복 작동시키지 않습니다. AI로 실측 신호를 분리한 결과는 아닙니다.'], result: '시연 기준 초과 여부는 하역과 순간 지표를 따로 확인하세요.', tip: '가상 파도는 실제 선박의 공진·감쇠·파고 응답을 모델링하지 않습니다.' },
    { target: '.experiment', title: '같은 파도에서 운전 방식을 비교해요.', text: '세 방식 모두 같은 합성 파도와 위상, 같은 관측 시간 구간을 사용합니다.', instructions: ['파도 세기를 적용한 뒤 3가지 방식 비교 실행을 누르세요.', '최대 하역 기울기와 최대 순간 기울기, 각각의 기준 초과 시간을 구분해 비교하세요.', '순간 지표의 비교 구간은 화물 수 × 하역 간격입니다. 이송량·펌프 지표는 마지막 조정이 끝날 때까지 계산합니다. JSON 저장에 파도 조건과 결과가 함께 남습니다.'], result: '물 이송량과 시작 횟수는 파도 세기만 바꿔도 동일합니다. 알려진 성분 분리로 파도를 제어 입력에서 제외하기 때문입니다.', tip: '하역 상태는 1초 간격, 파도 평가는 0.25초 간격입니다. 실측·학습형 AI 검증은 향후 범위입니다.' },
    { target: '.input-panel', title: '운전 조건과 하역 계획을 확인해요.', text: '평형수 운전 담당자가 하역 계획을 검토하는 업무를 시연합니다.', instructions: ['하역 계획 및 운전 조건 설정을 펼쳐 하역 간격, 펌프 유량, 시연 기준과 탱크 초기 수량을 입력하세요.', '설정 적용을 누르면 현재 시뮬레이션이 초기화되고 비교 실험의 조건도 바뀝니다.', '예제 CSV를 받아 중량과 순서를 수정할 수 있습니다. 72개 ID와 위쪽부터 하역하는 순서를 지켜야 합니다.'], result: '현재 구현은 합성/사용자 입력과 물리 모델입니다. 학습형 AI와 실제 설비 연동은 향후 개발 범위입니다.', tip: '합성 예제를 먼저 사용해 핵심 흐름을 확인하세요.' },
    { target: '.decision-panel', title: '앞으로 60초의 대안을 비교해요.', text: '예정 하역과 물 이송시간을 함께 고려하는 예측입니다.', instructions: ['점선은 현재 수위 유지, 실선은 추천 운전안의 기울기 예측입니다. 승인된 이송 중에는 점선에도 진행 중 이송이 반영됩니다.', '대안 표에서 예측 최대 기울기, 기준 초과 시간과 이송량을 비교하세요.', '추천 이유를 확인한 뒤 추천 운전안 적용을 누르세요. 시연 자동 승인은 실제 펌프를 제어하지 않습니다.'], result: '현재 기울기에 반응하는 규칙 방식과 60초 예측 탐색 방식을 입력 설정에서 선택할 수 있습니다.', tip: '예측 방식이 항상 더 좋은 결과를 내는 것은 아닙니다. 전체 하역의 성과는 비교 실험으로 확인하세요.' },
    { target: '.experiment', title: '같은 조건으로 성과를 검증해요.', text: '비교 실행은 화면 시뮬레이션과 별도로 전체 하역을 계산합니다.', instructions: ['3가지 방식 비교 실행을 누르면 무조정, 현재 상태 규칙, 60초 예측 탐색을 같은 입력에서 실행합니다.', '펌프 가동시간은 누적 이송량 ÷ 설정 유량입니다. 예: 412.5t ÷ 2.5t/s = 165.00초입니다. 짧은 부분 이송도 이송량에 맞춰 계산하며 시작 횟수와 구분합니다.', '최대 기울기·기준 초과시간은 표본 계산값입니다(하역 1초·파동 0.25초). 화면은 반올림 값이며 JSON에는 원본 소수점값을 저장합니다. 조건·결과 JSON 저장으로 입력과 결과를 남기세요. 운전 승인 및 재평가 기록에서는 화면 시뮬레이션의 사건을 확인합니다.'], result: '합성 모델에서 재현 가능한 비교이며 실제 현장 성과를 입증한 자료는 아닙니다.', tip: '시연 기준은 법정 기준이 아니며 비용·전력 절감률은 계산하지 않습니다.' },
    { title: '필수 기능을 차근차근 익혀보세요.', text: '이 웹은 화물을 내릴 때 생기는 배의 기울기와 평형수 조정 효과를 보여줍니다. 화면은 간단하게, 사용 방법은 기능별로 자세히 안내합니다.', instructions: ['평형수(밸러스트)는 선박의 균형을 조절하는 물입니다. 좌현은 배가 앞으로 향할 때 왼쪽, 우현은 오른쪽입니다.', '아래 다음·이전 버튼으로 따라가거나, 위의 기능 선택 메뉴로 필요한 설명에 바로 이동하세요.', '안내 중에는 시뮬레이션이 멈추고 배경 조작이 잠깁니다. 설명을 마치거나 닫은 뒤 직접 조작하세요.'], result: '전체 흐름: 선박 탐색 → 하역 시작 → 평형수 조정 → 효과 비교', tip: '건너뛰기나 ×로 닫아도 언제든 위쪽 시작 가이드·상세 안내 버튼에서 다시 볼 수 있습니다. 안내를 마친 뒤에는 재생 버튼을 직접 눌러야 합니다.' },
    { target: '.metric-grid', title: '현재 상태: 세 가지 숫자를 읽어요.', text: '상단 숫자는 하역과 평형수 이송에 따라 함께 갱신됩니다. 먼저 각각의 의미를 알아두세요.', instructions: ['좌우 기울기(°): 배가 옆으로 기운 정도의 절댓값입니다. 0°에 가까울수록 좌우가 수평입니다. 어느 쪽으로 기우는지는 3D 화면과 추천 설명을 함께 보세요.', '평형수 총량(t): 네 탱크에 담긴 물의 합계입니다. 탱크 사이로 물을 옮기므로 총량은 그대로이고 각 탱크의 양이 바뀝니다.', '하역 진행률(%): 처음 72개 중 내린 컨테이너의 비율입니다. 100%면 모든 화물을 내린 상태입니다.'], result: '조정 전후에는 좌우 기울기를, 작업 진행은 하역 진행률을 확인하세요.', tip: '주의 표시는 시연용 기준 1.5°를 넘으면 나타납니다. 시연 기준 내라는 표시는 전체 선박 안전을 뜻하지 않습니다. 추정 GM은 화물의 적재 높이와 탱크 수위로 계산한 초기 복원성 지표이며, 실제 선박 자료의 값은 아닙니다.' },
    { target: '#viewBody', view: ['3d', 'all'], title: '3D 선박: 회전·확대·시점 초기화', text: '3D 화면은 선박 전체와 화물 배치, 기울어지는 방향을 이해하는 용도입니다.', instructions: ['빈 화면이나 선박을 누른 채 드래그하면 보는 각도가 바뀝니다. 모바일에서는 한 손가락으로 드래그하세요.', '마우스 휠 또는 화면 오른쪽 ＋ / − 버튼으로 확대·축소합니다. 모바일에서는 ＋ / − 버튼을 사용하세요.', '⌖ 버튼을 누르면 회전 각도와 확대 배율이 처음 시점으로 돌아옵니다. 하역 진행이나 탱크 수위는 초기화되지 않습니다.', '맨 위 ⛶ 버튼(또는 F 키)은 선박 화면을 전체화면으로 엽니다. 다시 누르거나 Esc를 누르면 돌아옵니다.'], result: '선박을 여러 방향에서 살펴보며 화물과 탱크의 위치를 파악할 수 있습니다.', tip: '작은 변화를 쉽게 보도록 하역 기울기만 8배 확대하며 수면 추종 움직임은 별도로 더합니다. 상단 지표와 3D 자세는 서로 다른 표현입니다.' },
    { target: '.deck-selector', view: ['3d', 'all'], title: '층 선택: 필요한 구역만 살펴봐요.', text: '보기 선택은 선박을 보는 범위를 바꾸는 메뉴입니다. 표시 범위를 바꿔도 계산에는 남아 있는 모든 화물과 탱크가 반영됩니다.', instructions: ['전체 선박: 선체와 화물, 탱크를 한 번에 봅니다.', '상부 갑판: 위쪽 두 적재 층을 봅니다. 하부 화물창: 가장 아래 적재 층을 봅니다.', '밸러스트: 네 개의 평형수 탱크를 봅니다. 3D에서는 선체가 반투명해져 내부 탱크를 찾기 쉽습니다.'], result: '3D와 2D 모두 같은 보기 선택을 사용하므로 선택한 구역을 두 방식으로 확인할 수 있습니다. 화물 높이는 추정 무게중심 계산에도 반영됩니다.', tip: '탱크의 선수는 배의 앞쪽, 선미는 뒤쪽입니다. 탱크 이름의 좌현·우현과 선수·선미를 함께 읽으세요.' },
    { target: '.exploded-control', view: ['3d', 'all'], title: '분해 보기: 적재 층을 펼쳐봐요.', text: '분해 보기는 겹쳐 있는 화물의 높이별 배치를 구분하기 위한 시각화 기능입니다.', instructions: ['3D 화면 아래의 분해 보기 체크박스를 켭니다.', '위쪽 적재 층이 위로 떨어져 표시됩니다. 드래그해 층 사이의 위치 관계를 살펴보세요.', '체크를 해제하면 원래 배치로 돌아옵니다. 2D에서 켜면 3D 화면으로 전환됩니다.'], result: '화물의 적재 층을 구분할 수 있고, 시뮬레이션의 무게·하역 순서는 바뀌지 않습니다.', tip: '분해된 높이는 설명을 위한 표현입니다. 실제로 화물이 움직이거나 무게중심 계산이 달라지는 기능이 아닙니다.' },
    { target: '#viewBody', view: ['2d', 'upper'], title: '2D 화물 도면: 무게와 위치 확인', text: '2D 도면 버튼을 누르면 선택 구역을 위에서 내려다본 평면도로 봅니다. 3D 선박 버튼으로 다시 돌아갈 수 있습니다.', instructions: ['보기 선택에서 상부 갑판 또는 하부 화물창을 고릅니다.', '색이 채워진 컨테이너 칸을 클릭하면 화물 번호, 무게(t), 적재 위치가 열립니다. BAY는 길이 방향 구역, ROW는 좌우 줄, TIER는 적재 높이입니다.', '상부 도면은 기본적으로 각 칸의 가장 위에 남은 화물을 표시합니다. 3D에서 특정 화물을 선택하면 해당 화물을 강조합니다. 하역된 빈 칸은 점선입니다.'], result: '하역이 진행되면 같은 데이터에 따라 3D 화물과 2D 도면이 함께 갱신됩니다.', tip: '3D에서 컨테이너를 클릭해도 해당 구역의 2D 도면으로 이동합니다. 상세 창이 열리면 시뮬레이션이 멈추며, 닫은 뒤 재생을 눌러 계속하세요.' },
    { target: '#viewBody', view: ['2d', 'tank'], title: '2D 탱크 도면: 물의 양 확인', text: '밸러스트를 선택한 뒤 2D 도면을 열면 네 탱크의 위치와 채워진 정도를 확인할 수 있습니다.', instructions: ['각 탱크의 숫자는 현재 물의 양 / 용량입니다. 이 모델에서 탱크 한 개의 용량은 1,200 t입니다.', '초록색으로 채워진 길이와 백분율은 탱크가 얼마나 차 있는지 나타냅니다.', '탱크를 클릭하면 현재 평형수, 용량, 채워진 비율이 열립니다. 추천안을 적용하고 재생하면 보내는 탱크는 줄고 받는 탱크는 늘어납니다.'], result: '균형 조정이 어떤 탱크 사이에서 진행되는지 숫자와 도면으로 확인할 수 있습니다.', tip: '탱크 상세 창은 정보 확인용입니다. 수위를 직접 입력하는 기능은 없으며, 추천 운전안으로 물을 이송합니다.' },
    { target: '.scenario-panel', title: '하역 시나리오: 비교할 상황 선택', text: '같은 선박에서 두 가지 하역 순서를 비교할 수 있습니다. 기본값은 양쪽 번갈아 하역입니다. 한쪽 먼저 하역과 비교할 수 있습니다.', instructions: ['한쪽 먼저 하역: 왼쪽 화물을 우선 내려 좌우 하중 차이가 생기는 상황입니다. 평형수 조정 효과를 보기 쉽습니다.', '양쪽 번갈아 하역: 양쪽 화물을 번갈아 내려 하중 차이를 줄이는 순서입니다.', '시나리오를 바꾸면 진행 중인 하역, 탱크 수위, 그래프가 처음부터 다시 시작됩니다. 현재 결과를 보고 난 뒤 변경하세요.'], result: '하역 순서 자체의 차이와 평형수 조정 효과를 구분해서 관찰할 수 있습니다.', tip: '이 안내에서는 시나리오를 바꾸지 않습니다. 가이드를 닫은 뒤 직접 선택하세요. 자동 조정 체크 상태는 시나리오 변경 후에도 유지됩니다.' },
    { target: '#play', title: '시작·일시정지·재개', text: '선택한 시나리오를 시간에 따라 진행하는 버튼입니다. 하역과 평형수 이송은 같은 시뮬레이션 시간을 사용합니다.', instructions: ['시뮬레이션 시작을 누르면 컨테이너를 순서대로 내리고 상단 기울기와 진행률을 갱신합니다.', '재생 중에는 같은 버튼이 일시정지로 바뀝니다. 누르면 하역과 물의 이송이 모두 멈춥니다. 다시 시작을 누르면 멈춘 지점부터 이어집니다.', '하역이 100%여도 마지막 평형수 이송이 남아 있으면 작업은 계속됩니다. 이때도 일시정지·재개할 수 있습니다. 하역과 조정이 모두 끝난 뒤 다시 시뮬레이션을 누르면 새로 시작합니다.'], result: '버튼 아래 상태 문구가 하역 중, 마지막 평형수 조정 중, 조정 승인 대기, 전체 완료를 구분합니다. 원하는 순간에 멈춰 도면을 살펴볼 수 있습니다.', tip: '처음에는 자동 조정을 끈 채 몇 개의 화물을 내려 기울기를 본 다음, 추천안을 적용해 보세요. 탱크·화물 상세 창과 시작 가이드를 열어도 재생은 멈춥니다.' },
    { target: '.recommendation', title: '수동 승인: 추천안을 읽고 적용', text: '기울기가 생기면 어느 탱크에서 어느 탱크로 물을 옮길지 제안합니다. 추천안은 현재 상태를 기준으로 계산됩니다.', instructions: ['화살표 왼쪽은 물을 보내는 탱크, 오른쪽은 받는 탱크입니다. 화살표 아래의 t는 옮길 물의 양입니다.', '예상 기울기와 소요시간을 확인한 뒤 추천 운전안 적용을 누릅니다. 재생 중이면 이송이 진행되고, 멈춰 있으면 다음 재생부터 진행됩니다.', '이송 중에는 버튼이 비활성화되고 남은 양이 줄어듭니다. 완료하면 현재 상태를 다시 계산합니다. 받는 탱크가 가득 차면 다른 가능한 탱크 조합도 비교합니다.'], result: '각 탱크의 양과 선박 기울기가 점차 변합니다. 하역 100% 뒤에도 추천안이 남으면 먼저 승인하고 재생해 마무리하세요. 추천안 승인은 물을 즉시 옮기는 버튼이 아닙니다.', tip: '버튼이 비활성화된 것은 조정이 필요하지 않거나, 이미 이송 중인 경우입니다. 소요시간은 시뮬레이션 시간 기준입니다. 예상 기울기는 추천 당시 상태 기준이며 이후 하역이 이어지면 실제 결과는 달라질 수 있습니다.' },
    { target: '.auto-label', title: '자동 조정: 하역 후 남은 기울기까지 조정', text: '운전 추천에서 시연 자동 승인을 켜고 재생하면 선택한 추천 방식으로 평형수 이송을 실행합니다.', instructions: ['체크하면 현재 추천도 승인됩니다. 일시정지 상태에서는 물이 움직이지 않으므로 시작 버튼을 눌러야 합니다.', '화물을 하나 내릴 때마다 추천을 다시 평가합니다. 하역 100%는 화물 하역의 완료이며 평형수 조정의 완료와 다릅니다. 하역 100% · 마지막 평형수 조정 중이면 재생을 유지하세요.', '예측 방식은 하역 후에도 남은 기울기를 줄이는 유효 후보를 평가합니다. 하역과 평형수 조정 모두 완료 표시를 확인하세요. 해제하면 이후 추천은 수동 승인하며 이미 승인된 이송은 계속됩니다.'], result: '하역이 끝난 뒤의 이송과 기울기 변화까지 그래프에 기록합니다. 일시정지는 이송도 멈추고 다시 시작하면 이어집니다.', tip: '정확히 0°를 보장하지 않습니다. 모델 조정 기준·최소 이송량·탱크 수위·GM 제약이 적용되며 파도에 의한 순간 기울기는 별개입니다. 실제 설비 제어가 아닙니다.' },
    { target: '.chart-panel', title: '그래프: 조정 효과를 정확히 비교', text: '그래프는 같은 화물을 같은 순서로 하역할 때 평형수를 옮긴 경우와 옮기지 않은 경우를 비교합니다.', instructions: ['가로축은 시뮬레이션 진행 시간, 세로축은 부호가 있는 좌우 기울기(°)입니다. 가운데 0선에 가까울수록 좌우가 수평입니다.', '민트색 실선은 현재 조정 상태입니다. 점선은 초기 평형수를 유지한 채 똑같이 하역한 무조정 기준입니다. 두 선이 겹치면 그 시점의 차이가 작다는 뜻입니다.', '기준선보다 민트색 선이 0에 가까우면 그 순간의 기울기가 줄어든 것입니다. 두 선이 반대쪽에 있어도 절댓값을 비교해야 합니다.'], result: '하역 순서가 같을 때 평형수 조정이 기울기에 어떤 차이를 만드는지 확인할 수 있습니다.', tip: '위쪽 좌우 기울기 숫자는 절댓값, 그래프는 방향을 구분하는 부호를 포함합니다. 그래프는 하역 사이의 물 이송과 마지막 조정 완료까지 기록하고, 가로 간격은 실제 가상 시간에 비례합니다. 그래프 아래에서 최대 기울기 비교값도 볼 수 있습니다. 세로 범위는 자동으로 바뀌므로 눈금도 함께 읽으세요. 이 결과가 실제 선박의 검증된 성능을 뜻하지는 않습니다.' },
    { target: '#reset', title: '초기화: 적용한 실험안 B로 다시 시작', text: '↺는 현재 실행의 시작 배치를 복원합니다. 실험안 B를 메인에 적용했다면 72개 기본 화물로 바뀌지 않습니다.', instructions: ['재생과 진행 중 이송을 멈추고, 메인에 적용했던 B의 화물 위치·중량·적재 여부와 네 탱크의 초기 수량을 복원합니다. 적용 당시 빈 칸은 그대로 비워둡니다. 패널에서만 편집하고 메인에 적용하지 않은 B는 복원 대상이 아닙니다.', '하역 진행률·경과시간·누적 이송량을 초기 상태로 돌리고 그래프와 운전 기록을 새로 시작합니다. 추천은 복원된 배치 기준으로 다시 계산합니다. 저장 환경과 파도 시작 위상은 유지합니다.', '기본 72개 화물로 돌아가려면 하역 설정 → 하역 계획 및 운전 조건 설정 → 합성 예제 복원을 사용하세요. B의 시작 상태에서 자동 조정 효과를 비교하려면 ↺로 복원한 뒤 자동 승인 여부를 바꿔 재생합니다.'], result: '같은 화물·중량·초기 물 수량에서 반복 실험할 수 있습니다. 빈 배치는 0/0개로 표시합니다.', tip: '선택한 하역 순서·자동 승인 체크·화면 보기와 카메라는 유지되며 자동으로 재생하지 않습니다. ⌖는 카메라 시점만 복원합니다. 초기화만으로 새 관측을 조회하지 않습니다.' },
    { target: '#modelInfo', title: '이제 직접 실험할 준비가 됐어요.', text: '추천 시연 순서: 한쪽 먼저 하역 → 재생 → 기울기 확인 → 추천안 적용 → 그래프 비교입니다.', instructions: ['가이드를 닫으면 원래 보던 구역으로 돌아옵니다. 시뮬레이션 시작을 눌러 직접 진행하세요.', '계산 기준이 궁금하면 화면 아래 모델 및 계산 기준을 여세요. 적재 높이·수위에 따른 KG, 고정 KM과 자유표면 보정으로 추정한 GM의 수식·가정을 확인할 수 있습니다. 실제 선형 자료에 따른 완전한 복원성 계산은 아닙니다.', '필요한 기능을 잊었을 때는 시작 가이드를 다시 열고 위의 기능 선택 메뉴로 바로 이동하세요.'], result: '3D·2D 탐색, 하역 제어, 수동·자동 평형수 조정, 결과 비교까지 필수 기능 안내를 마쳤습니다.', tip: '합성 데이터와 단순화된 계산을 사용하는 개념 검증용 웹입니다. 실제 운전·안전 판단에 사용할 수 없으며, 학습형 밸러스트 제어 모델은 미구현이며, 외부 LLM 업무 보조는 AI 기능 가이드에서 확인할 수 있습니다.' }
  ];
  const coreSteps=[
    {target:'.environment-modes',title:'1. 관측 또는 직접 조건을 선택해요.',text:'환경 설정에서 실제 관측 사용과 사용자 조건 실험 중 선택합니다.',instructions:['실제 관측은 항구와 최신/과거 시각을 고르고 관측 조회·적용 버튼 하나로 불러와 적용합니다. 관측소·실제 시각·거리는 접힌 상세에서 확인하세요.','사용자 조건 실험에서는 날씨·풍속 선택 바·풍향·파고·주기·파향을 직접 설정한 뒤 사용자 조건 적용·초기화를 누릅니다.','개별 해양 적용, 모델 예보, 관측과 별개의 시각 시연은 고급 설정에 있습니다. 조회 실패·결측이면 기존 실험을 유지합니다.'],result:'환경을 선택한 것과 적용한 것은 다릅니다. 선박 위 적용 조건에서 현재 출처를 확인하세요.',tip:'날씨·풍속·파도 직접 설정은 그대로 사용할 수 있습니다. 관측 없는 연출은 기본 연출로 구분합니다.'},
    {target:'.placement-lab',title:'2. 적재 위치와 탱크 수량을 실험해요.',text:'적재·탱크 실험 메뉴에서 화물을 어느 칸에 얼마나 실을지, 네 탱크에 물을 얼마나 둘지 바꿉니다.',instructions:['처음에는 현재 상태를 불러옵니다. 화물을 모두 비운 뒤 BAY·ROW·높이·중량을 골라 적재하거나, 위쪽부터 하역해 중간 상태를 검사할 수 있습니다.','탱크 수량 반영·평가로 기울기·추정 GM·60초 합성 기울기를 비교하고, 같은 총 평형수에서 배치 후보를 찾습니다. 후보는 실제 안전 수량이 아닙니다.','실험안 B를 메인 3D에 적용을 누르면 화물·탱크·저장 환경으로 새 실행을 준비합니다. 하역 설정에서 순서를 고른 뒤 선박 위 시작 버튼으로 하역 중 기울기·수위 변화를 보세요. 선박 화면은 전체화면 ⛶ 버튼이나 F 키로 크게 볼 수 있습니다. ↺ 초기화는 메인에 적용한 B의 위치·중량·적재 여부·탱크 초기 수량으로 돌아갑니다. 기본72개 복원은 별도의 합성 예제 복원을 사용하세요.'],result:'기준안 A와 실험안 B의 반영된 조건을 비교하세요. 적재·물의 양을 바꿔도 선박 KM은 고정합니다.',tip:'현재 위험 상태에서 원인·기울기 방향·대응 안내를 확인하세요. 계산 범위 밖이면 하역과 이송이 중지됩니다. 실제 안전에는 선박별 복원성·강도·흘수 자료가 필요합니다.'},
    {target:'.recommendation',title:'3. 추천 근거를 보고 승인해요.',text:'운전 추천에서 탱크 방향·이송량·예상 기울기를 확인합니다.',instructions:['보내는 탱크와 받는 탱크, 이송량, 예상 기울기와 소요시간을 읽으세요.','추천 운전안 적용은 승인이며 물을 즉시 옮기지 않습니다. 시뮬레이션을 재생해야 이송이 진행됩니다.','운전 추천의 시연 자동 승인을 켜면 이후 추천도 자동 승인합니다. 하역100% 후에도 마지막 평형수 조정 중이면 재생을 유지하고, 하역과 평형수 조정 모두 완료를 확인하세요. 탱크·GM 제약으로 조정이 제한될 수 있습니다.'],result:'추천 전후의 기울기와 탱크 수량을 살펴보세요.',tip:'운전안 상세 근거와 고급 기능은 상세 기능 안내에서 따로 볼 수 있습니다.'},
    {target:'.experiment',title:'4. 동일 조건에서 결과를 비교해요.',text:'결과 비교에서 3가지 방식 비교 실행을 누릅니다.',instructions:['무조정·현재 상태 규칙·60초 예측 탐색을 같은 화물·하역 순서·환경으로 비교합니다.','최대 기울기·기준 초과시간·이송량을 함께 보세요. 펌프 가동시간은 이송량÷유량입니다(412.5t÷2.5t/s=165초).','최대·초과시간은 하역1초/파동0.25초 표본 계산값입니다. 화면은 반올림 값이며 조건·결과 JSON 저장으로 원본을 남깁니다.'],result:'같은 입력의 모델 비교이며 실제 현장 개선율이나 비용 절감을 입증하는 결과는 아닙니다.',tip:'입력값을 바꾸면 비교 결과를 다시 계산해야 합니다.'},
    {...detailedSteps[0],title:'5. 관측값·계산값·연출을 구분해요.'}
  ];
  const aiSteps=[
    {title:'AI 기능 6가지를 한 번에 익혀요.',text:'HARBOR TWIN의 AI는 하역 전 → 하역 중 → 하역 후 업무 흐름마다 들어가 있어요. 계산과 판정은 물리 모델과 기준표가 하고, AI(Groq LLM)는 그 결과를 쉬운 말로 설명하고, 글을 쓰고, 자료를 읽어 줘요.',instructions:['하역 전: ④ 기상 위험 판단 · ⑤ 적하목록 → 하역 계획 변환','하역 중: ① 평형수 조정 브리핑 · ② 하버에게 묻기(만약에 시뮬레이션) · ⑥ 위험 대응 안내','하역 후: ③ 작업 일지 자동 작성','이 순서대로 화면 위치를 하나씩 보여 드릴게요.'],result:'다음을 누르면 첫 번째 기능 위치로 이동해요.',tip:'AI 답변은 참고용이에요. 최종 판단은 담당자와 선박의 승인된 자료를 따릅니다.'},
    {target:'.ai-weather',title:'④ 현재 적용 조건으로 작업을 판정해요.',text:'관측이나 사용자 조건을 적용한 뒤 같은 공통 기준표로 판정합니다. 최신 조회 결과와 현재 적용 조건은 별개예요.',instructions:['관측 모드는 최신 또는 과거 관측을 조회·적용하고, 사용자 조건 모드는 직접 입력 후 적용을 누르세요.','카드의 적용 출처·항구·시각과 항목별 판정을 확인해요. 미확인 자료가 있으면 판정 보류가 나올 수 있어요.','풍속 10m/s부터 주의, 15m/s부터 중지 검토입니다. 채팅 가상 실험도 같은 기준을 써요.','AI 설명 받기는 판정을 설명할 뿐 하역 허가나 실제 안전을 보장하지 않아요. 조건이 바뀌면 설명을 다시 생성하세요.'],result:'현재 적용 조건과 AI 카드가 같은 입력을 가리키는지 확인하세요.',tip:'조회만 하거나 지역·날짜만 바꿔서는 적용된 실험과 판정이 바뀌지 않아요. 표의 기준은 시연용입니다.'},
    {target:'.ai-manifest',title:'⑤ 적하목록 → 하역 계획 변환',text:'형식이 제각각인 적하목록·하역 지시서를 붙여 넣으면 AI가 화물마다 위치·중량·하역 순서를 뽑아 줘요.',instructions:['입력칸에 적하목록을 붙여 넣어요. 자료가 없으면 ‘예시 넣기’를 눌러요.','‘AI로 변환’을 누르면 읽은 결과가 표로 나와요. 위치가 없는 줄처럼 제외한 항목과 이유도 보여 줘요.','적용 방식을 고르세요. 예제 일부 수정은 미지정 칸을 합성 화물로 유지하고, 목록만 적재는 나머지를 빈 칸으로 바꿔요.', '위치·중량·제외 항목을 확인했다는 체크를 한 뒤 적용하세요. 목록만 적재하려면 상부 화물을 지지하는 하부 화물도 목록에 있어야 해요.','같은 칸 위쪽 화물을 먼저 내리도록 순서를 자동으로 맞춰 줘요.'],result:'적용 후 ▶ 시뮬레이션 시작을 누르면 그 순서대로 하역해요.',tip:'BAY 05·ROW 04·TIER 84 같은 실제 베이플랜 표기도, “3번 베이 우현 바깥 갑판 2단” 같은 말도 읽어요. 원래대로 돌리려면 ‘합성 예제 복원’을 누르세요.'},
    {target:'.ai-briefing',title:'① 평형수 조정 브리핑',text:'추천 이송안과 현재 기울기·탱크 수위·다음 하역 화물·기상을 보고, 담당자(일등항해사)용 짧은 브리핑을 써요.',instructions:['시뮬레이션을 시작하면 새 이송안이 나올 때 자동으로 갱신돼요.','‘브리핑 생성’ 버튼으로 언제든 직접 만들 수 있어요.','지금 · 곧 · 추천 · 주의 네 줄로 읽으면 돼요.'],result:'추천 이송안의 근거를 이해한 뒤 ‘추천 운전안 적용’으로 승인해요.',tip:'수치와 단위는 원본 표를 기준으로 읽으세요. AI 문장의 숫자·단위·보증 표현 검증에 걸리면 고정 안내로 바꿔 보여줘요.'},
    {target:'.harbor-launcher',title:'② 하버에게 묻기 · 만약에 시뮬레이션',text:'오른쪽 아래 배 캐릭터 ‘하버’를 누르면 AI 채팅창이 열려요. 페이지를 내려도 같은 자리에 있어요.',instructions:['“지금 상황 요약해줘”처럼 현재 상태를 물어볼 수 있어요.','“풍속 20m/s면 하역 계속해도 돼?”, “P-A에서 S-A로 200t 옮기면 어때?”처럼 물으면 AI가 실제 시뮬레이터로 가상 계산을 돌려 답해요.','가상 계산은 화면의 시뮬레이션을 바꾸지 않아요.','↺ 새 대화는 진행 중인 AI 요청도 취소해요. 생성 당시 판정·시각을 확인하고, 조건이 바뀌었다는 안내가 나오면 다시 질문하세요. 시간 초과나 반복 한도 때도 화면 실험은 유지돼요.'],result:'채팅창 아래 예시 질문 버튼을 눌러 바로 써 보세요.',tip:'전체화면에서도 하버를 쓸 수 있어요. Esc로 채팅창을 닫아요.'},
    {target:'#model-risk',title:'⑥ 위험 대응 안내',text:'기울기·복원력(GM)·탱크 수위가 주의 또는 기준 초과 단계가 되면 이 칸에 AI 안내 카드가 나타나요.',instructions:['왜 위험한지 한 문장으로 알려 줘요.','지금 할 일 1~3(하역 일시 중지, 이송 방향 확인 등)을 체크리스트처럼 보여 줘요.','계속 지켜볼 계기도 알려 줘요.'],result:'위험 단계는 규칙 기준으로 정해지고, AI는 원인과 조치를 설명해요.',tip:'“한쪽 먼저 하역” 시나리오를 자동 승인 없이 재생하면 안내 카드를 쉽게 볼 수 있어요.'},
    {target:'.ai-report',title:'③ 작업 일지 자동 작성',text:'하역이 끝나면 AI가 작업 일지를 한 번 자동으로 써요. 진행 중에는 ‘일지 작성’으로 중간 기록을 만들 수 있어요.',instructions:['위쪽 표: 내린 컨테이너 수, 최대 기울기, 물을 안 옮겼을 때 비교, 이송량, 펌프 가동 시간 등 기록 수치','아래 글: 작업 개요 · 주요 경과 · 결과 평가 · 방식 비교 · 다음 작업 제안','‘내려받기’로 텍스트 파일로 저장해요.'],result:'하역 전에 ‘3가지 방식 비교 실행’을 해 두면 일지에 방식 비교도 들어가요.',tip:'표의 숫자·단위는 기록 그대로이고 AI는 숫자를 반복하지 않는 설명만 써요. 생성 당시 조건·시각을 확인하세요. 검증에 걸린 문장은 고정 안내로 바뀌며 원문 기록은 내려받기에 남아요.'},
    {title:'추천 시연 순서',text:'하역 전부터 하역 후까지 AI가 업무에 들어간 모습을 한 번에 볼 수 있어요.',instructions:['1. ④ 현재 적용 조건의 시연용 작업 판정과 미확인 자료 확인','2. ⑤ 예시 적하목록을 넣어 하역 계획으로 변환·적용','3. ▶ 시뮬레이션 시작 → ① 브리핑, ② 하버에게 묻기, ⑥ 위험 안내 확인','4. 하역이 끝나면 ③ 작업 일지 확인·내려받기'],result:'가이드를 닫고 직접 써 보세요.',tip:'AI 사용이 몰리면 “몇 초 뒤 다시 시도할게요”가 뜰 수 있어요. 짧은 제한은 한 번 자동 재시도하고, 긴 대기·시간 초과는 다시 요청할 수 있어요. 실제 장비 제어는 수행하지 않아요.'}
  ];
  let steps=coreSteps,guideMode='core';
  function setGuideMode(mode){guideMode=['detail','ai'].includes(mode)?mode:'core';steps=guideMode==='detail'?detailedSteps:guideMode==='ai'?aiSteps:coreSteps;index=0;find('#guide-core').setAttribute('aria-pressed',String(guideMode==='core'));find('#guide-detail').setAttribute('aria-pressed',String(guideMode==='detail'));find('#guide-ai').setAttribute('aria-pressed',String(guideMode==='ai'));find('#tutorial-jump').innerHTML=steps.map((step,i)=>`<option value="${i}">${String(i+1).padStart(2,'0')}. ${step.title}</option>`).join('');if(active)render();}
  find('#tutorial-jump').innerHTML=steps.map((step,i)=>`<option value="${i}">${String(i+1).padStart(2,'0')}. ${step.title}</option>`).join('');
  find('#tutorial-jump').onchange=e=>{index=Number(e.target.value);render();};
  let index = 0, savedView, savedScroll, savedFocus, savedPanel, savedMode, savedTimeMode, savedDetails, savedDrawerScroll, active = false, frame = 0;
  const stage = document.querySelector('.app');
  function remember() { try { localStorage.setItem(STORAGE_KEY, 'seen'); } catch {} }
  function revealTarget() {
    const target = steps[index].target && document.querySelector(steps[index].target);
    if (target) { if(!target.closest('[data-panel-view]')&&document.body.dataset.panel)document.dispatchEvent(new CustomEvent('harbor:set-panel',{detail:{panel:''}})); document.dispatchEvent(new CustomEvent('harbor:reveal-panel',{detail:{target:steps[index].target}})); const details=target.closest('details'); if(details)details.open=true; let ancestor=target.parentElement;while(ancestor){if(ancestor.tagName==='DETAILS')ancestor.open=true;ancestor=ancestor.parentElement;} if(target.id==='selected-observations'){const choice=document.querySelector('#observation-time-mode');choice.value='selected';choice.dispatchEvent(new Event('change'));} if(target.classList.contains('weather-panel')){const choice=document.querySelector('#observation-time-mode');choice.value='latest';choice.dispatchEvent(new Event('change'));} if(target.closest('.manual-mode'))document.querySelector('#mode-manual').click();if(target.closest('.observed-mode'))document.querySelector('#mode-observed').click(); for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true; const scroller=target.closest('.drawer-content'); const available=scroller?.clientHeight??stage.clientHeight; target.scrollIntoView({block:target.offsetHeight>available-24?'start':'center',inline:'nearest',behavior:'instant'}); }
  }
  function position() {
    if (!active) return;
    const target = steps[index].target && document.querySelector(steps[index].target);
    find('.tutorial-shade').hidden = true;
    spotlight.hidden = !target;
    if (!target) return;
    const r = target.getBoundingClientRect(), bounds = stage.getBoundingClientRect(), pad = 5;
    let left=Math.max(0,bounds.left+3,r.left-pad),top=Math.max(0,bounds.top+3,r.top-pad);
    let right=Math.min(innerWidth,bounds.right-3,r.right+pad),bottom=Math.min(innerHeight,bounds.bottom-3,r.bottom+pad);
    // The drawer clips tall targets; highlight only the portion actually visible below its header.
    for(let parent=target.parentElement;parent&&parent!==document.body;parent=parent.parentElement){
      const style=getComputedStyle(parent),rect=parent.getBoundingClientRect();
      if(/auto|scroll|hidden|clip/.test(style.overflowX)){left=Math.max(left,rect.left+parent.clientLeft);right=Math.min(right,rect.left+parent.clientLeft+parent.clientWidth);}
      if(/auto|scroll|hidden|clip/.test(style.overflowY)){top=Math.max(top,rect.top+parent.clientTop);bottom=Math.min(bottom,rect.top+parent.clientTop+parent.clientHeight);}
    }
    spotlight.hidden = right<=left || bottom<=top;
    Object.assign(spotlight.style,{left:`${left}px`,top:`${top}px`,width:`${Math.max(0,right-left)}px`,height:`${Math.max(0,bottom-top)}px`});
  }
  function schedulePosition() { cancelAnimationFrame(frame); frame=requestAnimationFrame(position); }
  function onResize(){revealTarget();schedulePosition();}
  function render() {
    const step=steps[index];
    if(step.view) showView(...step.view);
    find('.tutorial-art').hidden=!!step.target;
    find('.tutorial-step').textContent=`${guideMode==='core'?'핵심':guideMode==='ai'?'AI 기능':'상세'} ${String(index+1).padStart(2,'0')} / ${String(steps.length).padStart(2,'0')}`;
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
  let welcome=null;
  function dismissWelcome(){launch.classList.remove('is-new');welcome?.remove();welcome=null;try{localStorage.setItem(WELCOME_KEY,'done');}catch{}}
  function open(mode='core') {
    dismissWelcome();
    if(active){setGuideMode(mode);return;}setGuideMode(mode);
    savedFocus=document.activeElement;savedPanel=document.body.dataset.panel??'';savedMode=document.body.dataset.environmentMode; savedTimeMode=document.querySelector('#observation-time-mode')?.value;savedView=captureView(); savedScroll=scrollY;savedDrawerScroll=document.querySelector('.drawer-content')?.scrollTop??0;
    savedDetails=[...stage.querySelectorAll('details')].map(node=>({node,open:node.open}));pause(); index=0; active=true; overlay.hidden=false;
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
    document.dispatchEvent(new CustomEvent('harbor:set-panel',{detail:{panel:savedPanel}}));const timeMode=document.querySelector('#observation-time-mode');if(timeMode&&savedTimeMode&&timeMode.value!==savedTimeMode){timeMode.value=savedTimeMode;timeMode.dispatchEvent(new Event('change'));}if(savedMode)document.querySelector(savedMode==='manual'?'#mode-manual':'#mode-observed').click();restoreView(savedView);for(const item of savedDetails??[])item.node.open=item.open;const drawerContent=document.querySelector('.drawer-content');if(drawerContent)drawerContent.scrollTop=savedDrawerScroll;window.scrollTo({top:savedScroll,behavior:'instant'});
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
  function scrollSurface(x,y){const content=document.querySelector('.drawer-content');const rect=content?.getBoundingClientRect();return rect&&x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom?content:stage;}
  overlay.addEventListener('wheel',e=>{if(!active||card.contains(e.target))return;e.preventDefault();const surface=scrollSurface(e.clientX,e.clientY);surface.scrollTop+=e.deltaY;surface.scrollLeft+=e.deltaX;},{passive:false});
  let touchY=null;
  overlay.addEventListener('touchstart',e=>{touchY=active&&!card.contains(e.target)&&e.touches.length===1?e.touches[0].clientY:null;},{passive:true});
  overlay.addEventListener('touchmove',e=>{if(touchY===null||e.touches.length!==1)return;e.preventDefault();const y=e.touches[0].clientY;scrollSurface(e.touches[0].clientX,y).scrollTop+=touchY-y;touchY=y;},{passive:false});
  overlay.addEventListener('touchend',()=>{touchY=null;});
  overlay.addEventListener('touchcancel',()=>{touchY=null;});
  help.onclick=()=>open('core');launch.onclick=()=>open('core');detailLaunch.onclick=()=>open('detail');aiLaunch.onclick=()=>open('ai');find('#guide-ai').onclick=()=>setGuideMode('ai');find('#guide-core').onclick=()=>setGuideMode('core');find('#guide-detail').onclick=()=>setGuideMode('detail');
  // First visit: show the home screen with a small welcome bar instead of opening the guide.
  let seen=false;try{seen=localStorage.getItem(STORAGE_KEY)==='seen';}catch{}
  let welcomed=false;try{welcomed=localStorage.getItem(WELCOME_KEY)==='done';}catch{}
  if(!seen&&!welcomed){
    launch.classList.add('is-new');
    welcome=document.createElement('section');welcome.className='welcome-banner';welcome.setAttribute('role','region');welcome.setAttribute('aria-label','처음 방문 안내');
    welcome.innerHTML=`<div class="welcome-text"><strong>처음이신가요?</strong><span>아래 <b>▶ 시뮬레이션 시작</b>을 눌러 바로 하역을 보거나, <b>시작 가이드</b>로 5단계 사용법을, <b>AI 기능 가이드</b>로 AI 활용법을 확인하세요.</span></div><div class="welcome-actions"><button type="button" class="welcome-guide">◈ 시작 가이드 보기</button><button type="button" class="welcome-ai">✦ AI 기능 가이드</button><button type="button" class="welcome-skip">바로 둘러보기</button><button type="button" class="welcome-close" aria-label="안내 닫기">×</button></div>`;
    document.querySelector('.page-title').after(welcome);
    welcome.querySelector('.welcome-guide').onclick=()=>open('core');welcome.querySelector('.welcome-ai').onclick=()=>open('ai');
    welcome.querySelector('.welcome-skip').onclick=dismissWelcome;welcome.querySelector('.welcome-close').onclick=dismissWelcome;
  }
}
