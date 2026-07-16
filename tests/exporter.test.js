const test = require('node:test');
const assert = require('node:assert');
const { investmentsToCSV, eventsToCSV, buildBackup, validateBackup } = require('../js/exporter.js');

const BOM = '﻿';

const categories = [{ id: 'c1', name: 'DeFi', color: '#0EA5E9' }];
const investments = [
  {
    id: 'i1', name: 'Pool Alpha', type: 'periodic', categoryId: 'c1',
    principal: 1500.5, profitPercentage: 12.25, frequency: 'monthly',
    customFrequencyMonths: null, startDate: '2026-01-31', durationMonths: 6, showInBDM: true,
  },
  {
    id: 'i2', name: 'Nome; com "aspas"', type: 'asset', categoryId: null,
    principal: 200, profitPercentage: 0, frequency: 'at_maturity',
    customFrequencyMonths: null, startDate: '2026-02-01', durationMonths: 0, showInBDM: false,
  },
];
const events = [
  { id: 'e1', investmentId: 'i1', date: '2026-02-28', amount: 183.81, principalReturn: 0, isLastPayment: false, received: true },
  { id: 'e2', investmentId: 'i1', date: '2026-07-31', amount: 183.81, principalReturn: 1500.5, isLastPayment: true, received: false },
  { id: 'e3', investmentId: 'zz', date: '2026-03-01', amount: 10, principalReturn: 0, isLastPayment: false },
];

test('investmentsToCSV: BOM, header e linhas CRLF', () => {
  const csv = investmentsToCSV(investments, categories);
  assert.ok(csv.startsWith(BOM));
  const lines = csv.slice(1).split('\r\n');
  assert.strictEqual(lines.length, 3);
  assert.strictEqual(lines[0], 'Nome;Tipo;Categoria;Capital (R$);Lucro por Período (%);Frequência;Início;Duração (meses);Cripto (BDM)');
});

test('investmentsToCSV: decimal com vírgula e categoria por nome', () => {
  const csv = investmentsToCSV(investments, categories);
  const row = csv.split('\r\n')[1];
  assert.strictEqual(row, 'Pool Alpha;Periódico;DeFi;1500,5;12,25;Mensal;2026-01-31;6;Sim');
});

test('investmentsToCSV: escapa ; e aspas; sem categoria fica vazio', () => {
  const csv = investmentsToCSV(investments, categories);
  const row = csv.split('\r\n')[2];
  assert.strictEqual(row, '"Nome; com ""aspas""";Ativo;;200;0;No Vencimento;2026-02-01;0;Não');
});

test('eventsToCSV: header, ordenação por data e Recebido Sim/Não', () => {
  const csv = eventsToCSV(events, investments);
  const lines = csv.slice(1).split('\r\n');
  assert.strictEqual(lines[0], 'Data;Investimento;Lucro (R$);Devolução de Capital (R$);Último Pagamento;Recebido');
  assert.strictEqual(lines[1], '2026-02-28;Pool Alpha;183,81;0;Não;Sim');
  assert.strictEqual(lines[3], '2026-07-31;Pool Alpha;183,81;1500,5;Sim;Não');
});

test('eventsToCSV: investimento inexistente vira vazio', () => {
  const csv = eventsToCSV(events, investments);
  assert.strictEqual(csv.split('\r\n')[2], '2026-03-01;;10;0;Não;Não');
});

test('buildBackup: version 1, exportedAt ISO e dados', () => {
  const b = buildBackup({ investments, categories, events, settings: { bdmRate: 2.5 } });
  assert.strictEqual(b.version, 1);
  assert.ok(!isNaN(Date.parse(b.exportedAt)));
  assert.strictEqual(b.investments.length, 2);
  assert.strictEqual(b.categories.length, 1);
  assert.strictEqual(b.events.length, 3);
  assert.strictEqual(b.settings.bdmRate, 2.5);
});

test('buildBackup: defaults vazios', () => {
  const b = buildBackup({});
  assert.deepStrictEqual(b.investments, []);
  assert.deepStrictEqual(b.categories, []);
  assert.deepStrictEqual(b.events, []);
  assert.deepStrictEqual(b.settings, {});
});

test('validateBackup: aceita backup válido (round-trip)', () => {
  const r = validateBackup(buildBackup({ investments, categories, events }));
  assert.strictEqual(r.ok, true);
});

test('validateBackup: rejeita inválidos', () => {
  assert.strictEqual(validateBackup(null).ok, false);
  assert.strictEqual(validateBackup('x').ok, false);
  assert.strictEqual(validateBackup({}).ok, false);
  assert.strictEqual(validateBackup({ version: 2, investments: [], categories: [], events: [] }).ok, false);
  assert.strictEqual(validateBackup({ version: 1, investments: 'x', categories: [], events: [] }).ok, false);
  assert.strictEqual(validateBackup({ version: 1, investments: [{ name: 'sem id' }], categories: [], events: [] }).ok, false);
  const r = validateBackup({ version: 1, investments: [], categories: [], events: [] });
  assert.strictEqual(r.ok, true);
});
