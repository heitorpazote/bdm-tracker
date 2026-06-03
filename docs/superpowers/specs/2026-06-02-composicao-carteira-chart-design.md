# Composição da Carteira — Design Spec

**Data:** 2026-06-02  
**Status:** Aprovado  
**Scope:** Novo gráfico comparativo Ativos vs Investimentos Recorrentes na aba Insights

---

## Objetivo

Adicionar um card com doughnut chart de 2 segmentos na linha de gráficos do Insights, permitindo ao usuário ver visualmente a divisão percentual do seu patrimônio entre investimentos com rendimento periódico ("Recorrentes") e ativos de valorização sem ganho periódico ("Ativos").

---

## Layout & Placement

### Grid alterado
A seção `<!-- Charts Row -->` muda de `lg:grid-cols-5` para `lg:grid-cols-7`:

| Card | Grid atual | Grid novo |
|---|---|---|
| Distribuição da Carteira (donut) | `lg:col-span-2` | `lg:col-span-2` (inalterado) |
| Projeção Patrimonial (line) | `lg:col-span-3` | `lg:col-span-3` (inalterado) |
| Composição da Carteira (novo) | — | `lg:col-span-2` |

Mobile (`grid-cols-1`): os 3 cards empilham — sem impacto no comportamento existente.

### Estado do card
- **Visível** apenas quando `totalAsset > 0 && totalPeriodic > 0`
- **Oculto** (`hidden` via JS) quando só existe um tipo, pois a comparação perde sentido
- O card existe no HTML mas começa `hidden`; JS adiciona/remove a classe

---

## Conteúdo do Card

```
┌─────────────────────────────┐
│ Composição da Carteira      │
│                             │
│       ╭─────────╮           │
│       │  donut  │ centro:   │
│       │  2 seg  │ R$ total  │
│       ╰─────────╯           │
│                             │
│  ● Recorrentes   72%        │
│    R$ 7.200,00              │
│                             │
│  ● Ativos        28%        │
│    R$ 2.800,00              │
└─────────────────────────────┘
```

**Cores:**
- Recorrentes: `#0EA5E9` (primary — igual aos outros charts)
- Ativos: `#F59E0B` (âmbar — contrasta com o azul sem conflitar com o donut de categorias)

**Centro do donut:** total combinado (`totalPeriodic + totalAsset`) formatado com `fmtBRL()`

**Legenda abaixo:** dois blocos — nome + percentual + valor em R$

**Altura do canvas:** `180px` (igual ao donut existente)

---

## Implementação JS

### Novo campo em `App.charts`
```js
App.charts.composition = null; // adicionar ao objeto inicial
```

### Nova função `renderCompositionChart()`
```
1. Calcular totalPeriodic = soma de principal de investments onde type !== 'asset'
2. Calcular totalAsset = soma de principal de investments onde type === 'asset'
3. Se totalPeriodic === 0 || totalAsset === 0: ocultar card e retornar
4. Mostrar card
5. Destruir App.charts.composition se existir
6. Criar Chart.js doughnut com 2 datasets: [totalPeriodic, totalAsset]
7. Atualizar legenda HTML com valores e percentuais
```

### Integração em `renderInsights()`
Chamar `renderCompositionChart()` logo após `renderDonutChart()`.

### Canvas ID
`composition-chart` (evita conflito com `donut-chart` e `line-chart`)

### Chart handle
`App.charts.composition` (padrão existente de `App.charts.donut` / `App.charts.line`)

---

## HTML

### Card novo (dentro de `<!-- Charts Row -->`)
```html
<div id="composition-card" class="hidden premium-card rounded-xl p-5 lg:col-span-2">
  <h3>Composição da Carteira</h3>
  <div style="height:180px; position:relative">
    <canvas id="composition-chart"></canvas>
    <!-- centro absoluto com total -->
  </div>
  <div id="composition-legend"></div>
</div>
```

---

## Performance

- Nenhuma dependência nova — Chart.js já carregado via CDN
- `App.charts.composition?.destroy()` antes de recriar (previne memory leak)
- Card permanece `hidden` quando não há ambos os tipos — zero canvas render

---

## Responsividade

| Viewport | Comportamento |
|---|---|
| `< 1024px` (mobile/tablet) | Cards empilham (`grid-cols-1`), card aparece entre o line chart e o ranking |
| `≥ 1024px` (desktop) | 3 cards lado a lado na linha de gráficos |
