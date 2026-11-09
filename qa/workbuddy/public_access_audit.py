#!/usr/bin/env python3
"""Read-only, unauthenticated public-page audit for an owner-managed school workbench.
No student names, roster data, screenshots, account tokens, or cookies are stored or logged.
This is an indicator audit, not a claim of backend authorization testing.
"""
import json
import os
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

URL = os.environ.get("WORKBUDDY_URL", "https://class-workbench-08726.app.workbuddy.host/es5.html")
RESULT = Path(os.environ.get("AUDIT_RESULT_PATH", "audit-result.json"))
record = {
    "public_url": URL,
    "production_accepted": False,
    "method": "fresh Chromium context, no login, no writes",
    "status": "INCONCLUSIVE",
    "http_status": None,
    "loaded_ui": False,
    "role_switcher_publicly_rendered": False,
    "roster_navigation_publicly_rendered": False,
    "class_size_summary_publicly_rendered": False,
    "login_form_present": False,
    "roster_page_reachable_without_login": False,
    "student_rows_extracted": False,
    "issue": None,
}
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            locale="zh-CN",
            storage_state={"cookies": [], "origins": []},
            service_workers="block",
        )
        page = ctx.new_page()
        # Absolutely no request or console logging: those could contain personal details.
        response = page.goto(URL, wait_until="domcontentloaded", timeout=25000)
        record["http_status"] = response.status if response else None
        page.wait_for_timeout(4000)
        metrics = page.evaluate("""() => {
          const text = document.body?.innerText || '';
          const buttons = [...document.querySelectorAll('button')];
          const selects = [...document.querySelectorAll('select')];
          const roleSwitcher = selects.some(s => {
            const options = [...s.options].map(o => o.textContent.trim());
            return options.includes('班主任') && options.includes('任课教师');
          });
          const rosterNavigation = buttons.some(b => /学生名册/.test(b.textContent));
          return {
            ready: document.readyState !== 'loading',
            roleSwitcher,
            rosterNavigation,
            classSizeSummary: /班级人数/.test(text) && /\\d+\\s*人/.test(text),
            loginForm: !!document.querySelector('input[type="password"]')
          };
        }""")
        record["loaded_ui"] = metrics["ready"]
        record["role_switcher_publicly_rendered"] = metrics["roleSwitcher"]
        record["roster_navigation_publicly_rendered"] = metrics["rosterNavigation"]
        record["class_size_summary_publicly_rendered"] = metrics["classSizeSummary"]
        record["login_form_present"] = metrics["loginForm"]
        # Do not click private records, and do not capture displayed names.
        if (record["http_status"] != 200):
            record["status"] = "UNAVAILABLE"
            record["issue"] = "Public entry did not return HTTP 200"
        elif metrics["roleSwitcher"] and metrics["rosterNavigation"] and metrics["classSizeSummary"]:
            record["status"] = "POTENTIAL_PRIVACY_RISK"
            record["issue"] = "Anonymous page renders staff role selection and class-level records: verify backend login and data segregation"
        elif metrics["roleSwitcher"] or metrics["rosterNavigation"]:
            record["status"] = "REVIEW_REQUIRED"
            record["issue"] = "Anonymous page renders privileged UI; determine whether data is synthetic or protected by server authorization"
        else:
            record["status"] = "NO_EXPOSURE_OBSERVED"
            record["issue"] = "This limited UI check cannot validate backend access, mobile sync or storage"
        ctx.close()
        browser.close()
except (PlaywrightTimeout, Exception) as error:
    record["status"] = "INCONCLUSIVE"
    record["issue"] = "Browser could not complete a public, anonymous inspection (" + type(error).__name__ + ")"

RESULT.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("PUBLIC_SITE_AUDIT: " + record["status"])
print("HTTP_STATUS: " + str(record["http_status"]))
print("ROLE_SELECTOR_RENDERED: " + str(record["role_switcher_publicly_rendered"]))
print("ROSTER_NAV_RENDERED: " + str(record["roster_navigation_publicly_rendered"]))
print("CLASS_SUMMARY_RENDERED: " + str(record["class_size_summary_publicly_rendered"]))
print("PRIVACY: no student names, other personal data, screenshots, sessions or cookies logged.")
if record["status"] in ("POTENTIAL_PRIVACY_RISK", "UNAVAILABLE", "INCONCLUSIVE"):
    sys.exit(1)
sys.exit(0)
