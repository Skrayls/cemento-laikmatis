# Clinical evaluation and deployment boundaries

**CEMENT TIMER PRO is a prototype for workflow and usability evaluation, not a validated medical device. Do not use it for patient care or make clinical decisions from the timer.** The public preview is for workflow evaluation, not a deployment into a clinical environment.

- The **Bendras PMMA** profile presents two SmartSet HV study averages at 20 °C. Neither milestone confirms the state of the cement being handled.
- **Manual** mode is an elapsed stopwatch with optional operator-recorded phase markers. Labels report input, not an assessment of the material. There is no estimated remaining time in this mode.
- No automatic clinical profile is enabled. Use the exact product's local, current manufacturer instructions in conjunction with local procedure and trained staff. Cement behaviour can differ with formulation, preparation and storage, component and ambient temperature, mixing method, and patient or procedural conditions.
- If visibility, continuity, shared-tab ownership or time confidence is lost, do not infer elapsed time from a stale display. Verify against an independent approved time source. Discarding the on-screen session does not restart or affect physical polymerization.
- Fullscreen and wake lock are requests to the browser and OS, not guarantees. Device lock, browser crash, power loss and system interrupts can hide the display. An offline-installed app is not a hardware timer.

## Gates before any clinical deployment

1. Fix the intended use, market, exact product variants and mixing systems; obtain the current applicable IFUs and reconcile the data and terminology with the manufacturer. Establish provenance, handling conditions, uncertainty, and approved release criteria for each temperature.
2. Perform clinical and engineering risk assessments with orthopedic and operating-room staff. Include incorrect selection/start, an ambiguous phase, incorrect data, divergence after sleep, refresh, freezing, tab conflict, loss of display, accidental input and false reassurance. Establish independent fallback and training.
3. Validate end-to-end timing against a traceable reference on the actual OS/browser/hardware and operating conditions. Run supervised simulation, human-factors evaluation at viewing distance under actual lighting, accessibility review, and compatibility testing before considering use around patients.
4. Obtain clinical governance, biomedical engineering, information security and applicable regulatory review (including software/medical-device classification and obligations for the intended jurisdiction). Document change control, version acceptance, deployment, rollback, incident response and monitoring. These documents and software tests do not establish clinical or regulatory approval.
