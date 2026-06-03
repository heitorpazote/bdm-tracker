# Composição da Carteira Chart — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um doughnut chart de 2 segmentos (Recorrentes vs Ativos) na linha de gráficos do Insights, visível apenas quando ambos os tipos de investimento existem.

**Architecture:** Single HTML file (`index.html`). Todas as mudanças são: (1) ajuste de grid + HTML do novo card, (2) adição de `App.charts.composition` e função `renderCompositionChart()`, (3) chamada da função em `renderInsights()`. Segue os padrões já estabelecidos de `renderDonutChart()` e `App.charts.donut`.

**Tech Stack:** Vanilla JS, TailwindCSS CDN, Chart.js CDN (já carregado).

---

## File Map

| Arquivo | O que muda |
|---|---|
| `index.html:1233` | Grid de `lg:grid-cols-5` → `lg:grid-cols-7` |
| `index.html:1292` | Adicionar card `#composition-card` ao final da Charts Row |
| `index.html:1898` | Adicionar `composition: null` em `App.charts` |
| `index.html:3389` | Adicionar chamada `renderCompositionChart()` após `renderDonutChart()` |
| `index.html` (após `renderDonutChart`) | Nova função `renderCompositionChart()` |

---

## Task 1: HTML — atualizar grid e adicionar card

**Files:**
- Modify: `index.html:1233` (grid class)
- Modify: `index.html:1292` (adicionar card após line chart)

- [ ] **Step 1: Atualizar classe do grid da Charts Row**

Localizar linha ~1233:
```html
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
```

Substituir por:
```html
        <div class="grid grid-cols-1 lg:grid-cols-7 gap-4 mb-6">
```

- [ ] **Step 2: Adicionar card `#composition-card` ao final da Charts Row**

Localizar o fechamento da Charts Row (linha ~1292, após o fechamento do card do line chart):
```html
          </div>
        </div>

        <!-- Rankings + Milestones + Insights -->
```

Adicionar antes de `<!-- Rankings + Milestones + Insights -->`:
```html
          <!-- Composition chart -->
          <div id="composition-card" class="hidden premium-card rounded-xl p-5 lg:col-span-2">
            <h3 class="text-sm font-semibold text-on-surface mb-4">Composição da Carteira</h3>
            <div class="relative flex items-center justify-center" style="height:180px">
              <canvas id="composition-chart"></canvas>
              <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span class="text-[10px] text-secondary/60 font-medium uppercase tracking-wider">Total</span>
                <span id="composition-center" class="text-sm font-bold text-on-surface mt-0.5">—</span>
              </div>
            </div>
            <div id="composition-legend" class="flex flex-col gap-3 mt-4"></div>
          </div>
```

- [ ] **Step 3: Verificar HTML no browser**

Abrir `index.html` → Insights. Em desktop (≥1024px): verificar que o grid tem 3 colunas na linha de gráficos. O card `#composition-card` não aparece (está `hidden`) — comportamento correto.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add composition chart card HTML to Insights charts row"
```

---

## Task 2: JS — `App.charts.composition` e `renderCompositionChart()`

**Files:**
- Modify: `index.html:1898` (App.charts)
- Modify: `index.html` — adicionar `renderCompositionChart` após `renderDonutChart`

- [ ] **Step 1: Adicionar `composition: null` em `App.charts`**

Localizar linha ~1898:
```js
      charts: { donut: null, line: null, calc: null },
```

Substituir por:
```js
      charts: { donut: null, line: null, calc: null, composition: null },
```

- [ ] **Step 2: Adicionar função `renderCompositionChart` após `renderDonutChart`**

Localizar o final de `renderDonutChart()` (linha ~3447, termina com `}`).  
Adicionar logo após:

```js
    function renderCompositionChart() {
      const card = document.getElementById('composition-card');
      const legendEl = document.getElementById('composition-legend');
      const centerEl = document.getElementById('composition-center');
      if (!card || !legendEl || !centerEl) return;

      const totalPeriodic = App.investments
        .filter(i => i.type !== 'asset')
        .reduce((s, i) => s + i.principal, 0);
      const totalAsset = App.investments
        .filter(i => i.type === 'asset')
        .reduce((s, i) => s + i.principal, 0);

      if (totalPeriodic === 0 || totalAsset === 0) {
        card.classList.add('hidden');
        if (App.charts.composition) { App.charts.composition.destroy(); App.charts.composition = null; }
        return;
      }

      card.classList.remove('hidden');
      centerEl.textContent = fmtBRL(totalPeriodic + totalAsset);

      const total = totalPeriodic + totalAsset;
      const pctP = (totalPeriodic / total * 100).toFixed(1);
      const pctA = (totalAsset / total * 100).toFixed(1);

      legendEl.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-sm flex-shrink-0" style="background:#0EA5E9"></div>
            <span class="text-xs text-secondary truncate">Recorrentes</span>
          </div>
          <div class="text-right ml-2">
            <span class="text-xs font-semibold text-on-surface tabular-nums">${pctP}%</span>
            <span class="text-[10px] text-secondary/50 tabular-nums block">${fmtBRL(totalPeriodic)}</span>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-sm flex-shrink-0" style="background:#F59E0B"></div>
            <span class="text-xs text-secondary truncate">Ativos</span>
          </div>
          <div class="text-right ml-2">
            <span class="text-xs font-semibold text-on-surface tabular-nums">${pctA}%</span>
            <span class="text-[10px] text-secondary/50 tabular-nums block">${fmtBRL(totalAsset)}</span>
          </div>
        </div>`;

      const ctx = document.getElementById('composition-chart').getContext('2d');
      if (App.charts.composition) App.charts.composition.destroy();

      App.charts.composition = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Recorrentes', 'Ativos'],
          datasets: [{
            data: [totalPeriodic, totalAsset],
            backgroundColor: ['#0EA5E9', '#F59E0B'],
            borderColor: '#09090b',
            borderWidth: 3,
          }]
        },
        options: {
          cutout: '68%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (c) => ` ${c.label}: ${fmtBRL(c.raw)} (${(c.raw / total * 100).toFixed(1)}%)`
              }
            }
          },
          animation: { duration: 600 },
        }
      });
    }
```

- [ ] **Step 3: Verificar no browser — com ambos os tipos**

Abrir Insights com pelo menos 1 investimento recorrente e 1 ativo cadastrado.
Esperado:
- Card `#composition-card` aparece como 3º item na linha de gráficos (desktop)
- Donut com 2 segmentos (azul = recorrentes, âmbar = ativos)
- Centro exibe total combinado em R$
- Legenda exibe % e R$ de cada tipo
- Tooltip ao hover mostra valor e % do segmento

- [ ] **Step 4: Verificar no browser — sem ativos**

Com apenas investimentos recorrentes (nenhum ativo):
Esperado: card `#composition-card` permanece oculto (`hidden`).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add renderCompositionChart function and App.charts.composition handle"
```

---

## Task 3: Wire up — chamar `renderCompositionChart` em `renderInsights`

**Files:**
- Modify: `index.html:3389` (bloco de charts em `renderInsights`)

- [ ] **Step 1: Adicionar chamada após `renderDonutChart()`**

Localizar (linha ~3388):
```js
      // Charts
      renderDonutChart();
      renderLineChart();
```

Substituir por:
```js
      // Charts
      renderDonutChart();
      renderCompositionChart();
      renderLineChart();
```

- [ ] **Step 2: Verificar re-render ao navegar**

1. Abrir Insights com ambos os tipos → card aparece ✓
2. Navegar para Calendário → voltar para Insights → card ainda aparece corretamente (sem memory leak, sem double-render) ✓
3. Abrir Insights com apenas recorrentes → card oculto ✓
4. Adicionar um ativo → voltar ao Insights → card aparece ✓

- [ ] **Step 3: Verificar responsividade mobile**

Redimensionar para < 1024px (ou abrir DevTools → mobile):
- Os 3 cards da Charts Row devem empilhar verticalmente
- Card de composição aparece entre o line chart e os rankings
- Donut se ajusta ao container menor

- [ ] **Step 4: Commit final**

```bash
git add index.html
git commit -m "feat: wire renderCompositionChart into renderInsights

Composition chart shows % split between recurring investments and
assets. Hidden when only one type exists.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Checklist Final

- [ ] Grid atualizado para `lg:grid-cols-7`
- [ ] Card `#composition-card` aparece como 3º item em desktop
- [ ] Card oculto quando não há ambos os tipos
- [ ] Donut com 2 segmentos (azul recorrentes, âmbar ativos)
- [ ] Centro do donut exibe total combinado em R$
- [ ] Legenda exibe % e R$ de cada tipo
- [ ] Tooltip funcional ao hover
- [ ] Re-render correto ao navegar entre telas
- [ ] Sem memory leak (chart destruído antes de recriar)
- [ ] Mobile: cards empilham e donut se ajusta
