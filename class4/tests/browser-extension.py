"""GPL-3.0-or-later. Real browsers against the shared isolated fixture."""
import os, pathlib
source_path=pathlib.Path(__file__).with_name('http-access.py')
source=source_path.read_text()
source=source.replace("(9002,'qa_teacher_b')", "(9002,'qa_teacher_b'),(9003,'qa_teacher_c')")
anchor='    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(AccessTests))'
if source.count(anchor)!=1: raise RuntimeError('Unexpected test fixture version')
extra='''    def browser_workflow(self):
        from playwright.sync_api import sync_playwright, expect
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
            contexts=[]
            errors=[]
            try:
                for name,viewport in [('qa_teacher_b',{'width':375,'height':812}),('qa_teacher_c',{'width':1280,'height':800})]:
                    context=browser.new_context(viewport=viewport)
                    contexts.append(context)
                    page=context.new_page()
                    page.on('pageerror',lambda error: errors.append(str(error)))
                    page.goto(BASE+'/login',wait_until='networkidle')
                    page.locator('select').first.select_option('9001')
                    page.locator('input[autocomplete="username"]').fill(name)
                    page.locator('input[type="password"]').first.fill(password)
                    with page.expect_response(lambda response: response.url.endswith('/api/auth/login')) as login_response:
                        page.locator('button[type="submit"]').first.click()
                    self.assertEqual(login_response.value.status,200,'Teacher sign-in API must succeed')
                    page.wait_for_url('**/admin',timeout=15000)
                    page.goto(BASE+'/admin/scores',wait_until='networkidle')
                    expect(page.get_by_role('heading',name='积分管理',exact=True)).to_be_visible()
                    self.assertLessEqual(page.evaluate('document.documentElement.scrollWidth'),viewport['width']+2)
                a=contexts[0].pages[0]
                b=contexts[1].pages[0]
                b.get_by_placeholder('请输入操作备注...').fill('preserve-unsubmitted-draft')
                a.get_by_role('button',name='列表勾选',exact=True).click()
                a.locator('label').filter(has_text='qa_student_own').locator('input[type="checkbox"]').check()
                a.get_by_placeholder('请输入操作备注...').fill('browser-verified-observation')
                started=time.monotonic()
                a.get_by_role('button',name='为 1 名用户 加1 分',exact=True).click()
                expect(a.get_by_text('browser-verified-observation',exact=True)).to_be_visible()
                # No reload or manual API call: this verifies automatic cross-actor updates.
                expect(b.get_by_text('browser-verified-observation',exact=True)).to_be_visible(timeout=10000)
                print('Measured automatic update seconds:',round(time.monotonic()-started,3))
                expect(b.get_by_placeholder('请输入操作备注...')).to_have_value('preserve-unsubmitted-draft')
                self.assertNotIn('qa_student_other',b.locator('body').inner_text())
                self.assertEqual(errors,[], 'Browser runtime errors must not be ignored')
            except Exception:
                for index, context in enumerate(contexts):
                    for page in context.pages:
                        print('Browser diagnostic',index,'url',page.url,'errors',errors)
                        print(page.locator('body').inner_text()[:3500])
                raise
            finally:
                for context in contexts: context.close()
                browser.close()
    AccessTests.test_06_real_mobile_and_second_browser_workflow=browser_workflow
'''
source=source.replace(anchor,extra+anchor)
exec(compile(source,str(source_path),'exec'),{'__name__':'__main__','__file__':str(source_path)})
