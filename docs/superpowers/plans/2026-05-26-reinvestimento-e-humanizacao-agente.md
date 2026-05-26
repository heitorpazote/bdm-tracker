# Reinvestimento configurável + Humanização do agente — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o reinvestimento configurável por aba (Insights/Calendário) com cálculo correto (lucro fixo por período, deságio de 10% só em R$) e humanizar o agente de IA.

**Architecture:** Motor de cálculo puro centralizado em `js/schedule.js` (testável via Node), consumido por Calendário, Insights e contexto do agente. Eventos guardam lucro bruto; o deságio é aplicado na exibição (R$ líquido, BDM bruto). Toggles de reinvestimento são estado de visualização (não persistido), padrão ligado, independentes por aba.

**Tech Stack:** HTML/JS inline (`index.html`), TailwindCSS CDN, Chart.js CDN, IndexedDB. Testes do motor de cálculo com `node:test` (built-in, sem dependências).

---

## Estrutura de arquivos

- **Criar:** `js/schedule.js` — funções puras: `frequencyMonths`, `computeSchedule`, `displayProfit`, constante `WITHDRAWAL_DESAGIO`. Carregado via `<script src>` e também `require`-ável em Node.
- **Criar:** `tests/schedule.test.js` — testes Node do motor de cálculo.
- **Modificar:** `index.html` — incluir `schedule.js`, remover `frequencyMonths` inline duplicada, refatorar `generateEvents`, renderização do calendário, projeções/marcos dos Insights, toggles, texto explicativo, e o `AI_SYSTEM_PROMPT`.

Observação sobre testes: só o motor de cálculo (`schedule.js`) tem teste automatizado. Tarefas de UI são verificadas **manualmente no navegador** (abrir `index.html`), pois não há harness de browser no projeto.

Valores de referência (R$ 1.000, 28% a cada 4 meses, 12 meses = 3 períodos):
- Lucro bruto/período = 280; líquido/período (R$, −10%) = 252.
- OFF total no fim: 3×280=840 lucro (BDM) / 3×252=756 (R$) + 1.000 capital.
- ON total no vencimento: 1.000 + 252×3 = **1.756** (mesmo número em R$ e BDM; BDM converte 1.756 sem novo deságio).

---

### Task 1: Motor de cálculo puro `js/schedule.js`

**Files:**
- Create: `js/schedule.js`
- Test: `tests/schedule.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/schedule.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { computeSchedule, displayProfit, frequencyMonths, WITHDRAWAL_DESAGIO } = require('../js/schedule.js');

const inv = { principal: 1000, profitPercentage: 28, frequency: 'custom', customFrequencyMonths: 4, durationMonths: 12 };

test('frequencyMonths conhece os presets', () => {
  assert.strictEqual(frequencyMonths('monthly'), 1);
  assert.strictEqual(frequencyMonths('bimonthly'), 2);
  assert.strictEqual(frequencyMonths('quarterly'), 3);
  assert.strictEqual(frequencyMonths('semiannual'), 6);
  assert.strictEqual(frequencyMonths('at_maturity', 12), 12);
  assert.strictEqual(frequencyMonths('custom', 12, 4), 4);
});

test('numPeriods = 3 para 12 meses / intervalo 4', () => {
  assert.strictEqual(computeSchedule(inv, { reinvest: true }).numPeriods, 3);
});

test('lucro bruto/periodo = 280, liquido/periodo = 252 (fixo, sem compor)', () => {
  const s = computeSchedule(inv, {});
  assert.strictEqual(s.grossPerPeriod, 280);
  assert.strictEqual(s.netPerPeriod, 252);
});

test('sem composicao: total bruto na vida = 840', () => {
  const s = computeSchedule(inv, {});
  assert.strictEqual(s.grossPerPeriod * s.numPeriods, 840);
});

test('total de reinvestimento (ON) = 1756 usando lucro liquido', () => {
  assert.strictEqual(computeSchedule(inv, { reinvest: true }).totalReinvest, 1756);
});

test('displayProfit: BDM bruto, R$ liquido', () => {
  assert.strictEqual(displayProfit(280, true), 280);
  assert.strictEqual(displayProfit(280, false), 252);
});

test('WITHDRAWAL_DESAGIO = 0.10', () => {
  assert.strictEqual(WITHDRAWAL_DESAGIO, 0.10);
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node --test tests/`
Expected: FAIL com `Cannot find module '../js/schedule.js'`.

- [ ] **Step 3: Implementar `js/schedule.js`**

```js
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
  function computeSchedule(inv, opts) {
    opts = opts || {};
    var reinvest = !!opts.reinvest;
    var interval = frequencyMonths(inv.frequency, inv.durationMonths, inv.customFrequencyMonths);
    var numPeriods = Math.max(1, Math.floor(inv.durationMonths / interval));
    var grossPerPeriod = inv.principal * (inv.profitPercentage / 100);
    var netPerPeriod = grossPerPeriod * (1 - WITHDRAWAL_DESAGIO);
    var totalReinvest = inv.principal + netPerPeriod * numPeriods;
    return {
      interval: interval,
      numPeriods: numPeriods,
      grossPerPeriod: grossPerPeriod,
      netPerPeriod: netPerPeriod,
      principal: inv.principal,
      reinvest: reinvest,
      totalReinvest: totalReinvest,
    };
  }

  // R$ aplica desagio de 10% no lucro; BDM mostra bruto.
  function displayProfit(grossProfit, inBDM) {
    return inBDM ? grossProfit : grossProfit * (1 - WITHDRAWAL_DESAGIO);
  }

  var api = {
    WITHDRAWAL_DESAGIO: WITHDRAWAL_DESAGIO,
    frequencyMonths: frequencyMonths,
    computeSchedule: computeSchedule,
    displayProfit: displayProfit,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BDMSchedule = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test tests/`
Expected: PASS (7 testes).

---

### Task 2: Incluir o motor em `index.html` e tornar `generateEvents` linear

**Files:**
- Modify: `index.html` (head/scripts; `frequencyMonths` ~1986; `generateEvents` ~2006-2030)

- [ ] **Step 1: Incluir `schedule.js` antes do `<script>` inline principal**

Localizar a tag de abertura do `<script>` inline principal (o bloco grande que contém `const App = ...`/funções). Imediatamente antes dele, inserir:

```html
<script src="js/schedule.js"></script>
```

- [ ] **Step 2: Remover a `frequencyMonths` inline duplicada**

Em `index.html` ~1986-1994, apagar a função inline:

```js
    function frequencyMonths(freq, duration, customMonths) {
      if (freq === 'monthly') return 1;
      if (freq === 'bimonthly') return 2;
      if (freq === 'quarterly') return 3;
      if (freq === 'semiannual') return 6;
      if (freq === 'at_maturity') return duration;
      if (freq === 'custom') return customMonths || 1;
      return 1;
    }
```

E adicionar logo após o início do script (perto das demais constantes globais) um alias para manter as chamadas existentes funcionando:

```js
    const frequencyMonths = BDMSchedule.frequencyMonths;
```

- [ ] **Step 3: Tornar `generateEvents` linear (remover composição)**

Substituir o corpo do laço em `generateEvents` (~2012-2030). Trocar:

```js
      let cur = addMonths(start, interval);
      let currentPrincipal = inv.principal;

      while (cur <= end) {
        const isLast = addMonths(cur, interval) > end || dateKey(cur) === dateKey(end);
        const profitAmt = currentPrincipal * (inv.profitPercentage / 100);
        
        events.push({
          id: uid(),
          investmentId: inv.id,
          date: dateKey(cur),
          amount: profitAmt,
          principalReturn: isLast ? currentPrincipal : 0,
          isLastPayment: isLast,
        });
        
        currentPrincipal += profitAmt; // Juros compostos: reinveste o lucro no capital
        
        if (isLast) break;
```

por:

```js
      let cur = addMonths(start, interval);
      const profitAmt = inv.principal * (inv.profitPercentage / 100); // bruto, fixo por periodo

      while (cur <= end) {
        const isLast = addMonths(cur, interval) > end || dateKey(cur) === dateKey(end);

        events.push({
          id: uid(),
          investmentId: inv.id,
          date: dateKey(cur),
          amount: profitAmt,
          principalReturn: isLast ? inv.principal : 0,
          isLastPayment: isLast,
        });

        if (isLast) break;
```

(O restante do laço — `cur = addMonths(cur, interval)` etc. — permanece.)

- [ ] **Step 4: Verificar no navegador**

Abrir `index.html`, criar/editar um investimento (R$ 1.000, 28%, custom 4 meses, 12 meses). Confirmar no Calendário que os 3 períodos mostram o **mesmo** lucro bruto (280) — sem crescer período a período. Conferir no console: `App.events.filter(e=>e.investmentId===<id>).map(e=>e.amount)` → `[280,280,280]`.

---

### Task 3: Toggles "Considerar Reinvestimento" (Insights + Calendário)

**Files:**
- Modify: `index.html` (estado global do `App`; header Insights ~1006; header Calendário ~900-911; handlers junto a `toggleIPCA` ~3238)

- [ ] **Step 1: Adicionar estado no objeto `App`**

Localizar a definição de `const App = { ... }` e adicionar as flags (padrão ligado):

```js
      reinvestInsights: true,
      reinvestCalendar: true,
```

- [ ] **Step 2: Adicionar toggle no header dos Insights**

Dentro do card premium do header (após o bloco IPCA, antes de fechar a `.premium-card` em ~1023), inserir:

```html
            <div class="flex items-center justify-between border-t border-white/5 pt-3 mt-1">
              <span class="text-[10px] font-semibold tracking-wider uppercase text-secondary/60">Considerar Reinvestimento</span>
              <label class="tog">
                <input type="checkbox" id="reinvest-insights-toggle" checked onchange="toggleReinvestInsights(this.checked)" />
                <div class="tog-track"></div>
                <div class="tog-thumb"></div>
              </label>
            </div>
```

- [ ] **Step 3: Adicionar toggle no header do Calendário**

No header do Calendário, após a `<!-- View toggle -->` (depois do `</div>` que fecha o bloco de botões ANO/MÊS/AGENDA em ~910), inserir:

```html
            <label class="tog-inline flex items-center gap-2 self-start sm:self-auto premium-card rounded-lg px-3 py-1.5">
              <span class="text-[11px] font-semibold tracking-wide uppercase text-secondary/70">Reinvestimento</span>
              <span class="tog">
                <input type="checkbox" id="reinvest-calendar-toggle" checked onchange="toggleReinvestCalendar(this.checked)" />
                <span class="tog-track"></span>
                <span class="tog-thumb"></span>
              </span>
            </label>
```

- [ ] **Step 4: Adicionar handlers junto a `toggleIPCA`**

Próximo a `function toggleIPCA` (~3238), adicionar:

```js
    function toggleReinvestInsights(checked) {
      App.reinvestInsights = checked;
      renderInsights();
    }

    function toggleReinvestCalendar(checked) {
      App.reinvestCalendar = checked;
      renderCalendar();
    }
```

(Se o nome da função de render dos Insights não for `renderInsights`, usar o nome real — confirmar buscando a função que desenha os gráficos/Insights e chamá-la.)

- [ ] **Step 5: Verificar no navegador**

Abrir `index.html`. Confirmar que os dois toggles aparecem ligados por padrão, com o mesmo visual `.tog` dos demais, e que alternar cada um re-renderiza a respectiva aba sem erros no console.

---

### Task 4: Exibição do Calendário (deságio R$/BDM + resumo de reinvestimento)

**Files:**
- Modify: `index.html` (renderização dos eventos ~2340-2530; banner de totais ~2240-2260 e ~2320-2350)

- [ ] **Step 1: Aplicar deságio nos valores em R$ dos eventos**

Em cada ponto que exibe o lucro do evento em R$ a partir de `e.amount`, passar pelo líquido. Trocar usos de `fmtBRL(e.amount)` por `fmtBRL(BDMSchedule.displayProfit(e.amount, false))` nos três renderizadores de evento (agenda ~2358/2463, desktop ~2434/2459, mobile ~2502/2525). Onde houver `totalEvt` (lucro+capital) em R$, computar o lucro líquido + capital: substituir `totalEvt = e.amount + (e.principalReturn||0)` por:

```js
        const netProfit = BDMSchedule.displayProfit(e.amount, false);
        const totalEvt = netProfit + (e.principalReturn || 0);
```

Os valores em BDM (`toBDM(e.amount)`, `toBDM(totalEvt)`) permanecem usando o bruto — **não** alterar para líquido.

- [ ] **Step 2: Resumo de reinvestimento no evento de vencimento (modo ON)**

No bloco que renderiza o evento quando `e.isLastPayment` (ex.: ~2463 e ~2528), adicionar, quando `App.reinvestCalendar` for verdadeiro, uma linha de resumo usando `computeSchedule`. Inserir antes de montar a linha de "Recebimento/Total":

```js
        let reinvestHtml = '';
        if (App.reinvestCalendar && e.isLastPayment && inv) {
          const sched = BDMSchedule.computeSchedule(inv, { reinvest: true });
          const bdmReinvest = (inv.showInBDM && App.bdmRate > 0) ? ` (${fmtBDM(toBDM(sched.totalReinvest))})` : '';
          reinvestHtml = `<div class="col-span-2 mt-1 pt-1.5 border-t border-primary/20"><span class="text-secondary/50">Com reinvestimento no vencimento:</span> <span class="font-bold text-primary">${fmtBRL(sched.totalReinvest)}${bdmReinvest}</span></div>`;
        }
```

E concatenar `reinvestHtml` ao HTML do card do evento de vencimento (após a linha de Recebimento/Total existente). Usar `fmtBDM`/`toBDM` conforme já usados no arquivo; se o helper de formatação BDM tiver outro nome, usar o existente.

- [ ] **Step 3: Aplicar deságio nos totais do período (banner)**

Onde o banner "Total a Receber" soma `e.amount` em R$ (cálculo do período, ~2240-2260 e ~2320-2350), somar o líquido: trocar `+ e.amount` por `+ BDMSchedule.displayProfit(e.amount, false)` no acumulador de R$. Os totais em BDM continuam somando `toBDM(e.amount)` (bruto).

- [ ] **Step 4: Verificar no navegador**

Com o investimento de referência: no modo ON, o evento de vencimento mostra "Com reinvestimento no vencimento: R$ 1.756". Cada período em R$ mostra 252 (e 280 quando exibido em BDM). Desligar o toggle do Calendário: o resumo de reinvestimento some; períodos continuam 252 (R$)/280 (BDM); o vencimento mostra lucro do período + devolução do capital.

---

### Task 5: Projeções e marcos dos Insights (linear OFF / composto no vencimento ON)

**Files:**
- Modify: `index.html` (`getMonthlyIncomeEst` ~2732; `calculateMilestone` ~2760; `getProjectionData` ~2770; `getProjectionDataReal` ~3012; banner fixo ~1000-1003 e/ou `generateDynamicInsights` ~2842)

- [ ] **Step 1: `getMonthlyIncomeEst` baseado em lucro líquido linear**

Substituir (~2732-2741):

```js
    function getMonthlyIncomeEst() {
      let total = 0;
      for (const inv of App.investments) {
        const months = frequencyMonths(inv.frequency, inv.durationMonths, inv.customFrequencyMonths);
        const equivalentMonthlyRate = Math.pow(1 + (inv.profitPercentage / 100), 1 / months) - 1;
        total += inv.principal * equivalentMonthlyRate;
      }
      return total;
    }
```

por:

```js
    function getMonthlyIncomeEst() {
      let total = 0;
      for (const inv of App.investments) {
        if (!inv.durationMonths) continue;
        const s = BDMSchedule.computeSchedule(inv, {});
        total += (s.netPerPeriod * s.numPeriods) / inv.durationMonths; // lucro liquido medio por mes
      }
      return total;
    }
```

- [ ] **Step 2: `calculateMilestone` linear no OFF, composto no ON**

Substituir (~2760-2768):

```js
    function calculateMilestone(target) {
      const monthlyRate = getAvgMonthlyYield() / 100;
      const val = getTotalPatrimony();
      if (val >= target) return 0;
      if (monthlyRate <= 0 || val <= 0) return null;
      const months = Math.ceil(Math.log(target / val) / Math.log(1 + monthlyRate));
      return months > 0 && months < 600000 ? months : null;
    }
```

por:

```js
    function calculateMilestone(target) {
      const val = getTotalPatrimony();
      if (val >= target) return 0;
      const monthlyIncome = getMonthlyIncomeEst();
      if (monthlyIncome <= 0 || val <= 0) return null;
      let months;
      if (App.reinvestInsights) {
        const monthlyRate = monthlyIncome / val;
        months = Math.ceil(Math.log(target / val) / Math.log(1 + monthlyRate));
      } else {
        months = Math.ceil((target - val) / monthlyIncome);
      }
      return months > 0 && months < 600000 ? months : null;
    }
```

- [ ] **Step 3: Reescrever `getProjectionData`**

Substituir o laço de simulação em `getProjectionData` (~2775-2806) por:

```js
      const reinvest = App.reinvestInsights;
      const DES = BDMSchedule.WITHDRAWAL_DESAGIO;
      const profitByMonth = {};
      for (const inv of App.investments) {
        if (!inv.startDate || !inv.durationMonths) continue;
        const sched = BDMSchedule.computeSchedule(inv, { reinvest });
        const startDate = new Date(inv.startDate + 'T12:00:00');
        let cycleStartM = (startDate.getFullYear() - base.getFullYear()) * 12 +
                          (startDate.getMonth() - base.getMonth());
        let principal = inv.principal;

        if (!reinvest) {
          const netPer = principal * (inv.profitPercentage / 100) * (1 - DES);
          for (let p = 1; p <= sched.numPeriods; p++) {
            const payM = cycleStartM + p * sched.interval;
            if (payM > 0 && payM <= totalMonths) profitByMonth[payM] = (profitByMonth[payM] || 0) + netPer;
          }
          continue;
        }

        while (cycleStartM + inv.durationMonths <= 0) {
          const netPer = principal * (inv.profitPercentage / 100) * (1 - DES);
          principal += netPer * sched.numPeriods;
          cycleStartM += inv.durationMonths;
        }
        while (cycleStartM < totalMonths) {
          const netPer = principal * (inv.profitPercentage / 100) * (1 - DES);
          for (let p = 1; p <= sched.numPeriods; p++) {
            const payM = cycleStartM + p * sched.interval;
            if (payM > 0 && payM <= totalMonths) profitByMonth[payM] = (profitByMonth[payM] || 0) + netPer;
          }
          principal += netPer * sched.numPeriods;
          cycleStartM += inv.durationMonths;
        }
      }
```

(O bloco final — soma cumulativa em `labels`/`data` — permanece igual.)

- [ ] **Step 4: Reescrever `getProjectionDataReal` (mesma lógica, deflacionada por IPCA)**

Substituir o laço de simulação em `getProjectionDataReal` (~3018-3045+) por:

```js
      const reinvest = App.reinvestInsights;
      const DES = BDMSchedule.WITHDRAWAL_DESAGIO;
      const profitByMonth = {};
      for (const inv of App.investments) {
        if (!inv.startDate || !inv.durationMonths) continue;
        const sched = BDMSchedule.computeSchedule(inv, { reinvest });
        const startDate = new Date(inv.startDate + 'T12:00:00');
        let cycleStartM = (startDate.getFullYear() - base.getFullYear()) * 12 +
                          (startDate.getMonth() - base.getMonth());
        let principal = inv.principal;

        const addPayment = (payM, nominal) => {
          if (payM > 0 && payM <= totalMonths) {
            const real = nominal / Math.pow(1 + ipcaMonthly, payM);
            profitByMonth[payM] = (profitByMonth[payM] || 0) + real;
          }
        };

        if (!reinvest) {
          const netPer = principal * (inv.profitPercentage / 100) * (1 - DES);
          for (let p = 1; p <= sched.numPeriods; p++) addPayment(cycleStartM + p * sched.interval, netPer);
          continue;
        }

        while (cycleStartM + inv.durationMonths <= 0) {
          const netPer = principal * (inv.profitPercentage / 100) * (1 - DES);
          principal += netPer * sched.numPeriods;
          cycleStartM += inv.durationMonths;
        }
        while (cycleStartM < totalMonths) {
          const netPer = principal * (inv.profitPercentage / 100) * (1 - DES);
          for (let p = 1; p <= sched.numPeriods; p++) addPayment(cycleStartM + p * sched.interval, netPer);
          principal += netPer * sched.numPeriods;
          cycleStartM += inv.durationMonths;
        }
      }
```

(Manter o restante da função, inclusive `ipcaMonthly`, idêntico.)

- [ ] **Step 5: Banner/insight de reinvestimento condicional**

Tornar o aviso fixo do header dos Insights (~1000-1003, "Cálculos assumem Juros Compostos (Reinvestimento Automático)") condicional. Dar um id ao texto:

```html
              <span id="reinvest-notice-text" class="text-[10px] font-semibold uppercase tracking-wider">Cálculos consideram reinvestimento no vencimento</span>
```

E em `toggleReinvestInsights` (Task 3, Step 4), atualizar o texto/visibilidade do aviso:

```js
    function toggleReinvestInsights(checked) {
      App.reinvestInsights = checked;
      const n = document.getElementById('reinvest-notice-text');
      if (n) n.textContent = checked
        ? 'Cálculos consideram reinvestimento no vencimento'
        : 'Cálculos sem reinvestimento (lucro por período, sem composição)';
      renderInsights();
    }
```

Em `generateDynamicInsights` (~2842-2843), tornar a mensagem permanente condicional:

```js
      if (App.reinvestInsights) {
        insights.push({ type: 'info', icon: 'autorenew', msg: 'Com reinvestimento ligado: ao vencer, cada ativo é reaplicado com o capital mais o lucro líquido (já com o deságio de 10% do saque). Gráfico e marcos refletem esse crescimento.' });
      } else {
        insights.push({ type: 'info', icon: 'info', msg: 'Sem reinvestimento: o lucro de cada período é fixo sobre o valor investido. Os valores em reais já consideram o deságio de 10% no saque do lucro.' });
      }
```

- [ ] **Step 6: Verificar no navegador**

Com o investimento de referência e outros: ligado, a projeção cresce de forma composta a cada vencimento e os marcos usam crescimento composto; desligado, a projeção é linear (sem composição) e o marco usa divisão simples. Sem erros no console ao alternar o toggle dos Insights.

---

### Task 6: Texto explicativo do deságio de 10%

**Files:**
- Modify: `index.html` (área de Insights próxima às projeções/cálculos)

- [ ] **Step 1: Adicionar nota explicativa visível**

Próximo ao gráfico de projeção dos Insights, adicionar um rodapé explicativo (seguindo o estilo de textos auxiliares já usados, ex.: `text-[10px] text-secondary/50`):

```html
          <p class="text-[10px] text-secondary/50 mt-2">Os valores em reais já descontam o deságio de 10% que a plataforma cobra no saque do lucro. Valores exibidos em BDM mostram o lucro cheio.</p>
```

- [ ] **Step 2: Verificar no navegador**

Confirmar que a nota aparece de forma legível e coerente com o design (cor/tamanho dos textos auxiliares existentes).

---

### Task 7: Humanização do agente de IA

**Files:**
- Modify: `index.html` (`AI_SYSTEM_PROMPT` ~3439-3488)

- [ ] **Step 1: Reescrever as regras e o checklist do prompt**

Substituir o bloco de regras/checklist do `AI_SYSTEM_PROMPT`. Trocar a regra R7 e o checklist técnico por:

- Remover "R7. Sem saudacoes..." e substituir por:
  `R7. Seja humano e acolhedor: cumprimente quando o usuario cumprimentar, use tom caloroso e natural. Mantenha a objetividade nas acoes, sem enrolacao.`
- Adicionar uma regra nova:
  `R9. NUNCA exponha termos tecnicos ao usuario: nada de true/false, nomes de campos em ingles, JSON visivel ou jargao. Fale sempre em portugues (ptbr), salvo se o usuario pedir outro idioma. Ao faltar dados, pergunte em linguagem natural (ex.: "Voce quer acompanhar esse investimento em BDM ou em reais?" em vez de "showInBDM: true/false").`
- No CHECKLIST OBRIGATORIO, manter os campos internamente, mas instruir a coleta em linguagem natural. Reescrever o item 8:
  `8. Forma de exibicao (em BDM ou em reais) — pergunte de forma natural, nunca como "true/false".`
  E o item 3:
  `3. lucro por periodo (em %, maior que zero)`

(As regras R1–R6 e R8 sobre formato do JSON de ação permanecem — elas governam a saída de máquina, não a conversa com o usuário.)

- [ ] **Step 2: Ajustar a afirmação de reinvestimento na análise**

No MODO 1 (Analise), acrescentar:

```
Nao afirme reinvestimento automatico como fato. Se relevante, diga que o reinvestimento depende da opcao "Considerar Reinvestimento" ativa na tela, e que o lucro por periodo e fixo sobre o valor investido.
```

- [ ] **Step 3: Verificar no navegador**

Abrir o agente e:
- Mandar "bom dia" → o agente responde com uma saudação calorosa antes de oferecer ajuda.
- Pedir para criar um investimento sem informar tudo → o agente pede os dados que faltam em português natural, sem listar campos em inglês nem `true/false`.
- Confirmar que ações de criar/editar ainda produzem o JSON correto (R1–R6/R8 intactas).

---

## Self-Review (cobertura da spec)

- Botão por aba, padrão ligado, estilo `.tog` → Task 3. ✔
- Lucro fixo por período (sem composição), consistência calendário↔insights → Tasks 1, 2, 5. ✔
- Deságio 10% só em R$, nunca em BDM; reinvestimento usa líquido → Tasks 1 (`displayProfit`/`totalReinvest`), 4, 5. ✔
- Calendário: períodos fixos + resumo no vencimento (ON) → Task 4. ✔
- Insights: projeção linear OFF / composta no vencimento ON, marcos, aviso condicional → Task 5. ✔
- Texto explicativo do deságio → Task 6. ✔
- Agente: saudações, sem termos técnicos, ptbr, sem afirmar reinvestimento automático → Task 7. ✔

Observação de execução: confirmar os nomes reais das funções de render (`renderInsights`/`renderCalendar`) e do formatador BDM (`fmtBDM`/`toBDM`) no arquivo antes de aplicar os steps que os referenciam — usar os nomes existentes.
