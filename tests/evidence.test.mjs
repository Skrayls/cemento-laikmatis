import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SMARTSET, REFOBACIN } from '../public/evidence.mjs';
import { resolveConfig, HI_FATIGUE_GRAPH } from '../public/products.mjs';
import { phaseAt, validConfig } from '../public/timing.mjs';

test('SmartSet means and standard deviations are separate statistics', () => {
  assert.deepEqual(SMARTSET.doughing, { mean: 148, sd: 7 });
  assert.deepEqual(SMARTSET.setting, { mean: 534, sd: 17 });
  assert.deepEqual(SMARTSET.working, { mean: 386, sd: 21 });
  const config = resolveConfig('pmma');
  assert.ok(validConfig(config));
  assert.deepEqual(config.boundaries, [30000, 148000, 534000]);
  assert.equal(phaseAt(config, 148000).remaining, 386000);
  for (const temperature of [19, 21, 23]) assert.throws(() => resolveConfig('pmma', temperature));
});

test('historical IFU preserves all nine rows and resolves each exact configuration', () => {
  assert.equal(REFOBACIN.version, '9878300010 / 03 / 2018-05');
  assert.deepEqual(REFOBACIN.temperatures, [19, 21, 23]);
  assert.deepEqual(REFOBACIN.methods, {
    vacuum: [[30, 110, 285, 660], [30, 90, 255, 570], [30, 75, 230, 500]],
    manual: [[30, 110, 330, 690], [30, 90, 300, 615], [30, 75, 270, 540]],
    chilledVacuum: [[30, 255, 580, 960], [30, 240, 500, 825], [30, 225, 440, 720]],
  });
  for (const [method, rows] of Object.entries(REFOBACIN.methods)) {
    for (const [index, temp] of REFOBACIN.temperatures.entries()) {
      const config = resolveConfig('refobacin', temp, method);
      assert.ok(validConfig(config));
      assert.deepEqual(config.boundaries, rows[index].map(seconds => seconds * 1000));
    }
  }
  assert.throws(() => resolveConfig('refobacin', 20), /Unsupported/);
});

test('Hi-Fatigue preserves later graph points and omits conflicting waiting boundary', () => {
  for (const [method, rows] of Object.entries(HI_FATIGUE_GRAPH)) {
    for (const [index, row] of rows.entries()) {
      const config = resolveConfig('hi-fatigue', 18 + index, method);
      assert.ok(validConfig(config));
      assert.match(config.version, /135-0579-02/);
      assert.deepEqual(config.boundaries, [row[0], row[2], row[3]].map(minutes => minutes * 60000));
    }
  }
  assert.throws(() => resolveConfig('hi-fatigue', 24), /Unsupported/);
  assert.throws(() => resolveConfig('hi-fatigue', 20, 'chilledVacuum'), /Unsupported/);
});
