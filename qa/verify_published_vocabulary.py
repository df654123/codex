"""Read-only public-site acceptance; all learner input stays in a disposable browser."""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urljoin,urlsplit
from concurrent.futures import ThreadPoolExecutor
import hashlib,json,re,time,os,zipfile,io
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
URL='https://df654123.github.io/codex/'
EXPECTED='4.2.1-e35776c9507b9ecf'
def fetch(path):
 url=urljoin(URL,path);sep='&' if '?' in url else '?'
 req=Request(url+sep+'release_probe='+str(time.time_ns()),headers={'Cache-Control':'no-cache','User-Agent':'Vocabulary-release-acceptance'})
 with urlopen(req,timeout=25) as r:
  assert r.status==200,(path,r.status)
  return r.read()
release=None
for attempt in range(6):
 try:
  release=json.loads(fetch('release-vocabulary.json'))
  if release.get('buildId')==EXPECTED:break
 except Exception as e:print('Release not ready:',type(e).__name__,flush=True)
 time.sleep(5)
assert release and release['buildId']==EXPECTED,release
raw=fetch('sw.js').decode();build=json.loads(re.search(r'const BUILD = (.*?);\n',raw).group(1));assert build['id']==EXPECTED
assert hashlib.sha256(raw.encode()).digest()==hashlib.sha256((ROOT/'sw.js').read_bytes()).digest(),'Published worker differs from tested candidate'
def verify(asset):
 path=asset['url'];parsed=urlsplit(path)
 assert not parsed.scheme and not parsed.netloc and '..' not in parsed.path.split('/'),path
 data=fetch(path)
 assert len(data)==asset['bytes'],(path,len(data),asset['bytes'])
 assert hashlib.sha256(data).hexdigest()==asset['sha256'],path
 return path
with ThreadPoolExecutor(max_workers=6) as ex:checked=list(ex.map(verify,build['assets']+build['downloads']))
portable=fetch('downloads/jiangsu-english-offline.html')
with zipfile.ZipFile(io.BytesIO(fetch('downloads/jiangsu-english-complete.zip'))) as z:
 name=next(n for n in z.namelist() if n.endswith('/index.html'));assert z.read(name)==portable
print('PASS public files:',len(build['assets']),'core assets + portable HTML have matching hashes; family ZIP contains identical HTML.',flush=True)
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/google-chrome'),headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL+'#publishers',wait_until='domcontentloaded',timeout=45000)
 page.wait_for_function('window.LearningStartupReady && window.PublisherVocab')
 assert page.evaluate('ENGLISH_CURRICULUM.version')=='3.9'
 assert page.locator('#pv-unit option').count()==10
 assert '非完整词表' in page.locator('#publisherVocabRoot').inner_text()
 page.locator('[data-pv=spelling]').click();page.fill('#pv-input','get to know');page.locator('#pv-form button').click()
 page.wait_for_function('PublisherVocab.snapshot().events.length===1');assert page.evaluate('PublisherVocab.snapshot().events[0].correct')
 page.wait_for_function("document.querySelector('#offlineStatus').dataset.state==='ready' && !!navigator.serviceWorker.controller",timeout=90000)
 page.reload();page.wait_for_function('window.PublisherVocab');assert page.evaluate('PublisherVocab.snapshot().events.length')==1
 page.select_option('#pv-publisher','yl');page.locator('[data-pv=yl2]').click();page.wait_for_selector('#course.active')
 assert page.locator('#cxVocabulary h4').count()==55
 assert page.locator('#cxVocabulary h4').first.inner_text()=='jogging'
 assert page.evaluate("ENGLISH_CURRICULUM.units.find(x=>x.id==='7a-u1').vocabulary.find(w=>w.word==='go by').example")=='I go by Alex at school.'
 context.set_offline(True);page.goto(URL+'#publishers');page.reload();page.wait_for_function('window.PublisherVocab')
 assert page.evaluate('PublisherVocab.snapshot().events.length')==1
 assert page.evaluate('navigator.onLine') is False
 assert page.evaluate('(()=>{const s=buildSiteSnapshot();validateSiteSnapshot(s);return s.publisherVocabState.events.length===1})()')
 page.locator('[data-pv=reveal]').click()
 assert page.evaluate('document.documentElement.scrollWidth')<=390
 assert not errors,errors
 dest=ROOT/'qa/live-evidence';dest.mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(dest/'public-publisher-mobile.png'),full_page=True)
 summary={'buildId':EXPECTED,'coreHashes':len(build['assets']),'portableAndFamilyMatch':True,'browser':'Chrome at 390px, disposable synthetic records','publicRuntime':'pass','offlineRefresh':'pass','pepRecordRetained':True,'pageErrors':errors,'notProven':['all Chinese carriers','latest official print alignment','all textbook vocabulary complete','real learning outcomes']}
 (dest/'result.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
 print('PASS published UI: Yilin U2 55 items, PEP first spelling retained after refresh and offline reload, whole-site snapshot validates, no page errors.',flush=True)
 browser.close()
