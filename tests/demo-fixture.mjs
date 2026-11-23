/** @type {ReadonlyMap<number, readonly number[]>} */
const DEMO_BOUNDARIES = new Map([
  [19, Object.freeze([24000, 58000, 153000, 295000])],
  [20, Object.freeze([22000, 52000, 138000, 268000])],
  [21, Object.freeze([20000, 46000, 123000, 242000])],
]);

export function demoConfig(temp = 20) {
  const boundaries = DEMO_BOUNDARIES.get(temp);
  if (!boundaries) throw new RangeError('Unsupported temperature');
  return Object.freeze({ productId: 'demo', name: 'Legacy', manufacturer: 'Legacy',
    method: 'Legacy', conditions: 'Legacy', version: 'demo-1', temp, mode: 'demo', boundaries });
}
