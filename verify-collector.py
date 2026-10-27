import tempfile,datetime,unittest,json,threading,urllib.request,functools
from pathlib import Path
from unittest.mock import patch
import observation_server as s
class Tests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.path=Path(self.temp.name)/'obs.sqlite3';self.store=s.Store(self.path)
 def tearDown(self):self.temp.cleanup()
 def sample(self,minutes=0):
  now=datetime.datetime.now(s.KST);return {'station':{'id':'1','distanceKm':10},'observedAt':(now-datetime.timedelta(minutes=minutes)).isoformat(),'fetchedAt':now.isoformat(),'usable':True,'data':{'wind':5}}
 def test_restart_and_duplicate(self):
  r=self.sample();self.store.save('busan',r);self.store.save('busan',r);self.assertEqual(s.Store(self.path).read('busan')['data']['wind'],5)
  with self.store.connect() as db:self.assertEqual(db.execute('SELECT COUNT(*) FROM observations').fetchone()[0],1)
 def test_outage_keeps_previous(self):
  r=self.sample();self.store.save('busan',r)
  with patch.object(s,'get_key',return_value='fixture'),patch.object(s,'upstream',side_effect=ValueError('unavailable')):s.collect_once(self.store)
  self.assertEqual(self.store.read('busan')['observedAt'],r['observedAt']);self.assertEqual(self.store.read('busan')['collection']['error'],'unavailable')
 def test_stale_is_unusable(self):
  self.store.save('busan',self.sample(121));self.assertFalse(self.store.read('busan')['usable'])
 def test_older_does_not_replace(self):
  r=self.sample();self.store.save('busan',r);self.store.save('busan',self.sample(10));self.assertEqual(self.store.read('busan')['observedAt'],r['observedAt'])
 def test_missing_key(self):
  with patch.object(s,'get_key',return_value=''):s.collect_once(self.store)
  self.assertEqual(len(self.store.status()),len(s.PORTS));self.assertIsNone(self.store.read('busan'))
 def test_http_is_cache_only(self):
  self.store.save('busan',self.sample());server=s.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(s.Handler,directory=str(Path(__file__).parent/'dist')));server.store=self.store;t=threading.Thread(target=server.serve_forever,daemon=True);t.start()
  try:
   with patch.object(s,'upstream',side_effect=AssertionError('must not call upstream')):
    with urllib.request.urlopen(f'http://127.0.0.1:{server.server_port}/api/observations?port=busan') as r:self.assertEqual(json.load(r)['storage'],'server-sqlite')
  finally:server.shutdown();server.server_close();t.join()
 def test_scheduler_without_browser(self):
  fired=threading.Event()
  with patch.object(s,'collect_once',side_effect=lambda store:fired.set()) as mock:
   collector=s.Collector(self.store,interval=1);collector.start();self.assertTrue(fired.wait(2));fired.clear();self.assertTrue(fired.wait(3));collector.stop();self.assertGreaterEqual(mock.call_count,2)
 def test_weather_collection_and_restart(self):
  current={'time':datetime.datetime.now(s.KST).strftime('%Y-%m-%dT%H:%M'),'weather_code':61,'temperature_2m':18,'wind_speed_10m':5,'wind_direction_10m':90,'is_day':1}
  payload=[{'current':current,'utc_offset_seconds':32400,'latitude':lat,'longitude':lon} for lat,lon in s.PORTS.values()]
  with patch.object(s,'weather_upstream',return_value=payload):s.collect_weather_once(self.store)
  r=s.Store(self.path).read_weather('busan');self.assertEqual(r['sourceType'],'model_forecast');self.assertEqual(r['weather'],'rain');self.assertTrue(r['usable']);self.assertEqual(len(self.store.weather_status()),7)
  with patch.object(s,'weather_upstream',side_effect=ValueError('fixture outage')):s.collect_weather_once(self.store)
  self.assertEqual(self.store.read_weather('busan')['validAt'],r['validAt']);self.assertEqual(self.store.read_weather('busan')['collection']['error'],'fixture outage')
 def test_weather_stale_and_independent_storage(self):
  when=(datetime.datetime.now(s.KST)-datetime.timedelta(hours=4)).isoformat()
  self.store.save_weather('busan',{'sourceType':'model_forecast','validAt':when,'fetchedAt':when,'weather':'clear'})
  self.assertFalse(self.store.read_weather('busan')['usable']);self.assertIsNone(self.store.read('busan'))
class ActualCacheTests(unittest.TestCase):
 def test_combined_endpoint_reads_cache_only(self):
  with tempfile.TemporaryDirectory() as d:
   store=s.Store(Path(d)/'store.sqlite3');now=datetime.datetime.now(s.KST).isoformat()
   store.save('busan',{'usable':True,'station':{'id':'1','distanceKm':20},'observedAt':now,'fetchedAt':now,'data':{'wind':5}})
   store.save_weather('busan',{'sourceType':'sensor_observation','validAt':now,'observedAt':now,'fetchedAt':now,'station':{'id':'159','distanceKm':10},'weather':'clear'})
   server=s.ThreadingHTTPServer(('127.0.0.1',0),s.Handler);server.store=store;server.actual_weather_store=store
   t=threading.Thread(target=server.serve_forever,daemon=True);t.start()
   try:
    with patch.object(s,'upstream',side_effect=AssertionError('cache only')):
     with urllib.request.urlopen(f'http://127.0.0.1:{server.server_port}/api/environment/latest?port=busan') as r:
      data=json.load(r);self.assertTrue(data['complete']);self.assertEqual(data['weather']['sourceType'],'sensor_observation')
   finally:server.shutdown();server.server_close();t.join()

 def test_bulk_sensor_weather_and_restart(self):
  with tempfile.TemporaryDirectory() as d:
   store=s.Store(Path(d)/'actual.sqlite3');now=datetime.datetime.now(s.KST)
   record={'TM':now.strftime('%Y%m%d%H%M'),'STN':'159','WC':'-9','CA_TOT':'0','RN':'-9','IR':'3','IX':'2','TA':'18.7'}
   with patch.object(s,'get_key',return_value='fixture'),patch.object(s,'upstream',return_value='fixture') as api,patch.object(s,'sfc_stations',return_value=[{'STN_ID':'159','LON':129.03203,'LAT':35.10468,'STN_KO':'Busan'}]),patch.object(s,'sfc_rows',return_value=[record]):s.collect_actual_weather_once(store)
   self.assertEqual(api.call_count,2);r=s.Store(Path(d)/'actual.sqlite3').read_weather('busan');self.assertEqual(r['sourceType'],'sensor_observation');self.assertEqual(r['weather'],'clear');self.assertTrue(r['usable'])
   with patch.object(s,'get_key',return_value='fixture'),patch.object(s,'upstream',side_effect=ValueError('outage')):s.collect_actual_weather_once(store)
   r=store.read_weather('busan');self.assertEqual(r['weather'],'clear');self.assertEqual(r['collection']['error'],'outage')
   old=(now-datetime.timedelta(minutes=121)).isoformat();r.update(validAt=old,observedAt=old)
   with store.connect() as db:db.execute('UPDATE weather_latest SET valid_at=?,payload=? WHERE port=?',(old,json.dumps(r),'busan'))
   self.assertFalse(store.read_weather('busan')['usable'])
class SelectedTests(unittest.TestCase):
 def test_nearest_exact_tie_missing_and_boundary(self):
  t=datetime.datetime(2023,1,24,12,tzinfo=s.KST)
  rows=[{'TM':'202301241100','v':1},{'TM':'202301241300','v':2},{'TM':'202301241200','v':None}]
  def valid(r):
   if r['v'] is None:raise ValueError('missing')
   return r['v']
  when,value,offset=s.nearest_row(rows,t,valid);self.assertEqual((value,offset),(1,-60))
  rows.append({'TM':'202301241200','v':3});self.assertEqual(s.nearest_row(rows,t,valid)[2],0)
  with self.assertRaises(ValueError):s.nearest_row([{'TM':'202301241059','v':4}],t,valid)
 def test_future_rejected_without_network(self):
  t=(datetime.datetime.now(s.KST)+datetime.timedelta(days=1)).strftime('%Y-%m-%dT%H:00')
  with patch.object(s,'upstream',side_effect=AssertionError('network forbidden')):
   with self.assertRaisesRegex(ValueError,'미래'):s.selected_observations('busan',t)
 def test_weather_observation_classification_and_missing(self):
  self.assertEqual(s.observed_weather({'WC':'71'})['weather'],'snow')
  self.assertEqual(s.observed_weather({'WC':'-9','CA_TOT':'0','RN':'0'})['weather'],'clear')
  with self.assertRaises(ValueError):s.observed_weather({'WC':'-9','RN':'-9','CA_TOT':'-9'})
 def test_dry_weather_reporting_codes(self):
  r=s.observed_weather({'WC':'-9','CA_TOT':'0','RN':'-9','IR':'3','IX':'2'})
  self.assertEqual(r['weather'],'clear');self.assertIn('IR=3',r['classificationBasis']);self.assertEqual(r['raw']['IR'],'3')
  for ir,ix in [('4','2'),('3','3'),('3','6')]:
   with self.assertRaises(ValueError):s.observed_weather({'WC':'-9','CA_TOT':'0','RN':'-9','IR':ir,'IX':ix})
 def test_selected_real_rows_and_missing_approval(self):
  stations='# STN_ID LON LAT STN_KO\n1 129.12 35.05 TestBuoy'
  rows='202301241130 1 90 5 6 90 5 6 1010 60 18 20 1 .4 .2 8 90'
  def api(endpoint,params,key):
   if endpoint=='stn_inf.php' and params['inf']=='BUOY':return stations
   if endpoint=='stn_inf.php':return '159 129.032 35.104 0 1 1 1 1 1 159 Busan Busan'
   if endpoint=='kma_buoy.php':return rows
   raise ValueError('kma_sfctm3.php 활용신청 승인 필요 (기상청 HTTP 403)')
  with patch.object(s,'upstream',side_effect=api),patch.object(s,'get_key',return_value='fixture'):
   r=s.selected_observations('busan','2023-01-24T12:00')
  self.assertEqual(r['marine']['offsetMinutes'],-30);self.assertFalse(r['complete']);self.assertIsNone(r['weather']);self.assertIn('403',r['errors']['weather'])
 def test_selected_combines_distinct_observation_times(self):
  stations='# STN_ID LON LAT STN_KO\n1 129.12 35.05 TestBuoy'
  rows='202301241130 1 90 5 6 90 5 6 1010 60 18 20 1 .4 .2 8 90'
  keys='TM STN WD WS GST_WD GST_WS GST_TM PA PS PT PR TA TD HM PV RN RN_DAY RN_JUN RN_INT SD_HR3 SD_DAY SD_TOT WC WP WW CA_TOT CA_MID CH_MIN CT CT_TOP CT_MID CT_LOW VS SS SI ST_GD TS TE_005 TE_01 TE_02 TE_03 ST_SEA WH BF IR IX'.split()
  record={k:'-9' for k in keys};record.update(TM='202301241200',STN='159',WC='61')
  def api(endpoint,params,key):
   if endpoint=='stn_inf.php' and params['inf']=='BUOY':return stations
   if endpoint=='stn_inf.php':return '159 129.032 35.104 0 1 1 1 1 1 159 Busan Busan'
   if endpoint=='kma_buoy.php':return rows
   return ' '.join(record[k] for k in keys)
  with patch.object(s,'upstream',side_effect=api),patch.object(s,'get_key',return_value='fixture'):
   r=s.selected_observations('busan','2023-01-24T12:00')
  self.assertTrue(r['complete']);self.assertEqual(r['weather']['offsetMinutes'],0);self.assertEqual(r['weather']['data']['weather'],'rain');self.assertEqual(r['marine']['offsetMinutes'],-30)
if __name__=='__main__':unittest.main()
