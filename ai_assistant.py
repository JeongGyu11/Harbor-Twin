"""LLM proxy (Groq first, Gemini as fallback) for the ballast-adjustment assistant.

The browser never sees the API key. Prompts live here so the endpoint only serves the
assistant roles (briefing, risk guidance, chat with what-if tool, work log,
weather check explanation, manifest extraction).
Numbers always come from the physics model in the browser; the LLM explains them.
"""
import os, json, time, threading, urllib.request, urllib.error, re, hashlib, datetime

GROQ_BASE = os.getenv('GROQ_BASE_URL', 'https://api.groq.com/openai/v1').rstrip('/')
GEMINI_BASE = os.getenv('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai').rstrip('/')
KEY_NAMES = ('GROQ_API_KEY', 'GROQ_KEY', 'GROQ_API', 'GROQ_TOKEN', 'GROQ_APIKEY')
GEMINI_KEY_NAMES = ('GEMINI_API_KEY', 'GEMINI_KEY', 'GOOGLE_API_KEY', 'GOOGLE_AI_KEY', 'GEMINI_API')
DEFAULT_MODELS = ('openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile')
# Free tier: Flash-Lite has far more daily requests than Flash, so it goes first.
GEMINI_PREFERRED = ('gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-3-flash', 'gemini-flash-latest', 'gemini-2.5-flash')
MAX_BODY = 60_000

def _env_key(names):
    for name in names:
        value = os.getenv(name, '').strip()
        if value:
            return value, name
    # Local runs: same .env.local file the KMA key uses (never committed).
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env.local')
    try:
        with open(path, encoding='utf-8-sig') as f:
            for line in f:
                name, _, value = line.strip().partition('=')
                if name in names and value.strip().strip('"').strip("'"):
                    return value.strip().strip('"').strip("'"), name
    except OSError:
        pass
    return '', None

def api_key():
    return _env_key(KEY_NAMES)

def gemini_key():
    return _env_key(GEMINI_KEY_NAMES)

def models():
    preferred = os.getenv('GROQ_MODEL', '').strip()
    return ((preferred,) if preferred else ()) + tuple(m for m in DEFAULT_MODELS if m != preferred)

_gemini_models = {'at': 0, 'list': ()}
def gemini_models():
    """Gemini model names change often: ask the API once an hour and pick a text 'flash' model."""
    override = os.getenv('GEMINI_MODEL', '').strip()
    if override:
        return (override,)
    key, _ = gemini_key()
    if not key:
        return ()
    if time.time() - _gemini_models['at'] < 3600 and _gemini_models['list']:
        return _gemini_models['list']
    found = []
    try:
        req = urllib.request.Request(GEMINI_BASE + '/models', headers={'Authorization': 'Bearer ' + key})
        with urllib.request.urlopen(req, timeout=5) as r:
            data = json.loads(r.read(400_000))
        found = [str(m.get('id', '')).replace('models/', '') for m in data.get('data', [])]
    except Exception as e:
        print(f'[ai] gemini model list failed: {e}', flush=True)
    bad = ('image', 'tts', 'embedding', 'live', 'audio', 'vision', 'robotics', 'computer', 'native', 'thinking', 'exp', 'learnlm', 'gemma', 'veo', 'imagen', 'omni')
    usable = [m for m in found if m.startswith('gemini') and 'flash' in m and not any(b in m for b in bad)]
    ordered = [m for m in GEMINI_PREFERRED if m in usable] + sorted((m for m in usable if m not in GEMINI_PREFERRED and 'lite' in m), reverse=True) + sorted((m for m in usable if m not in GEMINI_PREFERRED and 'lite' not in m), reverse=True)
    result = tuple(ordered[:3]) or GEMINI_PREFERRED[:3]
    _gemini_models.update(at=time.time(), list=result)
    return result

def providers():
    out = []
    key, _ = api_key()
    if key:
        out += [('groq', GROQ_BASE, key, m) for m in models()]
    gkey, _ = gemini_key()
    if gkey:
        out += [('gemini', GEMINI_BASE, gkey, m) for m in gemini_models()]
    return out

BASE = (
    "당신은 'HARBOR TWIN'의 AI 평형수 조정 보조원 '하버'입니다. 사용자는 항구에 정박해 컨테이너를 하역하는 "
    "화물선의 평형수(밸러스트) 작업 담당자(일등항해사 등)입니다. 배는 운항 중이 아니라 정박 중이며, "
    "하역으로 무게중심이 바뀌어 생기는 좌우 기울기를 탱크 사이 평형수 이송으로 바로잡는 상황입니다.\n"
    "규칙:\n"
    "- 반드시 한국어로, 짧고 명확하게 답합니다.\n"
    "- 기울기·GM·톤수 등 모든 숫자는 제공된 상태 JSON이나 도구 결과에 있는 값만 사용합니다. 직접 계산하거나 지어내지 않습니다.\n"
    "- 값이 없으면 '현재 자료로는 알 수 없습니다'라고 말합니다.\n"
    "- 이 시뮬레이션은 합성 화물과 가정 물리 모델을 쓰는 개념검증용입니다. 실제 선박 안전을 보장하지 않으며, "
    "최종 판단은 담당자와 선박의 승인된 복원성 자료를 따른다는 점을 필요할 때 짧게 언급합니다.\n"
    "- 좌현(port)은 선수를 바라볼 때 왼쪽, 우현(starboard)은 오른쪽입니다. 탱크: P-F 좌현 선수, S-F 우현 선수, P-A 좌현 선미, S-A 우현 선미.\n"
    "- 시연 한도(threshold)는 표시용 기준이며 법정 기준이 아닙니다.\n"
    "쉬운 말 규칙(가장 중요):\n"
    "- 상태 JSON의 키 이름(heelDeg, gmM, forecast60s, recommendation 등)이나 코드·수식·영어 변수명을 절대 쓰지 않습니다.\n"
    "- 처음 보는 사람도 이해하도록 쉬운 우리말로, '~해요'체로 씁니다.\n"
    "- 기울기는 '왼쪽(좌현)으로 0.07도', '오른쪽(우현)으로 0.3도'처럼 방향을 말로 풀어 씁니다. ±, → 같은 기호는 쓰지 않습니다.\n"
    "- 탱크는 '왼쪽 뒤 탱크(P-A)'처럼 위치를 먼저 말합니다. P=왼쪽(좌현), S=오른쪽(우현), F=앞(선수), A=뒤(선미).\n"
    "- 전문 용어는 꼭 필요할 때만 쓰고 처음에 짧게 풀어 줍니다. 예: GM(배가 다시 바로 서려는 힘), 평형수(균형을 맞추려고 탱크에 넣는 바닷물).\n"
    "- 숫자는 꼭 필요한 것만, 소수점 둘째 자리까지만 씁니다. 1도보다 작은 기울기는 '아주 작은 기울기'라고 덧붙여도 좋습니다.\n"
    "- 굵은 제목(**결론** 등), 표, 코드 블록, '근거:' 같은 머리말 목록을 쓰지 않습니다.\n"
)

PROMPTS = {
    'briefing': BASE + (
        "역할: 평형수 조정 브리핑. 아래 상태를 보고 담당자에게 3~5개의 짧은 줄로 브리핑하세요. 형식:\n"
        "• 지금: (배가 어느 쪽으로 얼마나 기울었는지, 괜찮은 상태인지 한 문장)\n• 곧: (다음에 내릴 화물 때문에 어떻게 달라질지 한 문장)\n"
        "• 추천: (어느 탱크에서 어느 탱크로 물을 몇 톤 옮기면 어떻게 되는지, 몇 초 걸리는지. 없으면 '지금은 물을 옮기지 않아도 돼요')\n• 주의: (바람·파도·탱크 물 양 등 신경 쓸 점 한 문장)\n"
        "마크다운 제목이나 표는 쓰지 말고 위 형식의 줄만 출력하세요."),
    'risk': BASE + (
        "역할: 위험 경고 대응 안내. 현재 위험 단계와 원인을 보고 담당자가 지금 할 일을 안내하세요. 형식:\n"
        "왜 위험한가요? (쉬운 말 한 문장)\n지금 할 일:\n1. ...\n2. ...\n3. ...\n계속 볼 것: (한 문장)\n"
        "조치는 이 시뮬레이터에서 가능한 것(하역 일시 중지, 추천 이송 승인, 이송 방향 확인, 하역 간격 늘리기, 기상 재확인)을 우선합니다. "
        "과장하지 말고 4~7줄로 끝내세요."),
    'chat': BASE + (
        "역할: 담당자의 질문에 답합니다. 상태 JSON은 지금 시뮬레이션 화면의 값입니다.\n"
        "- '만약 ~라면'(풍속·풍향·파고·파주기·하역 간격·시연 한도를 바꾼 경우)이나 특정 이송안의 효과를 묻는 질문은 "
        "반드시 simulate_what_if 도구를 호출해 결과로 답하세요. 도구는 현재 화면을 바꾸지 않는 가상 계산입니다.\n"
        "- 답변은 대화하듯 3~5문장으로 씁니다. 첫 문장에 결론(괜찮아요/주의가 필요해요/위험해요)을 말하고, 이유를 한두 문장, 할 일을 한두 문장으로 씁니다. 할 일이 여러 개면 짧은 번호 목록(최대 3개)만 씁니다.\n"
        "- 이 시뮬레이터와 평형수·하역 안전과 무관한 요청은 정중히 범위를 안내합니다."),
    'report': BASE + (
        "역할: 하역·평형수 작업 일지 작성. 상태 JSON은 이번 작업의 기록(조건, 결과 수치, 주요 이벤트, 방식 비교)입니다. "
        "수치 표는 화면이 따로 붙이므로, 당신은 담당자가 읽을 서술 부분만 씁니다. 아래 다섯 덩어리를 이 순서와 머리말 그대로 쓰세요:\n"
        "[작업 개요] 어떤 조건(항구·기상·하역 간격·추천 방식)에서 컨테이너 몇 개를 내렸는지 2~3문장.\n"
        "[주요 경과] 기록된 이벤트 중 중요한 것 3~5개를 시간 순서로 '- 00:40 ...' 형식으로.\n"
        "[결과 평가] 가장 크게 기울었던 정도와 시연 한도 비교, 물을 옮기지 않았다면 어땠을지와의 비교, 옮긴 물 양과 펌프 가동 시간을 2~4문장.\n"
        "[방식 비교] 비교 실험 결과가 있으면 세 방식의 차이를 2문장, 없으면 '이번 작업에서는 비교 실험을 실행하지 않았어요.' 한 문장.\n"
        "[다음 작업 제안] 다음 하역 때 바꿔 볼 점 2~3개를 '1. ...' 번호 목록으로.\n"
        "작업이 끝나지 않았으면 첫 문장에 '작업 중간 기록'이라고 밝히세요. 전체 15~22줄 안으로 씁니다."),
    'weather': BASE + (
        "역할: 하역 전 기상 위험 판단 설명. 상태 JSON의 verdict(정상/주의/중지 검토)는 정해진 기준표로 이미 판정된 값입니다. "
        "절대 판정을 바꾸거나 새 판정을 만들지 말고, 그 판정을 담당자에게 설명하세요. 형식:\n"
        "판단: (verdict를 그대로 쓰고, 이유를 한 문장)\n"
        "근거:\n- 바람: ...\n- 파도: ...\n- 비·눈·시정: ...\n- 우리 배 예측: (shipForecast가 있으면 그 결과를 한 문장)\n"
        "권장 조치:\n1. ...\n2. ...\n"
        "참고: (관측소와 관측 시각, 기준표는 시연용이라 터미널 운영 기준으로 바꿔 써야 한다는 점을 한 문장)\n"
        "값이 없는 항목은 '관측값 없음'이라고 쓰세요. 전체 8~12줄."),
}

MANIFEST_PROMPT = (
    "당신은 컨테이너 적하목록(manifest)·하역 지시서 변환기입니다. 사용자가 붙여 넣은 글에서 컨테이너마다 "
    "위치, 중량(톤), 하역 순서를 뽑아 JSON 하나만 출력합니다. 설명 문장, 마크다운, 코드 블록은 쓰지 않습니다.\n"
    "대상 선박 격자(가상 선박): BAY 1~6 (1=선미 쪽, 6=선수 쪽), ROW 1~4 (1=좌현 바깥, 2=좌현 안쪽, 3=우현 안쪽, 4=우현 바깥), "
    "TIER 1~3 (1=창내 하부, 2=갑판 위 1단, 3=갑판 위 2단).\n"
    "위치 변환 규칙(순서대로 적용):\n"
    "1) 한 자리 숫자이고 격자 범위 안이면(BAY 1~6, ROW 1~4, TIER 1~3) 그대로 씁니다. 예: 'BAY 1 ROW 4 TIER 3' → [1,4,3], 'B6-R1-T3' → [6,1,3].\n"
    "2) 앞에 0이 붙은 두 자리 표기(01, 03, 82 등)는 실제 베이플랜 표기입니다.\n"
    "   - BAY 두 자리: 올림(n/2). 01·02→1, 03·04→2, 05·06→3, 09·10→5, 11·12→6. 13 이상은 제외.\n"
    "   - ROW 두 자리: 01→3, 02→2, 03→4, 04→1. 그 밖의 홀수→4, 짝수→1.\n"
    "   - TIER 두 자리: 02~18→1(창내), 82→2, 84 이상→3.\n"
    "   예: 'BAY 05 ROW 04 TIER 84' → [3,1,3], 'BAY 11 ROW 03 TIER 84' → [6,4,3], 'BAY 03 ROW 03 TIER 06' → [2,4,1].\n"
    "3) 말로 쓴 위치: '좌현 바깥'→ROW 1, '좌현 안쪽'→2, '우현 안쪽'→3, '우현 바깥'→4, 현측만 있으면 바깥 줄. "
    "'창내/하부/hold'→TIER 1, '갑판 위 1단'→2, '갑판 2단/갑판 위 2단'→3. '3번 베이'→BAY 3. "
    "예: '4번 베이 좌현 안쪽 갑판 위 2단' → [4,2,3], '3번 베이 우현 바깥 갑판 2단' → [3,4,3].\n"
    "- 중량: kg이면 1000으로 나눠 톤으로. VGM이나 총중량을 우선합니다. 소수 첫째 자리까지.\n"
    "- 하역 순서가 적혀 있으면 그 번호, 없으면 0.\n"
    "- 위치를 알 수 없거나 격자 범위를 벗어나는 줄은 items에 넣지 말고 notes에 짧게 이유를 씁니다.\n"
    "출력 형식(정확히 이 키만): {\"items\":[[bay,row,tier,weightT,order,\"식별자\"],...],\"notes\":[\"...\"]}\n"
    "식별자는 컨테이너 번호나 원문의 짧은 이름(15자 이하). notes는 쉬운 한국어 문장 최대 5개(가정한 변환 규칙, 제외한 줄 등)."
)
PROMPTS['manifest'] = MANIFEST_PROMPT


TOOLS = [{
    'type': 'function',
    'function': {
        'name': 'simulate_what_if',
        'description': '현재 하역 상태에서 조건을 바꿔 앞으로의 하역 기울기와 파도를 합친 순간 기울기를 물리 모델로 계산합니다. 화면은 바뀌지 않습니다. 지정하지 않은 값은 현재 조건을 유지합니다.',
        'parameters': {
            'type': 'object',
            'properties': {
                'wind_speed': {'type': 'number', 'description': '풍속 m/s (0~113.2)'},
                'wind_direction': {'type': 'number', 'description': '바람이 불어오는 방향, 북쪽 0도'},
                'wave_height': {'type': 'number', 'description': '유의파고 m (0~15)'},
                'wave_period': {'type': 'number', 'description': '파주기 초 (2~25)'},
                'wave_direction': {'type': 'number', 'description': '파도가 오는 방향, 북쪽 0도'},
                'unload_interval': {'type': 'number', 'description': '화물 1개 하역 간격 초 (5~120)'},
                'threshold': {'type': 'number', 'description': '시연 기울기 한도 도 (0.1~10)'},
                'horizon': {'type': 'number', 'description': '예측 시간 초 (20~180, 기본 60)'},
                'transfer_from': {'type': 'string', 'enum': ['P-F', 'S-F', 'P-A', 'S-A'], 'description': '평가할 이송의 출발 탱크'},
                'transfer_to': {'type': 'string', 'enum': ['P-F', 'S-F', 'P-A', 'S-A'], 'description': '평가할 이송의 도착 탱크'},
                'transfer_amount': {'type': 'number', 'description': '이송량 t'},
            },
        },
    },
}]

class RateLimiter:
    def __init__(self, per_ip=20, global_limit=90, window=60):
        self.per_ip, self.global_limit, self.window = per_ip, global_limit, window
        self.hits, self.lock = {}, threading.Lock()
        self.day, self.day_hits = None, 0
        self.daily_limit = max(1, int(os.getenv('AI_DAILY_LIMIT', '500')))
    def allow(self, ip):
        now = time.time()
        with self.lock:
            day = int(now // 86400)
            if self.day != day:self.day,self.day_hits=day,0
            if self.day_hits >= self.daily_limit:return False
            for k in list(self.hits):
                self.hits[k] = [t for t in self.hits[k] if now - t < self.window]
                if not self.hits[k]:
                    del self.hits[k]
            total = sum(len(v) for v in self.hits.values())
            mine = self.hits.setdefault(ip, [])
            if len(mine) >= self.per_ip or total >= self.global_limit:
                return False
            mine.append(now)
            self.day_hits += 1
            return True

limiter = RateLimiter()

def _retry_after(err, detail):
    try:
        header = float(err.headers.get('retry-after') or 0)
    except (TypeError, ValueError):
        header = 0
    import re
    m = re.search(r'try again in ([0-9.]+)\s*(ms|s|m)', detail)
    if m:
        value = float(m.group(1)) * {'ms': 0.001, 's': 1, 'm': 60}[m.group(2)]
        return max(header, value)
    return header or 6

def status():
    key, name = api_key()
    gkey, gname = gemini_key()
    return {'configured': bool(key or gkey), 'providers': [p for p, enabled in [('groq', bool(key)), ('gemini', bool(gkey))] if enabled], 'roles': list(PROMPTS), 'policyVersion': 'fix1028-v1', 'requestBudgetSeconds': 35}


def _flatten_tools(messages):
    """For providers that need provider-specific tool-call state (Gemini thought signatures),
    turn earlier tool exchanges into plain text so any conversation can continue."""
    out = []
    for m in messages:
        if m['role'] == 'assistant' and m.get('tool_calls'):
            asked = '; '.join(c['function']['arguments'] for c in m['tool_calls'])
            out.append({'role': 'assistant', 'content': (m.get('content') or '') + f'(가상 시뮬레이션을 실행했습니다: {asked})'})
        elif m['role'] == 'tool':
            out.append({'role': 'user', 'content': '[가상 시뮬레이션 결과 JSON — 사용자에게 쉬운 말로 설명하세요]\n' + m['content']})
        else:
            out.append(m)
    return out

def _clean_messages(raw):
    out = []
    recent = list(raw or [])[-14:]
    while recent and recent[0].get('role') != 'user':recent.pop(0)
    for m in recent:
        role = m.get('role')
        if role == 'user':
            out.append({'role': 'user', 'content': str(m.get('content', ''))[:1500]})
        elif role == 'assistant':
            msg = {'role': 'assistant', 'content': str(m.get('content') or '')[:3000]}
            calls = m.get('tool_calls')
            if isinstance(calls, list) and calls:
                msg['tool_calls'] = [{'id': str(c.get('id', ''))[:80], 'type': 'function',
                                      'function': {'name': 'simulate_what_if',
                                                   'arguments': str(c.get('function', {}).get('arguments', '{}'))[:1500]}}
                                     for c in calls[:3]]
            out.append(msg)
        elif role == 'tool':
            out.append({'role': 'tool', 'tool_call_id': str(m.get('tool_call_id', ''))[:80],
                        'content': str(m.get('content', ''))[:6000]})
    return out

_unusable = {}
_quota = {}  # model -> latest Groq rate-limit headers (remaining requests per day, tokens per minute)

def _note_quota(provider, model, headers):
    if provider != 'groq' or not headers:
        return
    q = {k[len('x-ratelimit-'):]: v for k, v in headers.items() if k.lower().startswith('x-ratelimit-')}
    if q:
        _quota[model] = {**{k.lower(): v for k, v in q.items()}, 'seenAt': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())}

def _complete_provider(body, deadline):
    """Returns (status, payload)."""
    attempts = providers()
    if not attempts:
        return 503, {'error': 'AI 키가 서버에 설정되지 않았습니다.', 'configured': False}
    role = body.get('role')
    if role not in PROMPTS:
        return 400, {'error': '지원하지 않는 AI 역할입니다.'}
    context = json.dumps(body.get('context') or {}, ensure_ascii=False, separators=(',', ':'))
    messages = [{'role': 'system', 'content': PROMPTS[role] + OUTPUT_POLICY + '\n\n현재 시뮬레이션 상태 JSON:\n' + context}]
    if role == 'manifest':
        text = str(body.get('manifest') or '').strip()[:6000]
        if len(text) < 10:
            return 400, {'error': '적하목록 내용을 붙여 넣으세요.'}
        messages = [{'role': 'system', 'content': PROMPTS['manifest']}, {'role': 'user', 'content': text}]
    elif role == 'chat':
        messages += _clean_messages(body.get('messages'))
        if len(messages) < 2:
            return 400, {'error': '질문을 입력하세요.'}
    else:
        messages.append({'role': 'user', 'content': '위 상태로 작성해 주세요.'})
    payload = {'messages': messages, 'temperature': 0 if role == 'manifest' else 0.15, 'top_p': 0.9, 'max_tokens': {'chat': 700, 'report': 1000, 'manifest': 2200, 'weather': 520}.get(role, 420)}
    force_tool = False
    if role == 'chat':
        payload['tools'] = TOOLS
        payload['tool_choice'] = 'auto'
        raw = body.get('messages') or []
        latest = raw[-1] if raw else {}
        force_tool = latest.get('role') == 'user' and bool(re.search(r'풍속|풍향|파고|파주기|파향|하역\s*간격|만약|옮기|이송|다음\s*화물|[PS]-[FA]', latest.get('content', ''), re.I))
        if force_tool:payload['tool_choice'] = {'type':'function','function':{'name':'simulate_what_if'}}
    last_error = None
    skipped = []
    busy_wait = []
    now = time.time()
    dead = {p for p, until in _unusable.items() if until > now}
    if dead and all(p in dead for p, *_ in attempts):
        dead = set()  # everything marked unusable: try again rather than refusing outright
    for provider, base, key, model in attempts:
        if provider in dead:
            continue  # key or billing problem applies to every model of this provider
        body_out = {**payload, 'model': model}
        if provider == 'groq' and model.startswith('openai/gpt-oss'):
            body_out['reasoning_effort'] = 'low'
            body_out['max_tokens'] = payload['max_tokens'] + 300  # room for short reasoning, kept small: Groq counts it toward TPM
        if provider == 'gemini':
            body_out['messages'] = _flatten_tools(payload['messages'])
            body_out.pop('top_p', None)
            body_out['reasoning_effort'] = 'low'
            body_out['max_tokens'] = payload['max_tokens'] + 1400  # Gemini counts thinking inside the output budget
        for attempt in (1, 2):
            remaining = deadline - time.monotonic()
            if remaining <= 0.2:
                return 504, {'error': 'AI 응답 시간이 초과됐습니다. 시뮬레이션은 유지됩니다. 다시 요청하세요.'}
            req = urllib.request.Request(base + '/chat/completions', data=json.dumps(body_out, ensure_ascii=False, separators=(',', ':')).encode(),
                                         headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json',
                                                  'User-Agent': 'harbor-twin/1.0'}, method='POST')
            try:
                with urllib.request.urlopen(req, timeout=min(12, remaining)) as r:
                    data = json.loads(r.read(400_000))
                    _note_quota(provider, model, r.headers)
                choice = (data.get('choices') or [{}])[0].get('message', {})
                calls = [{'id': c.get('id'), 'type': 'function', 'function': {'name': c['function']['name'], 'arguments': c['function'].get('arguments') or '{}'}}
                         for c in (choice.get('tool_calls') or []) if c.get('function', {}).get('name') == 'simulate_what_if']
                if force_tool and not calls:
                    skipped.append((model, 'required-tool-missing'))
                    break
                content = (choice.get('content') or '').strip()
                if not content and not calls:
                    skipped.append((model, 'empty'))
                    print(f'[ai] empty answer from {model}: finish={((data.get("choices") or [{}])[0]).get("finish_reason")}', flush=True)
                    break
                return 200, {'content': content, 'tool_calls': calls, 'model': model, 'provider': provider, 'skipped': [m for m, _ in skipped]}
            except urllib.error.HTTPError as e:
                detail = e.read(2000).decode('utf-8', 'replace')
                _note_quota(provider, model, e.headers)
                last_error = (e.code, detail)
                print(f'[ai] {model} HTTP {e.code} (attempt {attempt}): {detail[:300]}', flush=True)
                if e.code in (400, 403, 404) and ('model' in detail.lower() or 'decommission' in detail.lower()):
                    skipped.append((model, e.code))
                    break  # model unavailable: try the next one
                if e.code != 429 and (e.code in (401, 402, 403) or (e.code == 400 and 'api key' in detail.lower()) or 'credits are depleted' in detail or 'billing' in detail.lower()):
                    print(f'[ai] {provider} unusable (key/billing {e.code}); skipping this provider', flush=True)
                    dead.add(provider)
                    _unusable[provider] = time.time() + 600  # re-check after 10 minutes (e.g. credits added)
                    skipped.append((model, e.code))
                    break
                if e.code == 429:
                    wait = _retry_after(e, detail)
                    busy_wait.append(wait)
                    # Only wait on the last provider; otherwise hand over to the fallback right away.
                    later = [p for p, *_ in attempts[attempts.index((provider, base, key, model)) + 1:] if p != provider and p not in dead]
                    if attempt == 1 and wait <= 3 and not later and wait + 1 < deadline - time.monotonic():
                        time.sleep(wait + 0.3)  # per-minute limit frees up within seconds
                        continue
                    skipped.append((model, 429))
                    break  # each model has its own limit: try the next one
                if e.code >= 500 or provider == 'groq':
                    skipped.append((model, e.code))
                    break  # provider trouble: let the next provider answer
                return 502, {'error': f'AI 응답 오류({e.code})'}
            except Exception as e:  # network/timeout
                last_error = (0, str(e))
                print(f'[ai] {provider}/{model} network error: {e}', flush=True)
                skipped.append((model, 'net'))
                break
    if busy_wait:
        secs = max(3, min(60, round(min(busy_wait))))
        return 429, {'error': f'지금 AI 사용이 몰려 잠시 쉬고 있어요. {secs}초 뒤 자동으로 다시 시도할게요.', 'retryAfter': secs}
    print(f'[ai] all providers failed: {skipped}', flush=True)
    return 502, {'error': 'AI 서비스가 일시적으로 응답하지 않습니다. 시뮬레이션은 유지됩니다. 잠시 후 다시 요청하세요.'}


# Generated prose never owns numerical facts, units or the operational verdict.
# Facts are rendered directly from the model in the browser; unsafe prose is replaced.
OUTPUT_POLICY = """
최종 출력 제한(앞의 형식 요청보다 우선):
- simulate_what_if 도구의 인자에는 사용자 질문의 수치를 정확히 전달하세요. 아래 문장 제한은 도구 인자에는 적용하지 않습니다.
- 설명에는 숫자, 숫자로 된 번호 목록, 시간, 수치 단위, 탱크 영문 ID를 쓰지 마세요. 수치는 화면의 원본 표가 담당합니다.
- 숫자가 필요한 부분은 '기록 표의 값', '현재 시연 한도', '추천 탱크'로 표현하세요. 목록은 • 기호를 사용하세요.
- '위험이 없어요', '안전합니다', '문제없습니다', '괜찮아요', '계속 진행해도 됩니다', '안전 기준 만족' 같은 보증·운전 허가 표현을 쓰지 마세요. 시연 기준 내여도 실제 위험 부재를 단정하지 마세요.
- 판정이 시연 기준 내이면 '현재 가정 모델의 표시 기준 이내입니다. 실제 선박의 안전을 보장하는 판정은 아닙니다.'라고 한계를 명시하세요.
- operationAssessment의 판정 등급을 바꾸지 마세요. 자료 부족이면 보류와 확인을 안내하세요.
- 가상 도구에서 evaluatedTransferAssessment가 있으면 사용자가 요청한 이송안의 판정을 우선 설명하세요.
- 보고서에서도 수치·단위를 반복하지 말고 기록의 의미와 검토할 항목만 서술하세요.
"""

_prose_cache = {}
_cache_lock = threading.Lock()
_slots = threading.BoundedSemaphore(3)

def _validate_body(body):
    if not isinstance(body, dict) or body.get('role') not in PROMPTS:
        return '지원하지 않는 AI 역할입니다.'
    if not isinstance(body.get('context', {}), dict):
        return '상태 정보는 객체 형식이어야 합니다.'
    if len(json.dumps(body.get('context', {}), ensure_ascii=False)) > 16000:
        return '상태 기록이 너무 깁니다. 새 작업이나 대화로 다시 요청하세요.'
    if body.get('role') == 'manifest':
        text = body.get('manifest')
        if not isinstance(text, str) or not 10 <= len(text.strip()) <= 6000:
            return '적하목록은 10–6000자로 입력하세요. 긴 목록은 나누어 검토하세요.'
    if body.get('role') == 'chat':
        messages = body.get('messages')
        if not isinstance(messages, list) or not 1 <= len(messages) <= 40:
            return '대화 목록 형식 또는 길이를 확인하세요. 새 대화를 시작할 수 있습니다.'
        for msg in messages:
            if not isinstance(msg, dict) or msg.get('role') not in ('user', 'assistant', 'tool'):
                return '대화 항목 형식을 확인하세요.'
            if msg.get('content') is not None and not isinstance(msg.get('content'), str):
                return '대화 내용은 문자열이어야 합니다.'
            if 'tool_calls' in msg:
                calls = msg['tool_calls']
                if not isinstance(calls, list) or len(calls) > 3:
                    return '가상 도구 호출 형식을 확인하세요.'
                for call in calls:
                    if not isinstance(call, dict) or not isinstance(call.get('function'), dict) or not isinstance(call['function'].get('arguments', '{}'), str):
                        return '가상 도구 인자 형식을 확인하세요.'
    return None

def _assessment(body):
    assessment = body.get('context', {}).get('operationAssessment') or {}
    if body.get('role') == 'chat':
        for msg in reversed(body.get('messages', [])):
            if msg.get('role') == 'tool':
                try:
                    data = json.loads(msg.get('content', '{}'))
                    assessment = data.get('evaluatedTransferAssessment') or data.get('operationAssessment') or assessment
                except (ValueError, TypeError, AttributeError):
                    pass
                break
    return assessment if isinstance(assessment, dict) else {}

def guard_prose(role, content):
    forbidden = (r'안전(?:합니다|해요|하다|한\s*(?:상태|작업|하역)|\s*기준)|괜찮(?:아요|습니다)|'
                 r'(?:위험|리스크|문제)(?:성|요소)?(?:이|가|은|는|도)?\s*(?:전혀\s*|아무(?:런)?\s*)?없|'
                 r'(?:위험|리스크)(?:이|가|은|는)?\s*(?:제로|영)|'
                 r'위험하지\s*않|위험성(?:이|은)?\s*전무|'
                 r'걱정(?:할\s*필요|하지\s*않아도)|'
                 r'(?:계속\s*)?(?:하역|작업|진행)(?:을|를)?\s*(?:계속\s*)?(?:해도|하여도)\s*(?:돼|되|됩|괜찮)|'
                 r'계속\s*(?:하역|진행).*?(?:돼|됩|가능)|'
                 r'(?:no\s+(?:risk|danger)|risk[- ]free|completely\s+safe)|'
                 r'시속|초속|[0-9０-９]|(?:m/s|km/h|mps|톤/초)')
    if not re.search(forbidden, content, re.I):
        return content, False
    if role == 'report':
        return ('[작업 개요]\n작업 상태와 적용 조건은 위 기록 표를 확인하세요.\n'
                '[주요 경과]\n하역과 승인 이력은 아래 주요 기록 원문에 보존되어 있어요.\n'
                '[결과 평가]\n기울기와 이송량은 가정 모델의 기록이며 실제 선박의 운전 허가를 뜻하지 않아요.\n'
                '[방식 비교]\n비교 표에 기록된 결과만 사용하고 서로 다른 조건의 결과를 섞지 마세요.\n'
                '[다음 작업 제안]\n• 적용 출처와 시각을 다시 확인하세요.\n• 추천 방향과 탱크 수량을 담당자가 검토하세요.'), True
    return ('현재 적용 조건의 판정과 수치는 원본 표를 확인하세요. 기상·기울기·탱크 조건을 함께 검토하고 '
            '주의 또는 중지 검토일 때는 작업을 일시정지하고 조건과 추천안을 다시 확인하세요. '
            '이 결과는 시연용 가정 모델이며 실제 운전 여부는 담당자와 승인 자료로 판단해야 해요.'), True

def complete(body):
    error = _validate_body(body)
    if error:
        return 400, {'error': error}
    role = body['role']
    cacheable = role in ('briefing', 'risk', 'weather', 'report')
    stable = json.loads(json.dumps(body))
    stable.get('context', {}).pop('generatedAt', None)
    if isinstance(stable.get('context', {}).get('unloading'), dict):stable['context']['unloading'].pop('elapsed', None)
    key = hashlib.sha256(json.dumps(stable, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    with _cache_lock:
        cached = _prose_cache.get(key)
        if cacheable and cached and time.monotonic() - cached[0] < 30:
            return 200, {**cached[1], 'cached': True}
    if not _slots.acquire(blocking=False):
        return 429, {'error': 'AI 작업이 진행 중입니다. 잠시 후 다시 요청하세요.', 'retryAfter': 5}
    try:
        code, result = _complete_provider(body, time.monotonic() + 35)
        if code == 200:
            if role != 'manifest' and result.get('content'):
                content, guarded = guard_prose(role, result['content'])
                assessment = _assessment(body)
                if assessment.get('level', 0) > 0 and re.search(r'문제(?:가)?\s*없|하역\s*정상|계속\s*(?:해도|진행|하역)|시연\s*기준\s*내', content):
                    content, guarded = guard_prose(role, '안전합니다')
                if guarded and role != 'report' and assessment.get('label') == '시연 기준 내' and not assessment.get('missing'):
                    content = ('현재 가정 모델의 표시 기준 이내입니다. 실제 선박의 안전을 보장하는 판정은 아닙니다. '
                               + content)
                result['content'], result['guarded'] = content, guarded
            a = _assessment(body)
            result.update(generatedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                          assessmentLabel=a.get('label'), assessmentScope=a.get('scope'),
                          qualityChecked=True)
            if cacheable:
                with _cache_lock:
                    for k in list(_prose_cache):
                        if time.monotonic() - _prose_cache[k][0] >= 30:
                            del _prose_cache[k]
                    if len(_prose_cache) >= 128:
                        _prose_cache.pop(next(iter(_prose_cache)))
                    _prose_cache[key] = (time.monotonic(), dict(result))
        return code, result
    except Exception:
        return 502, {'error': 'AI 응답을 처리하지 못했습니다. 시뮬레이션은 유지됩니다. 다시 요청하세요.'}
    finally:
        _slots.release()
