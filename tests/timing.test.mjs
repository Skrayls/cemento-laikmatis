import { test } from 'node:test';
import { demoConfig } from './demo-fixture.mjs';
import assert from 'node:assert/strict';
import { PRODUCTS, resolveConfig } from '../public/products.mjs';
import {
  STORAGE_KEY, LEGACY_KEY, createSession, openSession, sample, phaseAt,
  validConfig, validSession, migrateLegacy,
} from '../public/timing.mjs';

/** @typedef {import('../public/products.mjs').Config} Config */

const WALL = 1700000000000;
const MONO = 125.5;
const demo = demoConfig();
const manual = resolveConfig('manual');

/** @param {number} wallDelta @param {number} [monoDelta] */
function clocks(wallDelta, monoDelta = wallDelta) {
  return { wall: WALL + wallDelta, mono: MONO + monoDelta };
}

/** @param {Config} [config] */
function fresh(config = demo) {
  return createSession(config, clocks(0), 'session-1');
}

/** @param {Config} [config] */
function freshLive(config = demo) {
  return openSession(fresh(config), clocks(0), false);
}

test('storage keys use the current and legacy browser contracts', () => {
  assert.equal(STORAGE_KEY, 'cement-timer-pro-v2');
  assert.equal(LEGACY_KEY, 'cemento-laikmatis-v1');
});

test('catalog offers one literature profile and two manufacturer reference profiles', () => {
  assert.deepEqual(PRODUCTS.map(({ id, status, temperatures }) => [id, status, temperatures]), [
    ['pmma', 'reference', []],
    ['refobacin', 'manual', []], ['hi-fatigue', 'manual', []],
  ]);
  const [, refobacin, hiFatigue] = PRODUCTS;
  assert.equal(refobacin.name, 'Refobacin Bone Cement R');
  assert.equal(refobacin.manufacturer, 'Zimmer Biomet (Biomet France)');
  assert.equal(hiFatigue.name, 'Hi-Fatigue G');
  assert.equal(hiFatigue.manufacturer, 'OSARTIS GmbH (distributed by Zimmer GmbH)');
  for (const product of [refobacin, hiFatigue]) {
    assert.ok(product.reason);
    assert.equal(Object.hasOwn(product, 'boundaries'), false);
    assert.ok(resolveConfig(product.id).boundaries.length);
    assert.throws(() => resolveConfig(product.id, 25), /Unsupported configuration/);
  }
});

test('demo defaults to 20°C without interpolation or coercion', () => {
  assert.deepEqual(demo, demoConfig(20));
  for (const temp of [18, 19.5, 22, NaN, Infinity, null]) {
    assert.throws(() => demoConfig(temp), /Unsupported/);
  }
  assert.throws(() => resolveConfig('not-a-product'), /Unknown/);
});

test('manual snapshot has no temperature or timed boundaries', () => {
  assert.deepEqual(manual, resolveConfig('manual', null));
  assert.equal(manual.name, 'Rankinis laikmatis');
  assert.equal(manual.mode, 'manual');
  assert.equal(manual.temp, null);
  assert.equal(manual.boundaries, null);
  assert.throws(() => resolveConfig('manual', 20), /no temperature/);
});

test('snapshots freeze both configuration and demo boundaries', () => {
  assert.ok(Object.isFrozen(manual));
  assert.ok(Object.isFrozen(demo));
  assert.ok(Object.isFrozen(demo.boundaries));
  assert.throws(() => Object.defineProperty(demo, 'version', { value: 'changed' }), TypeError);
  assert.throws(() => Object.defineProperty(demo.boundaries, '0', { value: 1 }), TypeError);
  assert.equal(demo.boundaries[0], 22000);
});

const references = [
  { temp: 19, ends: [24000, 58000, 153000, 295000] },
  { temp: 20, ends: [22000, 52000, 138000, 268000] },
  { temp: 21, ends: [20000, 46000, 123000, 242000] },
];

for (const { temp, ends } of references) {
  test(`demo at ${temp}°C selects the exact synthetic reference and starts at 00`, () => {
    const config = demoConfig(temp);
    assert.deepEqual(config.boundaries, ends);
    assert.deepEqual(phaseAt(config, 0), { index: 0, remaining: ends[0], complete: false });
  });

  for (const [index, end] of ends.entries()) {
    test(`demo at ${temp}°C: phase ${index} at -1 s, exact boundary, and +1 s`, () => {
      const config = demoConfig(temp);
      const nextIndex = index + 1;
      const complete = nextIndex === ends.length;
      assert.deepEqual(phaseAt(config, end - 1000), { index, remaining: 1000, complete: false });
      for (const offset of [0, 1000]) {
        const remaining = complete ? null : ends[nextIndex] - end - offset;
        assert.deepEqual(phaseAt(config, end + offset), { index: nextIndex, remaining, complete });
      }
    });
  }
}

test('manual phases move only on marks, including two marks sharing a timestamp', () => {
  assert.deepEqual(phaseAt(manual, 0), { index: 0, remaining: null, complete: false });
  assert.deepEqual(phaseAt(manual, 600000), { index: 0, remaining: null, complete: false });
  assert.deepEqual(phaseAt(manual, 1200, [0, 500, 500]), { index: 2, remaining: null, complete: false });
  assert.deepEqual(phaseAt(manual, 1200, [0, 500, 500, 1000]), { index: 3, remaining: null, complete: false });
  assert.deepEqual(phaseAt(manual, 1200, [0, 500, 500, 1000, 1200]), { index: 4, remaining: null, complete: true });
});

test('createSession has exactly the persistable fields and independent marks', () => {
  const state = fresh();
  assert.deepEqual(JSON.parse(JSON.stringify(state)), {
    id: 'session-1', config: demo, status: 'active', marks: [0], elapsed: 0, wall: WALL, issue: null,
  });
  assert.ok(validSession(state));
  assert.notEqual(state.marks, fresh().marks);
  assert.throws(() => createSession(demo, clocks(0, NaN), 'invalid'), /Invalid/);
});

test('fresh open keeps the state and samples elapsed from monotonic time', () => {
  const state = fresh();
  const live = openSession(state, clocks(0), false);
  assert.equal(live.state, state);
  assert.equal(live.recovered, false);
  assert.deepEqual(sample(live, clocks(0)), { elapsed: 0, issue: null });
  assert.deepEqual(sample(live, clocks(20, 13.5)), { elapsed: 13.5, issue: null });
  assert.deepEqual(sample(live, clocks(5300, 5301.75)), { elapsed: 5301.75, issue: null });
  assert.equal(state.wall, WALL + 5300);
});

test('a long gap is accepted when both clocks advance together', () => {
  const live = freshLive();
  sample(live, clocks(99));
  assert.deepEqual(sample(live, clocks(600000)), { elapsed: 600000, issue: null });
});

test('demo completion does not cap elapsed or stop the active session', () => {
  const live = freshLive();
  sample(live, clocks(268000));
  assert.deepEqual(phaseAt(demo, live.state.elapsed), { index: 4, remaining: null, complete: true });
  assert.deepEqual(sample(live, clocks(999999)), { elapsed: 999999, issue: null });
  assert.equal(live.state.status, 'active');
  assert.deepEqual(phaseAt(demo, live.state.elapsed), { index: 4, remaining: null, complete: true });
});

const clockFailures = [
  { name: 'wall clock moves backwards', wall: 999, mono: 1001 },
  { name: 'monotonic clock moves backwards', wall: 1001, mono: 999 },
  { name: 'monotonic clock stops across a long sleep', wall: 600000, mono: 1000 },
  { name: 'monotonic clock jumps ahead of wall time', wall: 1001, mono: 600000 },
  { name: 'wall clock becomes nonfinite', wall: Infinity, mono: 1001 },
  { name: 'monotonic clock becomes nonfinite', wall: 1001, mono: NaN },
  { name: 'wall clock exceeds safe numeric range', wall: Number.MAX_SAFE_INTEGER, mono: 1001 },
];

for (const { name, wall, mono } of clockFailures) {
  test(`preserves checkpoint and sets a sticky issue when ${name}`, () => {
    const live = freshLive();
    sample(live, clocks(1000));
    assert.deepEqual(sample(live, clocks(wall, mono)), { elapsed: 1000, issue: 'clock-discrepancy' });
    assert.deepEqual(sample(live, clocks(1002)), { elapsed: 1000, issue: 'clock-discrepancy' });
    assert.equal(live.state.wall, WALL + 1000);
  });
}

test('total skew is checked even when each step is within tolerance', () => {
  const live = freshLive();
  assert.deepEqual(sample(live, clocks(2000, 1000)), { elapsed: 1000, issue: null });
  assert.deepEqual(sample(live, clocks(4000, 2000)), { elapsed: 1000, issue: 'clock-discrepancy' });
  assert.equal(live.state.wall, WALL + 2000);
});

test('step skew is checked even when total skew is within tolerance', () => {
  const live = freshLive();
  assert.deepEqual(sample(live, clocks(2000, 1000)), { elapsed: 1000, issue: null });
  assert.deepEqual(sample(live, clocks(2000, 3000)), { elapsed: 1000, issue: 'clock-discrepancy' });
  assert.equal(live.state.wall, WALL + 2000);
});

test('1500 ms of skew is tolerated but 1501 ms is not', () => {
  const live = freshLive();
  assert.deepEqual(sample(live, clocks(2500, 1000)), { elapsed: 1000, issue: null });
  assert.deepEqual(sample(live, clocks(2501, 1000)), { elapsed: 1000, issue: 'clock-discrepancy' });
});

test('fresh open with an invalid clock preserves the initial checkpoint', () => {
  const live = openSession(fresh(), clocks(-1, 0), false);
  assert.deepEqual(sample(live, clocks(1000)), { elapsed: 0, issue: 'clock-discrepancy' });
  assert.equal(live.state.wall, WALL);
});

test('active reload freezes at the persisted checkpoint, regardless of the wall-only gap', () => {
  const live = freshLive(manual);
  sample(live, clocks(3210));
  live.state.marks.push(3000);
  const saved = JSON.parse(JSON.stringify(live.state));
  const reloaded = openSession(saved, clocks(150000, 0));
  assert.equal(reloaded.recovered, true);
  assert.deepEqual(sample(reloaded, clocks(160000, 10000)), { elapsed: 3210, issue: 'recovered' });
  assert.equal(reloaded.state.wall, WALL + 3210);
  assert.deepEqual(reloaded.state.marks, [0, 3000]);
});

test('reload does not overwrite a recorded clock issue', () => {
  const live = freshLive();
  sample(live, clocks(500));
  sample(live, clocks(4000, 500));
  const reloaded = openSession(live.state, clocks(5000));
  assert.equal(reloaded.recovered, true);
  assert.deepEqual(sample(reloaded, clocks(6000)), { elapsed: 500, issue: 'clock-discrepancy' });
});

for (const status of [/** @type {const} */ ('archived'), /** @type {const} */ ('abandoned')]) {
  test(`${status} checkpoints never restart on open or sample`, () => {
    const live = freshLive();
    sample(live, clocks(2000));
    live.state.status = status;
    assert.deepEqual(sample(live, clocks(3000)), { elapsed: 2000, issue: null });
    const reloaded = openSession(live.state, clocks(4500));
    assert.deepEqual(sample(reloaded, clocks(5000)), { elapsed: 2000, issue: null });
    assert.equal(reloaded.state.wall, WALL + 2000);
    assert.equal(reloaded.state.status, status);
  });
}

test('recognizes older versioned demo snapshots without comparing the current temperature table', () => {
  const config = { ...demo, version: 'demo-previous', temp: 18, boundaries: [1000, 2000, 3000, 4000] };
  assert.ok(validConfig(config));
  assert.ok(validSession({ ...fresh(), config }));
  assert.deepEqual(phaseAt(config, 2000), { index: 2, remaining: 1000, complete: false });
});

test('rejects disabled or mismatched IDs and malformed config metadata', () => {
  for (const config of [
    null, {}, { ...demo, version: '' }, { ...demo, manufacturer: 10 },
    { ...demo, productId: 'refobacin' }, { ...manual, productId: 'pmma' },
    { ...demo, productId: 'manual' }, { ...manual, productId: 'demo' },
  ]) assert.equal(validConfig(config), false);
});

test('rejects malformed boundaries and temperatures for both modes', () => {
  for (const boundaries of [
    null, [], [1, 2, 3], [0, 2, 3, 4], [1, 2, 2, 4], [1, 3, 2, 4],
    [1, 2, 3.5, 4], [1, 2, 3, Infinity], [1, 2, 3, Number.MAX_SAFE_INTEGER + 1],
  ]) assert.equal(validConfig({ ...demo, boundaries }), false);
  assert.equal(validConfig({ ...manual, boundaries: [] }), false);
  assert.equal(validConfig({ ...manual, temp: 20 }), false);
  assert.equal(validConfig({ ...demo, temp: NaN }), false);
  assert.equal(validConfig({ ...demo, temp: null }), false);
});

test('session validation rejects corrupt ids, statuses, times, issues, and marks', () => {
  const state = { ...fresh(manual), elapsed: 3000 };
  const sparseMarks = Array(3);
  sparseMarks[0] = 0;
  sparseMarks[2] = 1000;
  for (const changes of [
    { id: '' }, { status: 'stopped' }, { elapsed: -1 }, { elapsed: Infinity }, { wall: '1700000000000' },
    { wall: Number.MAX_SAFE_INTEGER + 1 }, { issue: undefined }, { issue: {} },
    { marks: [] }, { marks: [1000] }, { marks: [0, 2000, 1000] }, { marks: sparseMarks },
    { marks: [0, NaN] }, { marks: [0, 3001] }, { marks: [0, 1, 2, 3, 4, 5] },
  ]) assert.equal(validSession({ ...state, ...changes }), false);
  assert.ok(validSession({ ...state, marks: [0, 100, 100, 200, 2900] }));
  assert.equal(validSession({ ...fresh(), elapsed: 3000, marks: [0, 1000] }), false);
});

test('unfinished legacy migration preserves the last mark without inferring live elapsed', () => {
  const legacy = { startedAt: WALL, marks: [0, 500, 1200], finishedAt: null };
  const state = migrateLegacy(legacy);
  assert.ok(validSession(state));
  assert.deepEqual(state.config, manual);
  assert.equal(state.status, 'active');
  assert.equal(state.issue, 'uncertain');
  assert.equal(state.elapsed, 1200);
  assert.equal(state.wall, WALL + 1200);
  assert.deepEqual(state.marks, legacy.marks);
  assert.notEqual(state.marks, legacy.marks);
  assert.deepEqual(sample(openSession(state, clocks(999999)), clocks(1000000)), {
    elapsed: 1200, issue: 'uncertain',
  });
});

test('finished legacy migration archives the numeric elapsed, including zero', () => {
  const finished = migrateLegacy({ startedAt: WALL, marks: [0, 1000, 2000], finishedAt: 93000 });
  assert.ok(validSession(finished));
  assert.equal(finished.status, 'archived');
  assert.equal(finished.elapsed, 93000);
  assert.equal(finished.wall, WALL + 93000);
  assert.deepEqual(finished.marks, [0, 1000, 2000]);
  assert.equal(finished.issue, null);
  const immediate = migrateLegacy({ startedAt: WALL, marks: [0], finishedAt: 0 });
  assert.ok(validSession(immediate));
  assert.equal(immediate.status, 'archived');
  assert.equal(immediate.elapsed, 0);
});

test('legacy migration rejects missing, unsafe, or inconsistent fields', () => {
  for (const value of [
    null,
    { startedAt: String(WALL), marks: [0], finishedAt: null },
    { startedAt: WALL, marks: [0] },
    { startedAt: WALL, marks: [0, 1], finishedAt: 0 },
    { startedAt: WALL, marks: [0, 1, 2, 3, 4, 5], finishedAt: null },
    { startedAt: WALL, marks: [0, 1, 0], finishedAt: null },
    { startedAt: WALL, marks: [0], finishedAt: Infinity },
    { startedAt: Number.MAX_SAFE_INTEGER, marks: [0, 1], finishedAt: null },
  ]) assert.equal(migrateLegacy(value), null);
});
