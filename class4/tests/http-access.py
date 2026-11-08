"""GPL-3.0-or-later. HTTP regression against real Nuxt and temporary SQLite files."""
import os, sys, time, json, secrets, pathlib, tempfile, subprocess, sqlite3, unittest
import urllib.request, urllib.error
from http.cookies import SimpleCookie
RUNTIME = pathlib.Path(os.environ['CLASSFIRE_RUNTIME']).resolve()
WORK = tempfile.TemporaryDirectory(prefix='class4-http-')
ROOT = pathlib.Path(WORK.name)
BASE = 'http://127.0.0.1:4387'
password = secrets.token_urlsafe(20)
env = {**os.environ, 'HOST':'127.0.0.1', 'NITRO_HOST':'127.0.0.1', 'PORT':'4387', 'NITRO_PORT':'4387', 'NODE_ENV':'production', 'NUXT_SESSION_PASSWORD':secrets.token_hex(32), 'TZ':'Asia/Shanghai'}
proc = subprocess.Popen(['node', str(RUNTIME/'.output/server/index.mjs')],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
class Response:
    def __init__(self, response):
        self.status_code=response.code
        self.text=response.read().decode('utf-8')
        self.cookies={}
        for header in response.headers.get_all('Set-Cookie', []):
            c=SimpleCookie(); c.load(header)
            self.cookies.update({k:v.value for k,v in c.items()})
    def json(self): return json.loads(self.text)
def req(method, path, cookie=None, **kwargs):
    headers={'Cookie':cookie} if cookie else {}
    body=None
    if 'json' in kwargs:
        body=json.dumps(kwargs['json']).encode()
        headers['Content-Type']='application/json'
    request=urllib.request.Request(BASE+path,data=body,headers=headers,method=method)
    try:
        with urllib.request.urlopen(request, timeout=10) as r: return Response(r)
    except urllib.error.HTTPError as r: return Response(r)
def login(name):
    r=req('POST','/api/auth/login',json={'username':name,'password':password,'schoolId':9001})
    if r.status_code!=200:raise RuntimeError('Fixture login failed HTTP '+str(r.status_code))
    # Loopback test replays Secure cookies; production flags are never relaxed.
    return '; '.join(f'{k}={v}' for k,v in r.cookies.items())
def dbwrite(file, sql, args=()):
    with sqlite3.connect(file,timeout=10) as c:c.execute(sql,args)
try:
    for _ in range(80):
        try:
            if req('GET','/api/auth/me').status_code in (200,401): break
        except (urllib.error.URLError, OSError, TimeoutError): pass
        if proc.poll() is not None:raise RuntimeError('Application exited before HTTP startup')
        time.sleep(.25)
    else:raise RuntimeError('Application did not start')
    main=ROOT/'data/classfire.db'
    pw=subprocess.run(['node','-e',"const fs=require('node:fs'); const b=require(process.argv[1]); process.stdout.write(b.hashSync(fs.readFileSync(0,'utf8'),10));",str(RUNTIME/'.output/server/node_modules/bcryptjs')],input=password,text=True,capture_output=True,check=True).stdout
    dbwrite(main,'INSERT INTO schools(id,name,disabled,created_at) VALUES(9001,?,0,?)',('Synthetic acceptance school','2026-11-08'))
    for i,name in [(9001,'qa_teacher_a'),(9002,'qa_teacher_b')]:
        dbwrite(main,"""INSERT INTO admins(id,username,password_hash,role,school_id,grade_id,class_id,must_change_password,disabled,created_at)
          VALUES(?,?,?,'class_admin',9001,9001,9004,0,0,'2026-11-08')""",(i,name,pw))
    A=login('qa_teacher_a'); B=login('qa_teacher_b')
    req('GET','/api/users',A)
    school=ROOT/'data/schools/9001.db'
    dbwrite(school,"INSERT INTO grades(id,name,created_at) VALUES(9001,'QA grade','2026-11-08')")
    for cid in [9004,9005]:
        dbwrite(school,'INSERT INTO classes(id,grade_id,name,created_at) VALUES(?,9001,?,?)',(cid,'QA '+str(cid),'2026-11-08'))
    for uid,cid,name in [(9001,9004,'qa_student_own'),(9002,9005,'qa_student_other')]:
        dbwrite(school,"""INSERT INTO users(id,class_id,username,password_hash,actual_name,disabled,must_change_password,total_score,add_score,deduct_score,score_count,created_at)
          VALUES(?,?,?,?,?,0,0,0,0,0,0,'2026-11-08')""",(uid,cid,name,pw,name))
    class AccessTests(unittest.TestCase):
        def test_01_anonymous_private_data_denied(self):
            self.assertIn(req('GET','/api/users').status_code,(401,403))
        def test_02_two_teachers_see_saved_record(self):
            r=req('POST','/api/scores/add',A,json={'username':'qa_student_own','score_change':1,'description':'synthetic lesson observation','operationId':'class4-baseline-score-0001'})
            self.assertEqual(r.status_code,200)
            self.assertEqual(r.json()['summary']['successCount'],1)
            second=req('GET','/api/users',B)
            self.assertEqual(second.status_code,200)
            own=next(x for x in second.json()['data'] if x['username']=='qa_student_own')
            self.assertEqual(own['totalScore'],1)
            self.assertNotIn('qa_student_other',second.text)
        def test_03_overview_must_not_leak_other_class(self):
            r=req('GET','/api/stats/overview',B)
            self.assertEqual(r.status_code,200)
            self.assertNotIn('qa_student_other',r.text)
        def test_04_mobile_viewport_is_device_width(self):
            r=req('GET','/login')
            self.assertEqual(r.status_code,200)
            self.assertIn('width=device-width',r.text)
        def test_05_disabled_teacher_loses_existing_session_access(self):
            dbwrite(main,'UPDATE admins SET disabled=1 WHERE id=9001')
            self.assertIn(req('GET','/api/users',A).status_code,(401,403))
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(AccessTests))
    code=0 if result.wasSuccessful() else 1
finally:
    proc.terminate()
    try:proc.wait(timeout=5)
    except subprocess.TimeoutExpired:proc.kill();proc.wait()
    WORK.cleanup()
sys.exit(code)
