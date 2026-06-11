# Grupo B — Insights / Gráficos (zoom-pan patrimonial + projeção de lucro mensal)

**Data:** 2026-06-11
**Escopo:** Segundo de quatro grupos (A ✅ → **B** → C → D). Este spec cobre **apenas o Grupo B**.
Grupos C (tela de Configurações) e D (aviso de finalização) terão specs próprios.

## Contexto

Arquivo único `index.html` (~5400 linhas, HTML+CSS+JS inline). Charts via **Chart.js 4.4 (CDN)**,
sem build step. A tela Insights já tem a **Projeção Patrimonial**: `renderLineChart()` desenha um
`Chart` tipo `line` no canvas `#line-chart` (instância `App.charts.line`), alimentado por
`getProjectionData(years)` (nominal) e `getProjectionDataReal(years)` (deflacionado por IPCA), ambos
derivando de `buildProfitByMonth(totalMonths, reinvest, spread?)`. O horizonte é controlado por
`setProjectionYears(y)` → `_projYears` (botões `.proj-btn` 2a/5a/10a/20a/30a). `buildProfitByMonth`
com `spread=true` distribui o lucro de cada período pelos meses do intervalo (renda mensal suave).

## Itens

### B1 — Zoom/pan na Projeção Patrimonial

**Objetivo:** permitir dar zoom específico e mover (pan) o gráfico pelo período desejado, além dos
botões de horizonte.

**Dependência:** adicionar o plugin oficial `chartjs-plugin-zoom` via CDN, imediatamente após o
`<script>` do Chart.js (auto-registra no Chart global quando carregado por UMD; sem build step).

**Helper compartilhado `_zoomOptions(resetBtnId)`** retorna a config de zoom para `plugins.zoom`:
- `pan: { enabled: true, mode: 'x' }`
- `zoom: { wheel: { enabled: true, modifierKey: 'ctrl' }, pinch: { enabled: true }, drag: { enabled: true }, mode: 'x' }`
- `onZoomComplete`/`onPanComplete`: tornam visível o botão de reset cujo id é `resetBtnId`.

Zoom sempre no eixo **x** (tempo). Mobile: pinça para zoom, arraste para pan. Desktop: arrastar
seleciona área de zoom; roda do mouse só com **Ctrl** pressionado (evita sequestrar o scroll da
página).

**`renderLineChart()`:** acrescentar `zoom: _zoomOptions('line-reset-zoom')` em `options.plugins`.
Adicionar no cabeçalho do card um botão `#line-reset-zoom` (oculto por padrão, `hidden`) que chama
`App.charts.line.resetZoom()` e volta a se ocultar. Os botões de horizonte 2a–30a permanecem (definem
o range de dados; o zoom navega dentro do range renderizado).

**Critério de sucesso:** pinça/arraste no mobile e arraste/Ctrl+roda no desktop dão zoom/pan no eixo
do tempo; o botão "Resetar zoom" aparece quando há zoom/pan ativo e some ao resetar; trocar o
horizonte (2a–30a) re-renderiza e limpa o zoom.

### B2 — Novo gráfico "Projeção de Lucro Mensal"

**Objetivo:** gráfico no mesmo formato da Projeção Patrimonial (linha/área), porém plotando o **lucro
estimado mensal** (quanto cai por mês) ao longo do horizonte — cresce ao longo do tempo quando o
reinvestimento está ligado.

**HTML:** novo card `premium-card` (full width, `lg:col-span-3`) logo **abaixo** do card da Projeção
Patrimonial, contendo: título "Projeção de Lucro Mensal" (+ tooltip explicativo no padrão `has-tip`),
selo de reinvestimento (igual ao da patrimonial), uma fileira própria de botões de horizonte
(`.proj-btn` com `data-years`, sincronizados pelo loop existente em `setProjectionYears`), botão
`#monthly-reset-zoom` (oculto), empty-state `#monthly-empty` e wrapper `#monthly-wrap` (height 200px)
com canvas `#monthly-profit-chart`.

**Dados — duas funções novas, ao lado das patrimoniais:**
- `getMonthlyProfitData(years)` — nominal. `totalMonths = years*12`; `step = years<=2?1:years<=5?3:6`;
  `profitByMonth = buildProfitByMonth(totalMonths, App.reinvestInsights, true)` (spread). Para cada
  `i` de 0 a `totalMonths` em passos de `step`: label = mês/ano (mesmo formato da patrimonial),
  `data.push(Math.round(profitByMonth[i] || 0))`. **Não acumula** (é o lucro do mês, não o patrimônio).
- `getMonthlyProfitDataReal(years)` — real. Igual, mas `ipcaMensal = (1+App.ipcaRate/100)^(1/12)-1`;
  para cada ponto `i`: `data.push(Math.round((profitByMonth[i] || 0) / Math.pow(1+ipcaMensal, i)))`.

**`renderMonthlyProfitChart()`** espelha `renderLineChart()`:
- Empty-state: se `App.investments.length === 0`, esconde `#monthly-wrap`, mostra `#monthly-empty`.
- Destrói/recria `App.charts.monthlyProfit`.
- Dataset nominal "Lucro mensal" (linha azul `#0EA5E9` + área gradiente, `stepped:true`, `pointRadius:0`).
- Se `App.useIPCA`: dataset tracejado "Real (− IPCA)" com dados de `getMonthlyProfitDataReal`,
  mesmo estilo da linha real da patrimonial.
- Eixo y com o mesmo `callback` de formatação (k/M) da patrimonial; tooltip `mode:'index'` com `fmtBRL`.
- `plugins.zoom: _zoomOptions('monthly-reset-zoom')`.

**Critério de sucesso:** o novo gráfico mostra o lucro mensal estimado; com reinvestimento **ligado**
as linhas crescem ao longo do tempo; com IPCA **ligado** aparece a linha tracejada real; zoom/pan e
reset funcionam como na patrimonial; os números do ponto inicial batem com o KPI "lucro estimado
mensal" (`getMonthlyIncomeEst`) da própria tela.

### B3 — Integração / controles compartilhados

- `setProjectionYears(y)` passa a re-renderizar **os dois** gráficos: chamar `renderLineChart()` **e**
  `renderMonthlyProfitChart()`. O loop `document.querySelectorAll('.proj-btn')` já estiliza ambas as
  fileiras de botões (patrimonial + novo card) por terem a mesma classe/`data-years`.
- Onde `renderInsights()` chama `renderLineChart()`, passar a chamar também
  `renderMonthlyProfitChart()`.
- **Isolamento:** a config de zoom fica centralizada em `_zoomOptions` (sem duplicar entre os dois
  charts); as funções de dados do lucro mensal ficam adjacentes às patrimoniais. Sem refactor das
  demais funções da tela.

## Testes

Os gráficos dependem de Chart.js + estado vivo (`App.*`) + `new Date()` — como os gráficos atuais, que
não possuem teste unitário. **Verificação manual no browser** (autenticado, com ≥1 investimento):
1. Zoom/pan na Projeção Patrimonial (pinça/arraste no mobile; arraste e Ctrl+roda no desktop); botão
   reset aparece ao dar zoom e some ao resetar.
2. Novo gráfico "Projeção de Lucro Mensal" renderiza; com reinvestimento ligado as linhas sobem; com
   IPCA ligado a linha real tracejada aparece; valor inicial coerente com o KPI de lucro mensal.
3. Botões 2a–30a re-renderizam **ambos** os gráficos e sincronizam ambas as fileiras de botões.
4. Empty-state: sem investimentos, ambos os cards mostram a mensagem de vazio.

## Fora de escopo (Grupo B)

- Tela de Configurações (Grupo C).
- Aviso de finalização de investimento (Grupo D).
- Alterar a matemática de `buildProfitByMonth`/projeção patrimonial (reusada como está).

## Arquivos afetados

- `index.html` — novo `<script>` CDN do `chartjs-plugin-zoom`; novo card HTML; `_zoomOptions`;
  `getMonthlyProfitData`/`getMonthlyProfitDataReal`; `renderMonthlyProfitChart`; ajustes em
  `renderLineChart`, `setProjectionYears` e `renderInsights`.
- `STATE.md` — registro da sessão ao final.
