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
});

test('ativo BDM (showInBDM=true): COM desagio de 10%', () => {
  const s = computeSchedule(invBDM, { reinvest: true });
  assert.strictEqual(s.applyDesagio, true);
  assert.strictEqual(s.netPerPeriod, 252); // 280 - 10%
});

test('applyDesagio pode sobrescrever o padrao', () => {
  assert.strictEqual(computeSchedule(invBRL, { applyDesagio: true }).netPerPeriod, 252);
  assert.strictEqual(computeSchedule(invBDM, { applyDesagio: false }).netPerPeriod, 280);
});

test('WITHDRAWAL_DESAGIO = 0.10', () => {
  assert.strictEqual(WITHDRAWAL_DESAGIO, 0.10);
});

const { compoundedPeriods } = require('../js/schedule.js');

// helper de comparação em centavos (evita ruído de ponto flutuante)
function near(a, b) { assert.ok(Math.abs(a - b) < 1e-6, `${a} !== ${b}`); }

test('compoundedPeriods sem reinvest: lucro fixo sobre o principal, numPeriods periodos', () => {
  const ps = compoundedPeriods(invBRL, { reinvest: false });
  assert.strictEqual(ps.length, 3);
  near(ps[0].netProfit, 280);
  near(ps[1].netProfit, 280);
  near(ps[2].netProfit, 280);
  assert.strictEqual(ps[0].monthOffset, 4);
  assert.strictEqual(ps[2].monthOffset, 12);
});

test('compoundedPeriods com reinvest (sem BDM): compoe principal a cada periodo', () => {
  const ps = compoundedPeriods(invBRL, { reinvest: true });
  assert.strictEqual(ps.length, 3); // horizonte default = durationMonths (12) / interval (4)
  near(ps[0].principalBefore, 1000); near(ps[0].grossProfit, 280); near(ps[0].netProfit, 280); near(ps[0].principalAfter, 1280);
  near(ps[1].principalBefore, 1280); near(ps[1].grossProfit, 358.4); near(ps[1].netProfit, 358.4); near(ps[1].principalAfter, 1638.4);
  near(ps[2].principalBefore, 1638.4); near(ps[2].grossProfit, 458.752); near(ps[2].principalAfter, 2097.152);
});

test('compoundedPeriods com reinvest + BDM: aplica desagio de 10% por periodo', () => {
  const ps = compoundedPeriods(invBDM, { reinvest: true });
  near(ps[0].netProfit, 252); near(ps[0].principalAfter, 1252);
  near(ps[1].principalBefore, 1252); near(ps[1].grossProfit, 350.56); near(ps[1].netProfit, 315.504); near(ps[1].principalAfter, 1567.504);
  near(ps[2].principalBefore, 1567.504); near(ps[2].netProfit, 395.011008);
});

test('compoundedPeriods reinvest respeita horizonMonths estendido', () => {
  const ps = compoundedPeriods(invBRL, { reinvest: true, horizonMonths: 24 });
  assert.strictEqual(ps.length, 6); // 24/4
  assert.strictEqual(ps[5].monthOffset, 24);
});
