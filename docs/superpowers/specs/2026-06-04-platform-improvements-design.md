# Design: Platform Improvements — June 2026

## Scope

Four independent improvements to the Cripto Tracker SPA:

1. Comparative chart (Ativos × Recorrentes) on Insights screen
2. Tooltip help system across all screens
3. CLAUDE.md + STATE.md for agent memory
4. "Feito por: Heitor Pazote" attribution

---

## 1. Comparative Chart — Ativos × Recorrentes

### What

A new always-visible card on the Insights screen showing the portfolio split between:
- **Recorrentes** (type `periodic`) — investments that generate periodic income
- **Ativos** (type `asset`) — holdings valued by price appreciation only

### Where

New full-width card placed **between** the "Charts Row" and the "Rankings + Milestones" grid, inside `#screen-insights`. On mobile it stacks naturally.

### Visual

A horizontal split bar (two colored segments, proportional to %) with labels and R$ values below each segment. Example:

```
[ ████████████████████░░░░░░░░ ]
  Recorrentes 72%     Ativos 28%
  R$ 18.000           R$ 7.000
```

- Recorrentes color: `#0EA5E9` (primary blue)
- Ativos color: `#F59E0B` (amber)
- When one side is 0%: show full bar in that color with "0%" label on the other side
- When no investments: hide card entirely

### Data

```js
const totalPeriodic = App.investments.filter(i => i.type !== 'asset').reduce((s,i) => s + i.principal, 0);
const totalAsset    = App.investments.filter(i => i.type === 'asset').reduce((s,i) => s + i.principal, 0);
const total = totalPeriodic + totalAsset;
const pctP  = total > 0 ? (totalPeriodic / total * 100) : 0;
const pctA  = total > 0 ? (totalAsset    / total * 100) : 0;
```

### Implementation

- HTML: new `<div id="compare-card">` after the charts row, using `premium-card` class
- JS: new `renderCompareCard()` function called inside `renderInsights()`
- Hide card if `App.investments.length === 0`
- The existing `composition-card` (donut chart) is LEFT AS-IS; this is a new, separate card

### Mobile

- Full-width on all breakpoints
- Bar itself: `h-8 rounded-full overflow-hidden flex`
- Labels below bar: `flex justify-between` — readable at all sizes

---

## 2. Tooltip Help System

### Approach

Small `?` icon button (`ⓘ`) placed inline next to section headers and form field labels.

- **Desktop hover**: CSS tooltip appears (no JS needed for simple cases)
- **Mobile tap**: JS-driven popover that appears below the icon and dismisses on outside click

### Tooltip component pattern

```html
<button class="tooltip-btn" data-tip="Explanation text here">
  <span class="material-symbols-outlined text-[13px] text-secondary/40">help</span>
</button>
```

CSS tooltip (desktop):
```css
.tooltip-btn { position: relative; }
.tooltip-btn::after {
  content: attr(data-tip);
  /* positioned popover styles */
}
```

Mobile: JS attaches `click` listener; creates/removes a `<div class="tip-popover">` in DOM.

### Coverage — Insights screen

| Section | Tooltip text |
|---|---|
| "Portfolio Insights" header | "Análise completa da sua carteira: patrimônio, projeções e rentabilidade." |
| "Patrimônio Investido" KPI | "Soma do capital aplicado em todos os seus investimentos e ativos." |
| "Lucro Mensal Est." KPI | "Estimativa do lucro líquido médio por mês, considerando todos os rendimentos periódicos." |
| "Rentabilidade" KPI | "Taxa de rendimento anual média da carteira (nominal). Com IPCA ativado, mostra também o ganho real." |
| "Distribuição da Carteira" | "Como o capital está dividido entre suas categorias de investimento." |
| "Projeção Patrimonial" | "Simulação de crescimento do patrimônio ao longo do tempo, com ou sem reinvestimento automático." |
| "Composição da Carteira" (new compare card) | "Proporção do capital em investimentos com rendimento periódico versus ativos de valorização." |
| "Ranking de Rentabilidade" | "Seus investimentos ordenados pelo retorno percentual total gerado até agora." |
| "Projeção de Marcos" | "Estimativa de quando seu patrimônio atingirá R$ 1 milhão ou R$ 1 bilhão com reinvestimento." |
| "Insights Automáticos" | "Alertas e observações geradas automaticamente com base no seu perfil de carteira." |
| Inflação IPCA toggle | "Ative para descontar a inflação e ver o ganho real do portfólio." |
| Reinvestimento toggle | "Com reinvestimento ativo, o lucro de cada período é reaplicado no capital, gerando juros sobre juros." |

### Coverage — Investment modal

| Field | Tooltip text |
|---|---|
| "Com Rendimento" tab | "Investimento que paga lucro periodicamente (mensal, trimestral etc.), como CDB, staking, DeFi." |
| "Só Valorização" tab | "Ativo que você segura esperando valorização de preço, como Bitcoin, ações ou imóveis." |
| "Nome do Ativo" | "Identificação do investimento na sua carteira. Ex: BTC Spot, CDB Banco X." |
| "Capital Investido (R$)" | "Valor total aplicado neste investimento, em reais." |
| "Lucro por Período (%)" | "Percentual de rendimento a cada ciclo de pagamento. Ex: 3% ao mês = 3 por período mensal." |
| "Frequência de Lucro" | "Com que frequência você recebe ou acumula o lucro: mensal, trimestral, semestral, etc." |
| "Duração (meses)" | "Por quantos meses este investimento ficará ativo antes de vencer ou ser resgatado." |
| "Exibir em Cripto" | "Mostra o lucro convertido para a criptomoeda configurada, usando a cotação salva." |

### Coverage — Calendar screen (top area)

Add a subtitle/description paragraph below the calendar header explaining briefly what the calendar shows (payment events, maturity dates, etc.).

---

## 3. CLAUDE.md + STATE.md

### CLAUDE.md (project root)

Concise — max 60 lines. Covers:
- Project name, purpose
- Stack: vanilla HTML/CSS/JS, Tailwind CDN, Chart.js, Supabase
- Single-file SPA: `index.html` (~4600 lines)
- Screens: calendar, insights, calculator, AI agent
- Design system: dark theme, `premium-card`, `glass-panel`, `fi` form inputs, `primary` = `#0EA5E9`
- Key JS patterns: `App` global state, `renderInsights()`, `BDMSchedule` module
- How to run: open `index.html` in browser (no build step)
- Supabase: auth + investments/categories/events tables

### STATE.md (project root)

Updated at the END of every session. Structure:

```markdown
# Project State

## Last Updated
YYYY-MM-DD

## Recent Changes
- [date] Description of change

## Screen Status
| Screen | Status | Notes |
| Calendar | stable | |
| Insights | stable | |
| Calculator | stable | |
| AI Agent | stable | |

## Open Issues / TODOs
- ...

## Design Decisions
- ...
```

---

## 4. Attribution — "Feito por: Heitor Pazote"

### Desktop sidebar

Below the user email/logout row at the bottom of `<aside>`:
```html
<div class="text-[10px] text-secondary/30 text-center mt-2 tracking-wide">
  Feito por: Heitor Pazote
</div>
```

### Mobile footer

Inside the mobile `<nav>` element, a thin text row pinned above the nav bar — OR more simply, added as a `text-center` element inside the nav at the very bottom, below the button row. Given space constraints, place it in the desktop sidebar only and in the Calculator/AI screens footer (since those have more white space).

**Decision**: Place ONLY in the desktop sidebar (bottom) and as a subtle footer inside the Insights screen below the last card. Clean and not intrusive on mobile.

---

## Non-Goals

- No changes to Supabase schema
- No changes to Calculator screen logic
- No new authentication flows
- No changes to the AI agent screen

---

## Testing Checklist

- [ ] Compare card renders correctly with only periodic investments
- [ ] Compare card renders correctly with only assets
- [ ] Compare card renders correctly with both types
- [ ] Compare card hidden when no investments
- [ ] All tooltips legible on desktop (hover)
- [ ] All tooltips legible on mobile (tap, dismiss on outside click)
- [ ] Tooltips don't overflow viewport on mobile
- [ ] CLAUDE.md accurately describes project
- [ ] STATE.md created and filled
- [ ] Attribution visible on desktop sidebar
- [ ] Insights screen looks correct on iPhone-size (375px)
- [ ] No regressions on Calendar or Calculator screens
