const test = require('node:test');
const assert = require('node:assert');
const { computeSchedule, frequencyMonths, WITHDRAWAL_DESAGIO } = require('../js/schedule.js');

const base = { principal: 1000, profitPercentage: 28, frequency: 'custom', customFrequencyMonths: 4, durationMonths: 12 };
const invBRL = { ...base, showInBDM: false };
const invBDM = { ...base, showInBDM: true };

test('frequencyMonths conhece os presets', () => {
  assert.strictEqual(frequencyMonths('monthly'), 1);
  assert.strictEqual(frequencyMonths('bimonthly'), 2);
  assert.strictEqual(frequencyMonths('quarterly'), 3);
  assert.strictEqual(frequencyMonths('semiannual'), 6);
  assert.strictEqual(frequencyMonths('at_maturity', 12), 12);
  assert.strictEqual(frequencyMonths('custom', 12, 4), 4);
});

test('numPeriods = 3 para 12 meses / intervalo 4', () => {
  assert.strictEqual(computeSchedule(invBRL, { reinvest: true }).numPeriods, 3);
});

test('lucro bruto/periodo = 280 (fixo, sem compor)', () => {
  assert.strictEqual(computeSchedule(invBRL, {}).grossPerPeriod, 280);
  assert.strictEqual(computeSchedule(invBDM, {}).grossPerPeriod, 280);
});

test('ativo so em R$ (showInBDM=false): SEM desagio', () => {
  const s = computeSchedule(invBRL, { reinvest: true });
  assert.strictEqual(s.applyDesagio, false);
  assert.strictEqual(s.netPerPeriod, 280);
  assert.strictEqual(s.totalReinvest, 1840); // 1000 + 280*3
});

test('ativo BDM (showInBDM=true): COM desagio de 10%', () => {
  const s = computeSchedule(invBDM, { reinvest: true });
  assert.strictEqual(s.applyDesagio, true);
  assert.strictEqual(s.netPerPeriod, 252); // 280 - 10%
  assert.strictEqual(s.totalReinvest, 1756); // 1000 + 252*3
});

test('applyDesagio pode sobrescrever o padrao', () => {
  assert.strictEqual(computeSchedule(invBRL, { applyDesagio: true }).netPerPeriod, 252);
  assert.strictEqual(computeSchedule(invBDM, { applyDesagio: false }).netPerPeriod, 280);
});

test('WITHDRAWAL_DESAGIO = 0.10', () => {
  assert.strictEqual(WITHDRAWAL_DESAGIO, 0.10);
});
