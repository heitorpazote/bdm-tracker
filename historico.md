# BDM Tracker — Histórico do Projeto

## Visão Geral

**BDM Tracker** é uma Single-Page Application (SPA) de gestão e calendário de investimentos focada na criptomoeda BDM. Todo o projeto está contido em um único arquivo `index.html`, sem build system, sem dependências locais.

**Design System:** Aureus Elite — tema escuro premium com dourado (`#f2ca50`, `#D4AF37`) como cor primária.

---

## Stack Técnica

| Recurso | Detalhe |
|---|---|
| Estrutura | Single HTML file (`index.html`) |
| CSS | TailwindCSS via CDN |
| Gráficos | Chart.js via CDN |
| Fontes | Google Fonts — Inter + Material Symbols |
| Persistência | PostgreSQL — nuvem via Supabase (Row Level Security) |
| Plataforma | Browser — sem servidor, sem backend |

### Tabelas Supabase (com RLS por user_id)
- `investments` — dados dos investimentos cadastrados
- `categories` — categorias criadas pelo usuário
- `events` — eventos de pagamento gerados automaticamente
- `settings` — configurações globais (cotação BDM, IPCA, useIPCA)

---

## Arquitetura de Estado

```js
const App = {
  db: null,
  investments: [],
  categories: [],
  events: [],
  bdmRate: 0,        // cotação BDM em R$
  ipcaRate: 5.0,     // taxa IPCA anual %
  useIPCA: true,     // toggle para usar IPCA na projeção
  currentScreen: 'calendar',
  calView: 'month',  // 'month' | 'year' | 'agenda'
  calDate: new Date(),
  selectedDate: null,
  projectionYears: 5,
  charts: { donut: null, line: null, calc: null },
  editingInvestmentId: null,
};
```

---

## Telas Implementadas

### 1. Calendário (`screen-calendar`)
- **Vista Mês:** grade mensal com dots/bars coloridos por categoria nos dias com eventos
- **Vista Ano:** 12 mini-calendários, células com marcadores de eventos
- **Vista Agenda:** lista cronológica de eventos futuros (até 60 entradas), agrupada por data
- **Painel lateral (desktop):** ao selecionar um dia, exibe detalhes expansíveis de cada transação
- **Modal de dia (mobile):** mesmo conteúdo em modal bottom-sheet

#### Marcadores especiais no calendário
- Dot colorido = investimento com pagamento naquele dia
- Bar colorido = pagamento alto (≥ 1 BDM)
- Ícone de bandeira vermelha + outline vermelho na célula = vencimento/último pagamento do investimento

### 2. Insights (`screen-insights`)
- **KPIs:** Patrimônio Total, Renda Mensal Est., Rentabilidade (nominal + real), Qtd. Investimentos
- **Gráfico Donut:** distribuição do portfólio por categoria
- **Gráfico de Linha — Projeção Patrimonial:** baseado em cash flows reais agendados (degraus), não curva suave
  - Linha dourada = projeção nominal
  - Linha azul tracejada = projeção real descontando IPCA (quando ativado)
- **Ranking ROI:** investimentos ordenados por retorno percentual
- **Milestones:** "Quando vou me tornar milionário/bilionário?" — calculado por logaritmo
- **IPCA:** toggle on/off + campo de taxa; afeta projeção e cálculo de ganho real (Equação de Fisher)
- **Insights Dinâmicos:** concentração de risco, vencimentos próximos, diversificação, performance vs IPCA

### 3. Calculadora (`screen-calculator`)
Parâmetros alinhados com o formulário de adicionar investimento:
- Capital Investido (slider R$1k–R$1M)
- Lucro por Período % (slider 0–50%)
- Frequência de Lucro (select: Mensal/Bimestral/Trimestral/Semestral/No Vencimento/Personalizado)
- Duração em meses (slider 1–360)
- Aportes Mensais (slider R$0–R$50k) — adição exclusiva da calculadora
- Ganho Real usa o IPCA global do app (não tem slider próprio)

---

## Modais

| Modal | Função |
|---|---|
| `modal-investment` | Adicionar / Editar investimento |
| `modal-category` | Gerenciar categorias com color picker |
| `modal-bdm` | Atualizar cotação BDM |
| `modal-day` | Detalhe do dia (mobile) |

---

## Modelo de Investimento

```js
{
  id,            // uid()
  name,          // string
  categoryId,    // string | null
  principal,     // number (R$)
  profitPercentage, // number (% por período)
  startDate,     // 'YYYY-MM-DD'
  frequency,     // 'monthly'|'bimonthly'|'quarterly'|'semiannual'|'at_maturity'|'custom'
  customFrequencyMonths, // number | null
  durationMonths, // number
  showInBDM,     // boolean
}
```

### Geração de Eventos (`generateEvents`)
- Calcula `profitAmt = principal × profitPercentage / 100` (lucro fixo por período)
- Gera um evento por período conforme frequência
- O último evento recebe `principalReturn = principal` (capital retorna ao final)
- Eventos têm `isLastPayment: true` no vencimento

---

## Lógica Financeira

### Yield / Taxa
- `frequencyMonths(frequency, duration, custom)` → número de meses por período
- `getMonthlyIncomeEst()` → renda mensal estimada somando `profitAmt / freqMeses` de cada investimento
- `getAvgMonthlyYield()` → `(rendaMensal / patrimônio) × 100`
- `getAvgAnnualYield()` → `avgMonthly × 12`
- `getRealAnnualYield()` → Equação de Fisher: `(1 + nominal) / (1 + ipca) - 1`

### Projeção Patrimonial
Baseada em eventos reais agendados (cash flows discretos):
- Mapa de `profitByMonth[m]` = soma dos lucros dos eventos no mês-offset `m`
- Acumulação progressiva: `startVal + cumulative_profit`
- Exibição em degrau (`stepped: true` no Chart.js), sem suavização
- Linha real deflaciona cada pagamento por `(1 + ipcaMonthly)^m`

### Milestones (logaritmo)
```js
months = ceil(log(target / patrimony) / log(1 + monthlyRate))
```

### Calculadora
- `freqMonths` determinado pelo select de frequência
- `monthlyRate = (1 + profitPct/100)^(1/freqMonths) - 1`
- FV com juros compostos + aportes mensais
- Ganho real usando `App.ipcaRate` global

---

## Layout Responsivo

### Desktop (≥ md)
- Sidebar fixa à esquerda (`w-60`) com navegação, botão de adicionar, categorias, cotação BDM
- Conteúdo principal com padding-left para compensar a sidebar
- Painel de detalhes lateral no calendário (coluna direita)

### Mobile (< md)
- Bottom nav fixo com 5 botões: **Calendário | Insights | ➕ (FAB dourado, centro) | Calc | Categ.**
- Top bar com título e botão de cotação BDM
- Detalhe do dia em modal bottom-sheet

---

## CSS Classes Customizadas

| Classe | Uso |
|---|---|
| `.fi` | Form inputs — fundo creme `#f5f0e8`, texto preto `#1a150a` |
| `.tog` / `.tog-track` / `.tog-thumb` | Toggle switch estilizado |
| `.cal-cell` | Célula do calendário mensal |
| `.mini-cell` | Célula do mini-calendário anual |
| `.cal-cell.has-maturity` | Outline vermelho no vencimento |
| `.maturity-flag` | Ícone de bandeira no vencimento |
| `.glass-panel` | Painel com glassmorphism |
| `.glass-modal` | Modal com glassmorphism |
| `.premium-card` | Card de conteúdo premium |
| `.txn-row` | Linha de transação clicável (expansível) |
| `.txn-details` | Detalhes expansíveis de uma transação |
| `.gold-glow` | Sombra dourada |
| `.glow-card` | Card com glow dourado |
| `.hero-value` | Valor principal em tamanho grande |

---

## Funções JS Importantes

| Função | Descrição |
|---|---|
| `navigate(screen)` | Troca de tela, atualiza nav ativa |
| `openAddModal()` / `saveInvestment()` | CRUD de investimentos |
| `generateEvents(inv)` | Gera array de eventos para um investimento |
| `buildCell(dk, ...)` | Renderiza célula do calendário mensal |
| `renderDetailPanel(dk)` | Painel lateral desktop com transações expansíveis |
| `openDayModal(dk)` | Modal mobile equivalente |
| `toggleTxnDetails(id)` | Expande/colapsa detalhes de uma transação |
| `renderInsights()` | Renderiza toda a aba Insights |
| `renderLineChart()` | Gráfico de projeção patrimonial (stepped) |
| `renderDonutChart()` | Gráfico donut de distribuição |
| `updateIPCA(val)` | Atualiza taxa IPCA e re-renderiza |
| `toggleIPCA(checked)` | Liga/desliga uso do IPCA |
| `updateCalc()` | Recalcula e re-renderiza calculadora |
| `toggleCalcFreq(sel)` | Mostra/oculta campo de frequência custom na calculadora |
| `toggleCustomFreq(sel)` | Idem no formulário de investimento |
| `calculateMilestone(target)` | Meses para atingir meta (logaritmo) |
| `saveSettings()` | Persiste bdmRate, ipcaRate, useIPCA no Supabase |
| `loadAllData()` | Carrega tudo do Supabase para o usuário atual e atualiza `App.*` |
| `toast(msg, type)` | Notificação toast (success/error/info/warn) |

---

## Histórico de Desenvolvimento

### Sessão 1 — Funcionalidades iniciais
1. **Vista anual do calendário** — mini-calendários com células aumentadas para mostrar dias da semana
2. **Inputs com texto preto** — classe `.fi` com `-webkit-text-fill-color` para corrigir silver/gray no WebKit
3. **Milestones milionário/bilionário** — calculados por logaritmo na aba Insights
4. **Frequência personalizada** — opção "Personalizado" no select de frequência com input de meses

### Sessão 2 — IPCA, vencimento e expansão
1. **Sincronização Insights** — dados sempre via `App.investments`/`App.events` após `loadAllData()`
2. **IPCA como inflação** — toggle on/off; Fisher equation para yield real; gráfico dual (nominal + real)
3. **Bilionário não travava** — substituído loop limitado por fórmula logarítmica sem limite prático
4. **Retorno do principal no vencimento** — `principalReturn` no último evento; flag vermelha no calendário
5. **Transações expansíveis** — clicar no investimento no painel/modal expande detalhes
6. **Fix showInBDM** — filtro `bdmEvts` aplicado em todas as exibições BDM

### Sessão 3 — Correções de bugs e calculadora
1. **`buildCell` hasMaturity** — variável declarada, classe `has-maturity` aplicada corretamente
2. **`toggleIPCA`** — função adicionada (estava referenciada no HTML mas não definida)
3. **`renderAgenda` BDM** — total do dia filtrado por `showInBDM`
4. **Mobile — botão Categorias** — adicionado 5º botão na bottom nav
5. **IPCA sync gráfico** — `getProjectionDataReal` adicionava income; agora alinhado com nominal
6. **Calculadora alinhada** — parâmetros matching formulário: Lucro por Período, Frequência, Duração em meses; IPCA global

### Sessão 4 — Fidelidade de dados e UX
1. **Agenda — valor total** — dia e evento mostram `amount + principalReturn`; detalhamento no último pagamento
2. **Projeção fiel a investimentos** — `getProjectionData` e `getProjectionDataReal` baseados em cash flows reais (stepped), não curva exponencial suave
3. **Mobile — botão amarelo centralizado** — ordem: Calendário | Insights | ➕ | Calc | Categ.

---


### Sessão 5 — Autenticação e Supabase
1. **Supabase Migration** — dados migrados de IndexedDB local para nuvem com PostgreSQL.
2. **Autenticação (Auth)** — Tela de login com validação de email e senha (mínimo 8 caracteres).
3. **Isolamento RLS** — Tabelas `investments`, `categories`, `events` e `settings` isoladas por `user_id`.
4. **Lembrar senha** — Controle se a sessão sobrevive ao fechar a aba (`localStorage`) ou não (`sessionStorage`).
5. **No Email Confirmation** — O sistema faz login direto após o cadastro sem exigir confirmação de e-mail.

## Observações Técnicas

- **Non-breaking space no arquivo:** O arquivo contém U+00A0 em strings como `'R$ '` — edições via Edit tool podem falhar por mismatch de encoding. Usar PowerShell com substituição por índice neste caso.
- **Chart.js destroy:** Sempre chamar `.destroy()` antes de recriar gráficos (`App.charts.donut`, `App.charts.line`, `_calcChart`).
- **Modais:** Controlados por `inline style display:flex/none`, não por classes. Funções `showModal(id)/hideModal(id)`.
- **Supabase Auth & DB:** Usa `supabase-js` com sessão persistente (`localStorage` ou `sessionStorage` dependendo de "Lembrar senha"). RLS garante isolamento via `auth.uid() = user_id`.
- **Sem reinvestimento automático:** O modelo não assume que lucros são reinvestidos. O patrimônio cresce apenas pelos pagamentos recebidos conforme agendado.
