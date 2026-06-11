# Grupo A — Agente IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o microfone no mobile (desativar no APK), eliminar a sobreposição de elementos no cabeçalho ao abrir/fechar o teclado, e fazer o Agente IA usar números reais pré-calculados em vez de errar contas.

**Architecture:** App single-file `index.html` (HTML+CSS+JS inline) + módulos puros em `js/schedule.js`. A matemática nova vai num helper puro `buildAIInvestmentMetrics` no `BDMSchedule` (testável em Node via `node --test`); `index.html` só formata o texto injetado e ajusta DOM/CSS. Sem build step.

**Tech Stack:** JavaScript ES5/ES6 inline, Tailwind CDN, Chart.js (não usado aqui), Supabase Edge Function `ai-chat`, `node:test` para testes unitários.

---

## File Structure

- `js/schedule.js` — adicionar `buildAIInvestmentMetrics(inv, opts)` ao objeto `api`/`BDMSchedule`. Puro, sem DOM.
- `tests/schedule.test.js` — testes do novo helper (anexar ao final).
- `index.html`:
  - `initSTT()` (~linha 5235) — A1: esconder mic no mobile.
  - `_buildContext()` (~linha 4525) — A3: injetar métricas + agregados + próximo pagamento.
  - `AI_SYSTEM_PROMPT` (~linha 4342) — A3: regra "use números prontos" + seção sistemática.
  - `initAIMobileKeyboardFix()` (~linha 5307) — A2: corrigir sobreposição.
- `STATE.md` — registro da sessão (última tarefa).

**Comando de teste (todas as tasks de teste):** `node --test tests/schedule.test.js`

---

## Task 1: Helper puro `buildAIInvestmentMetrics` (A3 Parte 1)

**Files:**
- Modify: `js/schedule.js` (adicionar função antes do bloco `var api = {...}`, e expor no `api`)
- Test: `tests/schedule.test.js` (anexar ao final)

- [ ] **Step 1: Write the failing tests**

Anexar ao final de `tests/schedule.test.js`:

```javascript
const { buildAIInvestmentMetrics } = require('../js/schedule.js');

test('buildAIInvestmentMetrics: investimento so em R$ (sem desagio)', () => {
  const m = buildAIInvestmentMetrics(invBRL, { ipcaRate: 5 });
  assert.strictEqual(m.interval, 4);
  assert.strictEqual(m.numPeriods, 3);
  near(m.grossPerPeriod, 280);
  near(m.netPerPeriod, 280);
  assert.strictEqual(m.applyDesagio, false);
  near(m.totalFixed, 840);            // 280 * 3
  near(m.totalReinvested, 1097.152);  // principalAfter final (2097.152) - 1000
  near(m.monthlyProfit, 70);          // 280 / 4
  near(m.monthlyYieldPct, 7);         // 70 / 1000 * 100
  near(m.aprPct, 84);                 // 7 * 12
  near(m.realYieldPct, 75.2380952381); // (1.84/1.05 - 1) * 100
});

test('buildAIInvestmentMetrics: ativo BDM (desagio 10%)', () => {
  const m = buildAIInvestmentMetrics(invBDM, { ipcaRate: 5 });
  assert.strictEqual(m.applyDesagio, true);
  near(m.netPerPeriod, 252);          // 280 - 10%
  near(m.totalFixed, 756);            // 252 * 3
  near(m.totalReinvested, 962.515008);// principalAfter final (1962.515008) - 1000
  near(m.monthlyProfit, 63);          // 252 / 4
  near(m.aprPct, 75.6);               // 6.3 * 12
  near(m.realYieldPct, 67.2380952381);// (1.756/1.05 - 1) * 100
});

test('buildAIInvestmentMetrics: ipcaRate ausente trata como 0', () => {
  const m = buildAIInvestmentMetrics(invBRL, {});
  near(m.realYieldPct, 84); // (1.84/1.0 - 1) * 100
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/schedule.test.js`
Expected: FAIL — `buildAIInvestmentMetrics is not a function` (ou `undefined`).

- [ ] **Step 3: Implement the helper**

Em `js/schedule.js`, **antes** da linha `var api = {`, adicionar:

```javascript
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
```

E no objeto `api`, adicionar a linha (após `compoundedPeriods: compoundedPeriods,`):

```javascript
    buildAIInvestmentMetrics: buildAIInvestmentMetrics,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/schedule.test.js`
Expected: PASS — todos os testes (incluindo os 3 novos) verdes.

- [ ] **Step 5: Commit**

```bash
git add js/schedule.js tests/schedule.test.js
git commit -m "feat(schedule): buildAIInvestmentMetrics — metricas prontas p/ agente IA"
```

---

## Task 2: Injetar métricas + agregados no contexto do agente (A3 Parte 1, wiring)

**Files:**
- Modify: `index.html` — `_buildContext()` (~linha 4525-4543)

**Contexto:** `_buildContext()` hoje injeta só campos brutos. Vamos enriquecer cada periódico com as métricas do helper, calcular agregados da carteira, e derivar **próximo pagamento** e **status** de `App.events` (mesma fonte do Calendário, garantindo que os números batem).

- [ ] **Step 1: Substituir a montagem de `periodicos` e o texto de retorno**

Em `index.html`, substituir o corpo de `_buildContext()` (de `const periodicos = ...` até o template literal de retorno) por:

```javascript
    function _buildContext() {
      const todayStr = new Date().toISOString().split('T')[0];
      const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2);

      // Próximo pagamento e status vêm de App.events (mesma fonte do Calendário).
      const nextPaymentFor = (id) => {
        const future = App.events
          .filter(e => e.investmentId === id && e.date >= todayStr)
          .sort((a, b) => a.date.localeCompare(b.date));
        return future[0] || null;
      };
      const isFinished = (id) => {
        const evts = App.events.filter(e => e.investmentId === id);
        return evts.length > 0 && evts.every(e => e.date < todayStr);
      };

      const periodicos = App.investments.filter(i => i.type !== 'asset').map(i => {
        const m = BDMSchedule.buildAIInvestmentMetrics(i, { ipcaRate: App.ipcaRate });
        const next = nextPaymentFor(i.id);
        return {
          id: i.id, name: i.name, principal: i.principal,
          profitPercentage: i.profitPercentage, frequency: i.frequency,
          durationMonths: i.durationMonths, startDate: i.startDate,
          showInBDM: i.showInBDM, categoryId: i.categoryId,
          status: isFinished(i.id) ? 'finalizado' : 'ativo',
          intervaloMeses: m.interval,
          numPeriodos: m.numPeriods,
          lucroBrutoPorPeriodo: fmt(m.grossPerPeriod),
          lucroLiquidoPorPeriodo: fmt(m.netPerPeriod),
          temDesagio: m.applyDesagio,
          totalFixoSemReinvestir: fmt(m.totalFixed),
          totalSeReinvestir: fmt(m.totalReinvested),
          lucroMensalMedio: fmt(m.monthlyProfit),
          aprNominalAnualPct: fmt(m.aprPct),
          yieldRealPosIpcaPct: fmt(m.realYieldPct),
          proximoPagamento: next ? { data: next.date, valor: fmt(next.amount) } : null,
        };
      });

      const ativos = App.investments.filter(i => i.type === 'asset').map(i => ({
        id: i.id, name: i.name, type: 'asset',
        valorUnitario: i.unitValue, quantidade: i.quantity,
        valorDeMercado: fmt((i.unitValue || 0) * (i.quantity || 0)),
        showInBDM: i.showInBDM, categoryId: i.categoryId,
      }));

      const cats = App.categories.map(c => ({ id: c.id, name: c.name }));

      // Agregados da carteira
      const patrimonioPeriodicos = periodicos.reduce((s, p) => s + p.principal, 0);
      const patrimonioAtivos = App.investments.filter(i => i.type === 'asset')
        .reduce((s, i) => s + (i.unitValue || 0) * (i.quantity || 0), 0);
      const patrimonioTotal = patrimonioPeriodicos + patrimonioAtivos;
      const rendaMensalEstimada = periodicos
        .filter(p => p.status === 'ativo')
        .reduce((s, p) => s + parseFloat(p.lucroMensalMedio), 0);

      return `[ESTADO DO APP — ${todayStr}]
Cotacao Cripto: R$ ${App.bdmRate > 0 ? App.bdmRate.toFixed(2) : 'N/A'}
IPCA anual: ${App.ipcaRate}%
Reinvestimento (toggle Insights): ${App.reinvestInsights ? 'LIGADO' : 'DESLIGADO'}
Patrimonio total: R$ ${fmt(patrimonioTotal)} (periodicos R$ ${fmt(patrimonioPeriodicos)} + ativos R$ ${fmt(patrimonioAtivos)})
Renda mensal estimada (periodicos ativos): R$ ${fmt(rendaMensalEstimada)}
Categorias disponiveis: ${JSON.stringify(cats)}
Investimentos periodicos (${periodicos.length}) — TODOS os numeros abaixo ja estao calculados, NAO recalcule:
${JSON.stringify(periodicos)}
Ativos de valorizacao (${ativos.length}): ${JSON.stringify(ativos)}`;
    }
```

- [ ] **Step 2: Verificação manual no browser (console)**

Abrir `index.html` autenticado com ao menos 1 investimento periódico. No console do browser executar:

```javascript
copy(_buildContext()); console.log(_buildContext());
```

Expected: O texto contém `lucroLiquidoPorPeriodo`, `totalSeReinvestir`, `aprNominalAnualPct`, `yieldRealPosIpcaPct`, `proximoPagamento`, `Patrimonio total` e `Renda mensal estimada`. Conferir que `lucroLiquidoPorPeriodo` × `numPeriodos` ≈ `totalFixoSemReinvestir`, e que `proximoPagamento.valor` bate com o valor exibido no Calendário para esse investimento.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(ai): injeta metricas reais + agregados + proximo pagamento no contexto"
```

---

## Task 3: Atualizar o system prompt (A3 Parte 2)

**Files:**
- Modify: `index.html` — `AI_SYSTEM_PROMPT` (~linha 4342-4434)

- [ ] **Step 1: Adicionar a regra absoluta R11**

Após a linha `R10. USE CABECALHOS MARKDOWN...` (linha ~4355), adicionar:

```
R11. USE OS NUMEROS JA CALCULADOS do CONTEXTO INJETADO (lucroLiquidoPorPeriodo, totalFixoSemReinvestir, totalSeReinvestir, aprNominalAnualPct, yieldRealPosIpcaPct, proximoPagamento, rendaMensalEstimada, patrimonioTotal). NUNCA recalcule schedules, totais, yields ou projecoes por conta propria — leia e interprete os valores fornecidos. Se um numero nao estiver no contexto, diga que nao tem o dado, nao invente conta.
```

- [ ] **Step 2: Adicionar a seção "SISTEMÁTICA DO PROJETO"**

Imediatamente **antes** de `## CONHECIMENTO DA PLATAFORMA` (linha ~4357), inserir:

```
## SISTEMATICA DO PROJETO (como o app modela investimentos)

- Composicao "a cada recebimento": no cenario REINVESTIR, cada lucro periodico e reaplicado no mesmo investimento assim que cai (juros sobre juros desde o recebimento, nao so no vencimento). O campo totalSeReinvestir ja reflete isso; totalFixoSemReinvestir e o cenario sem reaplicar.
- Desagio de 10%: e taxa de SAQUE do BDM. So incide quando o investimento e exibido/sacado em Cripto (showInBDM=true / temDesagio=true). Reaplicar lucro nao e sacar. O lucroLiquidoPorPeriodo ja vem com o desagio descontado quando aplicavel.
- Frequencias (meses por periodo): monthly=1, bimonthly=2, quarterly=3, semiannual=6, at_maturity=duracao total, custom=customFrequencyMonths.
- APR vs APY: aprNominalAnualPct e a taxa NOMINAL anual (lucro mensal medio × 12, linear, sem capitalizacao). NAO confunda com juros compostos — a capitalizacao so aparece no cenario reinvestir (totalSeReinvestir).
- Ativos de valorizacao (type=asset): rendem por apreciacao de preco, NAO geram evento/pagamento periodico. So entram no patrimonio (valorDeMercado).
```

- [ ] **Step 3: Apontar a seção "Cálculos e métricas" aos campos injetados**

Em `### Cálculos e métricas` (linha ~4363), substituir as duas linhas de "Rentabilidade exibida" e "Yield real":

```
- **Rentabilidade (APR)** = use aprNominalAnualPct ja calculado no contexto (lucro mensal medio × 12, linear).
- **Yield real pos-IPCA** = use yieldRealPosIpcaPct ja calculado no contexto. Positivo = supera a inflacao.
- **Lucro por periodo** = use lucroLiquidoPorPeriodo (liquido, ja com desagio quando aplicavel) e lucroBrutoPorPeriodo (sem desagio).
- **Totais no horizonte** = totalFixoSemReinvestir (sem reaplicar) e totalSeReinvestir (reaplicando a cada recebimento).
```

- [ ] **Step 4: Verificação manual no browser**

Abrir o Agente IA, perguntar: *"Qual o lucro real pós-IPCA do meu investimento X e quanto rende por período?"*
Expected: A resposta cita números que batem com os campos `yieldRealPosIpcaPct` / `lucroLiquidoPorPeriodo` do contexto (conferir via `_buildContext()` no console), sem o agente fazer contas próprias divergentes.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(ai): prompt usa numeros prontos (R11) + secao sistematica do projeto"
```

---

## Task 4: Desativar microfone no mobile, preservar código (A1)

**Files:**
- Modify: `index.html` — `initSTT()` (~linha 5246-5266)

- [ ] **Step 1: Esconder o botão e não registrar listeners no touch**

Em `initSTT()`, localizar o bloco:

```javascript
      const isTouch = window.matchMedia('(pointer:coarse)').matches;

      if (isTouch) {
        // Mobile: press and hold to record
        let _holdStarted = false;
        micBtn.addEventListener('touchstart', e => {
```

Substituir a abertura do `if (isTouch) {` por uma guarda que esconde o botão e retorna **antes** de registrar qualquer listener:

```javascript
      const isTouch = window.matchMedia('(pointer:coarse)').matches;

      // Mobile (APK WebView): permissao de microfone (RECORD_AUDIO) nao e concedida ao
      // WebView, resultando em "acesso negado". Desativado no mobile — codigo STT mantido
      // intacto para reativacao futura. Desktop permanece inalterado.
      if (isTouch) {
        micBtn.style.display = 'none';
        return;
      }

      {
        // Desktop: click to toggle
        micBtn.addEventListener('click', () => {
          if (_sttActive) sttStop(true);
          else sttStart();
        });
      }
```

E **remover** o antigo bloco `if (isTouch) { ... } else { ... }` que continha os listeners `touchstart`/`touchend`/`touchcancel` e o `else` do desktop (substituído acima). Garantir que nenhum listener de toque seja registrado e que o `click` do desktop continue presente exatamente uma vez.

- [ ] **Step 2: Verificação manual — mobile**

Abrir `index.html` no celular (ou DevTools → device toolbar / emulação `pointer:coarse`) na tela do Agente IA.
Expected: O botão de microfone **não aparece**; nenhum prompt de permissão é disparado ao usar o chat.

- [ ] **Step 3: Verificação manual — desktop**

Abrir `index.html` no desktop. Clicar no microfone, falar, parar.
Expected: Botão visível; clique inicia/para a gravação; a transcrição preenche `#ai-input`; envio continua manual. Comportamento idêntico ao atual.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix(ai): desativa microfone no mobile (APK WebView), preserva codigo STT"
```

---

## Task 5: Corrigir sobreposição no cabeçalho ao abrir/fechar teclado (A2)

**Files:**
- Modify: `index.html` — `initAIMobileKeyboardFix()` (~linha 5307-5341)

**REQUIRED SUB-SKILL:** Use superpowers:systematic-debugging — reproduzir o bug primeiro (emulação mobile, focar/desfocar `#ai-input` repetidas vezes), confirmar a causa, só então aplicar o fix abaixo. O candidato de fix está pronto, mas só feche a task após reproduzir e confirmar que sumiu.

**Causa provável:** O handler `visualViewport.scroll` faz `aiScreen.style.top = offsetTop + 'px'`, mas `#screen-ai` é estático (`display:flex`, sem `position`), então `top` não posiciona — e o ajuste concorrente de `height` no `resize`, sem debounce e sem reset idempotente, deixa o container com altura defasada durante a transição teclado-fecha, empurrando/sobrepondo o cabeçalho. Header e input já são `flex-shrink-0`; só `#ai-messages` (`flex-1`) deve absorver a variação.

- [ ] **Step 1: Reproduzir o bug**

Abrir `index.html` autenticado, tela Agente IA, em emulação mobile (DevTools device toolbar). Focar o campo de texto (teclado abre), desfocar (fecha), repetir ~5x rápido.
Expected (bug atual): elementos se sobrepõem perto do cabeçalho durante as transições.

- [ ] **Step 2: Aplicar o fix — simplificar o handler**

Substituir o corpo de `initAIMobileKeyboardFix()` (de `if (window.visualViewport) {` até o fim da função) por:

```javascript
      // Mantem o input acima do teclado encolhendo SO a altura do #screen-ai ao
      // visualViewport.height. Header e input sao flex-shrink-0; apenas #ai-messages
      // (flex-1) encolhe. Nao manipulamos `top` (screen-ai e estatico — top nao
      // posiciona e causava layout defasado durante a transicao teclado-fecha).
      const applyVV = () => {
        if (!aiScreen.classList.contains('active') || window.innerWidth >= 768) return;
        const bottomNav = document.querySelector('nav.fixed.bottom-0');
        const navH = bottomNav?.offsetHeight || 64;
        aiScreen.style.height = (window.visualViewport.height - navH) + 'px';
      };
      const resetVV = () => { aiScreen.style.height = ''; aiScreen.style.top = ''; };

      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', applyVV);
      }

      // Fallback: rolar o input para a viewport quando focado (browsers sem visualViewport)
      aiInput.addEventListener('focus', () => {
        if (window.innerWidth >= 768) return;
        setTimeout(() => aiInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 350);
      });

      // Reset idempotente ao fechar o teclado
      aiInput.addEventListener('blur', () => {
        if (!aiScreen.classList.contains('active')) return;
        resetVV();
      });
```

- [ ] **Step 3: Verificar que o bug sumiu**

Repetir o Step 1 (focar/desfocar ~5x).
Expected: o cabeçalho permanece fixo no topo, sem sobreposição; o input permanece acima do teclado quando focado; ao fechar o teclado o layout volta ao normal sem altura residual.

- [ ] **Step 4: Verificação desktop (não-regressão)**

Abrir no desktop (largura ≥ 768px), focar/desfocar o campo do Agente IA.
Expected: nenhuma mudança de altura aplicada (`applyVV` retorna cedo); tela igual ao atual.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "fix(ai): teclado mobile nao sobrepoe o cabecalho (remove manip. de top)"
```

---

## Task 6: Atualizar STATE.md

**Files:**
- Modify: `STATE.md`

- [ ] **Step 1: Registrar a sessão**

Adicionar entrada em `## Recent Changes` (topo da lista) datada `2026-06-11` resumindo: A1 mic desativado no mobile (código preservado), A2 sobreposição de teclado corrigida (remoção da manipulação de `top`), A3 agente IA com métricas reais injetadas (`buildAIInvestmentMetrics`) + prompt R11 + seção sistemática. Atualizar a linha do Agente IA em `## Screen Status` e registrar a decisão "mic desativado no mobile por limitação de permissão do WebView".

- [ ] **Step 2: Commit**

```bash
git add STATE.md
git commit -m "docs: STATE.md — Grupo A (mic mobile, teclado, conhecimento do agente)"
```

---

## Notas de execução

- Rodar `node --test tests/schedule.test.js` após a Task 1 e novamente ao final (garantir verde).
- Tasks 2-5 não têm teste unitário (DOM/contexto vivo) — usar as verificações manuais descritas. Em emulação mobile use DevTools device toolbar; o `pointer:coarse` ativa o caminho mobile.
- Commits frequentes, um por task, mensagens em pt-BR como nos commits existentes.
