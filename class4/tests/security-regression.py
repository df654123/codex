"""Class4 regression tests for previously reproduced authorization and school-date bugs."""
import pathlib
source_path=pathlib.Path(__file__).with_name('http-access.py')
source=source_path.read_text()
anchor='    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(AccessTests))'
assert source.count(anchor)==1
extra='''    def test_06_stats_omit_other_class_notes(self):
        marker='PRIVATE-OTHER-CLASS-TEST-MARKER'
        dbwrite(school,'INSERT INTO score_logs(user_id,username,score_change,description,created_at) VALUES(9002,?,1,?,?)',('qa_student_other',marker,'2026-11-08T01:00:00.000Z'))
        r=req('GET','/api/stats/records',B)
        self.assertEqual(r.status_code,200)
        self.assertNotIn(marker,r.text)
    AccessTests.test_06_stats_omit_other_class_notes=test_06_stats_omit_other_class_notes

    def test_07_student_revoked_session(self):
        r=req('POST','/api/auth/student/login',json={'username':'qa_student_own','password':password,'schoolId':9001})
        self.assertEqual(r.status_code,200)
        cookie='; '.join(f'{k}={v}' for k,v in r.cookies.items())
        self.assertEqual(req('GET','/api/student/logs',cookie).status_code,200)
        try:
            dbwrite(school,'UPDATE users SET disabled=1 WHERE id=9001')
            r=req('GET','/api/student/logs',cookie)
            self.assertIn(r.status_code,(401,403))
        finally:
            dbwrite(school,'UPDATE users SET disabled=0 WHERE id=9001')
    AccessTests.test_07_student_revoked_session=test_07_student_revoked_session

    def test_08_beijing_daily_boundary(self):
        marker='BEIJING-NEXT-DAY-TEST'
        dbwrite(school,'INSERT INTO score_logs(user_id,username,score_change,description,created_at) VALUES(9001,?,1,?,?)',('qa_student_own',marker,'2026-11-08T16:30:00.000Z'))
        r=req('POST','/api/auth/student/login',json={'username':'qa_student_own','password':password,'schoolId':9001})
        self.assertEqual(r.status_code,200)
        cookie='; '.join(f'{k}={v}' for k,v in r.cookies.items())
        r=req('GET','/api/student/logs?date=2026-11-09',cookie)
        self.assertEqual(r.status_code,200)
        self.assertIn(marker,r.text)
    AccessTests.test_08_beijing_daily_boundary=test_08_beijing_daily_boundary

    def test_09_empty_class_access_cannot_export_school(self):
        try:
            dbwrite(main,'UPDATE admins SET class_id=NULL WHERE id=9002')
            r=req('GET','/api/admin/export',B)
            self.assertTrue(r.status_code in (401,403) or ('qa_student_other' not in r.text and 'qa_student_own' not in r.text))
        finally:
            dbwrite(main,'UPDATE admins SET class_id=9004 WHERE id=9002')
    AccessTests.test_09_empty_class_access_cannot_export_school=test_09_empty_class_access_cannot_export_school
'''
source=source.replace(anchor,extra+anchor)
exec(compile(source,str(source_path),'exec'),{'__name__':'__main__','__file__':str(source_path)})
