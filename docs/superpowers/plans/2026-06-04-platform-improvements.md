# Platform Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar sistema de tooltips explicativos, CLAUDE.md + STATE.md para memória do agente, e atribuição "Feito por: Heitor Pazote" — item 1 (gráfico comparativo) já implementado.

**Architecture:** SPA single-file (`index.html`, ~4600 linhas). Tooltips via CSS (hover desktop) + JS (tap mobile). Novos arquivos CLAUDE.md e STATE.md na raiz do projeto.

**Tech Stack:** HTML/CSS/JS vanilla, Tailwind CDN, Chart.js, Supabase. Sem build step — abrir `index.html` no browser.

---

## Tooltip HTML Pattern (referência global)

Usado em todas as Tasks 2-5. Inserir inline após o label/heading que precisa de tooltip:

```html
<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300">help_outline</span><span class="tip-box">TEXTO AQUI</span></span>
```

---

## Task 1: Tooltip CSS + JS Infrastructure

**Files:**
- Modify: `index.html` (CSS antes de `</style>` linha ~771; JS antes do comentário `// INIT` linha ~4519)

- [ ] **Step 1: Adicionar CSS de tooltips** — inserir o bloco abaixo imediatamente antes de `  </style>` (linha 771):

```css
    /* Tooltips */
    .has-tip {
      position: relative;
      display: inline-flex;
      align-items: center;
      vertical-align: middle;
    }
    .tip-icon {
      color: rgba(208,197,175,0.35);
      font-size: 13px !important;
      cursor: help;
      transition: color .15s;
      line-height: 1;
    }
    .has-tip:hover .tip-icon { color: rgba(208,197,175,0.75); }
    .tip-box {
      display: none;
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      background: #231f17;
      border: 1px solid rgba(229,228,226,0.18);
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 11px;
      line-height: 1.55;
      color: #d0c5af;
      width: 220px;
      z-index: 500;
      pointer-events: none;
      box-shadow: 0 8px 24px rgba(0,0,0,0.45);
      text-align: left;
      font-weight: 400;
      white-space: normal;
    }
    .tip-box::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 5px solid transparent;
      border-top-color: rgba(229,228,226,0.18);
    }
    @media (hover: hover) {
      .has-tip:hover .tip-box { display: block; }
    }
    .has-tip.tip-open .tip-box { display: block; }
```

- [ ] **Step 2: Adicionar JS de tooltips** — inserir o bloco abaixo imediatamente antes do comentário `// INIT` (linha ~4519):

```js
    // =========================================================
    // TOOLTIPS (mobile tap support)
    // =========================================================
    function initTooltips() {
      document.addEventListener('click', function(e) {
        const icon = e.target.closest('.tip-icon');
        if (icon) {
          const parent = icon.closest('.has-tip');
          if (!parent) return;
          const isOpen = parent.classList.contains('tip-open');
          document.querySelectorAll('.has-tip.tip-open').forEach(el => el.classList.remove('tip-open'));
          if (!isOpen) parent.classList.add('tip-open');
          e.stopPropagation();
          return;
        }
        document.querySelectorAll('.has-tip.tip-open').forEach(el => el.classList.remove('tip-open'));
      });
    }

```

- [ ] **Step 3: Chamar `initTooltips()` no init** — dentro da função `init()` (linha ~4522), adicionar a chamada. Localizar a linha:

```js
    async function init() {
      try {
```

Substituir por:

```js
    async function init() {
      initTooltips();
      try {
```

- [ ] **Step 4: Verificar no browser** — Abrir `index.html`. Nenhum erro no console. Estrutura CSS e JS carregados sem quebrar layout.

- [ ] **Step 5: Commit**

```
git add index.html
git commit -m "feat: add tooltip CSS/JS infrastructure"
```

---

## Task 2: Tooltips — Insights: controles + KPIs

**Files:**
- Modify: `index.html` (linhas ~1145–1229, seção Insights)

- [ ] **Step 1: Tooltip no título "Portfolio Insights"** — localizar:

```html
            <h1 class="text-2xl md:text-3xl font-semibold text-on-surface tracking-tight">Portfolio Insights</h1>
```

Substituir por:

```html
            <h1 class="text-2xl md:text-3xl font-semibold text-on-surface tracking-tight flex items-center gap-2">Portfolio Insights<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300">help_outline</span><span class="tip-box">Análise completa da sua carteira: patrimônio total, projeções de crescimento e rentabilidade comparada à inflação.</span></span></h1>
```

- [ ] **Step 2: Tooltip no toggle "Inflação IPCA"** — localizar:

```html
              <span class="text-[10px] font-semibold tracking-wider uppercase text-secondary/60">Inflação IPCA</span>
```

Substituir por:

```html
              <span class="text-[10px] font-semibold tracking-wider uppercase text-secondary/60 flex items-center gap-1">Inflação IPCA<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300">help_outline</span><span class="tip-box">Ative para considerar a inflação (IPCA) e ver o ganho real do portfólio, descontando a perda de poder de compra.</span></span></span>
```

- [ ] **Step 3: Tooltip no toggle "Considerar Reinvestimento"** — localizar:

```html
              <span class="text-[10px] font-semibold tracking-wider uppercase text-secondary/60">Considerar
                Reinvestimento</span>
```

Substituir por:

```html
              <span class="text-[10px] font-semibold tracking-wider uppercase text-secondary/60 flex items-center gap-1">Considerar Reinvestimento<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300">help_outline</span><span class="tip-box">Com reinvestimento ativo, o lucro de cada ciclo é somado ao capital e rende juros sobre juros nos próximos períodos.</span></span></span>
```

- [ ] **Step 4: Tooltip no KPI "Patrimônio Investido"** — localizar:

```html
              <span class="text-[10px] font-semibold tracking-wider uppercase text-secondary/70">Patrimônio
                Investido</span>
```

Substituir por:

```html
              <span class="text-[10px] font-semibold tracking-wider uppercase text-secondary/70 flex items-center gap-1">Patrimônio Investido<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300">help_outline</span><span class="tip-box">Soma do capital aplicado em todos os investimentos e ativos cadastrados. Não inclui lucros ainda não realizados.</span></span></span>
```

- [ ] **Step 5: Tooltip no KPI "Lucro Mensal Est."** — localizar:

```html
              <span class="text-[10px] font-semibold tracking-wider uppercase text-secondary/70">Lucro Mensal
                Est.</span>
```

Substituir por:

```html
              <span class="text-[10px] font-semibold tracking-wider uppercase text-secondary/70 flex items-center gap-1">Lucro Mensal Est.<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300">help_outline</span><span class="tip-box">Estimativa do lucro líquido médio por mês gerado pelos investimentos com rendimento periódico. Já desconta o deságio de 10% no saque.</span></span></span>
```

- [ ] **Step 6: Tooltip no KPI "Rentabilidade"** — localizar:

```html
              <span class="text-[10px] font-semibold tracking-wider uppercase text-secondary/70">Rentabilidade</span>
```

Substituir por:

```html
              <span class="text-[10px] font-semibold tracking-wider uppercase text-secondary/70 flex items-center gap-1">Rentabilidade<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300">help_outline</span><span class="tip-box">Taxa de rendimento anual média da carteira (nominal). Com IPCA ativado, exibe também o ganho real descontada a inflação.</span></span></span>
```

- [ ] **Step 7: Verificar no browser** — Navegar para a aba Insights. Passar mouse (desktop) ou tocar (mobile) nos ícones `?` dos 5 elementos. Tooltip deve aparecer com texto correto e sem overflow.

- [ ] **Step 8: Commit**

```
git add index.html
git commit -m "feat: add tooltips to Insights KPIs and controls"
```

---

## Task 3: Tooltips — Insights: gráficos, ranking, marcos

**Files:**
- Modify: `index.html` (linhas ~1233–1368)

- [ ] **Step 1: Tooltip em "Distribuição da Carteira"** — localizar:

```html
            <h3 class="text-sm font-semibold text-on-surface mb-4">Distribuição da Carteira</h3>
```

Substituir por:

```html
            <h3 class="text-sm font-semibold text-on-surface mb-4 flex items-center gap-1">Distribuição da Carteira<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300">help_outline</span><span class="tip-box">Como o capital está dividido entre as categorias de investimento que você criou.</span></span></h3>
```

- [ ] **Step 2: Tooltip em "Projeção Patrimonial"** — localizar:

```html
                <h3 class="text-sm font-semibold text-on-surface">Projeção Patrimonial</h3>
```

Substituir por:

```html
                <h3 class="text-sm font-semibold text-on-surface flex items-center gap-1">Projeção Patrimonial<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300">help_outline</span><span class="tip-box">Simulação de crescimento do patrimônio ao longo do tempo. Com reinvestimento ativo, o lucro de cada ciclo é composto. Selecione o horizonte com os botões 2a–30a.</span></span></h3>
```

- [ ] **Step 3: Tooltip em "Ranking de Rentabilidade"** — localizar:

```html
            <h3 class="text-sm font-semibold text-on-surface mb-4">Ranking de Rentabilidade</h3>
```

Substituir por:

```html
            <h3 class="text-sm font-semibold text-on-surface mb-4 flex items-center gap-1">Ranking de Rentabilidade<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300">help_outline</span><span class="tip-box">Seus investimentos ordenados pelo retorno percentual total já gerado, do maior para o menor.</span></span></h3>
```

- [ ] **Step 4: Tooltip em "Projeção de Marcos"** — localizar:

```html
                <h3 class="text-sm font-semibold text-on-surface">Projeção de Marcos</h3>
```

Substituir por:

```html
                <h3 class="text-sm font-semibold text-on-surface flex items-center gap-1">Projeção de Marcos<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300">help_outline</span><span class="tip-box">Estimativa de quando seu patrimônio atingirá R$ 1 milhão e R$ 1 bilhão, considerando reinvestimento automático ao vencimento.</span></span></h3>
```

- [ ] **Step 5: Tooltip em "Insights Automáticos"** — localizar:

```html
              <h3 class="text-sm font-semibold text-on-surface mb-4">Insights Automáticos</h3>
```

Substituir por:

```html
              <h3 class="text-sm font-semibold text-on-surface mb-4 flex items-center gap-1">Insights Automáticos<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300">help_outline</span><span class="tip-box">Alertas e observações geradas automaticamente com base no seu perfil de carteira: concentração de risco, vencimentos próximos e comparação com a inflação.</span></span></h3>
```

- [ ] **Step 6: Verificar no browser** — Conferir todos os tooltips da seção de gráficos e cards inferiores. Verificar mobile: tocar no `?`, tooltip abre; tocar fora, fecha.

- [ ] **Step 7: Commit**

```
git add index.html
git commit -m "feat: add tooltips to Insights charts and bottom sections"
```

---

## Task 4: Tooltips — Modal de Investimento

**Files:**
- Modify: `index.html` (linhas ~1657–1765, dentro de `#modal-investment`)

- [ ] **Step 1: Tooltip na aba "Com Rendimento"** — localizar:

```html
            Com Rendimento
          </button>
```

Substituir por:

```html
            Com Rendimento<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300;font-size:11px">help_outline</span><span class="tip-box">Investimento que paga lucro periodicamente (mensal, trimestral etc.), como CDB, staking ou DeFi com rendimento fixo.</span></span>
          </button>
```

- [ ] **Step 2: Tooltip na aba "Só Valorização"** — localizar:

```html
            Só Valorização
          </button>
```

Substituir por:

```html
            Só Valorização<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300;font-size:11px">help_outline</span><span class="tip-box">Ativo que você segura esperando valorização de preço, sem rendimento periódico. Ex: Bitcoin spot, ações, imóveis.</span></span>
          </button>
```

- [ ] **Step 3: Tooltip no label "Nome do Ativo"** — localizar:

```html
          <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 block mb-1.5">Nome do
            Ativo *</label>
```

Substituir por:

```html
          <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 mb-1.5 flex items-center gap-1">Nome do Ativo *<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300">help_outline</span><span class="tip-box">Identificação do investimento na sua carteira. Ex: BTC Spot, CDB Banco X, USDT DeFi.</span></span></label>
```

- [ ] **Step 4: Tooltip no label "Capital Investido (R$)"** — localizar:

```html
              <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 block mb-1.5">Capital
                Investido (R$) *</label>
```

Substituir por:

```html
              <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 mb-1.5 flex items-center gap-1">Capital Investido (R$) *<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300">help_outline</span><span class="tip-box">Valor total em reais que você aplicou neste investimento. Não inclua lucros — apenas o capital inicial.</span></span></label>
```

- [ ] **Step 5: Tooltip no label "Lucro por Período (%)"** — localizar:

```html
              <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 block mb-1.5">Lucro por
                Período (%) *</label>
```

Substituir por:

```html
              <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 mb-1.5 flex items-center gap-1">Lucro por Período (%) *<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300">help_outline</span><span class="tip-box">Percentual de rendimento a cada ciclo de pagamento. Ex: se paga 3% ao mês, insira 3. Se paga 10% a cada trimestre, insira 10 e selecione Trimestral.</span></span></label>
```

- [ ] **Step 6: Tooltip no label "Frequência de Lucro"** — localizar:

```html
              <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 block mb-1.5">Frequência
                de Lucro *</label>
```

Substituir por:

```html
              <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 mb-1.5 flex items-center gap-1">Frequência de Lucro *<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300">help_outline</span><span class="tip-box">Com que frequência este investimento paga ou acumula lucro. Selecione "No Vencimento" se o lucro só é liberado no final do prazo.</span></span></label>
```

- [ ] **Step 7: Tooltip no label "Duração (meses)"** — localizar:

```html
              <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 block mb-1.5">Duração
                (meses) *</label>
```

Substituir por:

```html
              <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 mb-1.5 flex items-center gap-1">Duração (meses) *<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300">help_outline</span><span class="tip-box">Por quantos meses este investimento ficará ativo. Ex: 12 para um CDB de 1 ano. Após o vencimento, o sistema para de gerar eventos no calendário.</span></span></label>
```

- [ ] **Step 8: Tooltip em "Exibir em Cripto"** — localizar:

```html
            <div class="text-sm font-medium text-on-surface">Exibir em Cripto</div>
            <div class="text-xs text-secondary/60 mt-0.5">Mostra o lucro convertido em Cripto</div>
```

Substituir por:

```html
            <div class="text-sm font-medium text-on-surface flex items-center gap-1">Exibir em Cripto<span class="has-tip ml-1 flex-shrink-0 inline-flex"><span class="material-symbols-outlined tip-icon" style="font-variation-settings:'wght' 300">help_outline</span><span class="tip-box">Quando ativado, o lucro deste investimento será exibido convertido para a criptomoeda configurada (usando a cotação salva na barra lateral).</span></span></div>
            <div class="text-xs text-secondary/60 mt-0.5">Mostra o lucro convertido em Cripto</div>
```

- [ ] **Step 9: Verificar no browser** — Abrir modal de novo investimento. Verificar tooltips em todos os campos. Verificar que os campos continuam funcionando (submit, validação). Testar no mobile.

- [ ] **Step 10: Commit**

```
git add index.html
git commit -m "feat: add tooltips to investment modal fields"
```

---

## Task 5: Descrição da tela Calendário

**Files:**
- Modify: `index.html` (linha ~1026)

- [ ] **Step 1: Expandir descrição do calendário** — localizar:

```html
                <p class="text-xs text-secondary mt-0.5">Visão geral de rendimentos</p>
```

Substituir por:

```html
                <p class="text-xs text-secondary mt-0.5">Cada dia marcado representa um pagamento de lucro agendado. Clique em um dia para ver o detalhamento dos rendimentos.</p>
```

- [ ] **Step 2: Verificar no browser** — A descrição aparece abaixo do título do mês no calendário, sem quebrar o layout do header em mobile.

- [ ] **Step 3: Commit**

```
git add index.html
git commit -m "feat: add calendar section description"
```

---

## Task 6: Criar CLAUDE.md

**Files:**
- Create: `CLAUDE.md` (raiz do projeto)

- [ ] **Step 1: Criar arquivo**

Criar `CLAUDE.md` na raiz com o conteúdo:

```markdown
# Cripto Tracker — CLAUDE.md

## O Projeto
SPA de gestão de investimentos em cripto/DeFi. Usuário cadastra investimentos e ativos, o sistema gera calendário de rendimentos e analytics.

## Stack
- **Single file:** `index.html` (~4600 linhas) — HTML + CSS inline + JS inline
- **CSS:** Tailwind CDN (dark mode class), custom CSS no `<style>`
- **Charts:** Chart.js 4.4 (CDN)
- **Backend:** Supabase (auth + DB)
- **Sem build step** — abrir `index.html` no browser

## Telas (navegação via `navigate(screen)`)
| Tela | ID | Descrição |
|---|---|---|
| Calendário | `calendar` | Calendário mensal de eventos de rendimento |
| Insights | `insights` | Analytics: KPIs, gráficos, projeções, marcos |
| Calculadora | `calculator` | Simulador de investimento |
| Agente IA | `ai` | Chat com Supabase Edge Function |

## Design System
- **Background:** `#09090b` / **Surface:** `#18181b`
- **Primary:** `#0EA5E9` (azul) / **Amber:** `#F59E0B`
- **Texto:** `#eae1d4` (on-surface) / `#c7c6c4` (secondary)
- **Cards:** classe `premium-card` / modais: `glass-modal`
- **Inputs:** classe `fi` / Toggles: `.tog`
- **Font:** Inter (Google Fonts)

## Estado Global
```js
App = {
  investments: [],   // {id, name, type, principal, profitPercentage, durationMonths, startDate, categoryId, ...}
  events: [],        // {id, investmentId, date, amount, isLastPayment}
  categories: [],    // {id, name, color}
  bdmRate: null,     // cotação cripto em R$
  useIPCA: true,
  ipcaRate: 5.0,
  reinvestInsights: true,
  charts: {}         // instâncias Chart.js
}
```

## Tipos de Investimento
- `periodic` — paga lucro periodicamente (padrão)
- `asset` — ativo de valorização, sem rendimento periódico

## Módulo BDMSchedule (em `js/schedule.js`)
- `computeSchedule(inv, opts)` — calcula numPeriods, interval, netPerPeriod
- `WITHDRAWAL_DESAGIO = 0.10` — deságio de 10% nos saques

## Supabase
- Tabelas: `investments`, `categories`, `events`
- Auth: email/password via `sb.auth`
- Regras RLS ativas — cada usuário vê só seus dados

## Padrões de Renderização
- Cada tela tem `render<Screen>()` — ex: `renderInsights()`, `renderCalendar()`
- Charts são destruídos e recriados em `App.charts.<name>`
- Chamar `renderInsights()` sempre que dados mudarem e a tela estiver ativa

## Como Testar
Abrir `index.html` no browser. Não há servidor local necessário para UI (Supabase é remoto).
Para testar autenticado: usar credenciais reais ou configurar usuário no Supabase dashboard.
```

- [ ] **Step 2: Verificar** — Ler o arquivo criado e confirmar que não há erros de formatação Markdown.

- [ ] **Step 3: Commit**

```
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md for agent context"
```

---

## Task 7: Criar STATE.md

**Files:**
- Create: `STATE.md` (raiz do projeto)

- [ ] **Step 1: Criar arquivo**

Criar `STATE.md` na raiz:

```markdown
# Project State

## Last Updated
2026-06-04

## Recent Changes
- 2026-06-04: Gráfico comparativo Ativos × Recorrentes adicionado na tela Insights
- 2026-06-04: Sistema de tooltips (ícone ?) adicionado em Insights e modal de investimento
- 2026-06-04: Descrição adicionada no header do Calendário
- 2026-06-04: Atribuição "Feito por: Heitor Pazote" adicionada
- 2026-06-04: CLAUDE.md e STATE.md criados

## Screen Status
| Tela | Status | Observações |
|---|---|---|
| Calendário | stable | Descrição do header expandida |
| Insights | stable | Novo gráfico comparativo + tooltips |
| Calculadora | stable | Sem alterações recentes |
| Agente IA | stable | Sem alterações recentes |

## Open Issues / TODOs
- Nenhum pendente

## Design Decisions
- Tooltips: CSS hover (desktop) + JS tap (mobile) via classe `.tip-open`
- Gráfico comparativo: barra horizontal split, always-visible, full-width
- Atribuição: sidebar desktop (bottom) + Insights screen (footer)
- CLAUDE.md: max ~60 linhas, objetivo e sem redundância com o código
```

> **Instrução ao agente:** Ao final de cada sessão de trabalho, ATUALIZAR este arquivo com as mudanças feitas, novos TODOs e decisões tomadas.

- [ ] **Step 2: Commit**

```
git add STATE.md
git commit -m "docs: add STATE.md for session memory"
```

---

## Task 8: Atribuição "Feito por: Heitor Pazote"

**Files:**
- Modify: `index.html` (sidebar desktop ~linha 1001; Insights screen ~linha 1382)

- [ ] **Step 1: Adicionar no sidebar desktop** — localizar:

```html
    </nav>

    <!-- BDM Rate widget -->
```

Substituir por:

```html
    </nav>

    <!-- Attribution -->
    <div class="px-3 mb-2 text-center">
      <span class="text-[10px] text-secondary/25 tracking-wide select-none">Feito por: Heitor Pazote</span>
    </div>

    <!-- BDM Rate widget -->
```

- [ ] **Step 2: Adicionar no Insights screen (mobile-visible)** — localizar o fechamento da tela Insights:

```html
        <!-- Ativos em Carteira -->
        <div id="assets-section" class="hidden mt-4">
          <div class="premium-card rounded-xl p-5">
```

Substituir por:

```html
        <!-- Ativos em Carteira -->
        <div id="assets-section" class="hidden mt-4">
          <div class="premium-card rounded-xl p-5">
```

Localizar o fechamento do Insights screen (a tag `</div>` que fecha `<div class="p-4 md:p-8 max-w-[1200px] mx-auto w-full">`):

```html
        </div>
      </div>
    </div>

    <!-- ============================================================
       SCREEN: CALCULADORA
```

Substituir por:

```html
        </div>
        <!-- Attribution (visible on mobile) -->
        <div class="md:hidden mt-6 pb-2 text-center">
          <span class="text-[10px] text-secondary/25 tracking-wide select-none">Feito por: Heitor Pazote</span>
        </div>
      </div>
    </div>

    <!-- ============================================================
       SCREEN: CALCULADORA
```

- [ ] **Step 3: Verificar no browser** — Desktop: atribuição aparece no sidebar, discreta, abaixo do botão "Novo Ativo". Mobile: atribuição aparece no rodapé da tela Insights, não no rodapé das outras telas.

- [ ] **Step 4: Commit**

```
git add index.html
git commit -m "feat: add 'Feito por: Heitor Pazote' attribution"
```

---

## Self-Review

### Spec Coverage
- [x] Tooltip help system — Tasks 1-5
- [x] CLAUDE.md — Task 6
- [x] STATE.md — Task 7
- [x] Attribution — Task 8
- [x] Mobile support — coberto em cada task (CSS `@media (hover: hover)` + JS tap)
- [x] Gráfico comparativo — **já implementado**, fora deste plano

### Placeholder Scan
- Nenhum TBD, TODO ou "similar to task N" encontrado.

### Type Consistency
- Função `initTooltips()` definida em Task 1, chamada em Task 1 — consistente.
- Classes CSS `.has-tip`, `.tip-icon`, `.tip-box`, `.tip-open` definidas em Task 1, usadas em Tasks 2-5 — consistente.
