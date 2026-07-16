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
  // aprPct e a taxa NOMINAL anual (lucro mensal medio x 12, linear/simples), NAO composta —
  // segue a convencao do app (getAvgAnnualYield). totalReinvested = ganho liquido acumulado
  // no cenario "reinvestir a cada recebimento" (principalAfter final - principal).
  function buildAIInvestmentMetrics(inv, opts) {
    opts = opts || {};
    var ipca = (opts.ipcaRate != null) ? opts.ipcaRate : 0;
    var sched = computeSchedule(inv, {});
    var reinv = compoundedPeriods(inv, { reinvest: true });
    var totalReinvested = reinv.length
      ? reinv[reinv.length - 1].principalAfter - inv.principal
      : 0;
    // Lucro mensal medio = total liquido / duracao (mesma convencao de getMonthlyIncomeEst
    // no app), para que lucroMensalMedio/APR/renda batam com a tela Insights mesmo quando
    // durationMonths nao e multiplo exato do intervalo.
    var totalFixed = sched.netPerPeriod * sched.numPeriods;
    var monthlyProfit = inv.durationMonths > 0 ? totalFixed / inv.durationMonths : 0;
    var monthlyYieldPct = inv.principal > 0 ? (monthlyProfit / inv.principal) * 100 : 0;
    var aprPct = monthlyYieldPct * 12;
    var realYieldPct = ((1 + aprPct / 100) / (1 + ipca / 100) - 1) * 100;
    return {
      interval: sched.interval,
      numPeriods: sched.numPeriods,
      grossPerPeriod: sched.grossPerPeriod,
      netPerPeriod: sched.netPerPeriod,
      applyDesagio: sched.applyDesagio,
      totalFixed: totalFixed,
      totalReinvested: totalReinvested,
      monthlyProfit: monthlyProfit,
      monthlyYieldPct: monthlyYieldPct,
      aprPct: aprPct,
      realYieldPct: realYieldPct,
    };
  }

  // Simulador da Calculadora, no MESMO modelo do app: lucro fixo (ratePct) sobre o
  // principal a cada intervalMonths; reinvest compoe o lucro no principal a cada
  // recebimento (como compoundedPeriods); desagio aplica WITHDRAWAL_DESAGIO sobre o
  // lucro (taxa de saque BDM). Aporte mensal entra no fim do mes — rende so a partir
  // do periodo seguinte. series[m].value = visao patrimonial (principal + sacado).
  function simulateCalculator(opts) {
    opts = opts || {};
    var principal = opts.principal || 0;
    var rate = (opts.ratePct || 0) / 100;
    var interval = Math.max(1, opts.intervalMonths || 1);
    var totalMonths = Math.max(1, opts.totalMonths || 1);
    var monthly = opts.monthlyContribution || 0;
    var reinvest = !!opts.reinvest;
    var desFactor = 1 - (opts.desagio ? WITHDRAWAL_DESAGIO : 0);

    var withdrawn = 0;
    var invested = principal;
    var grossTotal = 0;
    var series = [{ month: 0, value: principal }];

    for (var m = 1; m <= totalMonths; m++) {
      if (m % interval === 0) {
        var gross = principal * rate;
        grossTotal += gross;
        var net = gross * desFactor;
        if (reinvest) principal += net; else withdrawn += net;
      }
      principal += monthly;
      invested += monthly;
      series.push({ month: m, value: principal + withdrawn });
    }
    // O ultimo aporte do loop nao rendeu nem devia contar como "resultado":
    // ele acabou de entrar. Mantemos no principal (patrimonio), como no app.
    var finalValue = principal + withdrawn;
    return {
      finalValue: finalValue,
      totalProfit: grossTotal,
      netProfit: finalValue - invested,
      totalInvested: invested,
      series: series,
    };
  }

  var api = {
    WITHDRAWAL_DESAGIO: WITHDRAWAL_DESAGIO,
    frequencyMonths: frequencyMonths,
    computeSchedule: computeSchedule,
    compoundedPeriods: compoundedPeriods,
    buildAIInvestmentMetrics: buildAIInvestmentMetrics,
    simulateCalculator: simulateCalculator,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BDMSchedule = api;
})(typeof window !== 'undefined' ? window : globalThis);
