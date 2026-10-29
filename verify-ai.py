import unittest,json,urllib.request,urllib.error,threading,functools,tempfile,os
from pathlib import Path
from unittest.mock import patch
import ai_assistant as a
import observation_server as s
class AI(unittest.TestCase):
 def setUp(self):a._prose_cache.clear()
 def test_bad_input_never_calls_provider(self):
  with patch.object(a,'_complete_provider',side_effect=AssertionError('unexpected provider')):
   for body in [[],{}, {'role':'chat','messages':5},{'role':'chat','messages':[None]},{'role':'chat','messages':[{'role':'assistant','tool_calls':[None]}]},{'role':'weather','context':[]},{'role':'manifest','manifest':'x'*6001}]:
    with self.subTest(body=body):self.assertEqual(a.complete(body)[0],400)
 def test_bad_prose_is_replaced(self):
  for text in ['바람은 시속 20m입니다.','안전합니다.','현재 ２０m/s입니다.','30초 예측을 하세요.','안전 기준을 만족합니다.']:
   with self.subTest(text=text):
    out,changed=a.guard_prose('report',text);self.assertTrue(changed);self.assertNotIn('시속',out);self.assertNotIn('30',out)
 def test_good_prose_preserved(self):self.assertEqual(a.guard_prose('chat','추천 탱크의 방향과 수량을 확인하세요.'),('추천 탱크의 방향과 수량을 확인하세요.',False))
 def test_chat_explains_concept_without_stock_warning(self):
  answer='평형수는 배의 균형을 맞추기 위해 탱크에 넣는 물이에요. 화물을 한쪽에서 내리면 무게 분포가 달라져 반대쪽 탱크로 물을 옮겨 기울기를 줄일 수 있어요.'
  self.assertEqual(a.guard_prose('chat',answer,{'messages':[{'role':'user','content':'평형수가 뭐야?'}]}),(answer,False))
  neutral='안전 기준은 선박의 승인 자료로 확인해야 해요. 이 시연 모델의 기준과는 달라요.'
  self.assertEqual(a.guard_prose('chat',neutral),(neutral,False))
  for question in ['풍속이 뭐야?','평형수 이송의 원리가 뭐야?','왜 평형수를 이송해?']:
   self.assertFalse(a._needs_simulation(question))
  for question in ['풍속 20m/s면 계속해도 돼?','P-A에서 S-A로 200t 옮기면?','다음 화물 내리면?']:
   self.assertTrue(a._needs_simulation(question))
 def test_chat_grounded_values_and_units_survive(self):
  body={'context':{'heelDeg':-.07,'gmM':2.4,'tanks':[{'tonnes':600}]*4,'unloading':{'containersTotal':72,'elapsed':'02:30'}}}
  answer='지금은 좌현으로 0.07도 기울었어요. 추정 GM은 2.4m이고 탱크는 4개이며 각 600톤이에요. 전체 화물은 72개이고 150초가 지났어요.'
  self.assertEqual(a.guard_prose('chat',answer,body),(answer,False))
  wrong,changed=a.guard_prose('chat','추정 GM은 2.4km예요. 평형수는 균형을 맞추는 물이에요.',body)
  self.assertTrue(changed);self.assertNotIn('2.4km',wrong);self.assertIn('균형을 맞추는 물',wrong)
 def test_chat_removes_only_bad_sentences(self):
  body={'context':{'gmM':2.4}}
  text='평형수는 무게 분포를 조절하는 물이에요. 위험이 없어요. 추정 GM은 2.4m예요. 화물은 999톤이에요.'
  out,guarded=a.guard_prose('chat',text,body)
  self.assertTrue(guarded);self.assertIn('무게 분포',out);self.assertIn('2.4m',out)
  self.assertNotIn('위험이 없',out);self.assertNotIn('999',out);self.assertNotIn('원본 표를 확인',out)
 def test_chat_question_numbers_are_not_computed_results(self):
  body={'context':{'environment':{'windMps':20}},'messages':[{'role':'user','content':'화물은 999톤인가요?'}]}
  for text in ['화물은 999톤이에요.','화물은 20톤이에요.','풍속은 -20m/s예요.']:
   out,changed=a.guard_prose('chat',text,body);self.assertTrue(changed);self.assertNotIn(text,out)
 def test_chat_successful_tool_values_survive(self):
  tool={'conditions':{'windMps':20},'withoutTransfer':{'peakWithWavesDeg':.62},'operationAssessment':{'level':2,'label':'중지 검토'}}
  body={'messages':[{'role':'tool','content':json.dumps(tool)}]}
  text='가상 풍속은 20m/s이고 예상 최대 기울기는 0.62도예요. 시연 기준에서 중지 검토에 해당해요.'
  self.assertEqual(a.guard_prose('chat',text,body),(text,False))
  body['messages'][0]['content']=json.dumps({'error':'계산 실패','peakWithWavesDeg':.62})
  self.assertTrue(a.guard_prose('chat','예상 최대 기울기는 0.62도예요.',body)[1])
 def test_chat_complete_preserves_relevance_with_partial_guard(self):
  with patch.object(a,'_complete_provider',return_value=(200,{'content':'좌현은 선수를 바라볼 때 왼쪽이에요. 위험이 없어요.'})):
   _,out=a.complete({'role':'chat','context':{},'messages':[{'role':'user','content':'좌현은 어디야?'}]})
  self.assertIn('선수를 바라볼 때 왼쪽',out['content']);self.assertNotIn('위험이 없',out['content']);self.assertEqual(out['guardMode'],'partial')
 def test_no_absolute_safety_claim_in_any_prose_role(self):
  claims=['현재 기울기가 아주 작은 수준이라 위험이 없어요.', '위험은 전혀 없습니다.', '리스크가 없습니다.',
          '문제없이 하역할 수 있습니다.', '위험하지 않습니다.', '위험성이 전무합니다.',
          '작업을 계속해도 됩니다.', '하역해도 돼요.', 'There is no risk.', 'This is completely safe.']
  for role in ['chat','weather','briefing','risk','report']:
   for text in claims:
    with self.subTest(role=role,text=text):
     out,changed=a.guard_prose(role,text);self.assertTrue(changed);self.assertNotEqual(out,text)
 def test_model_scope_explanation_is_preserved(self):
  text='현재 가정 모델의 표시 기준 이내입니다. 실제 선박의 안전을 보장하는 판정은 아닙니다.'
  self.assertEqual(a.guard_prose('weather',text),(text,False))
 def test_safety_claim_guard_is_independent_of_assessment_level(self):
  for assessment in [{'level':0,'label':'시연 기준 내','missing':[]},
                     {'level':0,'label':'자료 부족 · 판정 보류','missing':['시정']},
                     {'level':1,'label':'주의'},{'level':2,'label':'중지 검토'}]:
   with self.subTest(assessment=assessment),patch.object(a,'_complete_provider',return_value=(200,{'content':'위험이 없어요.'})):
    code,r=a.complete({'role':'weather','context':{'operationAssessment':assessment}})
    self.assertEqual(code,200);self.assertTrue(r['guarded']);self.assertEqual(r['assessmentLabel'],assessment['label'])
    self.assertNotIn('위험이 없',r['content'])
    self.assertEqual('현재 가정 모델의 표시 기준 이내입니다.' in r['content'],assessment['label']=='시연 기준 내')
 def test_guarded_content_is_the_only_cached_content(self):
  with patch.object(a,'_complete_provider',return_value=(200,{'content':'위험이 없어요.'})) as provider:
   body={'role':'weather','context':{'operationAssessment':{'level':0,'label':'시연 기준 내','missing':[]}}}
   a.complete(body);_,cached=a.complete(body)
   self.assertTrue(cached['cached']);self.assertTrue(cached['guarded']);self.assertNotIn('위험이 없',cached['content']);self.assertEqual(provider.call_count,1)
 def test_verdict_and_guard(self):
  with patch.object(a,'_complete_provider',return_value=(200,{'content':'기준 내이므로 계속 진행해도 됩니다.'})):
   code,r=a.complete({'role':'chat','context':{'operationAssessment':{'level':2,'label':'중지 검토'}},'messages':[{'role':'user','content':'계속해도 돼?'}]})
   self.assertEqual(code,200);self.assertEqual(r['assessmentLabel'],'중지 검토');self.assertTrue(r['guarded'])
 def test_requested_transfer_assessment_wins(self):
  body={'role':'chat','context':{'operationAssessment':{'label':'자료 부족'}},'messages':[{'role':'user','content':'물을 옮기면?'},{'role':'tool','content':json.dumps({'operationAssessment':{'label':'주의'},'evaluatedTransferAssessment':{'label':'중지 검토'}})}]}
  self.assertEqual(a._assessment(body)['label'],'중지 검토')
 def test_condition_question_requires_tool(self):
  calls=[]
  class Response:
   headers={}
   def __enter__(self):return self
   def __exit__(self,*args):pass
   def read(self,*args):return json.dumps({'choices':[{'message':{'tool_calls':[{'id':'test','function':{'name':'simulate_what_if','arguments':'{"wind_speed":20}'}}]}}]}).encode()
  def open_request(req,**kw):calls.append(json.loads(req.data));return Response()
  with patch.object(a,'providers',return_value=[('groq','https://invalid.example','fixture','test')]),patch.object(a.urllib.request,'urlopen',side_effect=open_request):
   code,r=a._complete_provider({'role':'chat','context':{},'messages':[{'role':'user','content':'풍속 20m/s면 계속해도 돼?'}]},a.time.monotonic()+10)
   self.assertEqual(code,200);self.assertEqual(calls[0]['tool_choice']['function']['name'],'simulate_what_if');self.assertEqual(json.loads(r['tool_calls'][0]['function']['arguments'])['wind_speed'],20)
 def test_required_tool_cannot_be_skipped(self):
  class Response:
   headers={}
   def __enter__(self):return self
   def __exit__(self,*args):pass
   def read(self,*args):return json.dumps({'choices':[{'message':{'content':'괜찮아요'}}]}).encode()
  with patch.object(a,'providers',return_value=[('groq','https://invalid.example','fixture','test')]),patch.object(a.urllib.request,'urlopen',return_value=Response()):
   code,r=a._complete_provider({'role':'chat','messages':[{'role':'user','content':'풍속 20m/s면?'}]},a.time.monotonic()+10)
   self.assertEqual(code,502)
 def test_provider_exception_json(self):
  with patch.object(a,'_complete_provider',side_effect=TypeError('private internal detail')):
   code,r=a.complete({'role':'weather'});self.assertEqual(code,502);self.assertNotIn('private',str(r))
 def test_cache(self):
  with patch.object(a,'_complete_provider',return_value=(200,{'content':'기록 표를 확인하세요.'})) as f:
   for stamp in ['first','second']:self.assertEqual(a.complete({'role':'briefing','context':{'generatedAt':stamp}})[0],200)
   self.assertEqual(f.call_count,1)
 def test_concurrency(self):
  with patch.object(a,'_slots') as slot:
   slot.acquire.return_value=False;self.assertEqual(a.complete({'role':'weather'})[0],429)
 def test_deadline(self):
  with patch.object(a,'providers',return_value=[('groq','https://invalid.example','fixture','test')]),patch.object(a.urllib.request,'urlopen',side_effect=AssertionError('late network')):
   self.assertEqual(a._complete_provider({'role':'weather'},0)[0],504)
 def test_daily_limit(self):
  with patch.dict(os.environ,{'AI_DAILY_LIMIT':'1'}):
   limiter=a.RateLimiter();self.assertTrue(limiter.allow('one'));self.assertFalse(limiter.allow('two'))
 def test_trust_boundary(self):
  class H:headers={'X-Forwarded-For':'198.51.100.1'};client_address=('127.0.0.1',1)
  with patch.dict(os.environ,{'TRUST_PROXY_HOPS':'0'}):self.assertEqual(s.client_ip(H()),'127.0.0.1')
 def test_module_mime(self):
  self.assertEqual(s.Handler.extensions_map['.mjs'],'text/javascript')
 def test_separate_frontend_origin(self):
  class H:headers={'Origin':'https://harbor-twin.onrender.com','Host':'harbor-twin-server.onrender.com'}
  self.assertTrue(s._origin_ok(H())[1])
 def test_http_json_error_and_cors(self):
  with tempfile.TemporaryDirectory() as d:
   server=s.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(s.Handler,directory=d));worker=threading.Thread(target=server.serve_forever,daemon=True);worker.start()
   try:
    base=f'http://127.0.0.1:{server.server_port}'
    req=urllib.request.Request(base+'/api/ai/complete',data=json.dumps({'role':'chat','messages':[None]}).encode(),headers={'Content-Type':'application/json'},method='POST')
    with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(req,timeout=3)
    self.assertEqual(error.exception.code,400);self.assertIn('error',json.loads(error.exception.read()))
    req=urllib.request.Request(base+'/api/ai/complete',method='OPTIONS',headers={'Origin':'http://localhost:4174'})
    with urllib.request.urlopen(req,timeout=3) as r:self.assertEqual(r.status,204);self.assertIn('POST',r.headers['Access-Control-Allow-Methods'])
    body={'role':'weather','context':{'operationAssessment':{'level':0,'label':'시연 기준 내','missing':[]}}}
    req=urllib.request.Request(base+'/api/ai/complete',data=json.dumps(body).encode(),headers={'Content-Type':'application/json'},method='POST')
    with patch.object(a,'_complete_provider',return_value=(200,{'content':'현재 기울기가 아주 작은 수준이라 위험이 없어요.'})):
     with urllib.request.urlopen(req,timeout=3) as response:out=json.load(response)
    self.assertTrue(out['guarded']);self.assertTrue(out['qualityChecked']);self.assertNotIn('위험이 없',out['content'])
    self.assertIn('실제 선박의 안전을 보장하는 판정은 아닙니다.',out['content'])
    body={'role':'chat','context':{'gmM':2.4},'messages':[{'role':'user','content':'GM이 뭐야?'}]}
    req=urllib.request.Request(base+'/api/ai/complete',data=json.dumps(body).encode(),headers={'Content-Type':'application/json'},method='POST')
    with patch.object(a,'_complete_provider',return_value=(200,{'content':'GM은 배가 바로 서려는 성질을 나타내는 지표예요. 현재 추정 GM은 2.4m예요.'})):
     with urllib.request.urlopen(req,timeout=3) as response:out=json.load(response)
    self.assertFalse(out['guarded']);self.assertIn('현재 추정 GM은 2.4m',out['content']);self.assertNotIn('원본 표를 확인',out['content'])
   finally:server.shutdown();server.server_close();worker.join()
if __name__=='__main__':unittest.main()
