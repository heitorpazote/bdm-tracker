# Reinvestimento Periódico + UX Mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o reinvestimento compor o principal a cada recebimento periódico (não só no vencimento) em Calendário e Insights, e adicionar gestos táteis mobile (swipe de mês, bottom-sheet arrastável, háptico, long-press, pull-to-refresh).

**Architecture:** A matemática vive em uma única função pura `BDMSchedule.compoundedPeriods` (`js/schedule.js`), consumida tanto pelo Calendário quanto por `buildProfitByMonth` — garantindo números idênticos. A detecção de gestos vive em um módulo puro `js/gestures.js` (testável em Node); o wiring de DOM fica em `index.html`. Sem build step; testes via `node --test`.

**Tech Stack:** HTML/CSS/JS inline (single file `index.html`), módulos `js/*.js` com `module.exports` + global, Tailwind CDN, Chart.js, Supabase. Testes: `node:test` + `node:assert`.

---

## File Structure

- `js/schedule.js` — adiciona `compoundedPeriods` (matemática de composição). Mantém `computeSchedule` intacto.
- `js/gestures.js` — **novo**. Funções puras de detecção (direção do swipe, threshold, eixo dominante). Sem DOM.
- `tests/schedule.test.js` — adiciona testes para `compoundedPeriods` (mantém os existentes).
- `tests/gestures.test.js` — **novo**. Testes das funções puras de gesto.
- `index.html` — consome os módulos: linha "se reinvestir" por período no calendário, reescrita de `buildProfitByMonth`, textos de aviso, e wiring dos gestos mobile (swipe/bottom-sheet/háptico/long-press/pull-to-refresh).
- `STATE.md` — atualizar ao final.

---

## FASE 1 — Matemática de Reinvestimento

### Task 1: `compoundedPeriods` em `js/schedule.js`

**Files:**
- Modify: `js/schedule.js`
- Test: `tests/schedule.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao FINAL de `tests/schedule.test.js` (antes do EOF, após o último `test(...)`):

```js
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
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test tests/schedule.test.js`
Expected: FAIL — `compoundedPeriods is not a function` (ou `undefined`).

- [ ] **Step 3: Implementar `compoundedPeriods`**

Em `js/schedule.js`, inserir a função ANTES do bloco `var api = {`:

```js
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
```

E adicionar `compoundedPeriods` ao objeto `api`:

```js
  var api = {
    WITHDRAWAL_DESAGIO: WITHDRAWAL_DESAGIO,
    frequencyMonths: frequencyMonths,
    computeSchedule: computeSchedule,
    compoundedPeriods: compoundedPeriods,
  };
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test tests/schedule.test.js`
Expected: PASS — todos os testes (novos + antigos) verdes.

- [ ] **Step 5: Commit**

```bash
git add js/schedule.js tests/schedule.test.js
git commit -m "feat: compoundedPeriods - composicao periodica do reinvestimento"
```

---

### Task 2: Linha "se reinvestir" por período no Calendário

**Files:**
- Modify: `index.html` (helper novo + `renderDetailPanel` ~2944/2975, `openDayModal` ~3023/3051)

- [ ] **Step 1: Adicionar helper `reinvestProfitForEvent`**

Em `index.html`, inserir logo ANTES de `function renderCalendar()` (linha ~2611):

```js
    // Lucro liquido COMPOSTO deste evento, supondo reinvestimento dos recebimentos
    // anteriores no mesmo investimento. Retorna o periodo de BDMSchedule.compoundedPeriods
    // correspondente a data do evento, ou null.
    function reinvestProfitForEvent(inv, e) {
      if (!inv || !inv.startDate || !e || !e.date) return null;
      const interval = BDMSchedule.frequencyMonths(inv.frequency, inv.durationMonths, inv.customFrequencyMonths);
      const sd = new Date(inv.startDate + 'T12:00:00');
      const ed = new Date(e.date + 'T12:00:00');
      const months = (ed.getFullYear() - sd.getFullYear()) * 12 + (ed.getMonth() - sd.getMonth());
      const idx = Math.max(1, Math.round(months / interval));
      const periods = BDMSchedule.compoundedPeriods(inv, { reinvest: true, horizonMonths: idx * interval });
      return periods[idx - 1] || null;
    }
```

- [ ] **Step 2: Substituir cálculo `sched` no `renderDetailPanel`**

Em `index.html:2944-2945`, trocar:

```js
        const sched = (App.reinvestCalendar && e.isLastPayment && inv) ? BDMSchedule.computeSchedule(inv, { reinvest: true }) : null;
        const reinvBdm = (sched && inv.showInBDM && App.bdmRate > 0) ? ` (${fmtBDM(toBDM(sched.totalReinvest))})` : '';
```

por:

```js
        const rp = (App.reinvestCalendar && inv) ? reinvestProfitForEvent(inv, e) : null;
        const showReinv = !!(rp && rp.periodIndex >= 2);
        const reinvBdm = (showReinv && inv.showInBDM && App.bdmRate > 0) ? ` (${fmtBDM(toBDM(rp.netProfit))})` : '';
```

- [ ] **Step 3: Substituir a linha de exibição no `renderDetailPanel`**

Em `index.html:2975`, trocar:

```js
            ${sched ? `<div class="col-span-2 mt-1 pt-1.5 border-t border-primary/20"><span class="text-secondary/50">Com reinvestimento no vencimento:</span> <span class="font-bold text-primary">${fmtBRL(sched.totalReinvest)}${reinvBdm}</span></div>` : ''}
```

por:

```js
            ${showReinv ? `<div class="col-span-2 mt-1 pt-1.5 border-t border-primary/20"><span class="text-secondary/50">Se reinvestir os recebimentos anteriores:</span> <span class="font-bold text-primary">${fmtBRL(rp.netProfit)}${reinvBdm}</span>${inv.showInBDM ? ' <span class="text-[9px] text-secondary/40">(−10% deságio)</span>' : ''}</div>` : ''}
```

- [ ] **Step 4: Substituir cálculo `sched` no `openDayModal`**

Em `index.html:3023-3024`, trocar:

```js
        const sched = (App.reinvestCalendar && e.isLastPayment && inv) ? BDMSchedule.computeSchedule(inv, { reinvest: true }) : null;
        const reinvBdm = (sched && inv.showInBDM && App.bdmRate > 0) ? ` (${fmtBDM(toBDM(sched.totalReinvest))})` : '';
```

por:

```js
        const rp = (App.reinvestCalendar && inv) ? reinvestProfitForEvent(inv, e) : null;
        const showReinv = !!(rp && rp.periodIndex >= 2);
        const reinvBdm = (showReinv && inv.showInBDM && App.bdmRate > 0) ? ` (${fmtBDM(toBDM(rp.netProfit))})` : '';
```

- [ ] **Step 5: Substituir a linha de exibição no `openDayModal`**

Em `index.html:3051`, trocar:

```js
          ${sched ? `<div class="col-span-2 mt-1 pt-1.5 border-t border-primary/20"><span class="text-secondary/50">Com reinvestimento no vencimento:</span> <span class="font-bold text-primary">${fmtBRL(sched.totalReinvest)}${reinvBdm}</span></div>` : ''}
```

por:

```js
          ${showReinv ? `<div class="col-span-2 mt-1 pt-1.5 border-t border-primary/20"><span class="text-secondary/50">Se reinvestir os recebimentos anteriores:</span> <span class="font-bold text-primary">${fmtBRL(rp.netProfit)}${reinvBdm}</span>${inv.showInBDM ? ' <span class="text-[9px] text-secondary/40">(−10% deságio)</span>' : ''}</div>` : ''}
```

- [ ] **Step 6: Verificar no browser**

Abrir `index.html`, logar, garantir um investimento com pelo menos 2 períodos (ex.: 1000 @ 25% custom 4m, duração 12m) e o toggle "Reinvestimento" do calendário LIGADO. Selecionar um dia com o 2º ou 3º recebimento e expandir a transação.
Expected: aparece a linha "Se reinvestir os recebimentos anteriores: R$ <valor composto>", maior que o lucro base. No 1º período a linha NÃO aparece. Em ativo BDM, aparece "(−10% deságio)".

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: linha 'se reinvestir' composta por periodo no calendario"
```

---

### Task 3: Reescrever `buildProfitByMonth` para composição periódica

**Files:**
- Modify: `index.html:3370-3414`

- [ ] **Step 1: Substituir o corpo de `buildProfitByMonth`**

Trocar a função inteira (`index.html:3370-3414`) por:

```js
    function buildProfitByMonth(totalMonths, reinvest, spread) {
      const base = new Date(); base.setDate(1); base.setHours(0, 0, 0, 0);
      const profitByMonth = {};
      const addPeriod = (payM, interval, amount) => {
        if (spread) {
          const per = amount / interval;
          for (let k = 0; k < interval; k++) {
            const mm = payM - k;
            if (mm > 0 && mm <= totalMonths) profitByMonth[mm] = (profitByMonth[mm] || 0) + per;
          }
        } else if (payM > 0 && payM <= totalMonths) {
          profitByMonth[payM] = (profitByMonth[payM] || 0) + amount;
        }
      };
      for (const inv of App.investments) {
        if (!inv.startDate || !inv.durationMonths) continue;
        const startDate = new Date(inv.startDate + 'T12:00:00');
        const cycleStartM = (startDate.getFullYear() - base.getFullYear()) * 12 +
          (startDate.getMonth() - base.getMonth());
        const interval = BDMSchedule.frequencyMonths(inv.frequency, inv.durationMonths, inv.customFrequencyMonths);
        // reinvest: compoe continuamente ate cobrir o horizonte (a partir do inicio,
        // inclusive periodos ja passados, que so compoem o principal). Sem reinvest:
        // lucro fixo durante a duracao original (compoundedPeriods limita a numPeriods).
        const horizon = reinvest ? (totalMonths - cycleStartM) : inv.durationMonths;
        const periods = BDMSchedule.compoundedPeriods(inv, { reinvest, horizonMonths: horizon });
        for (const pr of periods) addPeriod(cycleStartM + pr.monthOffset, interval, pr.netProfit);
      }
      return profitByMonth;
    }
```

- [ ] **Step 2: Verificar projeção no browser**

Abrir `index.html`, ir em Insights com o toggle "Considerar Reinvestimento" LIGADO. Com 1000 @ 25%/4m:
Expected: o gráfico de Projeção Patrimonial cresce de forma composta (curva acelerando), e os marcos (R$ 1mi) recalculam. Desligar o toggle → curva linear (lucro fixo, sem composição) e valores idênticos ao comportamento anterior sem reinvest.

- [ ] **Step 3: Sanidade numérica (console do browser)**

No console do browser, com um único investimento 1000 @ 28% custom 4m duração 12m, `showInBDM=false`, iniciado neste mês:

```js
buildProfitByMonth(12, true, false)
```

Expected: `{4: 280, 8: 358.4, 12: 458.752}` (bate com a tabela da spec / Task 1).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: buildProfitByMonth compoe a cada periodo via compoundedPeriods"
```

---

### Task 4: Atualizar textos de aviso ("no vencimento" → "a cada recebimento")

**Files:**
- Modify: `index.html` — `toggleReinvestInsights` (~3963), `generateDynamicInsights` (~3459/3461), tooltips (~1266, ~1348, ~1418, ~1419, ~1353)

- [ ] **Step 1: Atualizar `toggleReinvestInsights`**

Em `index.html:3962-3964`, trocar:

```js
        ? 'Cálculos consideram reinvestimento no vencimento'
        : 'Cálculos sem reinvestimento (lucro por período, sem composição)';
```

por:

```js
        ? 'Cálculos compõem o reinvestimento a cada recebimento'
        : 'Cálculos sem reinvestimento (lucro por período, sem composição)';
```

- [ ] **Step 2: Atualizar as mensagens de `generateDynamicInsights`**

Em `index.html:3459`, trocar o texto:

```js
        insights.push({ type: 'info', icon: 'autorenew', msg: 'Com reinvestimento ligado: ao vencer, cada ativo é reaplicado com o capital mais o lucro líquido (já com o deságio de 10% do saque). Gráfico e marcos refletem esse crescimento.' });
```

por:

```js
        insights.push({ type: 'info', icon: 'autorenew', msg: 'Com reinvestimento ligado: cada recebimento periódico é reaplicado no mesmo investimento assim que cai, compondo o principal (o deságio de 10% só incide em ativos exibidos em cripto). Gráfico e marcos refletem esse crescimento.' });
```

- [ ] **Step 3: Atualizar tooltips de "no vencimento"**

Em `index.html`, nas tooltips abaixo, trocar a frase indicada:

Linha ~1266 (tip "Considerar Reinvestimento"): trocar `o lucro de cada ciclo é somado ao capital e rende juros sobre juros nos próximos períodos.` por `o lucro de cada recebimento é somado ao capital assim que cai e rende juros sobre juros nos próximos períodos.`

Linha ~1353 (label projeção): trocar `Reinvestimento automático ao vencimento` por `Reinvestimento automático a cada recebimento`.

Linha ~1418/1419 (tip "Projeção de Marcos" e subtítulo): trocar as ocorrências de `reinvestimento automático ao vencimento` / `Taxa atual composta com reinvestimento automático` por `reinvestimento automático a cada recebimento` / `Taxa composta com reinvestimento a cada recebimento`.

- [ ] **Step 4: Verificar no browser**

Abrir Insights, alternar o toggle e abrir as tooltips (?).
Expected: nenhum texto menciona mais "no vencimento"; todos dizem "a cada recebimento".

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "docs: textos de reinvestimento refletem composicao por recebimento"
```

---

## FASE 2 — UX Mobile Tátil

### Task 5: Módulo puro `js/gestures.js` + testes

**Files:**
- Create: `js/gestures.js`
- Create: `tests/gestures.test.js`
- Modify: `index.html:12` (carregar o script)

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/gestures.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { dominantAxis, swipeDirection, isTap, SWIPE_MIN, TAP_MAX } = require('../js/gestures.js');

test('dominantAxis identifica eixo predominante', () => {
  assert.strictEqual(dominantAxis(40, 10), 'x');
  assert.strictEqual(dominantAxis(10, 40), 'y');
  assert.strictEqual(dominantAxis(0, 0), 'none');
});

test('swipeDirection respeita o threshold horizontal', () => {
  assert.strictEqual(swipeDirection(SWIPE_MIN + 1, 5), 'right');
  assert.strictEqual(swipeDirection(-(SWIPE_MIN + 1), 5), 'left');
  assert.strictEqual(swipeDirection(SWIPE_MIN - 1, 5), null); // curto demais
  assert.strictEqual(swipeDirection(60, 60), null); // vertical domina
});

test('isTap: deslocamento pequeno conta como toque', () => {
  assert.strictEqual(isTap(TAP_MAX - 1, TAP_MAX - 1), true);
  assert.strictEqual(isTap(TAP_MAX + 5, 0), false);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node --test tests/gestures.test.js`
Expected: FAIL — `Cannot find module '../js/gestures.js'`.

- [ ] **Step 3: Implementar `js/gestures.js`**

Criar `js/gestures.js`:

```js
(function (root) {
  var SWIPE_MIN = 50;   // px minimos para contar como swipe
  var TAP_MAX = 10;     // px maximos de deslocamento para contar como toque
  var AXIS_RATIO = 1.3; // quanto um eixo precisa dominar o outro

  function dominantAxis(dx, dy) {
    var ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax === 0 && ay === 0) return 'none';
    return ax >= ay ? 'x' : 'y';
  }

  function swipeDirection(dx, dy) {
    if (Math.abs(dx) < SWIPE_MIN) return null;
    if (Math.abs(dx) < Math.abs(dy) * AXIS_RATIO) return null; // vertical domina
    return dx > 0 ? 'right' : 'left';
  }

  function isTap(dx, dy) {
    return Math.abs(dx) <= TAP_MAX && Math.abs(dy) <= TAP_MAX;
  }

  var api = {
    SWIPE_MIN: SWIPE_MIN, TAP_MAX: TAP_MAX, AXIS_RATIO: AXIS_RATIO,
    dominantAxis: dominantAxis, swipeDirection: swipeDirection, isTap: isTap,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BDMGestures = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test tests/gestures.test.js`
Expected: PASS.

- [ ] **Step 5: Carregar o módulo no `index.html`**

Em `index.html:12`, logo após `<script src="js/schedule.js"></script>`, adicionar:

```html
  <script src="js/gestures.js"></script>
```

- [ ] **Step 6: Commit**

```bash
git add js/gestures.js tests/gestures.test.js index.html
git commit -m "feat: js/gestures.js - deteccao pura de swipe/tap"
```

---

### Task 6: Swipe horizontal para trocar de mês

**Files:**
- Modify: `index.html` — adicionar wiring após `function nextPeriod()` (~2609)

- [ ] **Step 1: Adicionar o wiring de swipe + helper háptico compartilhado**

Em `index.html`, inserir logo APÓS o fim de `function nextPeriod() { ... }` (linha ~2609):

```js
    // Vibracao tatil curta (no-op onde nao suportado, ex.: iOS Safari).
    function haptic(ms) {
      try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (_) {}
    }

    // Swipe horizontal na grade do calendario troca o mes/periodo.
    function initCalendarSwipe() {
      const grid = document.getElementById('view-month');
      if (!grid || grid.dataset.swipeBound) return;
      grid.dataset.swipeBound = '1';
      let sx = 0, sy = 0, tracking = false;
      grid.addEventListener('touchstart', (ev) => {
        if (ev.touches.length !== 1) { tracking = false; return; }
        sx = ev.touches[0].clientX; sy = ev.touches[0].clientY; tracking = true;
      }, { passive: true });
      grid.addEventListener('touchend', (ev) => {
        if (!tracking) return;
        tracking = false;
        const t = ev.changedTouches[0];
        const dir = BDMGestures.swipeDirection(t.clientX - sx, t.clientY - sy);
        if (!dir) return;
        haptic(8);
        const card = document.getElementById('view-month');
        const cls = dir === 'left' ? 'slide-out-left' : 'slide-out-right';
        if (card) { card.classList.add(cls); setTimeout(() => card.classList.remove(cls), 220); }
        if (dir === 'left') nextPeriod(); else prevPeriod();
      }, { passive: true });
    }
```

- [ ] **Step 2: Adicionar CSS da transição de slide**

Em `index.html`, dentro do `<style>` (adicionar perto de `.glass-modal` ~linha 75), inserir:

```css
    @keyframes slideOutLeft { from { opacity:1; transform:translateX(0); } 50% { opacity:.4; transform:translateX(-14px);} to { opacity:1; transform:translateX(0);} }
    @keyframes slideOutRight { from { opacity:1; transform:translateX(0); } 50% { opacity:.4; transform:translateX(14px);} to { opacity:1; transform:translateX(0);} }
    .slide-out-left { animation: slideOutLeft .22s ease; }
    .slide-out-right { animation: slideOutRight .22s ease; }
```

- [ ] **Step 3: Chamar `initCalendarSwipe()` quando o calendário renderiza**

Em `index.html`, dentro de `function renderCalendar()` (~2611), adicionar como PRIMEIRA linha do corpo:

```js
      initCalendarSwipe();
```

- [ ] **Step 4: Verificar no browser (mobile)**

Abrir `index.html` no DevTools em modo dispositivo (touch). Na tela Calendário, deslizar a grade para a esquerda/direita.
Expected: swipe esquerda → próximo mês; direita → mês anterior; leve animação; scroll vertical da página ainda funciona (gesto vertical não troca o mês).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: swipe horizontal troca o mes no calendario + helper haptic"
```

---

### Task 7: Modais como bottom-sheet arrastável

**Files:**
- Modify: `index.html` — `showModal`/`hideModal` (~3068) + CSS

- [ ] **Step 1: Adicionar CSS da alça e do arraste**

Em `index.html` no `<style>`, adicionar:

```css
    .sheet-handle { width:36px; height:4px; border-radius:9999px; background:rgba(255,255,255,.25); margin:8px auto 4px; }
    @media (min-width: 640px) { .sheet-handle { display:none; } }
    .sheet-dragging { transition: none !important; }
    .glass-modal { transition: transform .25s ease; }
```

- [ ] **Step 2: Tornar `showModal` instalador do bottom-sheet no mobile**

Trocar `showModal`/`hideModal` (`index.html:3068-3075`) por:

```js
    function showModal(id) {
      const el = document.getElementById(id);
      el.style.display = 'flex';
      haptic(6);
      if (window.innerWidth < 640) initBottomSheet(el);
    }
    function hideModal(id) {
      const el = document.getElementById(id);
      el.style.display = 'none';
      const panel = el.querySelector('.glass-modal');
      if (panel) panel.style.transform = '';
    }

    // No mobile: arrastar o painel para baixo fecha o modal. Adiciona uma alca visual.
    function initBottomSheet(overlay) {
      const panel = overlay.querySelector('.glass-modal');
      if (!panel) return;
      if (!panel.querySelector('.sheet-handle')) {
        const h = document.createElement('div');
        h.className = 'sheet-handle';
        panel.insertBefore(h, panel.firstChild);
      }
      if (panel.dataset.sheetBound) return;
      panel.dataset.sheetBound = '1';
      let sy = 0, dy = 0, dragging = false;
      panel.addEventListener('touchstart', (ev) => {
        if (ev.touches.length !== 1 || panel.scrollTop > 0) { dragging = false; return; }
        sy = ev.touches[0].clientY; dy = 0; dragging = true;
        panel.classList.add('sheet-dragging');
      }, { passive: true });
      panel.addEventListener('touchmove', (ev) => {
        if (!dragging) return;
        dy = ev.touches[0].clientY - sy;
        if (dy > 0) panel.style.transform = `translateY(${dy}px)`;
      }, { passive: true });
      panel.addEventListener('touchend', () => {
        if (!dragging) return;
        dragging = false;
        panel.classList.remove('sheet-dragging');
        if (dy > 110) {
          haptic(10);
          panel.style.transform = `translateY(100%)`;
          const ov = panel.closest('[id^="modal-"]') || overlay;
          setTimeout(() => { ov.style.display = 'none'; panel.style.transform = ''; }, 220);
        } else {
          panel.style.transform = '';
        }
      }, { passive: true });
    }
```

- [ ] **Step 3: Verificar no browser (mobile)**

DevTools touch. Abrir um modal (ex.: "Novo Investimento" ou um dia com eventos).
Expected: no mobile aparece a alça no topo; arrastar o painel para baixo > ~110px fecha o modal (com háptico); arraste curto volta à posição. No desktop (largura ≥640px) a alça some e o comportamento é o de antes.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: modais como bottom-sheet arrastavel no mobile"
```

---

### Task 8: Feedback háptico nas ações principais

**Files:**
- Modify: `index.html` — `setView` (~2588), `navigate` (~2491), confirmações de save

> `haptic()` já foi criado na Task 6 e já é usado em swipe e modais. Aqui estendemos a pontos-chave.

- [ ] **Step 1: Háptico ao trocar de view do calendário e ao navegar de tela**

Em `function setView(v)` (`index.html:2588`), adicionar como primeira linha do corpo:

```js
      haptic(5);
```

Em `function navigate(screen)` (`index.html:2491`), adicionar como primeira linha do corpo:

```js
      haptic(5);
```

- [ ] **Step 2: Háptico ao salvar investimento com sucesso**

Localizar em `saveInvestment` o ponto após sucesso (logo antes/depois de `await loadAllData();` em `index.html:3152`). Adicionar imediatamente após esse `await loadAllData();`:

```js
        haptic(12);
```

- [ ] **Step 3: Verificar no browser (mobile real ou Android emul.)**

Em um aparelho que suporte `navigator.vibrate` (Android/Chrome). Trocar de tela, trocar view, salvar investimento.
Expected: micro-vibração nesses eventos. Em iOS/desktop: sem erro no console (no-op).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: feedback haptico em navegacao, troca de view e salvar"
```

---

### Task 9: Long-press no dia para preview de eventos

**Files:**
- Modify: `index.html` — `renderMonthGrid`/wiring (~2681-2714) + CSS do popover

- [ ] **Step 1: Adicionar CSS do popover de preview**

Em `index.html` no `<style>`, adicionar:

```css
    #day-preview { position:fixed; z-index:150; max-width:240px; pointer-events:none; opacity:0; transform:scale(.96); transition:opacity .12s ease, transform .12s ease; }
    #day-preview.show { opacity:1; transform:scale(1); }
```

- [ ] **Step 2: Adicionar o elemento do popover ao HTML**

Em `index.html`, logo antes de `</main>` (linha ~1770), adicionar:

```html
  <div id="day-preview" class="glass-modal rounded-xl p-3 text-xs"></div>
```

- [ ] **Step 3: Adicionar a lógica de long-press na grade**

Em `index.html`, inserir logo após `function initCalendarSwipe() { ... }` (criada na Task 6):

```js
    // Long-press num dia abre um preview rapido dos eventos sem navegacao.
    function initDayLongPress() {
      const grid = document.getElementById('month-grid');
      if (!grid || grid.dataset.lpBound) return;
      grid.dataset.lpBound = '1';
      let timer = null, startX = 0, startY = 0;
      const pop = document.getElementById('day-preview');
      const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
      const hide = () => { pop.classList.remove('show'); };
      grid.addEventListener('touchstart', (ev) => {
        const cell = ev.target.closest('.cal-cell');
        if (!cell || ev.touches.length !== 1) return;
        const m = cell.getAttribute('onclick') && cell.getAttribute('onclick').match(/'(\d{4}-\d{2}-\d{2})'/);
        if (!m) return;
        const dk = m[1];
        startX = ev.touches[0].clientX; startY = ev.touches[0].clientY;
        timer = setTimeout(() => {
          const evts = App.events.filter(e => e.date === dk);
          if (evts.length === 0) return;
          haptic(14);
          const d = new Date(dk + 'T12:00:00');
          const rows = evts.map(e => {
            const inv = App.investments.find(i => i.id === e.investmentId);
            return `<div class="flex justify-between gap-3"><span class="text-secondary/70">${inv ? inv.name : '—'}</span><span class="font-bold text-primary tabular-nums">+${fmtBRL(e.amount + (e.principalReturn || 0))}</span></div>`;
          }).join('');
          pop.innerHTML = `<div class="font-semibold text-on-surface mb-1.5">${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</div>${rows}`;
          const r = cell.getBoundingClientRect();
          pop.style.left = Math.max(8, Math.min(window.innerWidth - 248, r.left)) + 'px';
          pop.style.top = Math.max(8, r.top - 8 - pop.offsetHeight) + 'px';
          pop.classList.add('show');
        }, 420);
      }, { passive: true });
      grid.addEventListener('touchmove', (ev) => {
        if (!timer) return;
        const t = ev.touches[0];
        if (Math.abs(t.clientX - startX) > BDMGestures.TAP_MAX || Math.abs(t.clientY - startY) > BDMGestures.TAP_MAX) clear();
      }, { passive: true });
      grid.addEventListener('touchend', () => { clear(); setTimeout(hide, 1400); }, { passive: true });
    }
```

- [ ] **Step 4: Chamar `initDayLongPress()` ao renderizar o grid**

Em `function renderMonthGrid(y, m)` (`index.html:2681`), adicionar como ÚLTIMA linha do corpo (após `grid.innerHTML = html;`):

```js
      initDayLongPress();
```

- [ ] **Step 5: Verificar no browser (mobile)**

DevTools touch. Pressionar e segurar (~0,5s) um dia COM eventos.
Expected: popover aparece acima da célula com os recebimentos do dia; mover o dedo durante o press cancela; soltar fecha após curto delay. Dia sem eventos não abre nada.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: long-press no dia abre preview rapido dos eventos"
```

---

### Task 10: Pull-to-refresh para re-sincronizar Supabase

**Files:**
- Modify: `index.html` — wiring global + indicador; usa `loadAllData` (~2231)

- [ ] **Step 1: Adicionar o indicador e CSS**

Em `index.html` no `<style>`, adicionar:

```css
    #ptr { position:fixed; top:0; left:50%; transform:translate(-50%, -48px); z-index:140; transition:transform .18s ease; }
    #ptr .ptr-spin { width:28px; height:28px; border-radius:9999px; border:2px solid rgba(255,255,255,.2); border-top-color:#0EA5E9; }
    #ptr.spin .ptr-spin { animation: ptrSpin .7s linear infinite; }
    @keyframes ptrSpin { to { transform: rotate(360deg); } }
```

Em `index.html`, logo antes de `</main>` (~1770), adicionar:

```html
  <div id="ptr" class="glass-modal rounded-full p-2"><div class="ptr-spin"></div></div>
```

- [ ] **Step 2: Adicionar a lógica de pull-to-refresh**

Em `index.html`, inserir junto aos outros wirings de gesto (após `initDayLongPress`):

```js
    // Pull-to-refresh: puxar para baixo no topo re-sincroniza o Supabase.
    function initPullToRefresh() {
      if (document.body.dataset.ptrBound) return;
      document.body.dataset.ptrBound = '1';
      const ptr = document.getElementById('ptr');
      const scroller = document.scrollingElement || document.documentElement;
      let sy = 0, dy = 0, active = false, refreshing = false;
      window.addEventListener('touchstart', (ev) => {
        if (refreshing || ev.touches.length !== 1 || scroller.scrollTop > 0) { active = false; return; }
        sy = ev.touches[0].clientY; dy = 0; active = true;
      }, { passive: true });
      window.addEventListener('touchmove', (ev) => {
        if (!active) return;
        dy = ev.touches[0].clientY - sy;
        if (dy > 0) ptr.style.transform = `translate(-50%, ${Math.min(dy - 48, 56)}px)`;
      }, { passive: true });
      window.addEventListener('touchend', async () => {
        if (!active) return;
        active = false;
        if (dy > 90) {
          refreshing = true;
          haptic(12);
          ptr.classList.add('spin');
          ptr.style.transform = 'translate(-50%, 16px)';
          try { await loadAllData(); } catch (_) {}
          ptr.classList.remove('spin');
          ptr.style.transform = 'translate(-50%, -48px)';
          refreshing = false;
        } else {
          ptr.style.transform = 'translate(-50%, -48px)';
        }
      }, { passive: true });
    }
```

- [ ] **Step 3: Inicializar após o login/carga inicial**

Em `index.html`, no `function navigate(screen)` ou logo após o primeiro `await loadAllData();` da inicialização (`index.html:2185`), adicionar:

```js
      initPullToRefresh();
```

(Pode ser chamado mais de uma vez com segurança — é guardado por `document.body.dataset.ptrBound`.)

- [ ] **Step 4: Verificar no browser (mobile)**

DevTools touch, com scroll no topo. Puxar a página para baixo > ~90px e soltar.
Expected: o indicador desce, gira, os dados re-sincronizam (eventos/investimentos recarregam) e o indicador sobe de volta. Puxar pouco não dispara. Não dispara se a página não estiver no topo.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: pull-to-refresh re-sincroniza dados do Supabase no mobile"
```

---

### Task 11: Atualizar STATE.md

**Files:**
- Modify: `STATE.md`

- [ ] **Step 1: Registrar as mudanças**

Adicionar uma entrada datada (2026-06-10) em `STATE.md` resumindo: (1) reinvestimento agora compõe a cada recebimento (`compoundedPeriods`), refletido em Calendário (linha "se reinvestir") e Insights (`buildProfitByMonth`); deságio 10% por período só em ativos `showInBDM`; (2) gestos mobile: swipe de mês, bottom-sheet arrastável, háptico, long-press de preview, pull-to-refresh; novo módulo `js/gestures.js`. Listar TODOs remanescentes se houver.

- [ ] **Step 2: Commit**

```bash
git add STATE.md
git commit -m "docs: STATE.md - reinvestimento periodico + UX mobile"
```

---

## Self-Review (cobertura da spec)

- Spec §2.2 (matemática nova) → Task 1 (`compoundedPeriods` + testes).
- Spec §2.3 (fonte única) → Task 1 (módulo) consumido por Task 2 (calendário) e Task 3 (insights).
- Spec §2.4 (calendário: base + "se reinvestir") → Task 2.
- Spec §2.5 (insights/chart/marcos) → Task 3.
- Spec §2.2 deságio (notice) + §2.5 textos → Tasks 2 e 4.
- Spec §3.1 swipe mês → Task 6. §3.2 bottom-sheet → Task 7. §3.3 háptico → Tasks 6/7/8. §3.4 long-press → Task 9. §3.5 pull-to-refresh → Task 10.
- Spec §3 "helper compartilhado" → Task 5 (`js/gestures.js`) + `haptic()` (Task 6).
- Convenção STATE.md → Task 11.

**Fora de escopo (confirmado na spec):** Calculadora; mutação de `App.events`; KPIs de estado atual.
