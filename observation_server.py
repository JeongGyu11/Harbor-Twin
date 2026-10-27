"""Local KMA observation proxy. KMA_API_KEY stays server-side. No mock fallback."""
import os,json,math,datetime,urllib.request,urllib.parse,urllib.error,sqlite3,threading,time,signal,functools,contextlib
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
KST=datetime.timezone(datetime.timedelta(hours=9))
PORTS={'busan':(35.05,129.12),'busanNew':(35.04,128.81),'incheon':(37.42,126.5),'ulsan':(35.43,129.43),'gwangyang':(34.9,127.72),'pyeongtaek':(36.97,126.78),'pohang':(36.10,129.45)}
def distance(a,b):
 p,q=map(math.radians,[a[0],b[0]]);dp=q-p;dl=math.radians(b[1]-a[1]);return 6371*2*math.asin(min(1,math.sqrt(math.sin(dp/2)**2+math.cos(p)*math.cos(q)*math.sin(dl/2)**2)))
def table(text,kind):
 fallback=['STN_ID','LON','LAT','STN_SP','HT','AD','STN_KO','STN_EN','FCT_ID'] if kind=='stations' else ['TM','STN','WD1','WS1','WS1_GST','WD2','WS2','WS2_GST','PA','HM','TA','TW','WH_MAX','WH_SIG','WH_AVE','WP','WO']
 header=None;rows=[]
 for raw in text.splitlines():
  line=raw.strip()
  if not line:continue
  if line.startswith('#'):
   cells=line.lstrip('#').split()
   if ('LON' in cells and 'LAT' in cells) or ('WH_SIG' in cells and 'WP' in cells):header=cells
   continue
  values=line.split();keys=header or fallback
  if len(values)<len(keys):continue
  row=dict(zip(keys,values))
  if kind=='stations':row['STN_ID']=row.get('STN_ID') or row.get('STN') or values[0]
  if kind!='stations':row['TM']=row.get('TM') or row.get('YYMMDDHHMI') or row.get('YYMMDDHHMM') or values[0]
  try:
   if kind=='stations':
    lat,lon=float(row['LAT']),float(row['LON'])
    if not(25<lat<45 and 120<lon<140):continue
   else:datetime.datetime.strptime(row['TM'],'%Y%m%d%H%M')
   rows.append(row)
  except (ValueError,KeyError):continue
 if not rows:raise ValueError('공식 응답에서 유효한 자료를 읽지 못했습니다. 인증·활용승인 또는 응답 형식을 확인하세요.')
 return rows

def get_key():
 key=os.getenv('KMA_API_KEY','').strip()
 if not key:
  path=Path(__file__).with_name('.env.local')
  if path.exists():
   for line in path.read_text(encoding='utf-8-sig').splitlines():
    if line.startswith('KMA_API_KEY='):key=line.split('=',1)[1].strip().strip('"').strip("'")
 return key

def upstream(endpoint,params,key):
 query=urllib.parse.urlencode({**params,'authKey':key})
 try:
  with urllib.request.urlopen('https://apihub.kma.go.kr/api/typ01/url/'+endpoint+'?'+query,timeout=20) as r:raw=r.read(2_000_000)
 except urllib.error.HTTPError as e:
  if e.code==403:raise ValueError(endpoint+' 활용신청 승인 필요 (기상청 HTTP 403). API허브에서 해당 관측자료를 신청하세요.') from None
  raise ValueError('기상청 API HTTP 오류: '+str(e.code)) from None
 except Exception:raise ValueError('기상청 API 통신 실패. 인증키·활용승인·네트워크 상태를 확인하세요.') from None
 try:return raw.decode('utf-8')
 except UnicodeDecodeError:return raw.decode('cp949',errors='replace')

def observation(port,key,stations=None,observations=None):
 if stations is None:stations=table(upstream('stn_inf.php',{'inf':'BUOY','stn':0,'help':1},key),'stations')
 ranked=sorted(({**s,'distanceKm':distance(PORTS[port],(float(s['LAT']),float(s['LON'])))} for s in stations),key=lambda s:s['distanceKm'])
 nearest=ranked[0];d=nearest['distanceKm']
 mapping={p:{'id':min(stations,key=lambda s:distance(coords,(float(s['LAT']),float(s['LON']))))['STN_ID']} for p,coords in PORTS.items()}
 rows=observations if observations is not None else table(upstream('kma_buoy.php',{'stn':nearest['STN_ID'],'help':1},key),'observations')
 rows=[r for r in rows if r.get('STN',r.get('STN_ID'))==nearest['STN_ID']]
 if not rows:raise ValueError('가장 가까운 부이의 현재 관측값이 없습니다. 예보로 자동 대체하지 않습니다.')
 row=max(rows,key=lambda r:r['TM']);when=datetime.datetime.strptime(row['TM'],'%Y%m%d%H%M').replace(tzinfo=KST);age=(datetime.datetime.now(KST)-when).total_seconds()/60
 def value(name,low,high):
  try:v=float(row[name])
  except (KeyError,ValueError):raise ValueError('관측 항목 누락: '+name) from None
  if not math.isfinite(v) or not low<=v<=high:raise ValueError('관측 결측 또는 범위 초과: '+name)
  return v
 # Do not use the last valid value from a different time or a different station.
 data={'wind':value('WS1',0,60),'windDirection':value('WD1',0,360),'height':value('WH_SIG',0,10),'period':value('WP',2,30),'direction':value('WO',0,360)}
 station={'id':nearest['STN_ID'],'name':nearest['STN_KO'],'lat':float(nearest['LAT']),'lon':float(nearest['LON']),'distanceKm':round(d,2)}
 return {'source':'기상청 해양기상부이 관측','station':station,'observedAt':when.isoformat(),'ageMinutes':round(age,1),'fetchedAt':datetime.datetime.now(KST).isoformat(),'usable':-5<=age<=120 and d<=150,'warning': '관측이 120분 이상 지연됐거나 관측소가 150 km 밖이면 적용하지 않습니다. 항만 내부 관측이 아닌 주변 해역 자료입니다.','data':data,'mapping':mapping}

def utcnow():return datetime.datetime.now(datetime.timezone.utc).isoformat()

class Store:
 def __init__(self,path):
  self.path=str(path);Path(path).parent.mkdir(parents=True,exist_ok=True)
  with self.connect() as db:
   db.execute('PRAGMA journal_mode=WAL')
   db.execute('CREATE TABLE IF NOT EXISTS observations(port TEXT, station TEXT, observed_at TEXT, fetched_at TEXT, payload TEXT, PRIMARY KEY(port,station,observed_at))')
   db.execute('CREATE TABLE IF NOT EXISTS latest(port TEXT PRIMARY KEY, observed_at TEXT, payload TEXT)')
   db.execute('CREATE TABLE IF NOT EXISTS weather_latest(port TEXT PRIMARY KEY, valid_at TEXT, payload TEXT)')
   db.execute('CREATE TABLE IF NOT EXISTS weather_history(port TEXT, valid_at TEXT, fetched_at TEXT, payload TEXT, PRIMARY KEY(port,valid_at))')
   db.execute('CREATE TABLE IF NOT EXISTS weather_status(port TEXT PRIMARY KEY, attempted_at TEXT, succeeded_at TEXT, error TEXT)')
   db.execute('CREATE TABLE IF NOT EXISTS collection_status(port TEXT PRIMARY KEY, attempted_at TEXT, succeeded_at TEXT, error TEXT)')
 @contextlib.contextmanager
 def connect(self):
  db=sqlite3.connect(self.path,timeout=15)
  try:
   with db:yield db
  finally:db.close()
 def save(self,port,result):
  if not result['usable']:raise ValueError('새 관측이 지연·거리 제한을 초과했습니다. 기존 저장값을 유지합니다.')
  payload=json.dumps(result,ensure_ascii=False);now=utcnow()
  with self.connect() as db:
   db.execute('INSERT INTO observations VALUES(?,?,?,?,?) ON CONFLICT(port,station,observed_at) DO UPDATE SET fetched_at=excluded.fetched_at,payload=excluded.payload',(port,result['station']['id'],result['observedAt'],result['fetchedAt'],payload))
   db.execute('INSERT INTO latest VALUES(?,?,?) ON CONFLICT(port) DO UPDATE SET observed_at=excluded.observed_at,payload=excluded.payload WHERE excluded.observed_at>=latest.observed_at',(port,result['observedAt'],payload))
   db.execute('INSERT INTO collection_status VALUES(?,?,?,NULL) ON CONFLICT(port) DO UPDATE SET attempted_at=excluded.attempted_at,succeeded_at=excluded.succeeded_at,error=NULL',(port,now,now))
 def fail(self,port,message):
  with self.connect() as db:db.execute('INSERT INTO collection_status VALUES(?,?,NULL,?) ON CONFLICT(port) DO UPDATE SET attempted_at=excluded.attempted_at,error=excluded.error',(port,utcnow(),message))
 def status(self):
  with self.connect() as db:return {r[0]:{'attemptedAt':r[1],'succeededAt':r[2],'error':r[3]} for r in db.execute('SELECT * FROM collection_status')}
 def read(self,port):
  with self.connect() as db:row=db.execute('SELECT payload FROM latest WHERE port=?',(port,)).fetchone()
  if not row:return None
  result=json.loads(row[0]);age=(datetime.datetime.now(KST)-datetime.datetime.fromisoformat(result['observedAt'])).total_seconds()/60
  result.update(ageMinutes=round(age,1),usable=-5<=age<=120 and result['station']['distanceKm']<=150,servedAt=utcnow(),storage='server-sqlite',collection=self.status().get(port,{}))
  return result
 def save_weather(self,port,result):
  payload=json.dumps(result,ensure_ascii=False);now=utcnow()
  with self.connect() as db:
   db.execute('INSERT INTO weather_latest VALUES(?,?,?) ON CONFLICT(port) DO UPDATE SET valid_at=excluded.valid_at,payload=excluded.payload WHERE excluded.valid_at>=weather_latest.valid_at',(port,result['validAt'],payload))
   db.execute('INSERT INTO weather_history VALUES(?,?,?,?) ON CONFLICT(port,valid_at) DO UPDATE SET fetched_at=excluded.fetched_at,payload=excluded.payload',(port,result['validAt'],result['fetchedAt'],payload))
   db.execute('INSERT INTO weather_status VALUES(?,?,?,NULL) ON CONFLICT(port) DO UPDATE SET attempted_at=excluded.attempted_at,succeeded_at=excluded.succeeded_at,error=NULL',(port,now,now))
 def fail_weather(self,port,message):
  with self.connect() as db:db.execute('INSERT INTO weather_status VALUES(?,?,NULL,?) ON CONFLICT(port) DO UPDATE SET attempted_at=excluded.attempted_at,error=excluded.error',(port,utcnow(),message))
 def weather_status(self):
  with self.connect() as db:return {r[0]:{'attemptedAt':r[1],'succeededAt':r[2],'error':r[3]} for r in db.execute('SELECT * FROM weather_status')}
 def read_weather(self,port):
  with self.connect() as db:row=db.execute('SELECT payload FROM weather_latest WHERE port=?',(port,)).fetchone()
  if not row:return None
  result=json.loads(row[0]);now=datetime.datetime.now(KST)
  age=(now-datetime.datetime.fromisoformat(result['validAt'])).total_seconds()/60
  fetched_age=(now-datetime.datetime.fromisoformat(result['fetchedAt'])).total_seconds()/60
  result.update(ageMinutes=round(age,1),fetchAgeMinutes=round(fetched_age,1),usable=-15<=age<=180 and 0<=fetched_age<=120,servedAt=utcnow(),storage='server-sqlite',collection=self.weather_status().get(port,{}))
  if result.get('sourceType')=='sensor_observation':result['usable']=result['usable'] and age<=120 and result['station']['distanceKm']<=150
  return result
 def prune(self):
  cutoff=(datetime.datetime.now(KST)-datetime.timedelta(days=30)).isoformat()
  with self.connect() as db:
   db.execute('DELETE FROM observations WHERE observed_at<?',(cutoff,))
   db.execute('DELETE FROM weather_history WHERE valid_at<?',(cutoff,))

def collect_once(store):
 key=get_key()
 try:
  if not key:raise ValueError('KMA_API_KEY 미설정')
  stations=table(upstream('stn_inf.php',{'inf':'BUOY','stn':0,'help':1},key),'stations')
  rows=table(upstream('kma_buoy.php',{'stn':0,'help':1},key),'observations')
 except Exception as error:
  message=str(error) if isinstance(error,ValueError) else '공식 자료 수집 실패'
  for port in PORTS:store.fail(port,message)
  return
 for port in PORTS:
  try:store.save(port,observation(port,key,stations,rows))
  except ValueError as error:store.fail(port,str(error))
  except Exception:store.fail(port,'관측 처리 실패')
 store.prune()

def weather_kind(code):
 if code==0:return 'clear'
 if code<=3:return 'cloud'
 if code in (45,48):return 'fog'
 if 71<=code<=77 or code in (85,86):return 'snow'
 return 'rain'

def weather_upstream():
 params={'latitude':','.join(str(p[0]) for p in PORTS.values()),'longitude':','.join(str(p[1]) for p in PORTS.values()),'current':'weather_code,temperature_2m,wind_speed_10m,wind_direction_10m,is_day','wind_speed_unit':'ms','timezone':'Asia/Seoul'}
 url='https://api.open-meteo.com/v1/forecast?'+urllib.parse.urlencode(params)
 try:
  with urllib.request.urlopen(url,timeout=30) as r:data=json.loads(r.read(3_000_000))
 except Exception:raise ValueError('Open-Meteo 날씨 수집 통신 실패') from None
 if not isinstance(data,list) or len(data)!=len(PORTS):raise ValueError('항구별 날씨 응답 수 불일치')
 return data

def collect_weather_once(store):
 try:results=weather_upstream()
 except Exception as error:
  for port in PORTS:store.fail_weather(port,str(error) if isinstance(error,ValueError) else '날씨 수집 실패')
  return
 for (port,coords),data in zip(PORTS.items(),results):
  try:
   current=data['current'];names=['weather_code','temperature_2m','wind_speed_10m','wind_direction_10m','is_day']
   if any(not isinstance(current.get(k),(int,float)) or not math.isfinite(current[k]) for k in names):raise ValueError('날씨 응답 결측')
   code=int(current['weather_code'])
   if code not in (0,1,2,3,45,48,51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99):raise ValueError('알 수 없는 날씨 코드')
   if data.get('utc_offset_seconds')!=32400:raise ValueError('날씨 시간대 응답 불일치')
   valid=datetime.datetime.fromisoformat(current['time']).replace(tzinfo=KST)
   if abs((datetime.datetime.now(KST)-valid).total_seconds())>10800:raise ValueError('날씨 기준시각 지연·범위 초과')
   payload={'source':'Open-Meteo 모델 예보','sourceType':'model_forecast','provider':'Open-Meteo','validAt':valid.isoformat(),'fetchedAt':datetime.datetime.now(KST).isoformat(),'weather':weather_kind(code),'weatherCode':code,'temperature':current['temperature_2m'],'wind':current['wind_speed_10m'],'windDirection':current['wind_direction_10m'],'isDay':current['is_day'],'requestedCoordinates':list(coords),'apiCoordinates':[data['latitude'],data['longitude']]}
   store.save_weather(port,payload)
  except (KeyError,ValueError,TypeError):store.fail_weather(port,'날씨 결측·시간대·응답 형식 오류')
 store.prune()

class Collector:
 def __init__(self,store,interval=300,job=None):self.store=store;self.job=job or collect_once;self.interval=interval;self.stop_event=threading.Event();self.thread=threading.Thread(target=self.run,name='kma-collector',daemon=True)
 def start(self):self.thread.start()
 def run(self):
  while not self.stop_event.is_set():
   started=time.monotonic()
   try:self.job(self.store)
   except Exception:
    for port in PORTS:
     if self.job in (collect_weather_once,collect_actual_weather_once):self.store.fail_weather(port,'날씨 수집 회차 오류 · 다음 주기 재시도')
     else:self.store.fail(port,'수집 회차 오류 · 다음 주기 재시도')
   if self.stop_event.wait(max(1,self.interval-(time.monotonic()-started))):break
 def stop(self):self.stop_event.set();self.thread.join(timeout=45)

def nearest_row(rows,target,valid,window=60):
 candidates=[]
 for row in rows:
  try:
   when=datetime.datetime.strptime(row['TM'],'%Y%m%d%H%M').replace(tzinfo=KST)
   delta=(when-target).total_seconds()/60
   if abs(delta)>window or when>datetime.datetime.now(KST):continue
   data=valid(row)
   candidates.append((abs(delta),when>target,when,row,data,delta))
  except (KeyError,ValueError,TypeError):continue
 if not candidates:raise ValueError('선택 시각 앞뒤 1시간 이내 유효한 실제 관측이 없습니다.')
 _,_,when,row,data,delta=min(candidates,key=lambda x:(x[0],x[1]))
 return when,data,delta

def observed_weather(row):
 def number(key):
  try:v=float(row[key]);return v if math.isfinite(v) and v>=0 else None
  except (KeyError,ValueError):return None
 wc=number('WC');cloud=number('CA_TOT');rain=number('RN')
 kind=None;basis='현재일기 관측 코드(WC)'
 if wc is not None and wc.is_integer() and wc<=99:
  wc=int(wc)
  if wc in (22,26,36,37,38,39) or 70<=wc<=79 or wc in (85,86):kind='snow'
  elif wc in (11,12,28) or 40<=wc<=49:kind='fog'
  elif wc in (20,21,23,24,25,27,29) or 50<=wc<=69 or 80<=wc<=84 or 87<=wc<=99:kind='rain'
 # Without a reported phenomenon, only classify using measured cloud and precipitation.
 if kind is None:
  basis='관측 강수량·운량 기반 시각 분류(예보 아님)'
  if rain is not None and rain>0:kind='rain'
  elif (rain==0 or (rain is None and number('IR')==3 and number('IX') in (2,5))) and cloud is not None and cloud<=10:
   kind='clear' if cloud<=2 else 'cloud'
   if rain is None:basis='실제 운량 + IR=3(무강수)·IX=2/5(유의 현상 없음) 보고 코드 기반 분류'
 if kind is None:raise ValueError('날씨 코드·강수량·운량 결측으로 날씨를 분류할 수 없습니다.')
 return {'weather':kind,'classificationBasis':basis,'raw':{k:row.get(k) for k in ('WC','WW','CA_TOT','RN','RN_INT','TA','VS','IR','IX')}}

def sfc_stations(text):
 rows=[]
 for line in text.splitlines():
  if line.startswith('#'):continue
  v=line.split()
  try:
   if len(v)<12:continue
   lon,lat=float(v[1]),float(v[2])
   if not (25<lat<45 and 120<lon<140):continue
   rows.append({'STN_ID':v[0],'LON':lon,'LAT':lat,'STN_KO':v[10]})
  except ValueError:continue
 if not rows:raise ValueError('지상 관측소 목록을 읽지 못했습니다.')
 return rows

def sfc_rows(text):
 keys='TM STN WD WS GST_WD GST_WS GST_TM PA PS PT PR TA TD HM PV RN RN_DAY RN_JUN RN_INT SD_HR3 SD_DAY SD_TOT WC WP WW CA_TOT CA_MID CH_MIN CT CT_TOP CT_MID CT_LOW VS SS SI ST_GD TS TE_005 TE_01 TE_02 TE_03 ST_SEA WH BF IR IX'.split()
 return [dict(zip(keys,v)) for line in text.splitlines() if not line.startswith('#') and len(v:=line.split())>=len(keys)]

def selected_observations(port,local_time):
 if port not in PORTS:raise ValueError('지원하지 않는 항구입니다.')
 try:
  target=datetime.datetime.strptime(local_time,'%Y-%m-%dT%H:%M').replace(tzinfo=KST)
  if target.minute!=0:raise ValueError()
 except (ValueError,TypeError):raise ValueError('한국시간 날짜·시간을 정각으로 선택하세요.') from None
 if target>datetime.datetime.now(KST):raise ValueError('미래 시각에는 실제 관측이 없습니다. 현재·과거 시각을 선택하세요.')
 key=get_key()
 if not key:raise ValueError('서버 KMA_API_KEY 설정이 필요합니다.')
 result={'requestedAt':target.isoformat(),'portKey':port,'sourceType':'sensor_observation','fetchedAt':datetime.datetime.now(KST).isoformat(),'marine':None,'weather':None,'errors':{}}
 def station_info(s):return {'id':s['STN_ID'],'name':s['STN_KO'],'lat':float(s['LAT']),'lon':float(s['LON']),'distanceKm':round(distance(PORTS[port],(float(s['LAT']),float(s['LON']))),2)}
 def nearest(stations):
  st=min(stations,key=lambda s:distance(PORTS[port],(float(s['LAT']),float(s['LON']))))
  if station_info(st)['distanceKm']>150:raise ValueError('가장 가까운 관측소가 150 km 밖입니다.')
  return st
 try:
  st=nearest(table(upstream('stn_inf.php',{'inf':'BUOY','stn':0,'tm':target.strftime('%Y%m%d%H%M'),'help':1},key),'stations'))
  rows=[]
  for offset in (-60,0,60):
   query_time=min(target+datetime.timedelta(minutes=offset),datetime.datetime.now(KST))
   try:rows.extend(table(upstream('kma_buoy.php',{'tm':query_time.strftime('%Y%m%d%H%M'),'stn':st['STN_ID'],'help':1},key),'observations'))
   except ValueError:continue
  def marine_data(row):
   sample=observation(port,key,[st],[row]);return sample['data']
  when,data,delta=nearest_row([r for r in rows if r.get('STN')==st['STN_ID']],target,marine_data)
  result['marine']={'source':'기상청 해양기상부이 실제 관측','sourceType':'sensor_observation','station':station_info(st),'observedAt':when.isoformat(),'offsetMinutes':delta,'data':data}
 except ValueError as e:result['errors']['marine']=str(e)
 try:
  st=nearest(sfc_stations(upstream('stn_inf.php',{'inf':'SFC','stn':0,'tm':target.strftime('%Y%m%d%H%M'),'help':1},key)))
  text=upstream('kma_sfctm3.php',{'tm1':(target-datetime.timedelta(hours=1)).strftime('%Y%m%d%H%M'),'tm2':min(target+datetime.timedelta(hours=1),datetime.datetime.now(KST)).strftime('%Y%m%d%H%M'),'stn':st['STN_ID'],'help':1},key)
  when,data,delta=nearest_row([r for r in sfc_rows(text) if r['STN']==st['STN_ID']],target,observed_weather)
  result['weather']={'source':'기상청 ASOS 실제 관측','sourceType':'sensor_observation','station':station_info(st),'observedAt':when.isoformat(),'offsetMinutes':delta,'data':data}
 except ValueError as e:result['errors']['weather']=str(e)
 result['complete']=bool(result['marine'] and result['weather'])
 return result

def collect_actual_weather_once(store):
 key=get_key()
 try:
  if not key:raise ValueError('KMA_API_KEY 미설정')
  now=datetime.datetime.now(KST)
  stations=sfc_stations(upstream('stn_inf.php',{'inf':'SFC','stn':0,'help':1},key))
  rows=sfc_rows(upstream('kma_sfctm3.php',{'tm1':(now-datetime.timedelta(hours=2)).strftime('%Y%m%d%H%M'),'tm2':now.strftime('%Y%m%d%H%M'),'stn':0,'help':1},key))
 except ValueError as e:
  for port in PORTS:store.fail_weather(port,str(e))
  return
 for port,coords in PORTS.items():
  try:
   found=None
   for candidate in sorted(stations,key=lambda x:distance(coords,(float(x['LAT']),float(x['LON'])))):
    d=distance(coords,(float(candidate['LAT']),float(candidate['LON'])))
    if d>150:break
    try:
     when,data,delta=nearest_row([r for r in rows if r['STN']==candidate['STN_ID']],now,observed_weather,window=120)
     st=candidate;found=True;break
    except ValueError:continue
   if not found:raise ValueError('150km 이내 ASOS에 최근 120분 유효 날씨 관측이 없습니다.')
   store.save_weather(port,{'source':'기상청 ASOS 실제 관측','sourceType':'sensor_observation','provider':'KMA ASOS','validAt':when.isoformat(),'observedAt':when.isoformat(),'fetchedAt':datetime.datetime.now(KST).isoformat(),'station':{'id':st['STN_ID'],'name':st['STN_KO'],'lat':float(st['LAT']),'lon':float(st['LON']),'distanceKm':round(d,2)},'weather':data['weather'],'classificationBasis':data['classificationBasis'],'raw':data['raw'],'temperature':data['raw'].get('TA'),'isDay':int(6<=when.hour<18)})
  except ValueError as e:store.fail_weather(port,str(e))
 store.prune()

class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  url=urllib.parse.urlsplit(self.path)
  if not url.path.startswith('/api/'):
   return super().do_GET()
  origin=self.headers.get('Origin','')
  allowed=['http://127.0.0.1:4174','http://localhost:4174','http://127.0.0.1:4175','http://localhost:4175']+[v for v in os.getenv('ALLOWED_ORIGINS','').split(',') if v]
  same_origin=origin in ['http://'+self.headers.get('Host',''),'https://'+self.headers.get('Host','')]
  if origin and origin not in allowed and not same_origin:self.send_error(403);return
  status=200;store=self.server.store
  try:
   if url.path=='/api/environment/latest':
    port=urllib.parse.parse_qs(url.query).get('port',[''])[0]
    if port not in PORTS:status=400;result={'error':'지원하지 않는 항구입니다.'}
    else:
     weather=self.server.actual_weather_store.read_weather(port);marine=store.read(port)
     if weather and weather.get('sourceType')!='sensor_observation':weather=None
     result={'weather':weather,'marine':marine,'complete':bool(weather and marine and weather['usable'] and marine['usable']),'sourceType':'sensor_observation','servedAt':utcnow(),'weatherCollection':self.server.actual_weather_store.weather_status().get(port,{})}
   elif url.path=='/api/weather/observed/status':result={'collector':'server-background','intervalSeconds':300,'sourceType':'sensor_observation','ports':self.server.actual_weather_store.weather_status()}
   elif url.path=='/api/weather/observed':
    port=urllib.parse.parse_qs(url.query).get('port',[''])[0]
    if port not in PORTS:status=400;result={'error':'지원하지 않는 항구입니다.'}
    else:
     result=self.server.actual_weather_store.read_weather(port)
     if result is None:status=503;result={'error':'저장된 실제 날씨 관측이 없습니다.'}
   elif url.path=='/api/observations/selected':
    params=urllib.parse.parse_qs(url.query)
    try:result=selected_observations(params.get('port',[''])[0],params.get('time',[''])[0])
    except ValueError as e:status=400;result={'error':str(e)}
   elif url.path=='/api/observations/status':result={'configured':bool(get_key()),'collector':'server-background','intervalSeconds':300,'ports':store.status(),'weatherPorts':store.weather_status()}
   elif url.path=='/api/weather/status':result={'collector':'server-background','intervalSeconds':300,'sourceType':'model_forecast','ports':store.weather_status()}
   elif url.path=='/api/weather':
    port=urllib.parse.parse_qs(url.query).get('port',[''])[0]
    if port not in PORTS:status=400;result={'error':'지원하지 않는 항구입니다.'}
    else:
     result=store.read_weather(port)
     if result is None:status=503;result={'error':'저장된 날씨가 아직 없습니다. 서버 수집 상태를 확인하세요.','collection':store.weather_status().get(port,{})}
   elif url.path=='/api/observations':
    port=urllib.parse.parse_qs(url.query).get('port',[''])[0]
    if port not in PORTS:status=400;result={'error':'지원하지 않는 항구입니다.'}
    else:
     result=store.read(port)
     if result is None:status=503;result={'error':'저장된 관측이 아직 없습니다. 서버 수집 상태를 확인하세요.','collection':store.status().get(port,{})}
   else:status=404;result={'error':'없는 경로'}
  except Exception:status=503;result={'error':'저장 관측 조회 실패'}
  self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store')
  if origin:self.send_header('Access-Control-Allow-Origin',origin);self.send_header('Vary','Origin')
  self.end_headers();self.wfile.write(json.dumps(result,ensure_ascii=False).encode())

def main():
 root=Path(__file__).resolve().parent
 data=Path(os.getenv('DATA_DIR',str(root/'data')))
 store=Store(data/'observations.sqlite3');collector=Collector(store);weather_collector=Collector(store,job=collect_weather_once)
 actual_weather_store=Store(data/'weather-observed.sqlite3');actual_weather_collector=Collector(actual_weather_store,job=collect_actual_weather_once)
 handler=functools.partial(Handler,directory=str(root/'dist'))
 server=ThreadingHTTPServer((os.getenv('HOST','127.0.0.1'),int(os.getenv('PORT','4175'))),handler);server.store=store;server.actual_weather_store=actual_weather_store
 def shutdown(*args):threading.Thread(target=server.shutdown,daemon=True).start()
 signal.signal(signal.SIGTERM,shutdown);signal.signal(signal.SIGINT,shutdown)
 collector.start();weather_collector.start();actual_weather_collector.start()
 try:server.serve_forever()
 finally:collector.stop();weather_collector.stop();actual_weather_collector.stop();server.server_close()
if __name__=='__main__':main()
