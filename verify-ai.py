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
   finally:server.shutdown();server.server_close();worker.join()
if __name__=='__main__':unittest.main()
