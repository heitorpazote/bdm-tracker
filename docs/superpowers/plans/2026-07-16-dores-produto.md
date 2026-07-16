# Dores de Produto (1,5,6,7,8,9) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver 6 dores do BDM Tracker: conciliação recebido/projetado, export CSV+backup JSON, calculadora no modelo BDMSchedule, PWA, seleção de valores e guard do bottom-sheet.

**Architecture:** Mantém single-file `index.html` + módulos puros em `js/` (UMD, testáveis em Node com `node:test`). Supabase ganha 1 coluna (`events.received`). PWA adiciona `manifest.webmanifest` + `sw.js` na raiz.

**Tech Stack:** Vanilla JS inline, Tailwind CDN, Chart.js, Supabase JS, node:test.

**Spec:** `docs/superpowers/specs/2026-07-16-dores-produto-design.md`

## Global Constraints

- Sem build step; tudo roda abrindo `index.html`.
- Testes: `node --test tests/` — os 18 existentes devem continuar verdes.
- Datas SEMPRE via `dateKey()` local (nunca `toISOString().slice(0,10)`).
- Nomes renderizados SEMPRE via `_escHtml`.
- Erros Supabase SEMPRE com toast; nunca rejeição silenciosa.
- Design system: `premium-card`, `glass-modal`, `fi`, `.tog`, cores `#0EA5E9`/`#F59E0B`/`#09090b`.
- SW/manifest não podem quebrar `file://` nem o APK (registro condicional).

---

### Task 1: Coluna `received` — migração, modelo e persistência

**Files:**
- Create: `supabase/migrations/20260716_add_received_to_events.sql`
- Modify: `index.html` — `mapEventFromDB` (~2481), `mapEventToDB` (~2492), novo `dbPutEvent`, `saveInvestment` (~3671), `confirmAIEdit` (buscar `deleteInvestmentEvents` no fluxo do agente)

**Interfaces:**
- Produces: `ev.received: boolean` em todos os eventos; `dbPutEvent(ev)` (upsert único); `_carryReceived(oldEvents, newEvents)` — copia `received` por data.

- [ ] **Step 1: Migração SQL**

```sql
-- supabase/migrations/20260716_add_received_to_events.sql
alter table public.events
  add column if not exists received boolean not null default false;
```

Usuário roda no SQL Editor do dashboard (avisar na entrega; feature não funciona antes disso).

- [ ] **Step 2: Mapear no modelo**

Em `mapEventFromDB`: `received: !!r.received,`. Em `mapEventToDB`: `received: ev.received || false,`.

- [ ] **Step 3: `dbPutEvent` + preservação na regeneração**

```js
async function dbPutEvent(ev) {
  const { error } = await sb.from('events').upsert(mapEventToDB(ev));
  if (error) throw new Error(error.message);
}
// Antes de regenerar eventos de um investimento editado, preserva confirmações por data.
function _carryReceived(oldEvents, newEvents) {
  const receivedByDate = new Set(oldEvents.filter(e => e.received).map(e => e.date));
  for (const ev of newEvents) if (receivedByDate.has(ev.date)) ev.received = true;
  return newEvents;
}
```

Em `saveInvestment` (branch periodic) e `confirmAIEdit`: capturar `const oldEvts = App.events.filter(ev => ev.investmentId === inv.id)` ANTES do delete; após `generateEvents(inv)`, chamar `_carryReceived(oldEvts, evts)`.

- [ ] **Step 4: Validar sintaxe** — `node --check` no JS inline extraído (mesma técnica da auditoria) + `node --test tests/`.

- [ ] **Step 5: Commit** — `feat(recebido): coluna received + preservação na regeneração`

---

### Task 2: UI recebido — check nas 3 views, marcar todos, KPI

**Files:**
- Modify: `index.html` — `renderAgenda` (~3181; incluir eventos passados não confirmados), `renderDetailPanel` (~3278), `openDayModal` (~3385), header da agenda (`#agenda-list` ~1254), KPIs Insights (~1292 markup, `renderInsights` ~4007)

**Interfaces:**
- Consumes: `ev.received`, `dbPutEvent`, `dateKey`, `confirmDialog`, `toast`, `haptic`.
- Produces: `toggleEventReceived(id)`, `markAllReceivedUntilToday()`, `getReceivedTotals()` → `{received, projectedToDate}`.

- [ ] **Step 1: Funções de marcação**

```js
async function toggleEventReceived(id) {
  const ev = App.events.find(e => e.id === id);
  if (!ev) return;
  const prev = ev.received;
  ev.received = !prev;
  try {
    await dbPutEvent(ev);
    haptic(8);
  } catch (err) {
    ev.received = prev; // rollback
    toast('Erro ao salvar: ' + err.message, 'error');
  }
  rerenderEventViews();
}
async function markAllReceivedUntilToday() {
  const todayK = dateKey(new Date());
  const pend = App.events.filter(e => e.date <= todayK && !e.received);
  if (!pend.length) return;
  if (!await confirmDialog(`Confirmar ${pend.length} recebimento(s) até hoje?`, { title: 'Marcar todos', confirmText: 'Confirmar' })) return;
  pend.forEach(e => e.received = true);
  try { await dbPutEvents(pend); toast(`${pend.length} recebimento(s) confirmado(s).`); }
  catch (err) { pend.forEach(e => e.received = false); toast('Erro ao salvar: ' + err.message, 'error'); }
  rerenderEventViews();
}
function rerenderEventViews() {
  if (App.currentScreen === 'calendar') renderCalendar();
  if (App.currentScreen === 'insights') renderInsights();
}
```

- [ ] **Step 2: Check button helper + injetar nas 3 views**

```js
// Botão de conciliação: só para eventos com data <= hoje.
function _receivedBtnHtml(e) {
  if (e.date > dateKey(new Date())) return '';
  const on = !!e.received;
  return `<button type="button" onclick="event.stopPropagation();toggleEventReceived('${_escHtml(e.id)}')"
    class="recv-btn ${on ? 'recv-on' : 'recv-off'}" title="${on ? 'Recebido — toque para desfazer' : 'Marcar como recebido'}">
    <span class="material-symbols-outlined text-[16px]">${on ? 'check_circle' : 'radio_button_unchecked'}</span>
  </button>`;
}
```

CSS: `.recv-btn{...}` verde `#4ade80` quando on, âmbar `#F59E0B` off. Inserir o botão ao lado do valor em: linha de evento da agenda, transação do detail panel, transação do day modal.

- [ ] **Step 3: Agenda inclui passados pendentes** — `renderAgenda` hoje filtra `e.date >= todayStr`. Adicionar seção "Pendentes de confirmação" acima (eventos `date < hoje && !received`, últimos 30), + botão "Marcar todos até hoje" no cabeçalho quando houver pendentes.

- [ ] **Step 4: KPI Total Recebido** — novo card no grid de KPIs (vira `sm:grid-cols-4`):

```js
function getReceivedTotals() {
  const todayK = dateKey(new Date());
  let received = 0, projected = 0;
  for (const e of App.events) {
    if (e.date > todayK) continue;
    projected += e.amount;
    if (e.received) received += e.amount;
  }
  return { received, projected };
}
```

Card: valor = `fmtBRL(received)`, subtítulo `de ${fmtBRL(projected)} projetado até hoje`, tooltip explicando que soma só lucros (capital devolvido fora), ícone `task_alt`.

- [ ] **Step 5: Sintaxe + testes + verificação visual browser**
- [ ] **Step 6: Commit** — `feat(recebido): conciliação nas views + KPI total recebido`

---

### Task 3: `js/exporter.js` + testes (TDD)

**Files:**
- Create: `js/exporter.js`, `tests/exporter.test.js`

**Interfaces:**
- Produces: `BDMExporter.investmentsToCSV(investments, categories)`, `eventsToCSV(events, investments)`, `buildBackup(data)`, `validateBackup(obj)` → `{ok, error}`. CSV: `;`, decimal vírgula, BOM `﻿`, CRLF.

- [ ] **Step 1: Escrever testes primeiro** (`tests/exporter.test.js`, node:test, padrão do schedule.test.js): CSV com BOM+header, escape de `;`/aspas/quebra de linha, decimal vírgula, categoria resolvida por nome, evento com nome do investimento e received Sim/Não; buildBackup com version 1 e exportedAt; validateBackup rejeita null/version errada/arrays ausentes e aceita backup válido.
- [ ] **Step 2: Rodar — falha** (`node --test tests/exporter.test.js`).
- [ ] **Step 3: Implementar módulo UMD** (mesmo wrapper de schedule.js):

```js
(function (root) {
  function csvCell(v) {
    var s = v == null ? '' : String(v);
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csvNum(n) { return (n == null || isNaN(n)) ? '' : String(n).replace('.', ','); }
  function toCSV(headers, rows) {
    var lines = [headers.map(csvCell).join(';')].concat(
      rows.map(function (r) { return r.join(';'); }));
    return '﻿' + lines.join('\r\n');
  }
  function investmentsToCSV(investments, categories) { /* colunas: Nome;Tipo;Categoria;Capital (R$);Lucro por Período (%);Frequência;Início;Duração (meses);Cripto (BDM) */ }
  function eventsToCSV(events, investments) { /* colunas: Data;Investimento;Lucro (R$);Devolução de Capital (R$);Último Pagamento;Recebido */ }
  function buildBackup(d) { return { version: 1, exportedAt: new Date().toISOString(), investments: d.investments || [], categories: d.categories || [], events: d.events || [], settings: d.settings || {} }; }
  function validateBackup(o) { /* checa objeto, version===1, arrays, campos mínimos (id em cada item) */ }
  var api = { investmentsToCSV, eventsToCSV, buildBackup, validateBackup };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BDMExporter = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Testes verdes** — `node --test tests/`
- [ ] **Step 5: Commit** — `feat(export): módulo BDMExporter puro com testes`

---

### Task 4: UI Dados — export/backup/restore em Configurações

**Files:**
- Modify: `index.html` — `#screen-settings` (~1866, novo card antes do fechamento), `<script src="js/exporter.js">` junto do schedule.js, funções novas no script inline

**Interfaces:**
- Consumes: `BDMExporter.*`, `confirmDialog`, `loadAllData`, `sb`, `getUserId`.
- Produces: `exportInvestmentsCSV()`, `exportEventsCSV()`, `downloadBackup()`, `restoreBackupFile(input)`.

- [ ] **Step 1: Card "Dados" no settings** — 4 linhas com botões (download CSVs, backup JSON, label+input file oculto para restaurar; aviso em texto pequeno que restaurar substitui tudo).
- [ ] **Step 2: Funções**

```js
function _downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function exportInvestmentsCSV() { _downloadFile(`bdm-investimentos-${dateKey(new Date())}.csv`, BDMExporter.investmentsToCSV(App.investments, App.categories), 'text/csv;charset=utf-8'); }
function exportEventsCSV() { _downloadFile(`bdm-eventos-${dateKey(new Date())}.csv`, BDMExporter.eventsToCSV(App.events, App.investments), 'text/csv;charset=utf-8'); }
function downloadBackup() { _downloadFile(`bdm-backup-${dateKey(new Date())}.json`, JSON.stringify(BDMExporter.buildBackup({ investments: App.investments, categories: App.categories, events: App.events, settings: { bdmRate: App.bdmRate, ipcaRate: App.ipcaRate, useIPCA: App.useIPCA } }), null, 2), 'application/json'); }
async function restoreBackupFile(input) { /* lê File como texto, JSON.parse com try, validateBackup, confirmDialog danger, delete events/investments/categories do usuário, upsert categorias→investimentos→eventos com user_id atual, saveSettings, loadAllData + renderCalendar + toast; finally input.value='' */ }
```

- [ ] **Step 3: Sintaxe + teste manual no browser (export gera arquivos, restore de um backup exportado round-trips)**
- [ ] **Step 4: Commit** — `feat(export): tela Dados com CSV, backup e restauração`

---

### Task 5: Calculadora no modelo BDMSchedule (TDD)

**Files:**
- Modify: `js/schedule.js` (nova `simulateCalculator`), `tests/schedule.test.js` (novos casos), `index.html` — toggles no `#screen-calculator` (~1637, antes do painel de resultado), `updateCalc` (~4693), `renderCalcChart` (~4749)

**Interfaces:**
- Produces: `BDMSchedule.simulateCalculator({principal, ratePct, intervalMonths, totalMonths, monthlyContribution, reinvest, desagio})` → `{finalValue, totalProfit, netProfit, totalInvested, series: [{month, value}]}`.
  - `series[m].value` = principal acumulado + lucros sacados acumulados (visão patrimonial).
  - `reinvest=true`: lucro (líquido de deságio se `desagio`) compõe o principal a cada período.
  - `reinvest=false`: lucro acumula fora (com deságio se `desagio`).
  - Aporte mensal soma ao principal no fim de cada mês (rende no período seguinte).

- [ ] **Step 1: Testes primeiro** — sem reinvest/sem aporte (lucro linear: `principal*rate*numPeriods`), reinvest composto (`principal*(1+r)^n`), com deságio (fator 0.9 no lucro), com aporte mensal (aporte não rende no mês em que entra), série com `totalMonths+1` pontos.
- [ ] **Step 2: Rodar — falha.**
- [ ] **Step 3: Implementar**

```js
function simulateCalculator(opts) {
  var principal = opts.principal || 0;
  var rate = (opts.ratePct || 0) / 100;
  var interval = Math.max(1, opts.intervalMonths || 1);
  var totalMonths = Math.max(1, opts.totalMonths || 1);
  var monthly = opts.monthlyContribution || 0;
  var reinvest = !!opts.reinvest;
  var desFactor = 1 - (opts.desagio ? WITHDRAWAL_DESAGIO : 0);
  var withdrawn = 0, invested = principal, grossTotal = 0;
  var series = [{ month: 0, value: principal }];
  for (var m = 1; m <= totalMonths; m++) {
    if (m % interval === 0) {
      var gross = principal * rate;
      grossTotal += gross;
      var net = gross * desFactor;
      if (reinvest) principal += net; else withdrawn += net;
    }
    principal += monthly; invested += monthly;
    series.push({ month: m, value: principal + withdrawn });
  }
  var finalValue = principal + withdrawn;
  return { finalValue: finalValue, totalProfit: grossTotal, netProfit: finalValue - invested, totalInvested: invested, series: series };
}
```

(Nota: aporte após o pagamento do mês — o aporte do mês `m` só rende a partir do próximo período.)

- [ ] **Step 4: Testes verdes; commit do módulo** — `feat(calc): simulateCalculator no modelo do app`
- [ ] **Step 5: UI** — 2 toggles `.tog` ("Reinvestir recebimentos" `#calc-reinvest` default ON; "Saque em cripto (−10% deságio)" `#calc-desagio` default OFF) + `updateCalc` reescrito para delegar:

```js
const sim = BDMSchedule.simulateCalculator({ principal: amount, ratePct: profitPct, intervalMonths: freqMonths, totalMonths: months, monthlyContribution: monthly, reinvest: document.getElementById('calc-reinvest').checked, desagio: document.getElementById('calc-desagio').checked });
```

Resultado: `calc-result = sim.finalValue`, `calc-profit = sim.netProfit`, `calc-multiplier = finalValue/totalInvested`, `calc-total-invested = sim.totalInvested`. IPCA: deflaciona igual hoje (fvInflated mantém a fórmula de inflação sobre aportes). Chart: usa `sim.series` (linha principal) + `totalInvested` acumulado como linha tracejada ("Investido"). Labels dos cards: "Com juros compostos"→"Projeção (modelo do app)".

- [ ] **Step 6: Sintaxe + visual + commit** — `feat(calc): calculadora usa o modelo real do app`

---

### Task 6: PWA — manifest, service worker, ícones, registro

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png`
- Modify: `index.html` `<head>` (link manifest, theme-color, apple-touch-icon) + registro do SW no fim do script

**Interfaces:** nenhum código consome; browser consome os arquivos.

- [ ] **Step 1: Ícones** — copiar o launcher icon do APK (`arquivos_apk/app/src/main/res/mipmap-*`) se houver PNG ≥192; senão gerar via PowerShell System.Drawing (fundo `#09090b`, círculo `#0EA5E9`, glifo "B" Inter bold branco) nos tamanhos 192/512/180.
- [ ] **Step 2: manifest.webmanifest**

```json
{
  "name": "BDM Tracker",
  "short_name": "BDM",
  "description": "Gestão e calendário de investimentos cripto/DeFi",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "background_color": "#09090b",
  "theme_color": "#09090b",
  "lang": "pt-BR",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 3: sw.js** — `CACHE = 'bdm-shell-v1'`; precache `['./index.html','./js/schedule.js','./js/gestures.js','./js/exporter.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png']`; fetch handler: só GET; `*.supabase.co` → passthrough (network only); origem própria → cache-first com atualização em background; CDNs (cdn.tailwindcss.com, cdn.jsdelivr.net, fonts.googleapis.com, fonts.gstatic.com, unpkg) → stale-while-revalidate em `bdm-cdn-v1`; `install` → skipWaiting; `activate` → limpa caches antigos + clients.claim.
- [ ] **Step 4: head + registro**

```html
<link rel="manifest" href="manifest.webmanifest" />
<meta name="theme-color" content="#09090b" />
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />
```

```js
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW:', err)));
}
```

- [ ] **Step 5: Verificar em localhost (python http.server ou npx serve) — manifest ok no DevTools, SW instala, offline recarrega o shell. Verificar que `file://` segue funcionando sem erro no console.**
- [ ] **Step 6: Commit** — `feat(pwa): manifest + service worker + ícones`

---

### Task 7: Dor 8 (seleção de valores) + Dor 9 (guard bottom-sheet)

**Files:**
- Modify: `index.html` — CSS `user-select` (~51-63), `showModal`/`hideModal` (~3460), `initBottomSheet` (~3500), backdrops de `#modal-investment` (~1881) e `#modal-category`

**Interfaces:**
- Produces: `_snapshotForm(modalId)`, `_isFormDirty(modalId)`, `closeGuardedModal(modalId)` (usado nos backdrops).

- [ ] **Step 1: CSS seleção**

```css
.tabular-nums { -webkit-user-select: text; user-select: text; }
#calendar-grid .tabular-nums, #calendar-grid * { -webkit-user-select: none; user-select: none; }
```

- [ ] **Step 2: Guard**

```js
const _formSnapshots = {};
function _serializeModalForm(modalId) {
  const form = document.querySelector('#' + modalId + ' form');
  if (!form) return null;
  return Array.from(form.elements).map(el =>
    el.type === 'checkbox' ? (el.checked ? '1' : '0') : (el.value || '')).join('');
}
function _snapshotForm(modalId) { _formSnapshots[modalId] = _serializeModalForm(modalId); }
function _isFormDirty(modalId) {
  const snap = _formSnapshots[modalId];
  return snap != null && _serializeModalForm(modalId) !== snap;
}
async function closeGuardedModal(modalId) {
  if (_isFormDirty(modalId) && !await confirmDialog('Descartar as alterações do formulário?', { title: 'Descartar alterações', confirmText: 'Descartar', danger: true })) return;
  hideModal(modalId);
}
```

`showModal` tira snapshot (via rAF, depois que os campos foram populados) quando o modal tem form. Backdrops: `onclick="closeInvestmentModal()"` → `onclick="closeGuardedModal('modal-investment')"` (idem category). `initBottomSheet` touchend: se `dy > 110` e `_isFormDirty(ov.id)` → repõe o painel e chama `closeGuardedModal(ov.id)` em vez de fechar direto.

- [ ] **Step 3: Sintaxe + visual (arrastar com form sujo pergunta; limpo fecha; long-press calendário não seleciona texto)**
- [ ] **Step 4: Commit** — `feat(ux): copiar valores + guard de descarte no bottom-sheet`

---

### Task 8: Verificação final + STATE.md + entrega

- [ ] `node --test tests/` — todos verdes.
- [ ] Verificação visual completa no browser (skill verify): calendário/agenda com checks, KPI, settings Dados, calculadora, PWA em localhost.
- [ ] Atualizar `STATE.md` (mudanças, TODOs resolvidos, decisões) e remover as dores 1,5,6,7,8,9 dos Open Issues.
- [ ] Commit final + instruções ao usuário: SQL da migração + passo a passo GitHub Pages.
