# Grupo B — Insights / Gráficos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar zoom/pan à Projeção Patrimonial e um novo gráfico "Projeção de Lucro Mensal" (linha/área, espelhando a patrimonial) na tela Insights.

**Architecture:** App single-file `index.html` (HTML+CSS+JS inline), Chart.js 4.4 via CDN, sem build step. O zoom usa o plugin oficial `chartjs-plugin-zoom` (+ Hammer.js para gestos de toque). Config de zoom centralizada em `_zoomOptions`; o novo gráfico reusa `buildProfitByMonth` (já existente) com duas funções de dados novas e uma render function que espelha `renderLineChart`.

**Tech Stack:** JavaScript inline, Chart.js 4.4, chartjs-plugin-zoom 2.0.1, Hammer.js 2.0.8, Tailwind CDN.

---

## Sobre testes

Os gráficos dependem de Chart.js + estado vivo (`App.*`) + `new Date()`. Como os gráficos existentes (`renderLineChart`, `renderCompositionChart`, `renderDonutChart`), **não há teste unitário** — a verificação é **manual no browser**. Cada task abaixo traz passos de verificação concretos. Abrir `index.html` autenticado com ≥1 investimento periódico.

---

## File Structure

Tudo em `index.html`:
- `<head>` (~linha 10): novos `<script>` CDN (Hammer.js + chartjs-plugin-zoom).
- Card da Projeção Patrimonial (~linhas 1360-1398): botão de reset de zoom.
- Novo card "Projeção de Lucro Mensal" (inserir após a linha 1398).
- JS: `_zoomOptions` + `resetChartZoom` (helpers), `getMonthlyProfitData`, `getMonthlyProfitDataReal`, `renderMonthlyProfitChart`; ajustes em `renderLineChart`, `setProjectionYears`, `renderInsights`.
- `STATE.md`: registro final.

---

## Task 1: Plugin de zoom + zoom/pan na Projeção Patrimonial (B1)

**Files:**
- Modify: `index.html` — `<head>` (~linha 10), card patrimonial (~linha 1371), JS antes de `renderLineChart` (~linha 3915), `renderLineChart` (~linha 3970-3984).

- [ ] **Step 1: Adicionar os CDNs de Hammer.js e chartjs-plugin-zoom**

Localizar a linha (index.html ~linha 10):

```html
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
```

Inserir **imediatamente após** ela:

```html
  <script src="https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js"></script>
```

(O plugin auto-registra no `Chart` global quando carregado por UMD. Hammer.js habilita pinça/pan por toque.)

- [ ] **Step 2: Adicionar os helpers `_zoomOptions` e `resetChartZoom`**

Localizar o início de `function renderLineChart() {` (index.html ~linha 3915). Inserir **imediatamente antes** dela:

```javascript
    // Config compartilhada de zoom/pan (eixo do tempo) para os graficos de projecao.
    // Desktop: arrastar = selecionar area de zoom; Ctrl+roda = zoom. Mobile: pinca = zoom,
    // arraste (1 dedo) = pan. resetBtnId: botao "Resetar zoom" exibido quando ha zoom/pan.
    function _zoomOptions(resetBtnId) {
      const showReset = () => { document.getElementById(resetBtnId)?.classList.remove('hidden'); };
      return {
        pan: { enabled: true, mode: 'x', onPanComplete: showReset },
        zoom: {
          wheel: { enabled: true, modifierKey: 'ctrl' },
          pinch: { enabled: true },
          drag: { enabled: true },
          mode: 'x',
          onZoomComplete: showReset,
        },
      };
    }

    // Reseta o zoom de um grafico (App.charts[chartKey]) e oculta seu botao de reset.
    function resetChartZoom(chartKey, resetBtnId) {
      const ch = App.charts[chartKey];
      if (ch && typeof ch.resetZoom === 'function') ch.resetZoom();
      document.getElementById(resetBtnId)?.classList.add('hidden');
    }
```

- [ ] **Step 3: Aplicar o zoom em `renderLineChart` e ocultar o reset ao (re)renderizar**

Em `renderLineChart` (~linha 3970-3984), localizar o bloco `options.plugins`:

```javascript
          plugins: {
            legend: { display: App.useIPCA, labels: { color: '#99907c', font: { size: 10 }, boxWidth: 20 } },
            tooltip: {
              mode: 'index', intersect: false,
              callbacks: { label: c => ` ${c.dataset.label}: ${fmtBRL(c.raw)}` }
            }
          },
```

Substituir por (acrescenta a vírgula após `tooltip{}` e a chave `zoom`):

```javascript
          plugins: {
            legend: { display: App.useIPCA, labels: { color: '#99907c', font: { size: 10 }, boxWidth: 20 } },
            tooltip: {
              mode: 'index', intersect: false,
              callbacks: { label: c => ` ${c.dataset.label}: ${fmtBRL(c.raw)}` }
            },
            zoom: _zoomOptions('line-reset-zoom'),
          },
```

Depois, localizar o fechamento da função (a `});` que fecha `new Chart(...)` seguida da `}` de `renderLineChart`, ~linha 3985):

```javascript
        }
      });
    }

    function renderRankings() {
```

Substituir por (adiciona o reset do botão logo após criar o chart):

```javascript
        }
      });
      document.getElementById('line-reset-zoom')?.classList.add('hidden');
    }

    function renderRankings() {
```

- [ ] **Step 4: Adicionar o botão "Resetar zoom" ao card patrimonial**

No card da Projeção Patrimonial, localizar a `<div>` dos botões de horizonte (index.html ~linha 1371):

```html
              <div class="flex gap-1 text-[11px]">
                <button onclick="setProjectionYears(2)"
```

Substituir a abertura da div + inserir o botão de reset antes do primeiro botão de ano:

```html
              <div class="flex gap-1 text-[11px] items-center">
                <button id="line-reset-zoom" onclick="resetChartZoom('line','line-reset-zoom')" class="hidden px-2 py-0.5 rounded text-amber-400 hover:bg-white/5" title="Resetar zoom">Resetar zoom</button>
                <button onclick="setProjectionYears(2)"
```

- [ ] **Step 5: Verificação manual (browser)**

Abrir `index.html` autenticado, ir em Insights. No gráfico Projeção Patrimonial:
- Desktop: arrastar horizontalmente seleciona uma área e dá zoom; segurar **Ctrl** e girar a roda dá zoom; o botão "Resetar zoom" aparece; clicar nele volta ao normal e o botão some.
- Sem Ctrl, a roda do mouse rola a página normalmente (não dá zoom).
- (Se houver device/emulador touch: pinça dá zoom, arrastar com 1 dedo move.)
Expected: tudo acima funciona; nenhum erro no console.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(insights): zoom/pan na Projecao Patrimonial (chartjs-plugin-zoom + Hammer)"
```

---

## Task 2: HTML do novo card "Projeção de Lucro Mensal" (B2)

**Files:**
- Modify: `index.html` — inserir card após o card patrimonial (~linha 1398).

- [ ] **Step 1: Inserir o novo card**

Localizar o fim do card da Projeção Patrimonial e o início do card de composição (index.html ~linha 1396-1401):

```html
            <p class="text-[10px] text-secondary/50 mt-2">Os valores em reais já descontam o deságio de 10% que a
              plataforma cobra no saque do lucro. Valores exibidos em Cripto mostram o lucro cheio.</p>
          </div>

          <!-- Composition chart -->
          <div id="composition-card" class="hidden premium-card rounded-xl p-5 lg:col-span-2">
```

Inserir o novo card **entre** o `</div>` que fecha o card patrimonial e o comentário `<!-- Composition chart -->`:

```html
            <p class="text-[10px] text-secondary/50 mt-2">Os valores em reais já descontam o deságio de 10% que a
              plataforma cobra no saque do lucro. Valores exibidos em Cripto mostram o lucro cheio.</p>
          </div>

          <!-- Monthly profit projection chart -->
          <div class="premium-card rounded-xl p-5 lg:col-span-3">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-sm font-semibold text-on-surface flex items-center gap-1">Projeção de Lucro Mensal<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300">help_outline</span><span class="tip-box">Estimativa de quanto de lucro você recebe por mês ao longo do tempo. Com reinvestimento ativo, a renda mensal cresce conforme o principal é composto. Botões 2a–30a definem o horizonte; arraste/pinça para dar zoom.</span></span></h3>
                <span class="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide bg-primary/10 text-primary border border-primary/20">
                  <span class="material-symbols-outlined text-[11px]" style="font-variation-settings:'FILL' 1,'wght' 400">autorenew</span>
                  Reinvestimento automático a cada recebimento
                </span>
              </div>
              <div class="flex gap-1 text-[11px] items-center">
                <button id="monthly-reset-zoom" onclick="resetChartZoom('monthlyProfit','monthly-reset-zoom')" class="hidden px-2 py-0.5 rounded text-amber-400 hover:bg-white/5" title="Resetar zoom">Resetar zoom</button>
                <button onclick="setProjectionYears(2)" class="proj-btn px-2 py-0.5 rounded text-secondary/60 hover:text-secondary" data-years="2">2a</button>
                <button onclick="setProjectionYears(5)" class="proj-btn px-2 py-0.5 rounded bg-primary/10 text-primary" data-years="5">5a</button>
                <button onclick="setProjectionYears(10)" class="proj-btn px-2 py-0.5 rounded text-secondary/60 hover:text-secondary" data-years="10">10a</button>
                <button onclick="setProjectionYears(20)" class="proj-btn px-2 py-0.5 rounded text-secondary/60 hover:text-secondary" data-years="20">20a</button>
                <button onclick="setProjectionYears(30)" class="proj-btn px-2 py-0.5 rounded text-secondary/60 hover:text-secondary" data-years="30">30a</button>
              </div>
            </div>
            <div id="monthly-empty" class="flex-col items-center justify-center py-10 text-secondary/40" style="display:none">
              <span class="material-symbols-outlined text-[40px] mb-2" style="font-variation-settings:'wght' 200">bar_chart</span>
              <p class="text-xs">Adicione investimentos para ver as projeções</p>
            </div>
            <div id="monthly-wrap" style="height:200px">
              <canvas id="monthly-profit-chart"></canvas>
            </div>
            <p class="text-[10px] text-secondary/50 mt-2">Lucro líquido estimado por mês (já com o deságio de 10% no saque, quando aplicável). A linha tracejada desconta o IPCA.</p>
          </div>

          <!-- Composition chart -->
          <div id="composition-card" class="hidden premium-card rounded-xl p-5 lg:col-span-2">
```

- [ ] **Step 2: Verificação manual (estrutura)**

Abrir `index.html` em Insights. O card "Projeção de Lucro Mensal" aparece abaixo da Projeção Patrimonial, com título, selo de reinvestimento, botões 2a–30a e uma área de gráfico vazia (o canvas ainda não desenha — vem na Task 3). Sem erros no console.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(insights): card HTML da Projecao de Lucro Mensal"
```

---

## Task 3: Dados + render do gráfico de lucro mensal (B2)

**Files:**
- Modify: `index.html` — inserir funções de dados após `getProjectionDataReal` (~linha 3836) e `renderMonthlyProfitChart` após `renderLineChart` (~linha 3987).

- [ ] **Step 1: Adicionar `getMonthlyProfitData` e `getMonthlyProfitDataReal`**

Localizar o fim de `getProjectionDataReal` (a `}` antes de `function renderCompositionChart() {`, index.html ~linha 3836):

```javascript
      return { labels, data };
    }

    function renderCompositionChart() {
```

Inserir as duas funções **entre** o `return` e `function renderCompositionChart`:

```javascript
      return { labels, data };
    }

    // Lucro liquido estimado por mes (NAO acumulado). Usa buildProfitByMonth com spread=true
    // (distribui o lucro de cada periodo pelos meses do intervalo => renda mensal suave).
    function getMonthlyProfitData(years) {
      const totalMonths = years * 12;
      const step = years <= 2 ? 1 : years <= 5 ? 3 : 6;
      const base = new Date(); base.setDate(1); base.setHours(0, 0, 0, 0);
      const profitByMonth = buildProfitByMonth(totalMonths, App.reinvestInsights, true);
      const labels = [], data = [];
      for (let i = 0; i <= totalMonths; i += step) {
        const d = new Date(base); d.setMonth(d.getMonth() + i);
        labels.push(d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
        data.push(Math.round(profitByMonth[i] || 0));
      }
      return { labels, data };
    }

    // Lucro mensal deflacionado pelo IPCA (poder de compra do mes i).
    function getMonthlyProfitDataReal(years) {
      const totalMonths = years * 12;
      const step = years <= 2 ? 1 : years <= 5 ? 3 : 6;
      const base = new Date(); base.setDate(1); base.setHours(0, 0, 0, 0);
      const ipcaMonthly = Math.pow(1 + App.ipcaRate / 100, 1 / 12) - 1;
      const profitByMonth = buildProfitByMonth(totalMonths, App.reinvestInsights, true);
      const labels = [], data = [];
      for (let i = 0; i <= totalMonths; i += step) {
        const d = new Date(base); d.setMonth(d.getMonth() + i);
        labels.push(d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
        const deflator = ipcaMonthly > 0 ? Math.pow(1 + ipcaMonthly, i) : 1;
        data.push(Math.round((profitByMonth[i] || 0) / deflator));
      }
      return { labels, data };
    }

    function renderCompositionChart() {
```

- [ ] **Step 2: Adicionar `renderMonthlyProfitChart`**

Localizar o fim de `renderLineChart` — após a Task 1 ele termina assim (index.html ~linha 3986-3988):

```javascript
      document.getElementById('line-reset-zoom')?.classList.add('hidden');
    }

    function renderRankings() {
```

Inserir `renderMonthlyProfitChart` **entre** o `}` de `renderLineChart` e `function renderRankings`:

```javascript
      document.getElementById('line-reset-zoom')?.classList.add('hidden');
    }

    function renderMonthlyProfitChart() {
      const wrap = document.getElementById('monthly-wrap');
      const empty = document.getElementById('monthly-empty');
      if (!wrap || !empty) return;

      if (App.investments.length === 0) {
        wrap.style.display = 'none';
        empty.style.display = 'flex';
        return;
      }
      wrap.style.display = '';
      empty.style.display = 'none';

      const { labels, data } = getMonthlyProfitData(_projYears);
      const ctx = document.getElementById('monthly-profit-chart').getContext('2d');
      if (App.charts.monthlyProfit) App.charts.monthlyProfit.destroy();

      const gradient = ctx.createLinearGradient(0, 0, 0, 200);
      gradient.addColorStop(0, 'rgba(14,165,233,.25)');
      gradient.addColorStop(1, 'rgba(14,165,233,0)');

      const datasets = [{
        label: 'Lucro mensal',
        data,
        borderColor: '#0EA5E9',
        backgroundColor: gradient,
        fill: true,
        tension: 0,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#38bdf8',
        stepped: true,
      }];

      if (App.useIPCA) {
        const { data: realData } = getMonthlyProfitDataReal(_projYears);
        datasets.push({
          label: 'Real (- IPCA)',
          data: realData,
          borderColor: 'rgba(99,179,237,.7)',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0,
          borderWidth: 1.5,
          borderDash: [5, 3],
          pointRadius: 0,
          pointHoverRadius: 4,
          stepped: true,
          pointHoverBackgroundColor: '#90cdf4',
        });
      }

      App.charts.monthlyProfit = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: App.useIPCA, labels: { color: '#99907c', font: { size: 10 }, boxWidth: 20 } },
            tooltip: {
              mode: 'index', intersect: false,
              callbacks: { label: c => ` ${c.dataset.label}: ${fmtBRL(c.raw)}` }
            },
            zoom: _zoomOptions('monthly-reset-zoom'),
          },
          scales: {
            x: { grid: { color: 'rgba(229,228,226,.05)' }, ticks: { color: '#99907c', font: { size: 10 }, maxTicksLimit: 8 } },
            y: { grid: { color: 'rgba(229,228,226,.05)' }, ticks: { color: '#99907c', font: { size: 10 }, callback: v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'k' : v } }
          },
          animation: { duration: 600 },
        }
      });
      document.getElementById('monthly-reset-zoom')?.classList.add('hidden');
    }

    function renderRankings() {
```

- [ ] **Step 3: Chamar o render dentro de `renderInsights`**

Localizar em `renderInsights` (index.html ~linha 3743-3745):

```javascript
      renderDonutChart();
      renderCompositionChart();
      renderLineChart();
```

Substituir por:

```javascript
      renderDonutChart();
      renderCompositionChart();
      renderLineChart();
      renderMonthlyProfitChart();
```

- [ ] **Step 4: Verificação manual (browser)**

Abrir Insights com ≥1 investimento periódico:
- O gráfico "Projeção de Lucro Mensal" desenha uma linha/área azul.
- Com o toggle de **reinvestimento ligado**, a linha sobe ao longo do tempo; desligado, fica praticamente estável.
- Com **IPCA ligado**, aparece a linha tracejada "Real (− IPCA)" abaixo da nominal e a legenda.
- O valor do primeiro ponto é coerente com o KPI "lucro estimado mensal" da própria tela (`getMonthlyIncomeEst`).
- Zoom/pan e botão "Resetar zoom" funcionam como na patrimonial.
Expected: tudo acima; sem erros no console.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(insights): dados + render do grafico de Projecao de Lucro Mensal"
```

---

## Task 4: Sincronizar horizonte entre os dois gráficos (B3)

**Files:**
- Modify: `index.html` — `setProjectionYears` (~linha 3687-3693).

- [ ] **Step 1: Re-renderizar ambos os gráficos ao trocar o horizonte**

Localizar `setProjectionYears` (index.html ~linha 3687):

```javascript
    function setProjectionYears(y) {
      _projYears = y;
      document.querySelectorAll('.proj-btn').forEach(b => {
        b.className = `proj-btn px-2 py-0.5 rounded text-[11px] ${parseInt(b.dataset.years) === y ? 'bg-primary/10 text-primary' : 'text-secondary/60 hover:text-secondary'}`;
      });
      renderLineChart();
    }
```

Substituir por:

```javascript
    function setProjectionYears(y) {
      _projYears = y;
      document.querySelectorAll('.proj-btn').forEach(b => {
        b.className = `proj-btn px-2 py-0.5 rounded text-[11px] ${parseInt(b.dataset.years) === y ? 'bg-primary/10 text-primary' : 'text-secondary/60 hover:text-secondary'}`;
      });
      renderLineChart();
      renderMonthlyProfitChart();
    }
```

- [ ] **Step 2: Verificação manual (browser)**

Em Insights, clicar nos botões 2a / 5a / 10a / 20a / 30a (em qualquer um dos dois cards):
- **Ambos** os gráficos re-renderizam para o novo horizonte.
- **Ambas** as fileiras de botões (patrimonial + lucro mensal) destacam o ano selecionado simultaneamente.
- Qualquer zoom ativo é limpo (gráfico recriado) e os botões de reset somem.
Expected: tudo acima; sem erros no console.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(insights): botoes de horizonte sincronizam patrimonial + lucro mensal"
```

---

## Task 5: Atualizar STATE.md

**Files:**
- Modify: `STATE.md`

- [ ] **Step 1: Registrar a sessão**

Adicionar entrada no topo de `## Recent Changes` datada `2026-06-11` resumindo: Grupo B — zoom/pan na Projeção Patrimonial (`chartjs-plugin-zoom` + Hammer.js, `_zoomOptions`/`resetChartZoom`, botão reset); novo gráfico "Projeção de Lucro Mensal" (`getMonthlyProfitData`/`getMonthlyProfitDataReal`/`renderMonthlyProfitChart`, espelha a patrimonial com linha real IPCA e zoom); `setProjectionYears`/`renderInsights` re-renderizam ambos. Atualizar a linha do Insights em `## Screen Status`.

- [ ] **Step 2: Commit**

```bash
git add STATE.md
git commit -m "docs: STATE.md — Grupo B (zoom/pan + grafico de lucro mensal)"
```

---

## Notas de execução

- Sem testes unitários (gráficos Chart.js + estado vivo) — usar as verificações manuais de cada task. Para gestos de toque, usar device/emulador real (pinça/pan).
- `chartjs-plugin-zoom` exige Hammer.js para pinça/pan por toque — ambos os CDNs entram na Task 1.
- Conflito desktop drag-zoom × pan: com `zoom.drag` ligado, o arraste do mouse faz zoom-área; o pan por toque (Hammer) atende o mobile. Esse é o combo padrão e é o que o usuário escolheu.
- Commits frequentes, um por task, mensagens em pt-BR como nos commits existentes.
