(function (root) {
  var WITHDRAWAL_DESAGIO = 0.10;

  function frequencyMonths(freq, duration, customMonths) {
    if (freq === 'monthly') return 1;
    if (freq === 'bimonthly') return 2;
    if (freq === 'quarterly') return 3;
    if (freq === 'semiannual') return 6;
    if (freq === 'at_maturity') return duration;
    if (freq === 'custom') return customMonths || 1;
    return 1;
  }

  // Lucro por periodo SEMPRE fixo sobre o principal (nunca compoe dentro do investimento).
  // O desagio de 10% (taxa de saque do BDM) so se aplica quando o ativo e BDM (showInBDM).
  // applyDesagio pode sobrescrever; por padrao segue inv.showInBDM.
  function computeSchedule(inv, opts) {
    opts = opts || {};
    var reinvest = !!opts.reinvest;
    var applyDesagio = (opts.applyDesagio !== undefined) ? !!opts.applyDesagio : !!inv.showInBDM;
    var interval = frequencyMonths(inv.frequency, inv.durationMonths, inv.customFrequencyMonths);
    var numPeriods = Math.max(1, Math.floor(inv.durationMonths / interval));
    var grossPerPeriod = inv.principal * (inv.profitPercentage / 100);
    var netPerPeriod = grossPerPeriod * (1 - (applyDesagio ? WITHDRAWAL_DESAGIO : 0));
    return {
      interval: interval,
      numPeriods: numPeriods,
      grossPerPeriod: grossPerPeriod,
      netPerPeriod: netPerPeriod,
      principal: inv.principal,
      reinvest: reinvest,
      applyDesagio: applyDesagio,
    };
  }

  // Gera os periodos de um investimento. reinvest=true compoe o principal a cada
  // recebimento (juros sobre juros desde o recebimento, nao so no vencimento).
  // O desagio de 10% so incide por periodo quando applyDesagio (default inv.showInBDM).
  function compoundedPeriods(inv, opts) {
    opts = opts || {};
    var reinvest = !!opts.reinvest;
    var applyDesagio = (opts.applyDesagio !== undefined) ? !!opts.applyDesagio : !!inv.showInBDM;
    var interval = frequencyMonths(inv.frequency, inv.durationMonths, inv.customFrequencyMonths);
    var rate = inv.profitPercentage / 100;
    var desFactor = 1 - (applyDesagio ? WITHDRAWAL_DESAGIO : 0);
    var out = [];

    if (!reinvest) {
      var numPeriods = Math.max(1, Math.floor(inv.durationMonths / interval));
      var gross = inv.principal * rate;
      var net = gross * desFactor;
      for (var i = 1; i <= numPeriods; i++) {
        out.push({
          periodIndex: i, monthOffset: i * interval,
          principalBefore: inv.principal, grossProfit: gross,
          netProfit: net, principalAfter: inv.principal,
        });
      }
      return out;
    }

    var maxMonths = (opts.horizonMonths != null) ? opts.horizonMonths
      : Math.max(inv.durationMonths, interval);
    var principal = inv.principal;
    var p = 0;
    while (true) {
      p++;
      var monthOffset = p * interval;
      if (monthOffset > maxMonths) break;
      var g = principal * rate;
      var n = g * desFactor;
      out.push({
        periodIndex: p, monthOffset: monthOffset,
        principalBefore: principal, grossProfit: g,
        netProfit: n, principalAfter: principal + n,
      });
      principal += n;
    }
    return out;
  }

  // Metricas derivadas de um investimento PERIODICO, prontas para injetar no contexto
  // do agente IA (o agente NAO recalcula — apenas le). Cenarios fixo + reinvestido.
  // opts.ipcaRate em pontos percentuais (ex.: 5 = 5% a.a.). Puro, sem DOM.
  function buildAIInvestmentMetrics(inv, opts) {
    opts = opts || {};
    var ipca = (opts.ipcaRate != null) ? opts.ipcaRate : 0;
    var sched = computeSchedule(inv, {});
    var reinv = compoundedPeriods(inv, { reinvest: true });
    var totalReinvested = reinv.length
      ? reinv[reinv.length - 1].principalAfter - inv.principal
      : 0;
    var monthlyProfit = sched.interval > 0 ? sched.netPerPeriod / sched.interval : 0;
    var monthlyYieldPct = inv.principal > 0 ? (monthlyProfit / inv.principal) * 100 : 0;
    var aprPct = monthlyYieldPct * 12;
    var realYieldPct = ((1 + aprPct / 100) / (1 + ipca / 100) - 1) * 100;
    return {
      interval: sched.interval,
      numPeriods: sched.numPeriods,
      grossPerPeriod: sched.grossPerPeriod,
      netPerPeriod: sched.netPerPeriod,
      applyDesagio: sched.applyDesagio,
      totalFixed: sched.netPerPeriod * sched.numPeriods,
      totalReinvested: totalReinvested,
      monthlyProfit: monthlyProfit,
      monthlyYieldPct: monthlyYieldPct,
      aprPct: aprPct,
      realYieldPct: realYieldPct,
    };
  }

  var api = {
    WITHDRAWAL_DESAGIO: WITHDRAWAL_DESAGIO,
    frequencyMonths: frequencyMonths,
    computeSchedule: computeSchedule,
    compoundedPeriods: compoundedPeriods,
    buildAIInvestmentMetrics: buildAIInvestmentMetrics,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BDMSchedule = api;
})(typeof window !== 'undefined' ? window : globalThis);
