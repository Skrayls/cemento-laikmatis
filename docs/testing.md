# Software verification

Install the pinned development toolchain:

```sh
npm ci
npx playwright install --with-deps chromium
npm run check
```

`npm run check` runs linting, JavaScript type checks, deterministic Node tests, a static build, and Playwright checks. The browser suite uses the built site over loopback, not the live Cloudflare site or a real clinical system. Run `npm run dev` to serve the built application at <http://127.0.0.1:4173>.

## Scope

- Unit checks cover exact boundary semantics, reference provenance and legacy fixtures, invalid configurations, monotonic sampling, interruption and recovery, and the manual/legacy model. These tests use injected clocks, not sleeps.
- Chromium checks use a 1920 × 1080 OR monitor viewport and a 390 × 844 phone viewport, plus compact landscape, tablet, QHD and 4K viewports. The two primary viewports have active and OR-mode screenshots attached to the HTML report (`npx playwright show-report`); GitHub Actions uploads that report as `browser-qa`.
- The browser suite checks starting, configuration lock, abandon confirmation, each literature milestone at one second before, exactly at and one second after its boundary, completion, refresh recovery and offline operation. It exercises Chromium's fullscreen API (including external exit), the browser's screen wake-lock request and release with permission granted, and the fallback UI when a request is unavailable or denied.
- The PWA needs a successful first online load and cache installation. To check manually, load the built app over HTTPS or localhost, wait for offline readiness, disconnect, reload, and start a **Bendras PMMA** session. With an active session, reloading should recover the last checkpoint and flag uncertainty. An updated site must not apply its dataset mid-session.
- Browser automation does not validate real OS locking, power loss, system time synchronization, device-level display sleep, Safari/iOS behaviour, readability across a room or material outcomes. Verify on target hardware with an independent calibrated reference and trained staff before any clinical evaluation around patients.

See [clinical safety](clinical-safety.md) for the remaining non-software gates.
