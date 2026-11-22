# Software verification

Install the pinned development toolchain:

```sh
npm ci
npx playwright install --with-deps chromium
npm run check
```

`npm run check` runs linting, JavaScript type checks, deterministic Node tests, a static build, and Playwright checks. The browser suite uses the built site over loopback, not the live Cloudflare site or a real clinical system. Run `npm run dev` to serve the built application at <http://127.0.0.1:4173>.

## Scope

- Unit checks cover exact boundary semantics, discrete demo data, invalid configurations, monotonic sampling, interruption and recovery, and the manual/legacy model. These tests use injected clocks, not sleeps.
- Browser checks use a 1920 × 1080 OR monitor viewport and a 390 × 844 phone viewport. Validate actual flow (configuration, starting, lock and abandon controls, phase cues, completion, refresh safety, offline) rather than treating a screenshot as proof the timer is correct.
- The PWA needs a successful first online load and cache installation. To check manually, load the built app over HTTPS or localhost, wait for offline readiness, disconnect, reload, and start a **demonstration**. With an active session, reloading should recover the last checkpoint and flag uncertainty. An updated site must not apply its dataset mid-session.
- Browser automation does not validate real OS locking, power loss, system time synchronization, fullscreen exit gestures, actual wake lock, Safari/iOS behaviour, readability across a room or material outcomes. Verify on target hardware with an independent calibrated reference and trained staff before any clinical evaluation around patients.

See [clinical safety](clinical-safety.md) for the remaining non-software gates.
