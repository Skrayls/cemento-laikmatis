import { SMARTSET, REFOBACIN } from './evidence.mjs';

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
 *   {productId: 'pmma', temp: number, mode: 'reference', boundaries: readonly number[]} |
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
    version: SMARTSET.version, temperatures: NO_TEMPERATURES, status: 'reference',
    reason: 'Literatūros orientyras',
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

export const PRODUCTS = Object.freeze(catalog.map(product => Object.freeze(product)));

/**
 * Resolve a snapshot without using historical IFU rows as a schedule.
 * @param {string} productId
 * @param {number | null} [temp]
 * @returns {Config}
 */
export function resolveConfig(productId, temp) {
  const product = productId === 'manual' ? legacyManual : PRODUCTS.find(entry => entry.id === productId);
  if (!product) throw new RangeError(`Unknown product: ${productId}`);
  const { name, manufacturer, method, conditions, version } = product;
  const details = { name, manufacturer, method, conditions, version };
  if (productId === 'pmma') {
    if (temp != null && temp !== SMARTSET.temperature) throw new RangeError('Unsupported temperature');
    const boundaries = Object.freeze([SMARTSET.doughing.mean * 1000, SMARTSET.setting.mean * 1000]);
    return Object.freeze({ productId, ...details, temp: SMARTSET.temperature, mode: 'reference', boundaries });
  }
  if (productId !== 'manual' && productId !== 'refobacin' && productId !== 'hi-fatigue') {
    throw new RangeError('Unsupported profile');
  }
  if (temp != null) throw new RangeError('Manual mode has no temperature');
  return Object.freeze({ productId, ...details, temp: null, mode: 'manual', boundaries: null });
}
