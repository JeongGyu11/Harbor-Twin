import unittest
from unittest.mock import patch
import observation_server as s
class SelectedStations(unittest.TestCase):
 def test_skips_invalid_nearest_and_retains_time_window(self):
  lat,lon=s.PORTS['gwangyang']
  stations=[{'STN_ID':str(i),'STN_KO':str(i),'LAT':str(lat+d),'LON':str(lon)} for i,d in [(1,0),(2,.1),(3,2)]]
  rows=[{'STN':'1','TM':'202610271200','WC':'-9','CA_TOT':'-9','RN':'-9'},
        {'STN':'2','TM':'202610271100','WC':'61'},
        {'STN':'2','TM':'202610271300','WC':'71'}]
  def upstream(endpoint,params,key):
   if endpoint=='kma_buoy.php':raise ValueError('missing marine fixture')
   if endpoint=='kma_sfctm3.php':self.assertEqual(params['stn'],0)
   return ''
  with patch.object(s,'get_key',return_value='test'),patch.object(s,'upstream',side_effect=upstream),patch.object(s,'table',return_value=stations),patch.object(s,'sfc_stations',return_value=stations),patch.object(s,'sfc_rows',return_value=rows):
   result=s.selected_observations('gwangyang','2026-10-27T12:00')
   self.assertEqual(result['weather']['station']['id'],'2')
   self.assertEqual(result['weather']['offsetMinutes'],-60)
   self.assertEqual(result['weather']['data']['weather'],'rain')
   rows[:]=[{'STN':'2','TM':'202610271000','WC':'61'},{'STN':'3','TM':'202610271200','WC':'61'}]
   result=s.selected_observations('gwangyang','2026-10-27T12:00')
   self.assertIsNone(result['weather'])
   self.assertIn('weather',result['errors'])
if __name__=='__main__':unittest.main()
