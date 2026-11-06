"""390px real-Chrome acceptance for the PUBLIC first-week study page.

Place next to the unchanged qa/mobile_offline.py from mobile-offline-check,
then run python3 qa/pilot_test.py on the standard GitHub ubuntu runner with
Chrome/ChromeDriver. No pip dependencies, no personal data, no server writes.
The calendar progression is explicitly simulated in this throwaway profile.
"""
import datetime as dt
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import URLError

import mobile_offline as b

ROOT = os.environ.get("PILOT_TEST_URL", b.ROOT).rstrip("/") + "/"
UNIT = "7a-u4"
FIRST = dt.datetime(2032, 12, 29, 12, 0, tzinfo=dt.timezone(dt.timedelta(hours=8)))
J = json.dumps


def clock(days, prior=None):
    """Replace only the disposable page's clock before document creation.
    Don't overwrite progress or capabilities. Crossing Jan 1 tests civil dates.
    """
    if prior is not None:
        b.cdp("Page.removeScriptToEvaluateOnNewDocument", {"identifier": prior})
    now_ms = int((FIRST + dt.timedelta(days=days)).timestamp() * 1000)
    source = """
      (()=>{const D=Date, offset=STAMP-D.now();
        window.Date=new Proxy(D,{
          get(t,p,r){return p==='now'?()=>D.now()+offset:Reflect.get(t,p,r);},
          construct(t,args,n){return Reflect.construct(t,args.length?args:[D.now()+offset],n);},
          apply(){return new D(D.now()+offset).toString();}
        });})();
    """.replace("STAMP", str(now_ms))
    return b.cdp("Page.addScriptToEvaluateOnNewDocument", {"source": source})["identifier"]


def visible(selector):
    return b.js("return !!document.querySelector(arguments[0])?.getClientRects().length", selector)


def text(selector):
    return b.js("return document.querySelector(arguments[0])?.textContent || ''", selector)


def pick():
    # Native WebDriver option selection (event sequence goes through the
    # browser and the app's actual change handler).
    opt = '#wp-unit option[value="' + UNIT + '"]'
    b.wait_js("!!document.querySelector(" + J(opt) + ")")
    el = b.cmd("POST", "/element", {"using": "css selector", "value": opt})
    b.cmd("POST", "/element/" + el["element-6066-11e4-a52e-4f735466cecf"] + "/click", {})
    b.wait_js("document.querySelector('#wp-unit').value===" + J(UNIT))
    b.button("#wp-start")
    b.wait_js("!!document.querySelector('[name=w0]')?.getClientRects().length")


def step(n):
    b.button(f'[data-wp-step="{n}"]')


def submit_one_of_three():
    words = b.js("return window.WEEK_ONE_PACKS.find(u=>u.id.toLowerCase()===arguments[0]).words.map(w=>w.en)", UNIT)
    assert len(words) >= 3 and all(isinstance(x,str) and x.strip() for x in words[:3]), words
    for i, v in enumerate([words[0], "unrelated", "different"]):
        selector = f'[name=w{i}]'
        el = b.cmd("POST", "/element", {"using": "css selector", "value": selector})
        ref = el["element-6066-11e4-a52e-4f735466cecf"]
        b.cmd("POST", "/element/" + ref + "/value", {"text": v})
    b.button("#wp-submit")
    b.wait_js("!!window.WeekPilot?.snapshot()?.units?.['7a-u4']?.attempts?.['1']")
    b.wait_js(r"/1\s*[／/]\s*3/.test(document.querySelector('#wp-summary')?.textContent||'')")
    return b.js("return window.WeekPilot.snapshot().units[arguments[0]].attempts['1']", UNIT)


def check_lock(n):
    step(n)
    b.wait_js("!!document.querySelector('#wp-locked')?.getClientRects().length")
    assert not visible("#wp-submit") and not visible("[name=w0]"), "lock still lets the child submit a score"
    assert b.js("return !!window.WeekPilot.snapshot().units[arguments[0]].attempts[arguments[1]]", UNIT, str(n)) is False


def enter_after_clock(days, prior):
    ident=clock(days,prior)
    b.cmd("POST", "/refresh", {})
    b.wait_js("!!document.querySelector('[data-wp-step]')?.getClientRects().length")
    return ident

def fill(selector, value):
    ref=b.cmd("POST","/element",{"using":"css selector","value":selector})["element-6066-11e4-a52e-4f735466cecf"]
    b.cmd("POST","/element/"+ref+"/value",{"text":value})


def artifacts():
    judgment="Ming has music club on Tuesday; both can meet at lunch on Thursday."
    evidence="his music club meets on Tuesday afternoon. We both have a long lunch break on Thursday."
    draft="I am busy on Tuesday. Can we meet on Thursday?"
    revision="I am busy on Tuesday. Can we meet during the lunch break on Thursday to play chess?"
    explanation="The reader now knows the time and what to bring."
    step(3)
    assert "Ming" in text("#wp-activity .wp-reading")
    fill("#wp-text",judgment);fill("#wp-extra",evidence);b.button("#wp-submit")
    step(5)
    fill("#wp-text",draft);b.button("#wp-submit")
    step(6)
    assert draft in text("#wp-activity")
    fill("#wp-text",revision);fill("#wp-extra",explanation);b.button("#wp-submit")
    b.button("#wp-summary > summary")
    b.wait_js("document.querySelector('#wp-summary').open")
    rows=b.js("return [...document.querySelectorAll('#wp-summary .wp-grid b')].map(e=>e.textContent.trim())")
    assert rows==["1 / 3","未测","未测"], rows
    for label,payload in [("阅读判断和依据",evidence),("写给读者的初稿",draft),("修改后的版本",revision)]:
        selector=b.js("const ds=[...document.querySelectorAll('#wp-summary details')],i=ds.findIndex(d=>d.querySelector('summary').textContent.includes(arguments[0])); return i<0?null:'#wp-summary details:nth-of-type('+(i+1)+')';",label)
        assert selector,label
        b.button(selector+' > summary')
        assert payload in b.js("return document.querySelector(arguments[0]).innerText",selector)
    snap=b.js("""const raw=buildSiteSnapshot(), copy=JSON.parse(JSON.stringify(raw));
      validateSiteSnapshot(copy);
      return {version:copy.appVersion,unit:copy.weekPilotState.units[arguments[0]],same:JSON.stringify(copy.weekPilotState)===JSON.stringify(WeekPilot.snapshot())}""",UNIT)
    assert snap["same"] and snap["unit"]["tasks"]["3"]["extra"]==evidence
    assert snap["unit"]["tasks"]["5"]["text"]==draft and snap["unit"]["tasks"]["6"]["text"]==revision
    print("PASS actual synthetic work: reading claim+evidence, initial and revised writing visible in parent summary; whole-site snapshot round-trips through its validator.",flush=True)
    return snap["unit"]


def offline_reload(profile,previous):
    # No HTTP cache and reserved, non-listening proxy in a separate Chrome
    # process: a service-worker network fallback cannot hide missing assets.
    b.wait_js("document.querySelector('#offlineStatus')?.dataset.state==='ready' && !!navigator.serviceWorker.controller",185)
    b.close()
    with socket.socket() as sink:
        sink.bind(("127.0.0.1",0))
        b.start(profile,sink.getsockname()[1]);clock(6)
        b.cmd("POST","/url",{"url":ROOT+"#week"})
        b.wait_js("!!document.querySelector('[data-wp-step]')?.getClientRects().length")
        b.cmd("POST","/refresh",{})
        b.wait_js("!!document.querySelector('[data-wp-step]')?.getClientRects().length")
        actual=b.js("return {online:navigator.onLine,worker:navigator.serviceWorker.controller?.scriptURL,served:performance.getEntriesByType('navigation')[0].workerStart,unit:WeekPilot.snapshot().units[arguments[0]]}",UNIT)
        assert actual["online"] is False and actual["served"]>0 and actual["worker"]==ROOT+"sw.js",actual
        assert actual["unit"]["tasks"]==previous["tasks"] and actual["unit"]["attempts"]["1"]==previous["attempts"]["1"]
        print("PASS public #week reopens and refreshes after Chrome restart offline; prior reading, two writing versions and spelling remain.",flush=True)


def test(profile):
    b.start(profile)
    ident=clock(0)
    b.cmd("POST", "/url", {"url": ROOT+"#week"})
    b.wait_js("!!document.querySelector('#wp-unit')?.getClientRects().length && Array.isArray(window.WEEK_ONE_PACKS)")
    assert b.js("return innerWidth") == 390
    pick()
    baseline=submit_one_of_three()
    assert baseline.get("date") == FIRST.date().isoformat(), baseline
    assert len(baseline.get("answers",[])) == 3, baseline
    check_lock(2)
    check_lock(7)
    assert not re.search(r"100\s*%",text("#wp-summary")), "Unexpected invented 100% after 1/3"
    print("PASS actual live page/390px/touch: selected 7A Unit 4, one correct/two wrong, first result 1 / 3; same-day D2 and D7 locked.",flush=True)
    for n in [3,4,5,6]:
        step(n)
        assert visible("#weekPilotRoot") and not visible("#wp-locked"), f"D{n} not available as a preview"
        assert not b.js("return !!window.WeekPilot.snapshot().units[arguments[0]].attempts[arguments[1]]", UNIT,str(n)), "Preview generated a score"
    portfolio=artifacts()
    b.cmd("POST", "/refresh", {})
    b.wait_js("!!window.WeekPilot?.snapshot()?.units?.['7a-u4']?.attempts?.['1']")
    after=b.js("return window.WeekPilot.snapshot().units[arguments[0]].attempts['1']",UNIT)
    assert after == baseline, "Original spelling attempt changed during preview or reload"
    assert re.search(r"1\s*[／/]\s*3",text("#wp-summary")), "Parent summary dropped persisted result"
    print("PASS four activity previews do not create a spelling result; unit-specific initial answers and parent summary survive reload.",flush=True)
    ident=enter_after_clock(1,ident)
    step(2)
    b.wait_js("!!document.querySelector('[name=w0]')?.getClientRects().length")
    assert not visible("#wp-locked")
    ident=enter_after_clock(5,ident)
    check_lock(7)
    enter_after_clock(6,ident)
    step(7)
    b.wait_js("!!document.querySelector('[name=w0]')?.getClientRects().length")
    assert not visible("#wp-locked")
    assert b.js("return window.WeekPilot.snapshot().units[arguments[0]].attempts['1']",UNIT) == baseline
    print("PASS simulated Beijing calendar only (Dec 29–Jan 4): D2 opens after one civil date; D7 closed on +5 and opens on +6. No learner progress fabricated.",flush=True)
    offline_reload(profile,portfolio)


def main():
    driver = shutil.which("chromedriver") or str(Path(os.environ.get("CHROMEWEBDRIVER",""))/"chromedriver")
    with tempfile.TemporaryDirectory() as work:
        with socket.socket() as s:
            s.bind(("127.0.0.1",0)); port=s.getsockname()[1]
        b.base=f"http://127.0.0.1:{port}"
        proc=subprocess.Popen([driver,f"--port={port}"])
        try:
            for _ in range(100):
                try:
                    b.command("GET","/status");break
                except (OSError,URLError):time.sleep(.1)
            test(str(Path(work)/"profile"))
        except Exception:
            if b.sid:
                try:
                    print("Current synthetic profile:", b.js("return {url:location.href,visible:document.querySelector('#weekPilotRoot')?.innerText?.slice(-1800)}"), file=sys.stderr)
                except Exception:
                    pass
            raise
        finally:
            try:b.close()
            finally:proc.terminate();proc.wait(timeout=15)


if __name__=="__main__":
    main()
