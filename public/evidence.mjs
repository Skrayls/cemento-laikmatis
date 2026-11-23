export const MIXING_REFERENCE = Object.freeze({ seconds: 30, source: 'Heraeus PALACADEMY, Cement handling, p. 10' });

export const SMARTSET = Object.freeze({
  version: 'PMC4650370-control-20C-v1',
  temperature: 20,
  doughing: Object.freeze({ mean: 148, sd: 7 }),
  setting: Object.freeze({ mean: 534, sd: 17 }),
  working: Object.freeze({ mean: 386, sd: 21 }),
});

export const REFOBACIN = Object.freeze({
  version: '9878300010 / 03 / 2018-05',
  temperatures: Object.freeze([19, 21, 23]),
  applicability: 'Lietuvoje nepatvirtinta',
  methods: Object.freeze({
    vacuum: Object.freeze([[30,110,285,660], [30,90,255,570], [30,75,230,500]].map(row => Object.freeze(row))),
    manual: Object.freeze([[30,110,330,690], [30,90,300,615], [30,75,270,540]].map(row => Object.freeze(row))),
    chilledVacuum: Object.freeze([[30,255,580,960], [30,240,500,825], [30,225,440,720]].map(row => Object.freeze(row))),
  }),
});

// Cumulative seconds since mixing began; rounded graph readings, not exact endpoints.
export const ADDITIONAL_REFERENCES = Object.freeze({
  'palacos-r': {
    name: 'PALACOS R',
    manufacturer: 'Heraeus Medical GmbH',
    version: 'PALACOS R US IFU 5035999/10515 (2020-07), p. 6 / graph-v1',
    conditions: 'Apytiksliai PALACOS R IFU grafiko orientyrai',
    originalPhases: ['Mixing', 'Waiting', 'Application', 'Setting'],
    // 19, 21, 23 °C; central curves (nearest 15 s).
    methods: {
      vacuum: [[30, 60, 315, 525], [30, 45, 285, 480], [30, 45, 255, 435]],
      manual: [[30, 60, 315, 525], [30, 45, 285, 480], [30, 45, 255, 435]],
      chilledVacuum: [[30, 135, 420, 630], [30, 105, 375, 570], [30, 105, 345, 540]],
    },
  },
  'bonos-genta': {
    name: 'BonOs R NF Genta',
    manufacturer: 'OSARTIS GmbH',
    version: 'OSARTIS 141-2050-02EN (07/2020), p. 2 / graph-v1',
    conditions: 'Apytiksliai bendros R NF ir R NF Genta gamintojo diagramos orientyrai',
    originalPhases: ['Mixing Phase', 'Waiting Phase', 'Application Phase', 'Hardening Phase'],
    // 19, 21, 23 °C; cumulative graph readings (nearest 30 s).
    methods: {
      vacuum: [[30, 90, 390, 660], [30, 60, 360, 570], [30, 60, 300, 480]],
      manual: [[30, 120, 540, 780], [30, 120, 450, 660], [30, 90, 360, 570]],
    },
  },
});

export const ADDITIONAL_TEMPERATURES = Object.freeze([19, 21, 23]);
