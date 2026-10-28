"""Groq LLM proxy for the ballast-adjustment assistant.

The browser never sees the API key. Prompts live here so the endpoint only serves the
three assistant roles (briefing, risk guidance, chat with what-if simulation tool).
Numbers always come from the physics model in the browser; the LLM explains them.
"""
import os, json, time, threading, urllib.request, urllib.error

GROQ_URL = os.getenv('GROQ_BASE_URL', 'https://api.groq.com/openai/v1').rstrip('/') + '/chat/completions'
KEY_NAMES = ('GROQ_API_KEY', 'GROQ_KEY', 'GROQ_API', 'GROQ_TOKEN', 'GROQ_APIKEY')
DEFAULT_MODELS = ('openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile')
MAX_BODY = 60_000

def api_key():
    for name in KEY_NAMES:
        value = os.getenv(name, '').strip()
        if value:
            return value, name
    # Local runs: same .env.local file the KMA key uses (never committed).
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env.local')
    try:
        with open(path, encoding='utf-8-sig') as f:
            for line in f:
                name, _, value = line.strip().partition('=')
                if name in KEY_NAMES and value.strip().strip('"').strip("'"):
                    return value.strip().strip('"').strip("'"), name
    except OSError:
        pass
    return '', None

def models():
    preferred = os.getenv('GROQ_MODEL', '').strip()
    return ((preferred,) if preferred else ()) + tuple(m for m in DEFAULT_MODELS if m != preferred)

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
)

PROMPTS = {
    'briefing': BASE + (
        "역할: 평형수 조정 브리핑. 아래 상태를 보고 담당자에게 3~5개의 짧은 줄로 브리핑하세요. 형식:\n"
        "• 현재: (기울기 방향·크기, GM, 하역 진행)\n• 예상: (다음 하역이 기울기에 줄 영향, 60초 예측이 있으면 사용)\n"
        "• 추천: (추천 이송안 출발→도착 탱크, 톤수, 예상 결과, 소요 시간. 없으면 '현재 수위 유지')\n• 주의: (바람·파도·탱크 수위 한계 등 한 줄)\n"
        "마크다운 제목이나 표는 쓰지 말고 위 형식의 줄만 출력하세요."),
    'risk': BASE + (
        "역할: 위험 경고 대응 안내. 현재 위험 단계와 원인을 보고 담당자가 지금 할 일을 안내하세요. 형식:\n"
        "원인: (한 줄 요약)\n즉시 조치:\n1. ...\n2. ...\n3. ...\n확인할 것: (계기·수위·기상 중 한 줄)\n"
        "조치는 이 시뮬레이터에서 가능한 것(하역 일시 중지, 추천 이송 승인, 이송 방향 확인, 하역 간격 늘리기, 기상 재확인)을 우선합니다. "
        "과장하지 말고 4~7줄로 끝내세요."),
    'chat': BASE + (
        "역할: 담당자의 질문에 답합니다. 상태 JSON은 지금 시뮬레이션 화면의 값입니다.\n"
        "- '만약 ~라면'(풍속·풍향·파고·파주기·하역 간격·시연 한도를 바꾼 경우)이나 특정 이송안의 효과를 묻는 질문은 "
        "반드시 simulate_what_if 도구를 호출해 결과로 답하세요. 도구는 현재 화면을 바꾸지 않는 가상 계산입니다.\n"
        "- 답변은 결론 먼저, 근거 숫자, 권장 조치 순으로 6줄 이내로 씁니다.\n"
        "- 이 시뮬레이터와 평형수·하역 안전과 무관한 요청은 정중히 범위를 안내합니다."),
}

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
    def allow(self, ip):
        now = time.time()
        with self.lock:
            for k in list(self.hits):
                self.hits[k] = [t for t in self.hits[k] if now - t < self.window]
                if not self.hits[k]:
                    del self.hits[k]
            total = sum(len(v) for v in self.hits.values())
            mine = self.hits.setdefault(ip, [])
            if len(mine) >= self.per_ip or total >= self.global_limit:
                return False
            mine.append(now)
            return True

limiter = RateLimiter()

def status():
    key, name = api_key()
    return {'configured': bool(key), 'keyName': name, 'models': list(models()), 'roles': list(PROMPTS)}

def _clean_messages(raw):
    out = []
    for m in (raw or [])[-14:]:
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

def complete(body):
    """Returns (status, payload)."""
    key, _ = api_key()
    if not key:
        return 503, {'error': 'AI 키가 서버에 설정되지 않았습니다.', 'configured': False}
    role = body.get('role')
    if role not in PROMPTS:
        return 400, {'error': '지원하지 않는 AI 역할입니다.'}
    context = json.dumps(body.get('context') or {}, ensure_ascii=False)[:9000]
    messages = [{'role': 'system', 'content': PROMPTS[role] + '\n\n현재 시뮬레이션 상태 JSON:\n' + context}]
    if role == 'chat':
        messages += _clean_messages(body.get('messages'))
        if len(messages) < 2:
            return 400, {'error': '질문을 입력하세요.'}
    else:
        messages.append({'role': 'user', 'content': '위 상태로 작성해 주세요.'})
    payload = {'messages': messages, 'temperature': 0.3, 'max_tokens': 700 if role == 'chat' else 420}
    if role == 'chat':
        payload['tools'] = TOOLS
        payload['tool_choice'] = 'auto'
    last_error = None
    skipped = []
    for model in models():
        body_out = {**payload, 'model': model}
        if model.startswith('openai/gpt-oss'):
            body_out['reasoning_effort'] = 'low'
            body_out['max_tokens'] = payload['max_tokens'] + 900
        req = urllib.request.Request(GROQ_URL, data=json.dumps(body_out).encode(),
                                     headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json',
                                              'User-Agent': 'harbor-twin/1.0'}, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                data = json.loads(r.read(400_000))
            choice = (data.get('choices') or [{}])[0].get('message', {})
            calls = [{'id': c.get('id'), 'type': 'function', 'function': {'name': c['function']['name'], 'arguments': c['function'].get('arguments') or '{}'}}
                     for c in (choice.get('tool_calls') or []) if c.get('function', {}).get('name') == 'simulate_what_if']
            content = (choice.get('content') or '').strip()
            if not content and not calls:
                skipped.append((model, 'empty'))
                print(f'[ai] empty answer from {model}: finish={((data.get("choices") or [{}])[0]).get("finish_reason")}', flush=True)
                continue
            return 200, {'content': content, 'tool_calls': calls, 'model': model, 'skipped': [m for m, _ in skipped]}
        except urllib.error.HTTPError as e:
            detail = e.read(2000).decode('utf-8', 'replace')
            last_error = (e.code, detail)
            print(f'[ai] {model} HTTP {e.code}: {detail[:400]}', flush=True)
            if e.code in (400, 403, 404) and ('model' in detail.lower() or 'decommission' in detail.lower()):
                skipped.append((model, e.code))
                continue  # model unavailable: try the next one
            if e.code == 401:
                return 502, {'error': 'AI 키가 올바르지 않습니다. Render 환경변수를 확인하세요.'}
            if e.code == 429:
                return 429, {'error': 'AI 사용량 한도에 잠시 도달했습니다. 잠시 후 다시 시도하세요.'}
            return 502, {'error': f'AI 응답 오류({e.code})'}
        except Exception as e:  # network/timeout
            last_error = (0, str(e))
            return 504, {'error': 'AI 서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.'}
    return 502, {'error': '사용 가능한 AI 모델을 찾지 못했습니다.', 'detail': str(last_error)[:300]}
