import { PRODUCTS, resolveConfig, settings } from './products.mjs';
import { STORAGE_KEY, LEGACY_KEY, createSession, openSession, sample, phaseAt, validSession, migrateLegacy } from './timing.mjs';

/**
 * @template {HTMLElement} T
 * @param {string} id
 * @returns {T}
 */
function element(id) {
  return /** @type {T} */ (document.getElementById(id));
}

const product = /** @type {HTMLSelectElement} */ (element('product'));
const start = /** @type {HTMLButtonElement} */ (element('start'));
const abandon = /** @type {HTMLButtonElement} */ (element('abandon'));
const newSession = /** @type {HTMLButtonElement} */ (element('new-session'));
const modeButton = /** @type {HTMLButtonElement} */ (element('or-mode'));
const wake = /** @type {HTMLButtonElement} */ (element('wake'));
const dialog = /** @type {HTMLDialogElement} */ (element('confirm-action'));
const next = element('next-phase');
const nextCard = /** @type {HTMLElement} */ (next.parentElement);
const track = element('timeline-track');
const marker = element('timeline-marker');
const timelineLabels = element('timeline-labels');

const studyPhases = [
  { title: 'Paruošimas', short: 'Plastiška konsistencija' },
  { title: 'Plastiška konsistencija · orientyras', short: 'Sukietėjimo laikas' },
];
const mixingPhase = { title: 'Maišymas', short: 'Maišymo orientyras' };
const displayLabel = 'Laikas nuo maišymo pradžios';
const getClock = () => ({ wall: Date.now(), mono: performance.now() });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const tempSelect = /** @type {HTMLSelectElement} */ (element('temp'));
const methodSelect = /** @type {HTMLSelectElement} */ (element('method'));

const referencePhases = {
  refobacin: {
    Mixing: ['Maišymas', 'Maišymo pabaiga'],
    Sticky: ['Paruošimas', 'Paruošimo pabaiga'],
    Dough: ['Plastiška konsistencija', 'Plastiškumo pabaiga'],
    'Final hardening': ['Kietėjimas', 'Sukietėjimo orientyras'],
  },
  'hi-fatigue': {
    Mixing: ['Maišymas', 'Maišymo orientyras'],
    'Waiting / Application': ['Laukimas / aplikavimas', 'Aplikavimo pabaigos orientyras'],
    Hardening: ['Kietėjimas', 'Kietėjimo orientyras'],
  },
};

function phasesFor(config) {
  const profile = referencePhases[config.productId];
  if (profile) return Object.values(profile).map(([title, short]) => ({title, short}));
  return config.boundaries?.length === 3 ? [mixingPhase, ...studyPhases] : studyPhases;
}
let draft = resolveConfig('pmma');
let live = null;
let expectedRecord = null;
let legacyRecord = null;
let corruptRecord = false;
let concurrent = false;
let savingUnavailable = false;
let storageNote = '';
let wakeNote = '';
let fullScreenNote = '';
let pending = false;
let owner = false;
let releaseLock = null;
let confirmAction = null;
let timelineConfig = null;
let timelineRows = [];
let intendedWake = false;
let wakeHandle = null;
let wakeRequest = false;
let nativeFullscreen = false;
let changingDisplay = false;
let lastFrame = 0;
let frameHandle = null;

function setText(node, value) {
  if (node.textContent !== value) node.textContent = value;
}

function timeText(ms, round = Math.floor) {
  const seconds = round(Math.max(0, ms) / 1000);
  const part = value => String(value).padStart(2, '0');
  const hh = Math.floor(seconds / 3600);
  const mm = part(Math.floor(seconds / 60) % 60);
  const ss = part(seconds % 60);
  return hh ? [part(hh), mm, ss].join(':') : [mm, ss].join(':');
}

function renderNotice() {
  const lines = [];
  if (concurrent) lines.push('Rodinys sustabdytas: ciklą valdo arba pakeitė kitas skirtukas. Tęskite jame arba, jį uždarę, atnaujinkite šį puslapį.');
  if (corruptRecord) lines.push('Išsaugoto ciklo perskaityti nepavyko. Naujai sesijai išvalykite netinkamą įrašą.');
  if (live?.recovered) lines.push('Ciklas atkurtas; išsaugoti profilio parametrai nepakeisti.');
  if (live?.state.issue) lines.push('Praėjusio laiko patikimai nustatyti nepavyko. Rodomas paskutinis patikimas rodmuo; remkitės atsarginiu laikmačiu.');
  if (savingUnavailable) lines.push('Naršyklėje negalima išsaugoti ciklo. Neuždarykite ir neatnaujinkite šio puslapio.');
  if (storageNote) lines.push(storageNote);
  if (fullScreenNote) lines.push(fullScreenNote);
  if (wakeNote) lines.push(wakeNote);
  const notice = element('notice');
  notice.hidden = lines.length === 0;
  setText(notice, lines.join('\n'));
}

function profileName(id, fallback) {
  if (id === 'demo') return 'Ankstesnis ciklas';
  if (id === 'manual') return 'Rankinis chronometras';
  return fallback;
}

function buildTimeline(config) {
  marker.remove();
  track.replaceChildren();
  timelineLabels.replaceChildren();
  let previous = 0;
  timelineLabels.style.setProperty('--steps', String(phasesFor(config).length));
  timelineRows = phasesFor(config).map((phase, index) => {
    const boundary = config.boundaries?.[index];
    const duration = boundary === undefined ? 1 : boundary - previous;
    previous = boundary ?? 0;
    const segment = document.createElement('div');
    segment.className = 'timeline-segment';
    segment.dataset.step = String(index);
    segment.style.setProperty('--duration', String(duration));
    track.append(segment);

    const label = document.createElement('li');
    label.className = 'timeline-label';
    label.dataset.step = String(index);
    const heading = document.createElement('strong');
    heading.textContent = phase.short;
    const end = document.createElement('small');
    label.append(heading, end);
    timelineLabels.append(label);
    return { segment, label, end, boundary, duration };
  });
  track.append(marker);
  timelineConfig = config;
}

function renderTimeline(config, state, elapsed, index, uncertain) {
  const timeline = element('timeline');
  timeline.hidden = uncertain || !config.boundaries;
  if (timeline.hidden) return;
  if (timelineConfig !== config) buildTimeline(config);

  const total = config.boundaries?.at(-1);
  const active = state?.status === 'active';
  const marks = state?.marks ?? [];
  const displayElapsed = reducedMotion.matches && elapsed < total ? Math.floor(elapsed / 1000) * 1000 : elapsed;
  setText(element('timeline-title'), total ? 'Atskaitos taškai' : 'Rankiniu būdu pažymėti etapai');
  const summary = element('timeline-summary');
  summary.hidden = Boolean(total) || !state;
  if (!summary.hidden) setText(summary, `${marks.length - 1} / 4 žymų`);
  marker.hidden = !total || !active;
  if (total && active) {
    // Include the inter-segment gaps so the indicator stays on the active fill.
    const phase = Math.min(index, timelineRows.length - 1);
    const width = track.clientWidth;
    if (width) {
      const gap = 3;
      const progress = Math.min(1, displayElapsed / total);
      const x = progress * (width - (timelineRows.length - 1) * gap) + phase * gap;
      marker.style.setProperty('--position', `${x / width * 100}%`);
    }
  }

  timelineRows.forEach(({ segment, label, end, boundary, duration }, i) => {
    const current = active && index === i;
    const fill = boundary === undefined ? Number(marks[i + 1] !== undefined)
      : Math.min(1, Math.max(0, (displayElapsed - (boundary - duration)) / duration));
    segment.classList.toggle('is-current', current);
    segment.style.setProperty('--fill', String(fill));
    label.classList.toggle('is-current', current);
    label.classList.toggle('is-done', fill === 1);
    if (current) label.setAttribute('aria-current', 'step');
    else label.removeAttribute('aria-current');
    const endTime = boundary ?? marks[i + 1];
    setText(end, endTime === undefined ? '—' : (config.productId === 'hi-fatigue' ? '≈ ' : '') + timeText(endTime));
  });
}

function renderClock(tick = null) {
  const state = live?.state;
  const elapsed = tick?.elapsed ?? state?.elapsed ?? 0;
  const uncertain = Boolean(state && (state.issue || tick?.issue || concurrent));
  const config = state?.config ?? draft;
  const active = state?.status === 'active';
  const modeled = config.boundaries !== null;
  const oldSchedule = config.mode === 'demo';
  const steps = phasesFor(config);
  const phase = phaseAt(config, elapsed, state?.marks);
  let title;
  let modePhase = 'idle';
  let remaining = null;
  const remainingLabel = config.productId === 'hi-fatigue' ? 'Apytiksliai iki orientyro' : 'Iki kito orientyro';
  let nextTitle = '';

  if (uncertain) {
    title = concurrent ? 'Rodinys sustabdytas' : 'Laikas nepatikimas';
    modePhase = 'uncertain';
  } else if (state && !active) {
    title = state.status === 'archived' ? 'Ankstesnis ciklas baigtas' : 'Ciklas anuliuotas';
  } else if (active && oldSchedule) {
    title = 'Ankstesnis ciklas · tik praėjęs laikas';
  } else if (!active) {
    title = 'Paruošta';
  } else if (!modeled) {
    title = 'Orientyrų nėra';
  } else {
    modePhase = String(phase.index);
    if (phase.complete) {
      title = 'Sukietėjimo orientyras pasiektas';
    } else {
      title = steps[phase.index].title;
      remaining = phase.remaining;
      nextTitle = steps[phase.index].short;
    }
  }

  if (document.body.dataset.phase !== modePhase) document.body.dataset.phase = modePhase;
  const clock = element('elapsed');
  clock.classList.toggle('hours', elapsed >= 3600000);
  setText(clock, timeText(elapsed));
  setText(element('clock-label'), uncertain ? 'Paskutinis patikimas rodmuo' : displayLabel);
  setText(element('phase'), title);
  element('countdown').hidden = remaining === null;
  if (remaining !== null) {
    setText(element('remaining-label'), remainingLabel);
    setText(element('remaining'), timeText(remaining, Math.ceil));
  }
  next.hidden = !nextTitle;
  setText(next, nextTitle);
  nextCard.hidden = remaining === null && !nextTitle;
  renderTimeline(config, state, elapsed, phase.index, uncertain || oldSchedule);
}

function renderControls() {
  const state = live?.state;
  const config = state?.config ?? draft;
  const active = state?.status === 'active';
  const adjustable = !state && !concurrent && !corruptRecord && !pending;
  document.body.dataset.mode = config.mode;
  document.body.dataset.running = String(active);
  const name = profileName(config.productId, config.name);
  const configuration = element('configuration');
  configuration.hidden = Boolean(state) || corruptRecord;
  element('session-config').hidden = !configuration.hidden;
  setText(element('session-config'), config.mode !== 'reference' ? name :
    [name, `${config.temp} °C`, config.productId !== 'pmma' ? config.method : ''].filter(Boolean).join(' · '));
  tempSelect.disabled = !adjustable || tempSelect.options.length < 2;
  methodSelect.disabled = !adjustable;
  element('setup').hidden = Boolean(state) || corruptRecord;
  element('session-actions').hidden = !state && !corruptRecord;
  product.disabled = !adjustable;
  start.disabled = !adjustable;
  abandon.hidden = !active;
  abandon.disabled = concurrent || pending;
  newSession.hidden = !corruptRecord && (!state || active);
  newSession.disabled = concurrent || pending;
  setText(newSession, corruptRecord ? 'Išvalyti netinkamą įrašą' : 'Naujas ciklas');
  modeButton.hidden = !active && !document.body.classList.contains('or-mode');
  modeButton.disabled = changingDisplay || (!active && !document.body.classList.contains('or-mode'));
  wake.hidden = !active || !('wakeLock' in navigator);
  syncWakeButton();
  renderNotice();
}

function render() {
  renderControls();
  renderClock();
  queueAnimation();
}

for (const item of PRODUCTS) product.add(new Option(item.name, item.id));
product.value = draft.productId;

function readRecord() {
  try {
    return { ok: true, raw: localStorage.getItem(STORAGE_KEY), legacy: localStorage.getItem(LEGACY_KEY) };
  } catch {
    savingUnavailable = true;
    return { ok: false, raw: null, legacy: null };
  }
}

function releaseOwner() {
  owner = false;
  releaseLock?.();
  releaseLock = null;
  if (frameHandle !== null) cancelAnimationFrame(frameHandle);
  frameHandle = null;
}

function conflict() {
  concurrent = true;
  releaseOwner();
  intendedWake = false;
  void refreshWake();
  render();
}

async function claimOwner() {
  if (owner) return true;
  if (!navigator.locks?.request) {
    owner = true;
    return true;
  }
  return new Promise(resolve => {
    navigator.locks.request(STORAGE_KEY, { ifAvailable: true }, lock => {
      if (!lock) {
        resolve(false);
        return;
      }
      owner = true;
      return new Promise(unlock => {
        releaseLock = unlock;
        resolve(true);
      });
    }).catch(() => resolve(false));
  });
}

function checkUnchanged() {
  if (concurrent) return false;
  const data = readRecord();
  if (data.ok && (data.raw !== expectedRecord || (expectedRecord === null && data.legacy !== legacyRecord))) {
    conflict();
    return false;
  }
  return true;
}

function save(state) {
  if (!owner || !checkUnchanged()) return false;
  const serialized = JSON.stringify(state);
  if (serialized === expectedRecord) return true;
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
    expectedRecord = serialized;
    if (savingUnavailable) {
      savingUnavailable = false;
      renderNotice();
    }
    return true;
  } catch {
    savingUnavailable = true;
    renderNotice();
    return false;
  }
}

function noStoredSession() {
  return expectedRecord === 'null' || (expectedRecord === null && legacyRecord === null);
}

async function restore() {
  const data = readRecord();
  expectedRecord = data.raw;
  legacyRecord = data.legacy;
  try {
    const raw = data.raw ?? data.legacy;
    if (raw === null || raw === 'null') return;
    const saved = JSON.parse(raw);
    const restored = data.raw !== null ? saved : migrateLegacy(saved);
    if (!validSession(restored)) throw new Error('Invalid saved session');
    live = openSession(restored, getClock());
  } catch {
    corruptRecord = true;
  }
  if (live?.state.status === 'active') {
    if (!await claimOwner() || !checkUnchanged()) conflict();
    else save(live.state);
  }
}

await restore();
render();

function loadOptions() {
  const options = settings[product.value];
  tempSelect.replaceChildren(...options.temperatures.map(temp => new Option(`${temp} °C`, String(temp))));
  methodSelect.replaceChildren(...Object.entries(options.methods).map(([key, name]) => new Option(String(name), key)));
  element('temp-field').hidden = product.value === 'pmma';
  element('reference-temp').hidden = product.value !== 'pmma';
  element('method-field').hidden = !methodSelect.options.length;
}

function updateDraft() {
  if (live || pending) return;
  draft = resolveConfig(product.value, Number(tempSelect.value), methodSelect.value || undefined);
  render();
}

loadOptions();
product.addEventListener('change', () => {
  loadOptions();
  updateDraft();
});
tempSelect.addEventListener('change', updateDraft);
methodSelect.addEventListener('change', updateDraft);

start.addEventListener('click', async () => {
  if (live || start.disabled) return;
  pending = true;
  renderControls();
  if (!await claimOwner() || !checkUnchanged()) {
    conflict();
  } else {
    const now = getClock();
    const id = crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint32Array(4)), part => part.toString(16)).join('-');
    live = openSession(createSession(draft, now, id), now, false);
    save(live.state);
  }
  pending = false;
  render();
  if (live) modeButton.focus();
});

function takeSample() {
  if (live?.state.status !== 'active' || live.state.issue || concurrent || !owner) return null;
  const before = live.state.issue;
  const tick = sample(live, getClock());
  if (before !== tick.issue) {
    save(live.state);
    renderControls();
  }
  return tick;
}

function checkpoint() {
  const tick = takeSample();
  if (tick) {
    save(live.state);
    renderClock(tick);
  }
}

setInterval(checkpoint, 1000);
function animate(frame) {
  frameHandle = null;
  if (frame - lastFrame >= (reducedMotion.matches ? 250 : 55)) {
    lastFrame = frame;
    const tick = takeSample();
    if (tick) renderClock(tick);
  }
  queueAnimation();
}

function queueAnimation() {
  if (frameHandle === null && live?.state.status === 'active' && !live.state.issue && owner && !concurrent) {
    frameHandle = requestAnimationFrame(animate);
  }
}

function ask(kind, trigger, title, body, label) {
  confirmAction = { kind, id: live?.state.id, trigger };
  dialog.returnValue = 'cancel';
  setText(element('confirm-title'), title);
  setText(element('confirm-body'), body);
  setText(element('confirm-yes'), label);
  dialog.showModal();
}
abandon.addEventListener('click', () => {
  ask('abandon', abandon, 'Anuliuoti šį ciklą?', 'Laikmatis ir fazių rodinys bus sustabdyti. Tai nekeičia fizinio cemento kietėjimo.', 'Anuliuoti ciklą');
});
newSession.addEventListener('click', () => {
  void applyAction({ kind: 'clear', id: live?.state.id });
});

dialog.addEventListener('close', async () => {
  const action = confirmAction;
  confirmAction = null;
  if (!action) return;
  if (dialog.returnValue !== 'confirm') {
    action.trigger.focus();
    return;
  }
  await applyAction(action);
});

async function applyAction(action) {
  if (concurrent || action.id !== live?.state.id) return;
  pending = true;
  renderControls();

  if (!await claimOwner() || !checkUnchanged()) {
    conflict();
  } else if (action.kind === 'abandon' && live?.state.status === 'active') {
    takeSample();
    if (!concurrent) {
      const nextState = { ...live.state, status: /** @type {const} */ ('abandoned') };
      const saved = save(nextState);
      if (saved || (!concurrent && noStoredSession())) {
        live.state = nextState;
        storageNote = '';
        releaseOwner();
        intendedWake = false;
        void refreshWake();
      } else if (!concurrent) {
        storageNote = 'Neįrašytas ciklo anuliavimas. Ciklas neanuliuotas; bandykite dar kartą.';
      }
    }
  } else if (action.kind === 'clear') {
    const cleared = save(null);
    if (cleared || (!concurrent && noStoredSession())) {
      live = null;
      corruptRecord = false;
      storageNote = '';
    } else if (!concurrent) {
      storageNote = 'Įrašo išvalyti nepavyko; naujas ciklas nepradėtas.';
    }
    releaseOwner();
  }
  pending = false;
  render();
  const target = live || corruptRecord ? newSession : start;
  if (!target.hidden && !target.disabled) target.focus();
}

window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY && event.key !== LEGACY_KEY && event.key !== null) return;
  checkUnchanged();
});

window.addEventListener('pagehide', () => {
  checkpoint();
  releaseOwner();
});
window.addEventListener('pageshow', async event => {
  if (event.persisted && live?.state.status === 'active' && !concurrent) {
    if (!await claimOwner() || !checkUnchanged()) conflict();
    else checkpoint();
    render();
  }
});
document.addEventListener('visibilitychange', () => {
  checkpoint();
  void refreshWake();
});

function setOR(enabled) {
  document.body.classList.toggle('or-mode', enabled);
  modeButton.setAttribute('aria-pressed', String(enabled));
  setText(modeButton, enabled ? 'Išeiti iš OR režimo' : 'OR režimas');
  if (!enabled) {
    nativeFullscreen = false;
    fullScreenNote = '';
  }
  renderControls();
}

modeButton.addEventListener('click', async () => {
  if (changingDisplay) return;
  changingDisplay = true;
  fullScreenNote = '';
  if (document.body.classList.contains('or-mode')) {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      setOR(false);
    } catch {
      fullScreenNote = 'Norėdami išeiti iš viso ekrano, naudokite naršyklės komandą.';
    }
  } else {
    setOR(true);
    try {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        nativeFullscreen = Boolean(document.fullscreenElement);
      }
      if (!nativeFullscreen) fullScreenNote = 'OR rodinys · ne viso ekrano režimas';
    } catch {
      fullScreenNote = 'OR rodinys · ne viso ekrano režimas';
    }
  }
  changingDisplay = false;
  renderControls();
  if (!modeButton.disabled) modeButton.focus();
});
document.addEventListener('fullscreenchange', () => {
  if (nativeFullscreen && !document.fullscreenElement) setOR(false);
});

function syncWakeButton() {
  wake.setAttribute('aria-pressed', String(intendedWake));
  setText(wake, intendedWake ? 'Leisti užmigdyti' : 'Neužmigdyti ekrano');
}

async function refreshWake() {
  if (!intendedWake || document.visibilityState !== 'visible') {
    const released = wakeHandle;
    wakeHandle = null;
    if (released) await released.release().catch(() => {});
    return;
  }
  if (wakeHandle || wakeRequest) return;
  wakeRequest = true;
  try {
    const handle = await navigator.wakeLock.request('screen');
    if (!intendedWake || live?.state.status !== 'active' || concurrent || document.visibilityState !== 'visible') {
      await handle.release();
      return;
    }
    if (handle.released) throw new Error('Wake lock was released before it could be used');
    wakeHandle = handle;
    wakeNote = '';
    handle.addEventListener('release', () => {
      if (wakeHandle !== handle) return;
      wakeHandle = null;
      if (intendedWake && document.visibilityState === 'visible') {
        intendedWake = false;
        wakeNote = 'Ekrano budrumo palaikymas nutrūko; įrenginys gali užmigti.';
        syncWakeButton();
        renderNotice();
      }
    }, { once: true });
  } catch {
    intendedWake = false;
    wakeNote = 'Naršyklė negali palaikyti ekrano budrumo. Patikrinkite įrenginio nuostatas.';
  } finally {
    wakeRequest = false;
    syncWakeButton();
    renderNotice();
  }
}

wake.addEventListener('click', () => {
  intendedWake = !intendedWake;
  wakeNote = '';
  syncWakeButton();
  renderNotice();
  void refreshWake();
});
