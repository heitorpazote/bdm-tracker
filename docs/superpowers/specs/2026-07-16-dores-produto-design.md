# Design — Resolução das dores de produto 1, 5, 6, 7, 8, 9

Data: 2026-07-16 · Status: aprovado pelo usuário

Resolve 6 dores registradas no STATE.md (auditoria 2026-07-16). Todas as mudanças
mantêm a arquitetura atual: single-file `index.html` + módulos puros em `js/`
testáveis em Node, Supabase como backend.

## Dor 1 — Recebido vs Projetado (conciliação)

**Objetivo:** o usuário confirma manualmente cada recebimento; o app distingue
"projetado" de "efetivamente recebido".

- **Banco:** coluna nova `received boolean not null default false` na tabela
  `events`. Migração em `supabase/migrations/` — o usuário roda o SQL no
  dashboard (RLS existente já cobre a coluna). Até a migração rodar, o app
  tolera a ausência da coluna? Não — o upsert enviaria coluna inexistente.
  Sequência: usuário roda o SQL ANTES de usar a feature (bloqueio real,
  combinar na entrega).
- **Modelo:** `mapEventFromDB/ToDB` ganham `received` (default `false`).
- **Marcação:** manual, por evento com `date <= hoje` (dateKey local):
  - Botão check nas 3 views de eventos: agenda (`renderAgenda`), painel de
    detalhe (`renderDetailPanel`), modal do dia (`openDayModal`).
  - Estados visuais: recebido = check verde preenchido; passado não confirmado
    = check vazado âmbar; futuro = sem botão.
  - `toggleEventReceived(id)`: atualiza `App.events` local, upsert do evento
    isolado no Supabase (com tratamento de erro + rollback local se falhar),
    re-render da tela ativa.
  - Botão **"Marcar todos até hoje"** no cabeçalho da view Agenda (visível só
    quando existir evento passado não confirmado). Um upsert em lote.
- **KPI Insights:** card "Total Recebido" — soma de `amount` (lucro; para
  `isLastPayment` NÃO inclui `principalReturn`, é devolução de capital, não
  lucro) dos eventos `received`, comparado ao projetado até hoje:
  `R$ X de R$ Y projetado`. Tooltip explica a regra.
- **Preservação na regeneração:** `saveInvestment` e `confirmAIEdit` apagam e
  regeneram eventos ao editar. Antes de apagar, indexar eventos antigos
  `received=true` por `date`; ao gerar os novos, reaplicar `received` quando a
  data coincidir. (Mudança de data do investimento pode desalinhar — aceito,
  comportamento documentado.)

## Dor 5 — Exportação CSV + Backup JSON com restauração

- **Módulo novo `js/exporter.js`** (`BDMExporter`, padrão UMD igual a
  `schedule.js`), funções puras testáveis:
  - `investmentsToCSV(investments, categories)` — colunas: nome, tipo,
    categoria, principal, lucro %, frequência, início, duração, showInBDM.
  - `eventsToCSV(events, investments)` — colunas: data, investimento, lucro,
    devolução capital, último pagamento, recebido.
  - CSV: separador `;`, decimal com vírgula, BOM UTF-8 (Excel pt-BR), campos
    com aspas escapadas.
  - `buildBackup({investments, categories, events, settings})` → objeto
    `{version: 1, exportedAt, ...}`.
  - `validateBackup(obj)` → `{ok, error}` — checa version, arrays e campos
    mínimos.
- **UI:** seção "Dados" na tela Configurações com 4 ações: Exportar
  investimentos (CSV), Exportar eventos (CSV), Baixar backup (JSON),
  Restaurar backup (input file).
- **Download:** Blob + `<a download>`; nome com data (`bdm-backup-2026-07-16.json`).
- **Restauração:** valida com `validateBackup`, `confirmDialog` destrutivo
  ("substitui TODOS os dados atuais"), então: delete de todas as linhas do
  usuário (events → investments → categories), insert dos dados do backup com
  `user_id` remapeado para o usuário atual, `loadAllData()` + re-render.
  Erro no meio: toast com orientação a restaurar de novo (operação é
  idempotente por substituição).

## Dor 6 — Calculadora no modelo do app

- **Função pura nova** `BDMSchedule.simulateCalculator(opts)` em
  `js/schedule.js`:
  - `opts = {principal, ratePct, intervalMonths, totalMonths, monthlyContribution, reinvest, desagio}`.
  - Modelo: lucro fixo `ratePct` sobre o principal a cada `intervalMonths`;
    aporte mensal soma ao principal (rende a partir do período seguinte);
    `reinvest` compõe o lucro no principal a cada recebimento (mesma semântica
    de `compoundedPeriods`); `desagio` aplica `WITHDRAWAL_DESAGIO` (10%) sobre
    o lucro sacado (só faz sentido com `reinvest=false` sobre o que é sacado;
    com reinvest, deságio incide apenas no valor final exibido como saque).
  - Retorna `{finalValue, totalProfit, netProfit, totalInvested, series}`
    (série mensal para o gráfico).
- **UI Calculadora:** mantém sliders atuais (valor, taxa por período,
  frequência, meses, aporte); adiciona toggles "Reinvestir recebimentos"
  (default ligado, igual ao app) e "Saque em cripto (−10% deságio)".
  `updateCalc` delega a `simulateCalculator`; IPCA (lucro real) continua.
- **Testes:** casos em `tests/schedule.test.js` — sem aporte/sem reinvest
  (lucro linear), com reinvest (composto), com aporte, com deságio.

## Dor 7 — PWA

- **`manifest.webmanifest`:** nome "BDM Tracker", `display: standalone`,
  `theme_color #09090b`, `background_color #09090b`, ícones 192/512 (gerados
  a partir do ícone existente do APK ou placeholder novo no design system).
- **`sw.js`:** precache do shell local (`index.html`, `js/*.js`, manifest,
  ícones) com versão no nome do cache; runtime: CDNs (Tailwind, Chart.js,
  Hammer, fonts) em stale-while-revalidate; `*.supabase.co` NUNCA cacheado
  (network only). `skipWaiting` + `clients.claim` para atualização simples.
- **Registro:** no `index.html`, só quando `'serviceWorker' in navigator` e
  contexto seguro (`https:` ou `localhost`) — não interfere em `file://` nem
  no APK.
- **Meta tags:** `theme-color`, `apple-touch-icon`, link do manifest.
- **Escopo offline:** shell abre offline; dados dependem do Supabase (toast de
  erro de sync existente cobre). Passo a passo de publicação no GitHub Pages
  entregue ao final (README ou resposta).

## Dor 8 — Copiar valores

- CSS: `user-select: text` (+ `-webkit-`) para `.tabular-nums` — classe já
  presente em todos os valores monetários — EXCETO dentro de
  `#calendar-grid` (long-press/swipe do calendário não pode disparar seleção).
- Sem "toque para copiar" (YAGNI; seleção resolve).

## Dor 9 — Guard do bottom-sheet

- Em `showModal`, snapshot serializado dos campos do form (`_formSnapshot`)
  para modais com formulário (`modal-investment`, `modal-category`).
- `initBottomSheet` (drag > 110px) e o fechamento por backdrop desses modais
  passam por `_confirmDiscard(modalId)`: se o form estiver "sujo" (serialize
  atual ≠ snapshot), `confirmDialog('Descartar alterações?', {danger})`;
  fechar só se confirmado. Form limpo fecha direto (comportamento atual).
- Botão explícito "Cancelar/X" também respeita o guard? Não — botão explícito
  é intenção clara, fecha direto (só gesto acidental é protegido).

## Fora de escopo

- Sincronizar `received` com extrato bancário/on-chain (manual only).
- Dados offline completos (IndexedDB mirror) — só shell offline.
- Import CSV (só export; restauração é via JSON).

## Testes / verificação

- Node: `tests/schedule.test.js` (novos casos simulateCalculator) +
  `tests/exporter.test.js` (novo). Todos os existentes seguem verdes.
- Sintaxe do inline JS validada via Node (como na auditoria anterior).
- Verificação visual em browser; device real fica pendente do usuário.
