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
