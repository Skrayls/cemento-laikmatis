/**
 * @typedef {object} Product
 * @property {string} id
 * @property {string} name
 * @property {string} manufacturer
 * @property {string} method
 * @property {string} conditions
 * @property {string} version
 * @property {readonly number[]} temperatures
 * @property {'demo' | 'manual' | 'disabled'} status
 * @property {string} reason
 */

/**
 * @typedef {Pick<Product, 'name' | 'manufacturer' | 'method' | 'conditions' | 'version'>} ProductDetails
 * @typedef {Readonly<ProductDetails & (
 *   {productId: 'demo', temp: number, mode: 'demo', boundaries: readonly number[]} |
 *   {productId: 'manual', temp: null, mode: 'manual', boundaries: null}
 * )>} Config
 */

/** @type {ReadonlyMap<number, readonly number[]>} */
const DEMO_BOUNDARIES = new Map([
  [19, Object.freeze([24000, 58000, 153000, 295000])],
  [20, Object.freeze([22000, 52000, 138000, 268000])],
  [21, Object.freeze([20000, 46000, 123000, 242000])],
]);

const NO_TEMPERATURES = Object.freeze([]);

/** @type {Product[]} */
const catalog = [
  {
    id: 'demo',
    name: 'Demonstracinis cementas',
    manufacturer: 'Netaikoma',
    method: 'Demonstracinis laiko skaičiavimas',
    conditions: 'Pavyzdiniai duomenys, neskirti klinikiniam naudojimui',
    version: 'demo-1',
    temperatures: Object.freeze([...DEMO_BOUNDARIES.keys()]),
    status: 'demo',
    reason: 'Tik demonstracijai',
  },
  {
    id: 'manual',
    name: 'Rankinis laikmatis',
    manufacturer: 'Netaikoma',
    method: 'Rankinis etapų žymėjimas',
    conditions: 'Be iš anksto nustatytų etapų trukmių',
    version: 'manual-1',
    temperatures: NO_TEMPERATURES,
    status: 'manual',
    reason: '',
  },
  {
    id: 'refobacin',
    name: 'Refobacin Bone Cement R',
    manufacturer: 'Zimmer Biomet (Biomet France)',
    method: 'Nenurodytas',
    conditions: 'Nenurodytos',
    version: '',
    temperatures: NO_TEMPERATURES,
    status: 'disabled',
    reason: 'Automatiniai laikai nepatvirtinti',
  },
  {
    id: 'hi-fatigue',
    name: 'Hi-Fatigue G Bone Cement',
    manufacturer: 'OSARTIS GmbH (distributed by Zimmer GmbH)',
    method: 'Nenurodytas',
    conditions: 'Nenurodytos',
    version: '',
    temperatures: NO_TEMPERATURES,
    status: 'disabled',
    reason: 'Automatiniai laikai nepatvirtinti',
  },
];

export const PRODUCTS = Object.freeze(catalog.map(product => Object.freeze(product)));

/**
 * Resolve an immutable snapshot for the only supported modes. Demo times are synthetic.
 * @param {string} productId
 * @param {number | null} [temp]
 * @returns {Config}
 */
export function resolveConfig(productId, temp) {
  const product = PRODUCTS.find(entry => entry.id === productId);
  if (!product) throw new RangeError(`Unknown product: ${productId}`);
  if (product.status === 'disabled') throw new RangeError(`Product is disabled: ${productId}`);

  const { name, manufacturer, method, conditions, version } = product;
  const details = { name, manufacturer, method, conditions, version };

  if (product.status === 'manual') {
    if (temp !== undefined && temp !== null) throw new RangeError('Manual mode has no temperature');
    return Object.freeze({ productId: 'manual', ...details, temp: null, mode: 'manual', boundaries: null });
  }

  const demoTemp = temp === undefined ? 20 : temp;
  const boundaries = DEMO_BOUNDARIES.get(demoTemp);
  if (!boundaries) throw new RangeError(`Unsupported demo temperature: ${demoTemp}`);
  return Object.freeze({ productId: 'demo', ...details, temp: demoTemp, mode: 'demo', boundaries });
}
