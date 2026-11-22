# Timing architecture

The site uses native HTML, CSS and JavaScript modules; no runtime package, network timing service, analytics, or backend. Browser UI and browser lifecycle handling live in `public/app.js`. The clock/session model lives in `public/timing.mjs`; the catalog and condition-specific data live in `public/products.mjs`.

## Time, phases, and recovery

- Elapsed time is milliseconds from a monotonic clock in the same browser document. Rendering does not accumulate interval ticks. Wall time is sampled separately as a consistency check: divergent readings are not used to advance the displayed checkpoint. Sleeping devices and browsers differ in whether the monotonic clock also advances during suspend.
- Session checkpoints preserve the ID, immutable configuration values, data version, elapsed time, status and any recorded manual marks in local storage. On reload one cannot prove elapsed duration across a new monotonic clock using wall time alone. A recovered active session therefore retains the last verified checkpoint but suppresses automatic guidance. It does not auto-restart, advance by an assumed wall-clock gap, or switch datasets. This policy intentionally favors an explicit unknown over an estimate that could be wrong.
- The demonstration's data contains **cumulative** phase ends in increasing integer milliseconds. A phase is active up to but not including its end. Progress segments use the difference between consecutive ends. At the last end only the reference is complete; elapsed time continues. Manual mode never provides estimated boundaries or a countdown.
- Reset and invalidation do not pause or restart a physical process. The legacy manual session format is recognized; a previously stopped record stays stopped and its marks are not converted to manufacturer timing.
- Tabs share browser-origin storage. The client should treat a conflict or lost storage as a degraded state, not replace an in-progress timer with another tab's state. Different browsers, devices and preview/production origins remain independent.

## Dataset maintenance

For an additional cement, first verify manufacturer, market, exact reference/formulation, IFU revision, mixing system, preparation conditions and temperature basis (ambient is not the same as component/storage temperature). Keep primary sources and reconciliations in [cement-research.md](cement-research.md). Validate ordered bounds, units, temperature coverage and uncertainty. Reject extrapolation and do not present interpolation as manufacturer measurements.

Catalog availability is separate from timing data. A disabled product does not inherit demo values. Keep a version with each released dataset and persist the chosen snapshot instead of consulting the mutable catalog during a session. Adding a clinical mode to a later release requires passing the [clinical evaluation gates](clinical-safety.md), a deliberate data/model change, and review of the UI copy, unit and browser tests, and migration compatibility. Do not flip a disabled flag as a substitute for that review.
