"""Local browser acceptance; synthetic profiles only, no student data."""
import functools
import http.server
import json
import os
from pathlib import Path
import re
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BUILD = json.loads(re.search(r'^const BUILD = (.*);$', (ROOT/'sw.js').read_text(), re.M)[1])

class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        return super().translate_path(path.removeprefix('/codex'))
    def log_message(self, *args):
        pass

class AccessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.base = os.environ.get('ACCESS_TEST_URL') or f'http://127.0.0.1:{cls.server.server_port}/codex/'
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.server.shutdown();cls.server.server_close()
    def setUp(self):
        self.ctx=self.browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
        self.page=self.ctx.new_page()
        self.page.set_default_timeout(6000)
    def tearDown(self):
        self.ctx.close()
    def open(self):
        self.page.goto(self.base+'network-check.html')
        self.page.wait_for_function("document.querySelector('#panel').dataset.state !== 'waiting'")
    def full(self):
        self.page.locator('#fullCheck').click()
        self.page.wait_for_function("document.querySelector('#fullPanel').dataset.state !== 'running'",timeout=30000)
    def state(self):
        return self.page.locator('#fullPanel').get_attribute('data-state')
    def report(self):
        return self.page.locator('#report').input_value()
    def test_01_full_entry_exists(self):
        self.open()
        self.assertEqual(self.page.locator('#fullCheck').count(),1,'Full resource-check entry is missing')
    def test_02_real_release_all_assets_and_manual_unmeasured(self):
        self.open();self.full()
        self.assertEqual(self.state(),'pass')
        self.assertEqual(self.page.locator('#assetRows [data-state=pass]').count(),len(BUILD['assets']))
        self.assertIn('43 / 43',self.page.locator('#fullTitle').inner_text())
        self.assertIn('词汇提交并刷新：未测',self.report())
        self.assertIn('断网关闭后重开：未测',self.report())
        self.assertIn('不代表全国所有网络均通过',self.report())
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    def test_03_same_size_corrupt_resource_is_not_green(self):
        original=(ROOT/'curriculum-data.js').read_bytes()
        changed=original.replace(b'window',b'windoX',1)
        self.ctx.route('**/curriculum-data.js?**',lambda r:r.fulfill(status=200,body=changed,content_type='text/javascript'))
        self.open();self.full()
        self.assertEqual(self.state(),'fail')
        self.assertIn('内容不一致',self.report())
    def test_04_missing_asset_is_not_green(self):
        self.ctx.route('**/pilot.css?**',lambda r:r.fulfill(status=404,body='Not found'))
        self.open();self.full()
        self.assertEqual(self.state(),'fail');self.assertIn('HTTP 404',self.report())
    def test_05_offline_retry_does_not_reuse_success(self):
        self.open();self.full();self.ctx.set_offline(True)
        self.page.locator('#retry').click()
        self.page.wait_for_function("document.querySelector('#panel').dataset.state === 'fail'")
        self.assertNotEqual(self.state(),'pass')
        self.full();self.assertEqual(self.state(),'fail')
    def test_06_out_of_scope_manifest_is_rejected_without_fetch(self):
        bad=json.loads(json.dumps(BUILD));bad['assets'][0]['url']='https://example.com/stolen.js'
        self.ctx.route('**/sw.js?**',lambda r:r.fulfill(status=200,body='const BUILD = '+json.dumps(bad)+';\n'))
        destinations=[];self.page.on('request',lambda r:destinations.append(r.url))
        self.open();self.full()
        self.assertEqual(self.state(),'fail');self.assertFalse(any('example.com' in u for u in destinations))
    def test_07_fetched_script_is_not_executed(self):
        self.ctx.route('**/sw.js?**',lambda r:r.fulfill(status=200,body='window.badNetworkEval=true; const BUILD = alert(1);'))
        self.open();self.full();self.assertEqual(self.state(),'fail')
        self.assertIsNone(self.page.evaluate('window.badNetworkEval'))
    def test_08_stale_environment_and_manual_evidence_reset(self):
        self.open();self.page.locator('#region').select_option('江苏');self.page.locator('#network').select_option('手机流量');self.full()
        self.page.locator('#manualVocab').select_option('通过')
        self.assertIn('词汇提交并刷新：通过（用户自报）',self.report())
        self.page.locator('#network').select_option('家庭 Wi-Fi')
        self.assertEqual(self.state(),'stale');self.assertIn('环境已修改',self.report())
        self.full();self.assertEqual(self.page.locator('#manualVocab').input_value(),'未测')
        self.assertIn('网络（用户自报）：家庭 Wi-Fi',self.report())
    def test_09_no_student_storage_read_or_upload(self):
        self.page.add_init_script("""localStorage.setItem('syntheticStudentRecord','PRIVATE_STUDENT_SENTINEL');
          window.storageReads=[]; const read=Storage.prototype.getItem;
          Storage.prototype.getItem=function(k){storageReads.push(k);return read.call(this,k);};""")
        requests=[];self.page.on('request',lambda r:requests.append((r.method,r.url)))
        self.open();self.full()
        self.assertEqual(self.page.evaluate('window.storageReads'),[])
        self.assertNotIn('PRIVATE_STUDENT_SENTINEL',self.report())
        self.assertTrue(all(method=='GET' and url.startswith(self.base) for method,url in requests))
    def test_10_no_crypto_means_unverified(self):
        self.page.add_init_script("Object.defineProperty(window.crypto,'subtle',{value:undefined});")
        self.open();self.full()
        self.assertEqual(self.state(),'unsupported');self.assertNotIn('43 / 43',self.report())
    def test_11_report_download_and_clipboard_fallback(self):
        self.page.add_init_script("Object.defineProperty(navigator,'clipboard',{value:undefined});")
        self.open();self.full();self.page.locator('#copyReport').click()
        self.assertIn('长按',self.page.locator('#copyStatus').inner_text())
        with self.page.expect_download() as d:
            self.page.locator('#downloadReport').click()
        body=Path(d.value.path()).read_text(encoding='utf-8-sig')
        self.assertIn('词汇提交并刷新：未测',body)
    def test_12_request_timeout_is_bounded(self):
        self.page.add_init_script("""const native=window.fetch;window.fetch=(u,o)=>String(u).includes('sw.js?')?new Promise(()=>{}):native(u,o);
          const timer=window.setTimeout;window.setTimeout=(fn,ms,...a)=>timer(fn,ms===20000?60:ms,...a);""")
        self.open();self.full();self.assertEqual(self.state(),'fail');self.assertIn('超时',self.report())
    def test_13_service_worker_controlled_disconnect_does_not_pass(self):
        self.page.goto(self.base+'#home')
        self.page.wait_for_function("document.querySelector('#offlineStatus')?.dataset.state === 'ready' && !!navigator.serviceWorker.controller",timeout=30000)
        self.open();self.full();self.assertEqual(self.state(),'pass')
        self.ctx.set_offline(True);self.full();self.assertEqual(self.state(),'fail')
        self.assertTrue(self.page.evaluate('!!navigator.serviceWorker.controller'))
    def test_14_learning_runtime_and_offline_record_unchanged(self):
        self.page.goto(self.base+'#words')
        self.page.wait_for_function("window.LearningStartupReady && document.querySelector('#offlineStatus')?.dataset.state==='ready'",timeout=30000)
        self.ctx.set_offline(True)
        self.page.locator('[data-wm-action=enroll-unit]').click()
        word=self.page.locator('#wmCardTitle').inner_text()
        self.page.locator('[data-wm-action=reveal]').click()
        self.page.locator('[data-wm-action=rate][data-wm-value=\"1\"]').click()
        self.page.wait_for_function("document.querySelector('#wmReviewResult').textContent.includes('本次结果已保存')")
        self.page.reload()
        self.page.locator('[data-wm-action=panel][data-wm-value=history]').click()
        self.assertIn(word,self.page.locator('.wm-history').inner_text())
        self.assertIn('需要再学',self.page.locator('.wm-history').inner_text())

if __name__=='__main__':
    unittest.main(verbosity=2)
