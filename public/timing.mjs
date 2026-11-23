import { resolveConfig } from './products.mjs';

/** @typedef {import('./products.mjs').Config} Config */
/** @typedef {{wall: number, mono: number}} Clocks */
/** @typedef {'active' | 'archived' | 'abandoned'} SessionStatus */
/**
 * @typedef {object} Session
 * @property {string} id
 * @property {Config} config
 * @property {SessionStatus} status
 * @property {number[]} marks
 * @property {number} elapsed
 * @property {number} wall
 * @property {string | null} issue
 */
/**
 * @typedef {object} LiveSession
 * @property {Session} state
 * @property {boolean} recovered
 * @property {{wall: number, mono: number, elapsed: number} | null} anchor
 * @property {Clocks | null} previous
 */

export const STORAGE_KEY = 'cement-timer-pro-v2';
export const LEGACY_KEY = 'cemento-laikmatis-v1';

const CLOCK_TOLERANCE_MS = 1500;
const COMPLETE_PHASE = 4;

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {unknown} value @returns {value is string} */
function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** @param {unknown} value @returns {value is number} */
function isSafeNumber(value) {
  return typeof value === 'number' && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
}

/** @param {unknown} value @returns {value is number} */
function isTime(value) {
  return isSafeNumber(value) && value >= 0;
}

/** @param {unknown} marks @returns {marks is number[]} */
function validMarks(marks) {
  if (!Array.isArray(marks) || marks[0] !== 0 || marks.length > COMPLETE_PHASE + 1) return false;
  let previous = 0;
  for (const mark of marks) {
    if (!isTime(mark) || mark < previous) return false;
    previous = mark;
  }
  return true;
}

/**
 * Validate the shape of a saved snapshot, not its equality to the current demo release.
 * @param {unknown} config
 * @returns {config is Config}
 */
export function validConfig(config) {
  if (!isRecord(config)) return false;
  const { productId, name, manufacturer, method, conditions, version, temp, mode, boundaries } = config;
  if (![name, manufacturer, method, conditions, version].every(hasText)) return false;
  if (productId === 'manual' || productId === 'refobacin' || productId === 'hi-fatigue') return mode === 'manual' && temp === null && boundaries === null;

  const count = productId === 'pmma' && mode === 'reference' && temp === 20 ? 2
    : productId === 'demo' && mode === 'demo' && isSafeNumber(temp) ? 4 : 0;
  if (!count || !Array.isArray(boundaries) || boundaries.length !== count) return false;

  let previous = 0;
  for (const boundary of boundaries) {
    if (!Number.isSafeInteger(boundary) || boundary <= previous) return false;
    previous = boundary;
  }
  return true;
}

/** @param {unknown} state @returns {state is Session} */
export function validSession(state) {
  if (!isRecord(state)) return false;
  const { id, config, status, marks, elapsed, wall, issue } = state;
  return hasText(id) && validConfig(config) &&
    (status === 'active' || status === 'abandoned' || status === 'archived') &&
    validMarks(marks) && (config.mode === 'manual' || marks.length === 1) &&
    isTime(elapsed) && elapsed >= marks[marks.length - 1] &&
    isTime(wall) && (issue === null || hasText(issue));
}

/**
 * Create the initial persistable checkpoint. The monotonic anchor belongs only to the live wrapper.
 * @param {Config} config
 * @param {Clocks} clocks
 * @param {string} id
 * @returns {Session}
 */
export function createSession(config, { wall, mono }, id) {
  if (!validConfig(config) || !hasText(id) || !isTime(wall) || !isTime(mono)) {
    throw new TypeError('Invalid session configuration, id, or clocks');
  }
  return { id, config, status: 'active', marks: [0], elapsed: 0, wall, issue: null };
}

/**
 * Use reload semantics by default. Pass false only when opening a brand-new session.
 * @param {Session} state
 * @param {Clocks} clocks
 * @param {boolean} [reload]
 * @returns {LiveSession}
 */
export function openSession(state, { wall, mono }, reload = true) {
  if (!validSession(state)) throw new TypeError('Invalid session checkpoint');

  /** @type {LiveSession} */
  const live = { state, recovered: false, anchor: null, previous: null };
  if (state.status !== 'active') return live;

  if (reload) {
    live.recovered = true;
    state.issue ??= 'recovered';
    return live;
  }
  if (state.issue !== null) return live;

  if (!isTime(wall) || !isTime(mono) || wall < state.wall) {
    state.issue = 'clock-discrepancy';
    return live;
  }

  live.anchor = { wall, mono, elapsed: state.elapsed };
  live.previous = { wall, mono };
  return live;
}

/**
 * Advance only when the wall and monotonic clocks agree over both the full run and the latest step.
 * @param {LiveSession} live
 * @param {Clocks} clocks
 * @returns {{elapsed: number, issue: string | null}}
 */
export function sample(live, { wall, mono }) {
  const { state, anchor, previous } = live;
  if (state.status !== 'active' || state.issue !== null || !anchor || !previous) {
    return { elapsed: state.elapsed, issue: state.issue };
  }

  if (!isTime(wall) || !isTime(mono) || wall < previous.wall || mono < previous.mono) {
    state.issue = 'clock-discrepancy';
    return { elapsed: state.elapsed, issue: state.issue };
  }

  const monoDelta = mono - anchor.mono;
  const elapsed = anchor.elapsed + monoDelta;
  const totalSkew = (wall - anchor.wall) - monoDelta;
  const stepSkew = (wall - previous.wall) - (mono - previous.mono);

  if (!isTime(elapsed) || Math.abs(totalSkew) > CLOCK_TOLERANCE_MS ||
      Math.abs(stepSkew) > CLOCK_TOLERANCE_MS) {
    state.issue = 'clock-discrepancy';
  } else {
    state.elapsed = elapsed;
    state.wall = wall;
    previous.wall = wall;
    previous.mono = mono;
  }

  return { elapsed: state.elapsed, issue: state.issue };
}

/**
 * Return the current phase. Completing the demo reference does not stop the live stopwatch.
 * @param {Config} config
 * @param {number} elapsed
 * @param {readonly number[]} [marks]
 * @returns {{index: number, remaining: number | null, complete: boolean}}
 */
export function phaseAt(config, elapsed, marks = [0]) {
  if (config.mode === 'manual') {
    const index = Math.max(0, Math.min(COMPLETE_PHASE, marks.length - 1));
    return { index, remaining: null, complete: index === COMPLETE_PHASE };
  }
  const time = Math.max(0, elapsed);
  const index = config.boundaries.findIndex(boundary => time < boundary);
  if (index === -1) return { index: COMPLETE_PHASE, remaining: null, complete: true };
  return { index, remaining: config.boundaries[index] - time, complete: false };
}

/**
 * Migrate the old manual stopwatch without estimating the time since its last mark.
 * @param {unknown} value
 * @returns {Session | null}
 */
export function migrateLegacy(value) {
  if (!isRecord(value)) return null;
  const { startedAt, marks, finishedAt } = value;
  if (!isTime(startedAt) || !validMarks(marks)) return null;

  const lastMark = marks[marks.length - 1];
  const elapsed = finishedAt === null ? lastMark : finishedAt;
  if (!isTime(elapsed) || elapsed < lastMark || !isTime(startedAt + elapsed)) return null;

  return {
    id: `legacy-${startedAt}`,
    config: resolveConfig('manual'),
    status: finishedAt === null ? 'active' : 'archived',
    marks: [...marks],
    elapsed,
    wall: startedAt + elapsed,
    issue: finishedAt === null ? 'uncertain' : null,
  };
}
