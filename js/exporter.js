// BDMExporter — geracao de CSV e backup JSON. Modulo puro (sem DOM/Supabase),
// testavel em Node (tests/exporter.test.js). CSV no dialeto Excel pt-BR:
// separador ';', decimal com virgula, BOM UTF-8, quebras CRLF.
(function (root) {
  var FREQ_LABEL = {
    monthly: 'Mensal', bimonthly: 'Bimestral', quarterly: 'Trimestral',
    semiannual: 'Semestral', at_maturity: 'No Vencimento', custom: 'Personalizado',
  };

  function csvCell(v) {
    var s = v == null ? '' : String(v);
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function csvNum(n) {
    if (n == null || isNaN(n)) return '';
    return String(n).replace('.', ',');
  }

  function csvBool(b) { return b ? 'Sim' : 'Não'; }

  function toCSV(headers, rows) {
    var lines = [headers.map(csvCell).join(';')];
    for (var i = 0; i < rows.length; i++) lines.push(rows[i].join(';'));
    return '﻿' + lines.join('\r\n');
  }

  function investmentsToCSV(investments, categories) {
    var catById = {};
    (categories || []).forEach(function (c) { catById[c.id] = c.name; });
    var rows = (investments || []).map(function (inv) {
      var freq = FREQ_LABEL[inv.frequency] || inv.frequency || '';
      if (inv.frequency === 'custom' && inv.customFrequencyMonths) freq += ' (' + inv.customFrequencyMonths + 'm)';
      return [
        csvCell(inv.name),
        (inv.type || 'periodic') === 'asset' ? 'Ativo' : 'Periódico',
        csvCell(inv.categoryId ? (catById[inv.categoryId] || '') : ''),
        csvNum(inv.principal),
        csvNum(inv.profitPercentage),
        csvCell(freq),
        csvCell(inv.startDate),
        csvNum(inv.durationMonths),
        csvBool(inv.showInBDM),
      ];
    });
    return toCSV(
      ['Nome', 'Tipo', 'Categoria', 'Capital (R$)', 'Lucro por Período (%)', 'Frequência', 'Início', 'Duração (meses)', 'Cripto (BDM)'],
      rows
    );
  }

  function eventsToCSV(events, investments) {
    var invById = {};
    (investments || []).forEach(function (i) { invById[i.id] = i.name; });
    var sorted = (events || []).slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    var rows = sorted.map(function (e) {
      return [
        csvCell(e.date),
        csvCell(invById[e.investmentId] || ''),
        csvNum(e.amount),
        csvNum(e.principalReturn || 0),
        csvBool(e.isLastPayment),
        csvBool(e.received),
      ];
    });
    return toCSV(
      ['Data', 'Investimento', 'Lucro (R$)', 'Devolução de Capital (R$)', 'Último Pagamento', 'Recebido'],
      rows
    );
  }

  function buildBackup(d) {
    d = d || {};
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      investments: d.investments || [],
      categories: d.categories || [],
      events: d.events || [],
      settings: d.settings || {},
    };
  }

  function validateBackup(o) {
    if (!o || typeof o !== 'object') return { ok: false, error: 'Arquivo não é um backup válido.' };
    if (o.version !== 1) return { ok: false, error: 'Versão de backup não suportada: ' + o.version };
    var keys = ['investments', 'categories', 'events'];
    for (var k = 0; k < keys.length; k++) {
      var arr = o[keys[k]];
      if (!Array.isArray(arr)) return { ok: false, error: 'Campo "' + keys[k] + '" ausente ou inválido.' };
      for (var i = 0; i < arr.length; i++) {
        if (!arr[i] || typeof arr[i] !== 'object' || !arr[i].id) {
          return { ok: false, error: 'Item sem id em "' + keys[k] + '".' };
        }
      }
    }
    return { ok: true };
  }

  var api = {
    investmentsToCSV: investmentsToCSV,
    eventsToCSV: eventsToCSV,
    buildBackup: buildBackup,
    validateBackup: validateBackup,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BDMExporter = api;
})(typeof window !== 'undefined' ? window : globalThis);
