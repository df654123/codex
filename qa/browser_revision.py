"""Synthetic local UI regression. No real learner records or official print claims."""
import os,json,threading,tempfile,unittest,http.server,functools,zipfile,re,hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
class BrowserTests(unittest.TestCase):
 @classmethod
 def setUpClass(c):
  c.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
  threading.Thread(target=c.server.serve_forever,daemon=True).start();c.url=f'http://127.0.0.1:{c.server.server_port}/'
  c.pw=sync_playwright().start();c.browser=c.pw.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 @classmethod
 def tearDownClass(c):c.browser.close();c.pw.stop();c.server.shutdown();c.server.server_close()
 def setUp(self):
  self.context=self.browser.new_context(viewport={'width':390,'height':844});self.page=self.context.new_page();self.errors=[];self.page.on('pageerror',lambda e:self.errors.append(str(e)))
  self.page.goto(self.url+'#publishers');self.page.wait_for_function('window.LearningStartupReady && window.PublisherVocab')
 def tearDown(self):
  if self.errors:print('PAGE ERRORS:',self.errors)
  self.context.close()
  self.assertEqual(self.errors,[], 'Uncaught page errors are a release blocker')
 def test_01_ready_and_scope(self):
  self.assertEqual(self.errors,[]);self.assertEqual(self.page.locator('#pv-unit option').count(),10)
  self.assertIn('非完整词表',self.page.locator('#publisherVocabRoot').inner_text())
  self.page.select_option('#pv-unit','rj-2024-7a-u2');self.assertIn('词汇尚未接入',self.page.locator('#publisherVocabRoot').inner_text());self.assertEqual(self.page.locator('#pv-form').count(),0)
  self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
 def test_02_pep_spelling_reload_and_snapshot(self):
  self.page.locator('[data-pv=spelling]').click();self.page.fill('#pv-input','get to know');self.page.locator('#pv-form button').click();self.page.wait_for_function('PublisherVocab.snapshot().events.length===1')
  self.assertTrue(self.page.evaluate('PublisherVocab.snapshot().events[0].correct'))
  self.page.reload();self.page.wait_for_function('window.PublisherVocab');self.assertEqual(self.page.evaluate('PublisherVocab.snapshot().events.length'),1)
  self.assertTrue(self.page.evaluate('(()=>{const s=buildSiteSnapshot();validateSiteSnapshot(s);return s.publisherVocabState.events.length===1})()'))
  self.assertIsNone(self.page.evaluate("localStorage.getItem('englishWordStudyV35')"))
 def test_03_yilin_order_and_group_gate(self):
  self.page.select_option('#pv-publisher','yl');self.page.locator('[data-pv=yl1]').click();self.page.wait_for_selector('#course.active')
  self.assertEqual(self.page.locator('#cxVocabulary h4').first.inner_text(),'greet')
  self.assertIn('40',self.page.locator('#cxVocabulary').inner_text());self.assertIn('课内复现',self.page.locator('#cxVocabulary').inner_text())
  self.page.evaluate("Curriculum.selectUnit('7a-u2','course')");self.assertEqual(self.page.locator('#cxVocabulary h4').count(),55)
  self.assertEqual(self.page.locator('#cxVocabulary h4').first.inner_text(),'jogging')
  self.page.locator('#cxVocabulary [data-caction=exercise]').click();self.page.wait_for_selector('#cxQuizForm');self.assertEqual(self.page.locator('.cx-vocab-sets button').count(),11)
  self.page.locator('.cx-vocab-sets button').last.click();self.assertEqual(self.page.locator('#cxQuizForm fieldset').count(),5)
  for i in range(5):self.page.locator(f'input[name=cxq{i}]').first.check()
  self.page.locator('#cxQuizForm [data-caction=submit]').click();self.assertIn('本次答对',self.page.locator('#cxQuizStatus').inner_text())
  self.assertFalse(self.page.evaluate("CurriculumCore.progress(Curriculum.snapshot(),ENGLISH_CURRICULUM.units.find(u=>u.id==='7a-u2')).complete.vocabulary"))
 def test_04_abbreviation_and_old_record_survive(self):
  self.page.evaluate("localStorage.setItem('englishWordStudyV35',JSON.stringify({version:1,records:{'7a-u1::0':{level:1,due:'2030-01-01',at:'2026-11-01T00:00:00Z',remembered:2,hard:1,spellingCorrect:3,spellingWrong:4}}}))")
  self.page.reload();self.page.wait_for_function('window.WordStudyCore && window.PublisherVocab')
  self.assertEqual(self.page.evaluate("WordStudy.snapshot().records['7a-u1::0'].spellingCorrect"),3)
  self.assertTrue(self.page.evaluate("(()=>{const s=WordStudyCore.normalize({}),c=WordStudyCore.createCard('7a-u1',22);return WordStudyCore.checkSpelling(s,c,'be ready to do sth','be ready to do sth.').correct})()"))
 def test_05_invalid_backup_does_not_touch_other_keys(self):
  before=self.page.evaluate('JSON.stringify({...localStorage})')
  self.assertTrue(self.page.evaluate("(()=>{try{PublisherVocab.validate({schemaVersion:1,events:[{id:'x',wordId:'7a-u1',at:'bad'}]});return false}catch{return true}})()"))
  self.assertEqual(before,self.page.evaluate('JSON.stringify({...localStorage})'))
 def test_06_corrupt_publisher_storage_is_preserved(self):
  self.page.evaluate("localStorage.setItem('englishPublisherVocabV1','BROKEN')");self.page.reload();self.page.wait_for_selector('#pv-publisher')
  self.page.locator('[data-pv=spelling]').click();self.page.fill('#pv-input','get to know');self.page.locator('#pv-form button').click();self.page.wait_for_function('PublisherVocab.snapshot().events.length===1')
  self.assertEqual(self.page.evaluate("localStorage.getItem('englishPublisherVocabV1')"),'BROKEN');self.assertIn('未覆盖',self.page.locator('#pv-status').inner_text())
 def test_07_portable_is_current_and_runs(self):
  self.page.goto(self.url+'downloads/jiangsu-english-offline.html#publishers');self.page.wait_for_function('window.PublisherVocab')
  self.assertEqual(self.page.evaluate('ENGLISH_CURRICULUM.version'),'3.9');self.assertEqual(self.page.evaluate('PUBLISHER_VOCAB_DATA.entries.length'),12);self.assertEqual(self.errors,[])
  with zipfile.ZipFile(ROOT/'downloads/jiangsu-english-complete.zip') as z:
   name=next(n for n in z.namelist() if n.endswith('/index.html'));self.assertEqual(z.read(name),(ROOT/'downloads/jiangsu-english-offline.html').read_bytes())
 def test_08_offline_refresh_preserves_pep(self):
  self.page.wait_for_function("document.querySelector('#offlineStatus').dataset.state==='ready' && !!navigator.serviceWorker.controller",timeout=60000)
  self.context.set_offline(True);self.page.reload();self.page.wait_for_function('window.PublisherVocab');self.page.locator('[data-pv=spelling]').click();self.page.fill('#pv-input','get to know');self.page.locator('#pv-form button').click();self.page.wait_for_function('PublisherVocab.snapshot().events.length===1')
  self.page.reload();self.page.wait_for_function('window.PublisherVocab');self.assertEqual(self.page.evaluate('PublisherVocab.snapshot().events.length'),1);self.assertFalse(self.page.evaluate('navigator.onLine'))
 def test_09_source_classification_and_release_hashes(self):
  d=json.loads((ROOT/'curriculum-data.js').read_text().split('=',1)[1].strip().rstrip(';'));u=d['units'][0];v={w['word']:w for w in u['vocabulary']}
  self.assertEqual(v['maths']['category'],'in_text_expression');self.assertEqual(v['fun']['partOfSpeech'],'adj.');self.assertEqual(v['stay']['partOfSpeech'],'linking v.');self.assertEqual(v['go by']['example'],'I go by Alex at school.')
  self.assertEqual(sum(w['category'] in ['textbook_word','textbook_phrase'] for w in u['vocabulary']),40)
  build=json.loads(re.search(r'const BUILD = (.*?);\n',(ROOT/'sw.js').read_text()).group(1))
  for a in build['assets']+build['downloads']:
   path='index.html' if a['url']=='./' else a['url'].split('?')[0];b=(ROOT/path).read_bytes();self.assertEqual(a['bytes'],len(b),path);self.assertEqual(a['sha256'],hashlib.sha256(b).hexdigest(),path)
  (ROOT/'qa/evidence').mkdir(exist_ok=True);self.page.screenshot(path=str(ROOT/'qa/evidence/publisher-mobile.png'),full_page=True)
 def test_10_portable_file_origin(self):
  self.page.goto((ROOT/'downloads/jiangsu-english-offline.html').as_uri()+'#publishers')
  self.page.wait_for_function('window.PublisherVocab && window.LearningStartupReady')
  self.assertEqual(self.page.evaluate('ENGLISH_CURRICULUM.version'),'3.9')
  self.assertEqual(self.errors,[])
if __name__=='__main__':unittest.main(verbosity=2)
