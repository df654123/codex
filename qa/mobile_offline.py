"""Test GitHub Pages at phone width in real Chrome, using only Python's stdlib.
GitHub-hosted Linux runners supply Chrome and ChromeDriver. No student data.
Uses two Chrome sessions with one disposable profile: first online, then a new
process with all browser traffic forced to a non-listening local proxy port.
"""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import build_opener, ProxyHandler, Request

ROOT = "https://df654123.github.io/codex/"
http = build_opener(ProxyHandler({}))  # ChromeDriver commands stay on loopback
sid = ""
base = ""


def command(method, path, data=None):
    req = Request(base + path, method=method, headers={"Content-Type": "application/json"},
                  data=json.dumps(data).encode() if data is not None else None)
    try:
        with http.open(req, timeout=70) as r:
            return json.load(r)["value"]
    except HTTPError as ex:
        raise RuntimeError(f"{method} {path}: {ex.code} {ex.read().decode()[:1000]}") from ex


def cmd(method, path, data=None):
    return command(method, "/session/" + sid + path, data)


def js(script, *args):
    return cmd("POST", "/execute/sync", {"script": script, "args": list(args)})


def wait_js(predicate, timeout=30):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        value = js("return (" + predicate + ")")
        if value:
            return value
        time.sleep(.3)
    raise RuntimeError(f"Timed out: {predicate}; page: " + str(js(
        "return {title:document.title,url:location.href,offline:document.querySelector('#offlineStatus')?.textContent,"
        "status:document.querySelector('#offlineDetail')?.textContent}")))


def cdp(name, params=None):
    return cmd("POST", "/goog/cdp/execute", {"cmd": name, "params": params or {}})


def start(profile, off_port=None):
    global sid
    args = ["--headless=new", "--disable-quic", "--no-first-run", "--disable-default-apps",
            "--disable-background-networking", "--disable-dev-shm-usage", "--lang=zh-CN",
            "--user-data-dir=" + profile]
    if off_port is not None:
        args += [f"--proxy-server=http://127.0.0.1:{off_port}", "--proxy-bypass-list=<-loopback>"]
    options = {"args": args, "mobileEmulation": {
        "deviceMetrics": {"width": 390, "height": 844, "pixelRatio": 2, "mobile": True, "touch": True}}}
    binary = os.environ.get("CHROME_BIN") or shutil.which("google-chrome") or shutil.which("chromium")
    if binary:
        options["binary"] = binary
    session = command("POST", "/session", {"capabilities": {"alwaysMatch": {
        "browserName": "chrome", "goog:chromeOptions": options}}})
    sid = session["sessionId"]
    print("Chrome", session["capabilities"]["browserVersion"], "390 × 844 CSS px", flush=True)
    cmd("POST", "/timeouts", {"pageLoad": 50000, "script": 12000})
    cdp("Network.enable")
    cdp("Network.setCacheDisabled", {"cacheDisabled": True})
    if off_port is not None:
        cdp("Network.emulateNetworkConditions", {"offline": True, "latency": 0,
            "downloadThroughput": 0, "uploadThroughput": 0})


def close():
    global sid
    if sid:
        cmd("DELETE", "")
        sid = ""


def button(selector):
    wait_js(f'document.querySelector({json.dumps(selector)})?.getClientRects().length > 0')
    # ChromeDriver's built-in click can return before a CSS smooth scroll lands.
    # Scroll like a user, wait until the center stabilizes AND hit-tests to the
    # real button. Do not invoke HTMLElement.click() or hide an overlay.
    js("document.querySelector(arguments[0]).scrollIntoView({block:'center',inline:'center',behavior:'instant'})", selector)
    prev = None
    stop = time.monotonic() + 10
    while time.monotonic() < stop:
        info = js("""
          const el=document.querySelector(arguments[0]); if(!el)return {missing:true};
          const r=el.getBoundingClientRect(), x=Math.round((r.left+r.right)/2), y=Math.round((r.top+r.bottom)/2);
          const hit=document.elementFromPoint(x,y), v=window.visualViewport;
          return {x,y,hit:hit?.tagName+'#'+(hit?.id||'')+'.'+(hit?.className||''),
            onTarget:!!hit && el.contains(hit) && !el.disabled,
            visible:x>=0&&y>=0&&x<Math.min(innerWidth,v?.width??innerWidth)&&y<Math.min(innerHeight,v?.height??innerHeight),
            view:[innerWidth,innerHeight,v?.width,v?.height,v?.scale],scroll:Math.round(scrollY),label:el.textContent.trim()};
        """, selector)
        xy=(info.get("x"), info.get("y"))
        if info.get("onTarget") and info.get("visible") and xy == prev:
            print("TAP verified visible button:", info, flush=True)
            cdp("Input.dispatchTouchEvent", {"type":"touchStart", "touchPoints":[{"x":xy[0], "y":xy[1]}]})
            cdp("Input.dispatchTouchEvent", {"type":"touchEnd", "touchPoints":[]})
            return
        prev=xy
        time.sleep(.12)
    raise RuntimeError(f"Button center blocked: {selector}: {info}")


def test(profile, off_port):
    start(profile)
    cmd("POST", "/url", {"url": ROOT + "#home"})
    wait_js("document.querySelector('#offlineStatus')?.dataset.state === 'ready' && !!navigator.serviceWorker.controller", 185)
    ready = js("return {status:document.querySelector('#offlineStatus').textContent, title:document.title,"
               "worker:navigator.serviceWorker.controller.scriptURL, width:innerWidth}")
    assert ready["width"] == 390 and ready["worker"] == ROOT + "sw.js", ready
    print("PASS online cache:", ready, flush=True)
    cmd("POST", "/url", {"url":ROOT + "network-check.html"})
    panel = "document.querySelector('#panel')?.dataset.state"
    wait_js(panel + " === 'pass'")
    cdp("Network.emulateNetworkConditions", {"offline":True,"latency":0,"downloadThroughput":0,"uploadThroughput":0})
    button("#retry")
    wait_js(panel + " === 'fail'", 22)
    print("PASS network checker on same open page: online pass -> disconnected retry fail", flush=True)
    close()  # flushed profile; this tears down every tab, JS heap and SW process
    start(profile, off_port)
    cmd("POST", "/url", {"url": ROOT + "#words"})
    wait_js("!!document.querySelector('[data-wm-action=enroll-unit]') && !!navigator.serviceWorker.controller")
    check = js("return {online:navigator.onLine,worker:navigator.serviceWorker.controller.scriptURL,"
               "navWorker:performance.getEntriesByType('navigation')[0].workerStart, title:document.title}")
    assert check["online"] is False and check["navWorker"] > 0 and check["worker"] == ROOT + "sw.js", check
    control = cmd("POST", "/execute/async", {"script": """
      const done = arguments[arguments.length-1]; fetch('/uncached-offline-control-'+Date.now(),{cache:'no-store'})
        .then(r=>done({networkReachable:true,status:r.status}),e=>done({networkReachable:false,error:e.name}));
    """, "args": []})
    assert control == {"networkReachable": False, "error": "TypeError"}, control
    print("PASS cold offline navigation; uncached out-of-scope request failed:", check, control, flush=True)
    stats = "Number(document.querySelectorAll('.wm-stats strong')[2]?.textContent.match(/\\d+/)?.[0])"
    assert js("return " + stats) == 0
    button('[data-wm-action="enroll-unit"]')
    word = wait_js("document.querySelector('#wmCardTitle')?.textContent.trim()")
    button('[data-wm-action="reveal"]')
    button('[data-wm-action="rate"][data-wm-value="1"]')
    wait_js("document.querySelector('#wmReviewResult')?.textContent.includes('本次结果已保存')")
    assert js("return " + stats) == 1
    cmd("POST", "/refresh", {})
    wait_js("!!document.querySelector('.wm-stats')")
    button('[data-wm-action="panel"][data-wm-value="history"]')
    persisted = js("return document.querySelector('.wm-history')?.innerText || document.querySelector('#wordMemoryRoot').innerText")
    assert word in persisted and "需要再学" in persisted, persisted
    assert js("return " + stats) == 1
    print("PASS saved while offline -> refreshed history:", word, "需要再学, 今天已练=1", flush=True)


def main():
    global base
    with tempfile.TemporaryDirectory() as work, socket.socket() as sink:
        # Reserve the port for the whole test without listening: no process can use
        # it as a real proxy. Chrome cannot reach external hosts in phase two.
        sink.bind(("127.0.0.1", 0))
        with socket.socket() as port:
            port.bind(("127.0.0.1", 0))
            dp = port.getsockname()[1]
        base = f"http://127.0.0.1:{dp}"
        driver = shutil.which("chromedriver")
        if not driver:
            driver = str(Path(os.environ.get("CHROMEWEBDRIVER", "")) / "chromedriver")
        p = subprocess.Popen([driver, f"--port={dp}"])
        try:
            for _ in range(100):
                try:
                    command("GET", "/status")
                    break
                except OSError:
                    time.sleep(.1)
            test(str(Path(work)/"profile"), sink.getsockname()[1])
        finally:
            try:
                close()
            finally:
                p.terminate()
                p.wait(timeout=15)


if __name__ == "__main__":
    main()
