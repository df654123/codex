# Regional access diagnostic scope

Authorized continuation of docs/national-access-plan.md stage A (2026-11-06). Keep current URL, learning content, service worker and privacy intact; no paid services or visibility changes.

Extend network-check.html only: retain the quick manifest connectivity test; add explicit full-runtime download + SHA-256 comparison using JSON data extracted from sw.js (never execute downloaded JS). Restrict assets to the same site path. Bound total bytes, resource count, download time and concurrency. Do not confuse offline caches with online access.

Optional province/network/operator fields are user-reported. Coarse browser family only. No geolocation, IP lookup, student records, cookies or telemetry. Reports stay on the page until copied/downloaded. Interactive exercise/refresh and cold offline restart remain manual, default 未测. Starting a new test resets manual evidence; changed environment makes old evidence stale.

A full pass proves only runtime-byte integrity on that device/network/time. It does not prove every feature, permanent uptime, all provinces, all carriers, offline audio or cross-device sync.

Execution: RED entry test against unchanged release; GREEN 14 browser cases on isolated local test server, then publish just network-check.html and verify the actual Pages URL. The local assistant container blocks browser navigation, so real browser execution uses an ephemeral GitHub-hosted runner. Neither environment is evidence for mainland Chinese carrier access.
