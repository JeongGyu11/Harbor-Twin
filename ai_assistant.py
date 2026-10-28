"""LLM proxy (Groq first, Gemini as fallback) for the ballast-adjustment assistant.

The browser never sees the API key. Prompts live here so the endpoint only serves the
three assistant roles (briefing, risk guidance, chat with what-if simulation tool).
Numbers always come from the physics model in the browser; the LLM explains them.
"""
import os, json, time, threading, urllib.request, urllib.error

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
        with urllib.request.urlopen(req, timeout=15) as r:
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
    return {'configured': bool(key or gkey), 'keyName': name, 'models': list(models()) if key else [],
            'fallback': {'provider': 'gemini', 'configured': bool(gkey), 'keyName': gname, 'models': list(gemini_models()) if gkey else [],
                         'temporarilyUnusable': _unusable.get('gemini', 0) > time.time()},
            'groqQuota': _quota,
            'roles': list(PROMPTS)}

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

_unusable = {}
_quota = {}  # model -> latest Groq rate-limit headers (remaining requests per day, tokens per minute)

def _note_quota(provider, model, headers):
    if provider != 'groq' or not headers:
        return
    q = {k[len('x-ratelimit-'):]: v for k, v in headers.items() if k.lower().startswith('x-ratelimit-')}
    if q:
        _quota[model] = {**{k.lower(): v for k, v in q.items()}, 'seenAt': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())}

def complete(body):
    """Returns (status, payload)."""
    attempts = providers()
    if not attempts:
        return 503, {'error': 'AI 키가 서버에 설정되지 않았습니다.', 'configured': False}
    role = body.get('role')
    if role not in PROMPTS:
        return 400, {'error': '지원하지 않는 AI 역할입니다.'}
    context = json.dumps(body.get('context') or {}, ensure_ascii=False, separators=(',', ':'))[:9000]
    messages = [{'role': 'system', 'content': PROMPTS[role] + '\n\n현재 시뮬레이션 상태 JSON:\n' + context}]
    if role == 'chat':
        messages += _clean_messages(body.get('messages'))
        if len(messages) < 2:
            return 400, {'error': '질문을 입력하세요.'}
    else:
        messages.append({'role': 'user', 'content': '위 상태로 작성해 주세요.'})
    payload = {'messages': messages, 'temperature': 0.15, 'top_p': 0.9, 'max_tokens': 700 if role == 'chat' else 420}
    if role == 'chat':
        payload['tools'] = TOOLS
        payload['tool_choice'] = 'auto'
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
            req = urllib.request.Request(base + '/chat/completions', data=json.dumps(body_out, ensure_ascii=False, separators=(',', ':')).encode(),
                                         headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json',
                                                  'User-Agent': 'harbor-twin/1.0'}, method='POST')
            try:
                with urllib.request.urlopen(req, timeout=40) as r:
                    data = json.loads(r.read(400_000))
                    _note_quota(provider, model, r.headers)
                choice = (data.get('choices') or [{}])[0].get('message', {})
                calls = [{'id': c.get('id'), 'type': 'function', 'function': {'name': c['function']['name'], 'arguments': c['function'].get('arguments') or '{}'}}
                         for c in (choice.get('tool_calls') or []) if c.get('function', {}).get('name') == 'simulate_what_if']
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
                    if attempt == 1 and wait <= 8 and not later:
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
    return 502, {'error': '사용 가능한 AI 모델을 찾지 못했습니다.', 'detail': str(last_error)[:300], 'attempts': [f'{m}:{c}' for m, c in skipped]}
