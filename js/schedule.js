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
    var totalReinvest = inv.principal + netPerPeriod * numPeriods;
    return {
      interval: interval,
      numPeriods: numPeriods,
      grossPerPeriod: grossPerPeriod,
      netPerPeriod: netPerPeriod,
      principal: inv.principal,
      reinvest: reinvest,
      applyDesagio: applyDesagio,
      totalReinvest: totalReinvest,
    };
  }

  var api = {
    WITHDRAWAL_DESAGIO: WITHDRAWAL_DESAGIO,
    frequencyMonths: frequencyMonths,
    computeSchedule: computeSchedule,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BDMSchedule = api;
})(typeof window !== 'undefined' ? window : globalThis);
