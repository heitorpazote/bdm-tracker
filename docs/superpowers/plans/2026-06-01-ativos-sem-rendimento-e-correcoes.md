# Ativos sem Rendimento + Correções — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir 3 bugs de UI, adicionar exibição de capital no ranking e aviso de deságio no calendário, e implementar novo tipo de ativo "Só Valorização" sem ganho periódico.

**Architecture:** Single HTML file (`index.html`, ~4256 linhas). Backend Supabase. Todas as mudanças são edições pontuais no arquivo único. A nova feature adiciona 3 colunas à tabela `investments` e bifurca o modal existente com pill-tabs + blocos de campos condicionais.

**Tech Stack:** Vanilla JS, TailwindCSS CDN, Chart.js, Supabase JS v2, IndexedDB removido — apenas Supabase.

**Supabase project ref:** `rzsciusbrlqvgazizsuq`
**PAT para migração:** `<REMOVIDO>`

---

## File Map

| Arquivo | O que muda |
|---|---|
| `index.html` | Todas as mudanças — HTML do modal, FAB, sidebar, JS de modelo, funções de save/edit/render |

---

## Task 1: Migração SQL — 3 colunas em `investments`

**Files:**
- Modify: Supabase dashboard (SQL Editor) ou Management API

- [ ] **Step 1: Executar migration via Management API**

```bash
curl -X POST "https://api.supabase.com/v1/projects/rzsciusbrlqvgazizsuq/database/query" \
  -H "Authorization: Bearer <REMOVIDO>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "ALTER TABLE investments ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT '\''periodic'\'', ADD COLUMN IF NOT EXISTS unit_value NUMERIC, ADD COLUMN IF NOT EXISTS quantity NUMERIC;"
  }'
```

Resposta esperada: `{"rows":[]}` sem campo `error`.

- [ ] **Step 2: Verificar colunas criadas**

```bash
curl -X POST "https://api.supabase.com/v1/projects/rzsciusbrlqvgazizsuq/database/query" \
  -H "Authorization: Bearer <REMOVIDO>" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = '\''investments'\'' AND column_name IN (''type'',''unit_value'',''quantity'') ORDER BY column_name;"}'
```

Esperado: 3 linhas retornadas com `type`, `unit_value`, `quantity`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add type/unit_value/quantity columns to investments table"
```

---

## Task 2: Fix A — saveCategory com try/catch

**Files:**
- Modify: `index.html:2940-2951`

- [ ] **Step 1: Substituir saveCategory**

Localizar (linha ~2940):
```js
async function saveCategory() {
  const name = document.getElementById('cat-name').value.trim();
  const color = document.getElementById('cat-color').value;
  if (!name) { toast('Digite um nome para a categoria.', 'error'); return; }

  const cat = { id: uid(), name, color };
  await dbPutCategory(cat);
  await loadAllData();
  renderCategoryList();
  document.getElementById('cat-name').value = '';
  toast('Categoria criada!', 'success');
}
```

Substituir por:
```js
async function saveCategory() {
  const name = document.getElementById('cat-name').value.trim();
  const color = document.getElementById('cat-color').value;
  if (!name) { toast('Digite um nome para a categoria.', 'error'); return; }
  try {
    const cat = { id: uid(), name, color };
    await dbPutCategory(cat);
    await loadAllData();
    renderCategoryList();
    document.getElementById('cat-name').value = '';
    toast('Categoria criada!', 'success');
  } catch (err) {
    toast('Erro ao criar categoria: ' + err.message, 'error');
  }
}
```

- [ ] **Step 2: Verificar no browser**

Abrir `index.html` → Categorias → digitar nome → clicar "Adicionar Categoria".
Esperado: toast verde "Categoria criada!" e a categoria aparece na lista.
Se houver erro de Supabase, agora aparecerá toast vermelho com a mensagem em vez de silêncio.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix: add try/catch to saveCategory to surface Supabase errors"
```

---

## Task 3: Fix B — Exibir capital investido no Ranking

**Files:**
- Modify: `index.html:3396-3415`

- [ ] **Step 1: Adicionar linha de capital no item do ranking**

Localizar em `renderRankings()` (linha ~3398):
```js
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-semibold text-on-surface truncate">${item.inv.name}</span>
          <span class="text-xs font-bold ${item.roi >= 0 ? 'text-primary' : 'text-error'} tabular-nums ml-2 whitespace-nowrap">+${NUM.format(item.roi)}%</span>
        </div>
```

Substituir por:
```js
        <div class="flex items-center justify-between mb-1">
          <div class="flex flex-col min-w-0">
            <span class="text-xs font-semibold text-on-surface truncate">${item.inv.name}</span>
            <span class="text-[10px] text-secondary/50 tabular-nums">${fmtBRL(item.inv.principal)}</span>
          </div>
          <span class="text-xs font-bold ${item.roi >= 0 ? 'text-primary' : 'text-error'} tabular-nums ml-2 whitespace-nowrap">+${NUM.format(item.roi)}%</span>
        </div>
```

- [ ] **Step 2: Verificar no browser**

Navegar para Insights → "Ranking de Rentabilidade".
Esperado: abaixo de cada nome de investimento aparece o valor em R$ (ex: "R$ 1.000,00") sem precisar clicar.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: show invested capital next to each investment in ranking"
```

---

## Task 4: Fix C — Aviso de deságio 10% no calendário

**Files:**
- Modify: `index.html:2660-2661` (desktop `renderDetailPanel`)
- Modify: `index.html:2730-2732` (mobile `openDayModal`)

### Subtask 4a — Desktop (renderDetailPanel)

- [ ] **Step 1: Adicionar nota após o bloco de transações no painel desktop**

Localizar em `renderDetailPanel()` (linha ~2661):
```js
  <div class="text-[10px] font-semibold tracking-[.1em] uppercase text-secondary/60 mb-3">Transações (clique para expandir)</div>
  <div class="flex flex-col gap-2">
    ${evts.map(e => {
```

A função constrói `panel.innerHTML` como uma string. Após o bloco `evts.map(...).join('')`, adicionar a nota condicional. Localizar o final do template (após o `.join('')}`), que termina com:
```js
    </div>`;
```

Substituir o fechamento do template (a linha com `    </div>\``) por:
```js
    </div>
  ${bdmEvts.length > 0 && App.bdmRate > 0 ? `<p class="text-[10px] text-secondary/40 mt-3 pt-2 border-t border-white/5 leading-relaxed"><span class="material-symbols-outlined text-[11px] align-middle" style="font-variation-settings:\'wght\' 400">info</span> Valores em Cripto exibem o lucro bruto. O saque tem deságio de 10% sobre o lucro.</p>` : ''}`;
```

### Subtask 4b — Mobile (openDayModal)

- [ ] **Step 2: Adicionar nota ao final do HTML do modal de dia**

Localizar em `openDayModal()` (linha ~2730):
```js
  <p class="text-[10px] text-secondary/40 mb-2 uppercase font-semibold tracking-wider">Transações — toque para expandir</p>`;
```

Após `html += evts.map(e => { ... }).join('');` (linha ~2770), localizar:
```js
      document.getElementById('day-modal-content').innerHTML = html;
      showModal('modal-day');
```

Adicionar antes de `showModal`:
```js
      if (bdmEvts.length > 0 && App.bdmRate > 0) {
        html += `<p class="text-[10px] text-secondary/40 mt-3 pt-2 border-t border-white/5 leading-relaxed"><span class="material-symbols-outlined text-[11px] align-middle" style="font-variation-settings:'wght' 400">info</span> Valores em Cripto exibem o lucro bruto. O saque tem deságio de 10% sobre o lucro.</p>`;
      }
      document.getElementById('day-modal-content').innerHTML = html;
      showModal('modal-day');
```

- [ ] **Step 3: Verificar no browser**

Desktop: clicar em um dia com investimento `showInBDM=true` → painel lateral exibe nota de deságio no rodapé.
Mobile (ou < 1024px): tocar no mesmo dia → modal exibe a mesma nota.
Dias sem investimentos BDM: nota não aparece.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add 10% desagio notice in calendar when BDM events are visible"
```

---

## Task 5: Modelo JS — campos type/unitValue/quantity

**Files:**
- Modify: `index.html:2052-2083`

- [ ] **Step 1: Atualizar mapInvestmentFromDB**

Localizar (linha ~2052):
```js
    function mapInvestmentFromDB(r) {
      return {
        id: r.id,
        name: r.name,
        categoryId: r.category_id,
        principal: parseFloat(r.principal),
        profitPercentage: parseFloat(r.profit_percentage),
        startDate: r.start_date,
        frequency: r.frequency,
        customFrequencyMonths: r.custom_frequency_months,
        durationMonths: r.duration_months,
        showInBDM: r.show_in_bdm,
        createdAt: r.created_at,
      };
    }
```

Substituir por:
```js
    function mapInvestmentFromDB(r) {
      return {
        id: r.id,
        name: r.name,
        categoryId: r.category_id,
        principal: parseFloat(r.principal),
        profitPercentage: parseFloat(r.profit_percentage),
        startDate: r.start_date,
        frequency: r.frequency,
        customFrequencyMonths: r.custom_frequency_months,
        durationMonths: r.duration_months,
        showInBDM: r.show_in_bdm,
        createdAt: r.created_at,
        type: r.type || 'periodic',
        unitValue: r.unit_value ? parseFloat(r.unit_value) : null,
        quantity: r.quantity ? parseFloat(r.quantity) : null,
      };
    }
```

- [ ] **Step 2: Atualizar mapInvestmentToDB**

Localizar (linha ~2068):
```js
    function mapInvestmentToDB(inv) {
      return {
        id: inv.id,
        user_id: getUserId(),
        name: inv.name,
        category_id: inv.categoryId,
        principal: inv.principal,
        profit_percentage: inv.profitPercentage,
        start_date: inv.startDate,
        frequency: inv.frequency,
        custom_frequency_months: inv.customFrequencyMonths,
        duration_months: inv.durationMonths,
        show_in_bdm: inv.showInBDM,
        created_at: inv.createdAt,
      };
    }
```

Substituir por:
```js
    function mapInvestmentToDB(inv) {
      return {
        id: inv.id,
        user_id: getUserId(),
        name: inv.name,
        category_id: inv.categoryId,
        principal: inv.principal,
        profit_percentage: inv.profitPercentage,
        start_date: inv.startDate,
        frequency: inv.frequency,
        custom_frequency_months: inv.customFrequencyMonths,
        duration_months: inv.durationMonths,
        show_in_bdm: inv.showInBDM,
        created_at: inv.createdAt,
        type: inv.type || 'periodic',
        unit_value: inv.unitValue || null,
        quantity: inv.quantity || null,
      };
    }
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add type/unitValue/quantity fields to investment JS model"
```

---

## Task 6: Modal HTML — pill-tabs + bloco de campos de ativo

**Files:**
- Modify: `index.html:1605-1698` (modal `#modal-investment`)

- [ ] **Step 1: Adicionar campo hidden `#inv-type` e pill-tabs no cabeçalho do modal**

Localizar (linha ~1612):
```html
      <form id="form-investment" onsubmit="saveInvestment(event)" class="p-6 flex flex-col gap-5">
        <input type="hidden" id="inv-edit-id" />

        <div>
          <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 block mb-1.5">Nome do
            Investimento *</label>
          <input type="text" id="inv-name" class="fi" placeholder="Ex: CDB Banco XYZ" required />
        </div>
```

Substituir por:
```html
      <form id="form-investment" onsubmit="saveInvestment(event)" class="p-6 flex flex-col gap-5">
        <input type="hidden" id="inv-edit-id" />
        <input type="hidden" id="inv-type" value="periodic" />

        <!-- Pill-tabs de tipo -->
        <div class="flex rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container">
          <button type="button" id="inv-tab-periodic" onclick="switchInvestmentType('periodic')"
            class="flex-1 py-2.5 text-xs font-semibold transition-all bg-primary/10 border-r border-outline-variant/30 text-primary">
            Com Rendimento
          </button>
          <button type="button" id="inv-tab-asset" onclick="switchInvestmentType('asset')"
            class="flex-1 py-2.5 text-xs font-semibold transition-all text-secondary/60">
            Só Valorização
          </button>
        </div>

        <div>
          <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 block mb-1.5">Nome do
            Ativo *</label>
          <input type="text" id="inv-name" class="fi" placeholder="Ex: CDB Banco XYZ" required />
        </div>
```

- [ ] **Step 2: Envolver os campos periódicos em `#inv-periodic-fields`**

Localizar o bloco que começa com o grid Capital/Lucro (linha ~1629) e termina antes do toggle "Exibir em Cripto" (linha ~1676). Envolver esse bloco completo:

```html
        <!-- Campos exclusivos de investimento periódico -->
        <div id="inv-periodic-fields">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 block mb-1.5">Capital
                Investido (R$) *</label>
              <input type="number" id="inv-principal" class="fi" placeholder="0,00" min="0.01" step="0.01" />
            </div>
            <div>
              <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 block mb-1.5">Lucro por
                Período (%) *</label>
              <input type="number" id="inv-profit-pct" class="fi" placeholder="0,00" min="0.01" step="0.01" />
            </div>
          </div>

          <div class="mt-5">
            <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 block mb-1.5">Data de
              Início *</label>
            <input type="date" id="inv-start-date" class="fi" />
          </div>

          <div class="grid grid-cols-2 gap-4 mt-5">
            <div>
              <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 block mb-1.5">Frequência
                de Lucro *</label>
              <select id="inv-frequency" class="fi" onchange="toggleCustomFreq(this)">
                <option value="monthly">Mensal (1 mês)</option>
                <option value="bimonthly">Bimestral (2 meses)</option>
                <option value="quarterly">Trimestral (3 meses)</option>
                <option value="semiannual">Semestral (6 meses)</option>
                <option value="at_maturity">No Vencimento</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
            <div>
              <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 block mb-1.5">Duração
                (meses) *</label>
              <input type="number" id="inv-duration" class="fi" placeholder="12" min="1" step="1" />
            </div>
          </div>

          <div id="inv-custom-freq-wrap" class="hidden mt-5">
            <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 block mb-1.5">Período
              Personalizado (meses) *</label>
            <input type="number" id="inv-custom-freq-months" class="fi" placeholder="Ex: 4 (a cada 4 meses)" min="1"
              step="1" />
            <p class="text-[10px] text-secondary/50 mt-1">Defina o intervalo em meses entre cada pagamento de lucro.</p>
          </div>
        </div>

        <!-- Campos exclusivos de ativo (só valorização) -->
        <div id="inv-asset-fields" class="hidden flex flex-col gap-5">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 block mb-1.5">Valor por
                Unidade (R$) *</label>
              <input type="number" id="inv-unit-value" class="fi" placeholder="0,00000" min="0.00001" step="any"
                oninput="updateAssetTotal()" />
            </div>
            <div>
              <label class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70 block mb-1.5">Quantidade *</label>
              <input type="number" id="inv-quantity" class="fi" placeholder="0" min="0.00001" step="any"
                oninput="updateAssetTotal()" />
            </div>
          </div>
          <div class="flex items-center justify-between p-3 rounded-xl bg-surface-container border border-outline-variant/20">
            <span class="text-[11px] font-semibold tracking-wider uppercase text-secondary/70">Total</span>
            <span id="inv-asset-total" class="text-sm font-bold text-primary tabular-nums">R$ 0,00</span>
          </div>
        </div>
```

Remover o bloco original entre as linhas 1629–1675 (Capital/Lucro grid, Data de Início, Frequência/Duração grid, Custom freq) que foi substituído pelos dois divs acima.

- [ ] **Step 3: Verificar HTML no browser**

Abrir modal de investimento → verificar pill-tabs visíveis no topo.
Clicar "Só Valorização" → campos de rendimento somem, campos de ativo aparecem.
Clicar "Com Rendimento" → volta aos campos originais.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add type pill-tabs and asset fields to investment modal"
```

---

## Task 7: JS — switchInvestmentType e updateAssetTotal

**Files:**
- Modify: `index.html` — adicionar após `function toggleCustomFreq` (buscar linha ~2810)

- [ ] **Step 1: Adicionar função switchInvestmentType**

Localizar `function toggleCustomFreq` (linha ~2810) e adicionar logo após ela:

```js
    function switchInvestmentType(type) {
      document.getElementById('inv-type').value = type;
      const periodic = document.getElementById('inv-periodic-fields');
      const asset = document.getElementById('inv-asset-fields');
      const tabP = document.getElementById('inv-tab-periodic');
      const tabA = document.getElementById('inv-tab-asset');

      if (type === 'asset') {
        periodic.classList.add('hidden');
        asset.classList.remove('hidden');
        tabA.classList.add('bg-primary/10', 'text-primary');
        tabA.classList.remove('text-secondary/60');
        tabP.classList.remove('bg-primary/10', 'text-primary');
        tabP.classList.add('text-secondary/60');
        // Remover required dos campos periódicos para não bloquear submit
        document.getElementById('inv-principal').removeAttribute('required');
        document.getElementById('inv-profit-pct').removeAttribute('required');
        document.getElementById('inv-start-date').removeAttribute('required');
        document.getElementById('inv-frequency').removeAttribute('required');
        document.getElementById('inv-duration').removeAttribute('required');
      } else {
        periodic.classList.remove('hidden');
        asset.classList.add('hidden');
        tabP.classList.add('bg-primary/10', 'text-primary');
        tabP.classList.remove('text-secondary/60');
        tabA.classList.remove('bg-primary/10', 'text-primary');
        tabA.classList.add('text-secondary/60');
        document.getElementById('inv-principal').setAttribute('required', '');
        document.getElementById('inv-profit-pct').setAttribute('required', '');
        document.getElementById('inv-start-date').setAttribute('required', '');
        document.getElementById('inv-frequency').setAttribute('required', '');
        document.getElementById('inv-duration').setAttribute('required', '');
      }
    }

    function updateAssetTotal() {
      const uv = parseFloat(document.getElementById('inv-unit-value').value) || 0;
      const qty = parseFloat(document.getElementById('inv-quantity').value) || 0;
      document.getElementById('inv-asset-total').textContent = fmtBRL(uv * qty);
    }
```

- [ ] **Step 2: Verificar no browser**

Abrir modal → digitar valor e quantidade nos campos de ativo → verificar que "Total" atualiza em tempo real.
Trocar entre tabs → verificar que `required` some/aparece conforme o tipo.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add switchInvestmentType and updateAssetTotal functions"
```

---

## Task 8: saveInvestment — suporte ao tipo asset

**Files:**
- Modify: `index.html:2821-2868`

- [ ] **Step 1: Bifurcar saveInvestment por tipo**

Localizar `async function saveInvestment(e)` (linha ~2821). Substituir a função inteira por:

```js
    async function saveInvestment(e) {
      e.preventDefault();
      const errEl = document.getElementById('inv-error');
      errEl.classList.add('hidden');

      const type = document.getElementById('inv-type').value || 'periodic';
      const name = document.getElementById('inv-name').value.trim();
      const categoryId = document.getElementById('inv-category').value || null;
      const showInBDM = document.getElementById('inv-show-bdm').checked;
      const editId = document.getElementById('inv-edit-id').value;

      if (!name) { showError('Preencha o nome do ativo.'); return; }

      if (type === 'asset') {
        const unitValue = parseFloat(document.getElementById('inv-unit-value').value);
        const quantity = parseFloat(document.getElementById('inv-quantity').value);
        if (isNaN(unitValue) || unitValue <= 0) { showError('O valor por unidade deve ser positivo.'); return; }
        if (isNaN(quantity) || quantity <= 0) { showError('A quantidade deve ser positiva.'); return; }

        const inv = {
          id: editId || uid(),
          name, categoryId,
          principal: unitValue * quantity,
          profitPercentage: 0,
          startDate: new Date().toISOString().slice(0, 10),
          frequency: 'at_maturity',
          durationMonths: 0,
          customFrequencyMonths: null,
          showInBDM,
          createdAt: editId ? (App.investments.find(i => i.id === editId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
          type: 'asset',
          unitValue,
          quantity,
        };
        try {
          if (editId) await deleteInvestmentEvents(editId);
          await dbPutInvestment(inv);
          await loadAllData();
          renderCalendar();
          closeInvestmentModal();
          toast(editId ? 'Ativo atualizado!' : 'Ativo adicionado à carteira!', 'success');
        } catch (err) {
          showError('Erro ao salvar: ' + err.message);
        }
        return;
      }

      // type === 'periodic' — comportamento original
      const principal = parseFloat(document.getElementById('inv-principal').value);
      const profitPercentage = parseFloat(document.getElementById('inv-profit-pct').value);
      const startDate = document.getElementById('inv-start-date').value;
      const frequency = document.getElementById('inv-frequency').value;
      const durationMonths = parseInt(document.getElementById('inv-duration').value);
      const customFrequencyMonths = frequency === 'custom' ? parseInt(document.getElementById('inv-custom-freq-months').value) : null;

      if (!name || isNaN(principal) || principal <= 0) { showError('Preencha todos os campos obrigatórios.'); return; }
      if (isNaN(profitPercentage) || profitPercentage <= 0) { showError('O lucro por período deve ser positivo.'); return; }
      if (!startDate) { showError('Selecione uma data de início.'); return; }
      if (isNaN(durationMonths) || durationMonths < 1) { showError('A duração deve ser de pelo menos 1 mês.'); return; }
      if (frequency === 'custom' && (isNaN(customFrequencyMonths) || customFrequencyMonths < 1)) { showError('Defina o período personalizado em meses (mínimo 1).'); return; }

      const intervalCheck = frequencyMonths(frequency, durationMonths, customFrequencyMonths);
      if (durationMonths % intervalCheck !== 0) {
        if (!confirm(`Aviso: A duração de ${durationMonths} meses não é um múltiplo exato da frequência de recebimento (${intervalCheck} meses). O último pagamento será antecipado ou cortado. Deseja continuar?`)) return;
      }

      const inv = {
        id: editId || uid(),
        name, categoryId, principal, profitPercentage, startDate, frequency, durationMonths, showInBDM, customFrequencyMonths,
        createdAt: editId ? (App.investments.find(i => i.id === editId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
        type: 'periodic',
        unitValue: null,
        quantity: null,
      };

      try {
        if (editId) await deleteInvestmentEvents(editId);
        await dbPutInvestment(inv);
        const evts = generateEvents(inv);
        await dbPutEvents(evts);
        await loadAllData();
        renderCalendar();
        closeInvestmentModal();
        toast(editId ? 'Investimento atualizado!' : `${evts.length} evento(s) gerado(s) no calendário!`, 'success');
      } catch (err) {
        showError('Erro ao salvar: ' + err.message);
      }
    }
```

- [ ] **Step 2: Verificar no browser — salvar ativo**

Abrir modal → aba "Só Valorização" → nome "BDM Token", valor 0.50, quantidade 1000 → Salvar.
Esperado: toast "Ativo adicionado à carteira!" sem erros.

- [ ] **Step 3: Verificar no browser — salvar investimento periódico**

Abrir modal → aba "Com Rendimento" → preencher campos normais → Salvar.
Esperado: toast com contagem de eventos, comportamento idêntico ao anterior.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: saveInvestment handles asset type without generating events"
```

---

## Task 9: openAddModal e editInvestment — suporte ao tipo

**Files:**
- Modify: `index.html:2792-2907`

- [ ] **Step 1: Atualizar openAddModal para aceitar type**

Localizar (linha ~2792):
```js
    function openAddModal() {
      App.editingInvestmentId = null;
      document.getElementById('modal-inv-title').textContent = 'Novo Investimento';
      document.getElementById('form-investment').reset();
      document.getElementById('inv-edit-id').value = '';
```

Substituir por:
```js
    function openAddModal(type) {
      App.editingInvestmentId = null;
      const t = type || 'periodic';
      document.getElementById('modal-inv-title').textContent = t === 'asset' ? 'Novo Ativo' : 'Novo Investimento';
      document.getElementById('form-investment').reset();
      document.getElementById('inv-edit-id').value = '';
```

E logo após o `populateCategorySelect()` e antes do `showModal('modal-investment')`, adicionar:
```js
      switchInvestmentType(t);
      document.getElementById('inv-asset-total').textContent = 'R$ 0,00';
```

- [ ] **Step 2: Atualizar editInvestment para restaurar campos do ativo**

Localizar `function editInvestment(invId)` (linha ~2886). Após preencher os campos existentes (após `inv-show-bdm`), adicionar:
```js
      switchInvestmentType(inv.type || 'periodic');
      if (inv.type === 'asset') {
        document.getElementById('inv-unit-value').value = inv.unitValue || '';
        document.getElementById('inv-quantity').value = inv.quantity || '';
        updateAssetTotal();
      }
```

Também atualizar o título do modal no início de `editInvestment`:
```js
      document.getElementById('modal-inv-title').textContent = inv.type === 'asset' ? 'Editar Ativo' : 'Editar Investimento';
```

- [ ] **Step 3: Verificar no browser — editar ativo**

Criar um ativo → abrir edição → verificar que tab "Só Valorização" está ativa e campos preenchidos.
Editar valores → salvar → verificar que total foi recalculado.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: openAddModal and editInvestment support asset type"
```

---

## Task 10: FAB Speed Dial — 3º item "Ativo"

**Files:**
- Modify: `index.html:862-887`

- [ ] **Step 1: Adicionar item "Ativo" no dial**

Localizar o bloco do FAB speed dial (linha ~862):
```html
  <div id="fab-dial" class="md:hidden fixed z-50"
    style="display:none;bottom:calc(5.5rem + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%)">
    <div class="flex items-end gap-5">
      <div class="fab-dial-item flex flex-col items-center gap-2" style="transition-delay:40ms">
        <button onclick="openAddModal();closeFAB()"
```

Substituir o conteúdo completo do `<div class="flex items-end gap-5">` por:
```html
    <div class="flex items-end gap-5">
      <div class="fab-dial-item flex flex-col items-center gap-2" style="transition-delay:80ms">
        <button onclick="openAddModal('asset');closeFAB()"
          class="w-14 h-14 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
          style="background:rgba(56,189,248,.1);border:1.5px solid rgba(56,189,248,.4);box-shadow:0 6px 24px rgba(14,165,233,.2)">
          <span class="material-symbols-outlined text-[22px] text-primary"
            style="font-variation-settings:'wght' 400">inventory_2</span>
        </button>
        <span class="text-[10px] font-semibold tracking-wide whitespace-nowrap px-2.5 py-1 rounded-full"
          style="color:#eae1d4;background:rgba(9,9,11,.8)">Ativo</span>
      </div>
      <div class="fab-dial-item flex flex-col items-center gap-2" style="transition-delay:40ms">
        <button onclick="openAddModal('periodic');closeFAB()"
          class="w-14 h-14 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
          style="background:linear-gradient(135deg,#0ea5e9,#38bdf8);box-shadow:0 6px 24px rgba(14,165,233,.45)">
          <span class="material-symbols-outlined text-[22px] text-on-primary"
            style="font-variation-settings:'wght' 500">add_circle</span>
        </button>
        <span class="text-[10px] font-semibold tracking-wide whitespace-nowrap px-2.5 py-1 rounded-full"
          style="color:#eae1d4;background:rgba(9,9,11,.8)">Investimento</span>
      </div>
      <div class="fab-dial-item flex flex-col items-center gap-2" style="transition-delay:0ms">
        <button onclick="openCategoryModal();closeFAB()"
          class="w-14 h-14 rounded-2xl flex items-center justify-center active:scale-95 transition-transform"
          style="background:rgba(56,189,248,.1);border:1.5px solid rgba(56,189,248,.4);box-shadow:0 6px 24px rgba(14,165,233,.2)">
          <span class="material-symbols-outlined text-[22px] text-primary"
            style="font-variation-settings:'wght' 400">label</span>
        </button>
        <span class="text-[10px] font-semibold tracking-wide whitespace-nowrap px-2.5 py-1 rounded-full"
          style="color:#eae1d4;background:rgba(9,9,11,.8)">Categoria</span>
      </div>
    </div>
```

- [ ] **Step 2: Verificar no browser (mobile/< 1024px)**

Tocar FAB central → 3 opções aparecem: Ativo, Investimento, Categoria.
Tocar "Ativo" → modal abre na aba "Só Valorização".
Tocar "Investimento" → modal abre na aba "Com Rendimento".

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add third FAB speed dial item for asset type"
```

---

## Task 11: Sidebar Desktop — botão "Novo Ativo"

**Files:**
- Modify: `index.html:970-975`

- [ ] **Step 1: Adicionar botão abaixo de "Novo Investimento"**

Localizar (linha ~970):
```html
    <!-- Add Investment button -->
    <button onclick="openAddModal()"
      class="mx-1 mb-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary\10 border border-primary\20 text-primary font-semibold text-sm hover:bg-primary/15 transition-all gold-glow">
      <span class="material-symbols-outlined text-[18px]" style="font-variation-settings:'wght' 400">add_circle</span>
      Novo Investimento
    </button>
```

Substituir por:
```html
    <!-- Add Investment / Asset buttons -->
    <button onclick="openAddModal('periodic')"
      class="mx-1 mb-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary/10 border border-primary/20 text-primary font-semibold text-sm hover:bg-primary/15 transition-all gold-glow">
      <span class="material-symbols-outlined text-[18px]" style="font-variation-settings:'wght' 400">add_circle</span>
      Novo Investimento
    </button>
    <button onclick="openAddModal('asset')"
      class="mx-1 mb-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary/10 border border-primary/20 text-primary font-semibold text-sm hover:bg-primary/15 transition-all">
      <span class="material-symbols-outlined text-[18px]" style="font-variation-settings:'wght' 400">inventory_2</span>
      Novo Ativo
    </button>
```

- [ ] **Step 2: Verificar no browser (desktop)**

Na sidebar esquerda: dois botões visíveis — "Novo Investimento" e abaixo "Novo Ativo".
Clicar "Novo Ativo" → modal abre na tab "Só Valorização".

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add Novo Ativo button to desktop sidebar"
```

---

## Task 12: Cálculos — filtrar ativos de funções de renda

**Files:**
- Modify: `index.html:2970-2995` (getMonthlyIncomeEst, renderRankings)

- [ ] **Step 1: Filtrar ativos em getMonthlyIncomeEst**

Localizar (linha ~2970):
```js
    function getMonthlyIncomeEst() {
      let total = 0;
      for (const inv of App.investments) {
        if (!inv.durationMonths) continue;
```

Substituir por:
```js
    function getMonthlyIncomeEst() {
      let total = 0;
      for (const inv of App.investments) {
        if (inv.type === 'asset') continue;
        if (!inv.durationMonths) continue;
```

- [ ] **Step 2: Filtrar ativos em renderRankings**

Localizar (linha ~3390):
```js
      const ranked = App.investments.map(inv => ({ inv, roi: getInvestmentROI(inv) })).sort((a, b) => b.roi - a.roi);
```

Substituir por:
```js
      const ranked = App.investments
        .filter(inv => inv.type !== 'asset')
        .map(inv => ({ inv, roi: getInvestmentROI(inv) }))
        .sort((a, b) => b.roi - a.roi);
```

- [ ] **Step 3: Verificar no browser**

Criar um ativo "Só Valorização" com R$ 5.000 total.
Ir em Insights → KPI "Renda Mensal": não deve incluir o ativo.
Ranking: ativo não deve aparecer na lista.
Patrimônio total (se exibido nos KPIs): deve incluir o ativo.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: exclude asset-type investments from income and ranking calculations"
```

---

## Task 13: Insights — seção "Ativos em Carteira"

**Files:**
- Modify: `index.html:1341` (após o grid Ranking + Milestones)
- Modify: `index.html:3213-3218` (renderInsights — chamar renderAssetsSection)
- Modify: `index.html` — adicionar função `renderAssetsSection`

### Subtask 13a — HTML da seção

- [ ] **Step 1: Adicionar card "Ativos em Carteira" após o grid**

Localizar o fechamento do grid (linha ~1341):
```html
        </div>
      </div>
    </div>
```

O grid tem a estrutura `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">`. Adicionar logo após o fechamento desse grid:

```html
        <!-- Ativos em Carteira -->
        <div id="assets-section" class="hidden mt-4">
          <div class="premium-card rounded-xl p-5">
            <div class="flex justify-between items-start mb-4">
              <div>
                <h3 class="text-sm font-semibold text-on-surface">Ativos em Carteira</h3>
                <p class="text-[10px] text-secondary/50 mt-0.5">Patrimônio sem rendimento periódico</p>
              </div>
            </div>
            <div id="assets-list"></div>
          </div>
        </div>
```

### Subtask 13b — JS: renderAssetsSection

- [ ] **Step 2: Adicionar função renderAssetsSection após renderRankings**

Localizar o final de `renderRankings()` (linha ~3417) e adicionar logo após:

```js
    function renderAssetsSection() {
      const assets = App.investments.filter(i => i.type === 'asset');
      const section = document.getElementById('assets-section');
      const list = document.getElementById('assets-list');
      if (!section || !list) return;

      if (assets.length === 0) { section.classList.add('hidden'); return; }
      section.classList.remove('hidden');

      list.innerHTML = assets.map((inv, idx) => {
        const color = getCategoryColor(inv.categoryId);
        const total = inv.principal;
        const bdmVal = (inv.showInBDM && App.bdmRate > 0) ? toBDM(total) : null;
        const uv = inv.unitValue || 0;
        const qty = inv.quantity || 0;
        return `<div class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/3 transition-colors group">
      <div class="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5" style="background:${color}"></div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-on-surface truncate">${inv.name}</span>
          <span class="text-xs font-bold text-primary tabular-nums ml-2 whitespace-nowrap">${fmtBRL(total)}</span>
        </div>
        <div class="flex items-center justify-between mt-0.5">
          <span class="text-[10px] text-secondary/50 tabular-nums">${NUM.format(qty)} un × ${fmtBRL(uv)}</span>
          ${bdmVal !== null ? `<span class="text-[10px] text-secondary/50 tabular-nums ml-2">${fmtBDM(bdmVal)}</span>` : ''}
        </div>
      </div>
      <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onclick="editInvestment('${inv.id}')" class="p-1 rounded text-secondary/50 hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-[14px]" style="font-variation-settings:'wght' 300">edit</span>
        </button>
        <button onclick="deleteInvestment('${inv.id}')" class="p-1 rounded text-secondary/50 hover:text-error transition-colors">
          <span class="material-symbols-outlined text-[14px]" style="font-variation-settings:'wght' 300">delete</span>
        </button>
      </div>
    </div>`;
      }).join('');
    }
```

### Subtask 13c — Chamar renderAssetsSection em renderInsights

- [ ] **Step 3: Chamar a função na renderização de Insights**

Localizar em `renderInsights()` (linha ~3218):
```js
      // Rankings
      renderRankings();
```

Adicionar logo após:
```js
      // Assets
      renderAssetsSection();
```

- [ ] **Step 4: Verificar no browser**

Com ativos cadastrados → Insights → seção "Ativos em Carteira" aparece abaixo do grid.
Cada ativo exibe nome, quantidade × valor unitário, total em R$, e valor em cripto se configurado.
Sem ativos: seção não aparece.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add Ativos em Carteira section to Insights"
```

---

## Checklist Final

- [ ] Migração SQL executada (3 colunas existem na tabela)
- [ ] Botão "Criar Categoria" mostra erro ao falhar
- [ ] Ranking exibe capital investido abaixo do nome
- [ ] Calendário exibe aviso de deságio em dias com eventos BDM
- [ ] Modal aceita dois tipos com pill-tabs funcionais
- [ ] Salvar ativo não gera eventos no calendário
- [ ] Salvar ativo cria registro com `type='asset'` no Supabase
- [ ] Editar ativo restaura todos os campos corretamente
- [ ] FAB mobile exibe 3 opções: Ativo, Investimento, Categoria
- [ ] Sidebar desktop exibe "Novo Ativo" abaixo de "Novo Investimento"
- [ ] Ativo não aparece no ranking nem na renda estimada
- [ ] Ativo aparece no patrimônio total e no donut de distribuição
- [ ] Seção "Ativos em Carteira" aparece/some conforme existência de ativos
