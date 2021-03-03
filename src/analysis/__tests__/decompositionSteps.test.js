import { readFileSync } from 'fs';
import { join } from 'path';

import { createSequentialArray } from 'ml-spectra-processing';

import { fromJcamp } from '../../index.js';
import {
  testables,
  reconstructedDecomposition,
  analyzeTGA,
} from '../decompositionSteps.js';

const {
  initialize,
  getTotalMassLoss,
  getInitialMassLossGuess,
  peakWidth,
  getInitialWidthEstimates,
  massConservingTemperatureWidths,
  selfConsistentLoop,
  getBeta,
  findBetas,
} = testables;

let jcamp = readFileSync(
  join(__dirname, '../../../testFiles/tga_double_peak.jdx'),
  'utf8',
);
let analysis = fromJcamp(jcamp);

let spectrum1 = analysis.getXYSpectrum();

const temperatures = spectrum1.variables.x.data.slice(0, 1600);
const masses = spectrum1.variables.y.data.slice(0, 1600);

test('getTotalMassLoss', () => {
  let res = getTotalMassLoss(masses, 2);
  expect(res).toBeCloseTo(88.87, 1);
});

test('initial mass loss guesses', () => {
  let res = getInitialMassLossGuess(88.87, 2);
  expect(res).toHaveLength(2);
  expect(res[0]).toBeCloseTo(88.87 / 2, 1);
});

test('initial width guess', () => {
  let res = getInitialWidthEstimates([88, 88], [-0.003, -0.03]);
  expect(res).toHaveLength(2);
  expect(res[0]).toBeGreaterThan(res[1]);
});

test('peak width', () => {
  let res = peakWidth(120, -1);
  expect(res).toStrictEqual(120);
});

test('mass conserving widths', () => {
  let res = massConservingTemperatureWidths(
    [100, 100],
    88,
    [0.003, 0.03],
    [{ x: 120 }, { x: 420 }],
  );
  expect(res).toHaveLength(2);
  expect(res[0]).toBeGreaterThan(res[1]);
});

test('initialization', () => {
  const peaks = [
    { x: 120, y: -0.0034, width: 10 },
    { x: 420, y: -0.0319, width: 10 },
  ];
  let res = initialize(peaks, masses, temperatures);
  expect(res).toHaveProperty('firstDerivatives');
  expect(res).toHaveProperty('thirdDerivatives');
  expect(res).toHaveProperty('totalMassLoss');
  expect(res).toHaveProperty('peakWidths');
  expect(res).toHaveProperty('peaks');
  expect(res).toHaveProperty('massLosses');
  expect(res.firstDerivatives).toHaveLength(2);
  expect(res.thirdDerivatives).toHaveLength(2);
  expect(res.peakWidths).toHaveLength(2);
  expect(res.peakWidths[0]).toStrictEqual(10);
  expect(res.peaks).toHaveLength(2);
  expect(res.massLosses).toHaveLength(2);
});

test('selfConsistentLoop basic sanity check tolerance', () => {
  // tighter tolerance should mean that we need more iterations ...s
  let res0 = selfConsistentLoop(
    [-1.6, -1.6],
    [0.01, 0.01],
    [10, 10],
    [44.437034027777905, 44.437034027777905],
    88.87406805555581,
    [
      { x: 120, y: -0.0034 },
      { x: 420, y: -0.0319 },
    ],
    [10, 10],
    { massTolerance: 1, widthTolerance: 1 },
  );

  expect(res0.steps).toHaveLength(2);
  expect(res0.steps[0].activationEnergy).toBeGreaterThan(0);
  expect(res0.steps[1].activationEnergy).toBeGreaterThan(0);

  expect(res0.steps[0].preactivationFactor).toBeGreaterThan(0);
  expect(res0.steps[1].preactivationFactor).toBeGreaterThan(0);

  let res1 = selfConsistentLoop(
    [-1.6, -1.6],
    [0.01, 0.01],
    [10, 10],
    [44.437034027777905, 44.437034027777905],
    88.87406805555581,
    [
      { x: 120, y: -0.0034 },
      { x: 420, y: -0.0319 },
    ],
    [10, 10],
    { massTolerance: 0.00000001, widthTolerance: 0.0000001 },
  );

  expect(res1.steps).toHaveLength(2);
});

test('reconstruct decomposition', () => {
  let x = createSequentialArray({ from: 200, to: 500, length: 1000 });
  let res = reconstructedDecomposition(1, [1], [377], [10], x);
  expect(res).toHaveProperty('allTraces');
  expect(res).toHaveProperty('sum');
  expect(res.allTraces).toHaveLength(1);
  expect(res.sum).toHaveLength(1000);
  expect(res.sum[res.sum.length - 1]).toBeCloseTo(0);
  //ToDo: as soon as merged in spectra-processing
  //expect(xIsMonotone(res.sum)).toBe(true);
});

test('reconstruct decomposition two step', () => {
  let x = createSequentialArray({ from: 200, to: 500, length: 1000 });
  let res = reconstructedDecomposition(1, [0.5, 0.25], [377, 450], [10, 10], x);
  expect(res).toHaveProperty('allTraces');
  expect(res).toHaveProperty('sum');
  expect(res.allTraces).toHaveLength(2);
  expect(res.sum).toHaveLength(1000);
  expect(res.sum[res.sum.length - 1]).toBeCloseTo(0.25);
  expect(res.allTraces[0][999]).toBeCloseTo(0.5);
  //ToDo: as soon as merged in spectra-processing
  //expect(xIsMonotone(res.sum)).toBe(true);
});

test('heating rate calculation', () => {
  let temperatures = createSequentialArray({
    from: 200,
    to: 500,
    length: 1000,
  });
  let times = createSequentialArray({
    from: 200,
    to: 500,
    length: 1000,
  });
  let res = getBeta(times, temperatures, 300, 400);
  expect(res).toStrictEqual(1);
});

test('single step simulated spectrum', () => {
  let x = createSequentialArray({ from: 473.15, to: 773.15, length: 1000 });
  let simulated = reconstructedDecomposition(1, [1], [650], [10], x);
  let betas = [10];
  let peaks = [{ x: 650, width: 10 }];
  let initializationResults = initialize(peaks, simulated.sum, x);

  let scfResults = selfConsistentLoop(
    initializationResults.firstDerivatives,
    initializationResults.thirdDerivatives,
    initializationResults.peakWidths,
    initializationResults.massLosses,
    initializationResults.totalMassLoss,
    peaks,
    betas,
  );

  expect(
    scfResults.steps[0].activationEnergy - 351.1 * Math.pow(10, 3),
  ).toBeLessThan(200);
  expect(scfResults.steps).toHaveLength(1);
  expect(scfResults.steps[0].peakWidth).toBeCloseTo(16.085);
});

test('find betas', () => {
  let temperatures = createSequentialArray({
    from: 200,
    to: 500,
    length: 1000,
  });
  let times = createSequentialArray({
    from: 200,
    to: 500,
    length: 1000,
  });

  let peaks = [
    { x: 250, width: 10 },
    { x: 300, width: 10 },
  ];

  let betas = findBetas(times, temperatures, peaks);
  expect(betas).toHaveLength(2);
  expect(betas[0]).toStrictEqual(1);
});

test('double step simulated spectrum', () => {
  let temperatures = createSequentialArray({
    from: 473.15,
    to: 773.15,
    length: 1000,
  });
  let times = createSequentialArray({ from: 0, to: 1000, length: 10000 });
  let simulated = reconstructedDecomposition(
    1,
    [0.5, 0.25],
    [500, 650],
    [10, 10],
    temperatures,
  );
  let peaks = [
    { x: 500, width: 12 },
    { x: 650, width: 12 },
  ];
  let results = analyzeTGA(peaks, simulated.sum, temperatures, times);
  expect(results.steps).toHaveLength(2);
  expect(results.steps[0].peakWidth).toBeCloseTo(17.08, 1);
  expect(results.steps[1].peakWidth).toBeCloseTo(14.53, 1);
  expect(results.steps[0].massLoss).toBeCloseTo(0.5, 1);
  expect(results.steps[1].massLoss).toBeCloseTo(0.25, 1);
});