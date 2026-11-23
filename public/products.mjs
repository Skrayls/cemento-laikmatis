import { MIXING_REFERENCE, SMARTSET, REFOBACIN, ADDITIONAL_REFERENCES, ADDITIONAL_TEMPERATURES } from './evidence.mjs';

/**
 * @typedef {object} Product
 * @property {string} id
 * @property {string} name
 * @property {string} manufacturer
 * @property {string} method
 * @property {string} conditions
 * @property {string} version
 * @property {readonly number[]} temperatures
 * @property {'reference' | 'manual'} status
 * @property {string} reason
 */

/**
 * @typedef {Pick<Product, 'name' | 'manufacturer' | 'method' | 'conditions' | 'version'>} ProductDetails
 * @typedef {Readonly<ProductDetails & (
 *   {productId: 'pmma' | 'refobacin' | 'hi-fatigue' | 'palacos-r' | 'bonos-genta', temp: number, mode: 'reference', boundaries: readonly number[]} |
 *   {productId: 'demo', temp: number, mode: 'demo', boundaries: readonly number[]} |
 *   {productId: 'manual' | 'refobacin' | 'hi-fatigue', temp: null, mode: 'manual', boundaries: null}
 * )>} Config
 */

const NO_TEMPERATURES = Object.freeze([]);
const legacyManual = {
  name: 'Rankinis laikmatis', manufacturer: 'Netaikoma',
  method: 'Rankinis etapų žymėjimas', conditions: 'Be automatinių perėjimų', version: 'manual-1',
};

/** @type {Product[]} */
const catalog = [
  {
    id: 'pmma', name: 'Bendras PMMA', manufacturer: 'SmartSet HV tyrimas',
    method: 'Rankinis maišymas dubenyje', conditions: '20 °C, 50 % santykinė drėgmė',
    version: `composite-30s+${SMARTSET.version}`, temperatures: NO_TEMPERATURES, status: 'reference',
    reason: 'Sudėtinis orientyras',
  },
  {
    id: 'refobacin',
    name: 'Refobacin Bone Cement R',
    manufacturer: 'Zimmer Biomet (Biomet France)',
    method: 'Nenurodytas',
    conditions: 'Nenurodytos',
    version: REFOBACIN.version,
    temperatures: NO_TEMPERATURES,
    status: 'manual',
    reason: 'Taikymas Lietuvoje nepatvirtintas',
  },
  {
    id: 'hi-fatigue',
    name: 'Hi-Fatigue G',
    manufacturer: 'OSARTIS GmbH (distributed by Zimmer GmbH)',
    method: 'Nenurodytas',
    conditions: 'Nenurodytos',
    version: '135-0579-02 / 2020-04-21',
    temperatures: NO_TEMPERATURES,
    status: 'manual',
    reason: 'IFU fazių ribos nesuderintos',
  },
];

for (const [id, reference] of Object.entries(ADDITIONAL_REFERENCES)) {
  const { name, manufacturer, version, conditions } = reference;
  catalog.push({ id, name, manufacturer, version, conditions, method: 'Nenurodytas',
    temperatures: ADDITIONAL_TEMPERATURES, status: 'reference', reason: 'Apytiksliai gamintojo grafiko orientyrai' });
}

export const PRODUCTS = Object.freeze(catalog.map(product => Object.freeze(product)));

// Approximate cumulative minutes read from IFU 135-0579-02, printed p. 5.
export const HI_FATIGUE_GRAPH = Object.freeze({
  vacuum: [[.5,1.5,7,11.5],[.5,1.5,6.5,10.5],[.5,1,6,9.5],[.5,1,5.5,9],[.5,1,5,8.5],[.5,1,4.5,8]],
  manual: [[.5,3,8,14],[.5,2.5,7.5,13.5],[.5,2.5,7,12.5],[.5,2,6.5,11.5],[.5,2,6.5,11],[.5,2,6,10]],
});

export const settings = {
  'palacos-r': { temperatures: ADDITIONAL_TEMPERATURES, methods: {
    vacuum: 'Vakuuminis · nešaldytas', manual: 'Rankinis · nešaldytas', chilledVacuum: 'Vakuuminis · komponentai 4–7 °C',
  } },
  'bonos-genta': { temperatures: ADDITIONAL_TEMPERATURES, methods: {
    vacuum: 'Vakuuminis · nešaldytas', manual: 'Rankinis · nešaldytas',
  } },
  pmma: { temperatures: [20], methods: {} },
  refobacin: { temperatures: REFOBACIN.temperatures, methods: {
    vacuum: 'Vakuuminis · nešaldytas', manual: 'Rankinis · nešaldytas', chilledVacuum: 'Vakuuminis · komponentai 4 °C',
  } },
  'hi-fatigue': { temperatures: [18,19,20,21,22,23], methods: {
    vacuum: 'Vakuuminis · nešaldytas', manual: 'Rankinis · nešaldytas',
  } },
};

/**
 * Resolve a snapshot without using historical IFU rows as a schedule.
 * @param {string} productId
 * @param {number | null} [temp]
 * @param {string} [methodKey]
 * @returns {Config}
 */
export function resolveConfig(productId, temp, methodKey) {
  const product = productId === 'manual' ? legacyManual : PRODUCTS.find(entry => entry.id === productId);
  if (!product) throw new RangeError(`Unknown product: ${productId}`);
  const { name, manufacturer, method, conditions, version } = product;
  const details = { name, manufacturer, method, conditions, version };
  if (productId === 'pmma') {
    if (temp != null && temp !== SMARTSET.temperature) throw new RangeError('Unsupported temperature');
    const boundaries = Object.freeze([MIXING_REFERENCE.seconds * 1000, SMARTSET.doughing.mean * 1000, SMARTSET.setting.mean * 1000]);
    return Object.freeze({ productId, ...details, temp: SMARTSET.temperature, mode: 'reference', boundaries });
  }
  if (productId === 'refobacin' || productId === 'hi-fatigue') {
    const options = settings[productId];
    const selectedTemp = temp ?? options.temperatures[0];
    const position = options.temperatures.indexOf(selectedTemp);
    const key = methodKey ?? 'vacuum';
    if (position < 0 || !Object.hasOwn(options.methods, key)) throw new RangeError('Unsupported configuration');
    const graph = productId === 'hi-fatigue';
    const row = graph ? HI_FATIGUE_GRAPH[key][position] : REFOBACIN.methods[key][position];
    // The Waiting → Application boundary conflicts with the IFU text.
    const seconds = graph ? [row[0] * 60, row[2] * 60, row[3] * 60] : row;
    return Object.freeze({ productId, ...details, method: options.methods[key],
      version: graph ? version + ' / graph-30s-v1' : version,
      conditions: graph ? 'Apytiksliai grafiko orientyrai' : 'Istorinės IFU orientyrai',
      temp: selectedTemp, mode: 'reference', boundaries: Object.freeze(seconds.map(value => value * 1000)) });
  }
  if (productId === 'palacos-r' || productId === 'bonos-genta') {
    const selectedTemp = temp ?? ADDITIONAL_TEMPERATURES[1];
    const position = ADDITIONAL_TEMPERATURES.indexOf(selectedTemp);
    const key = methodKey ?? 'vacuum';
    const { methods } = ADDITIONAL_REFERENCES[productId];
    if (position < 0 || !Object.hasOwn(methods, key)) throw new RangeError('Unsupported configuration');
    return Object.freeze({ productId, ...details, method: settings[productId].methods[key],
      temp: selectedTemp, mode: 'reference', boundaries: Object.freeze(methods[key][position].map(value => value * 1000)) });
  }
  if (productId !== 'manual') throw new RangeError('Unsupported profile');
  if (temp != null) throw new RangeError('Manual mode has no temperature');
  return Object.freeze({ productId, ...details, temp: null, mode: 'manual', boundaries: null });
}
