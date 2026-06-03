# Design Spec: Ativos sem Ganho Periódico + Correções

**Data:** 2026-06-01
**Projeto:** Cripto Tracker — AgendaInvestimento_BDM
**Arquivo principal:** `index.html` (SPA single-file)

---

## Escopo

Quatro entregas neste spec:

1. **Fix A** — Botão "Adicionar Categoria" silenciosamente falha
2. **Fix B** — Ranking de Rentabilidade: exibir capital investido por ativo
3. **Fix C** — Calendário: aviso de deságio de 10% ao exibir ganhos em Cripto
4. **Feature** — Novo tipo de investimento "Só Valorização" (ativo sem ganho periódico)

---

## Fix A — Botão "Adicionar Categoria" não funciona

### Problema
`saveCategory()` (linha ~2940) não tem `try/catch`. Se `dbPutCategory()` lança um erro (falha de RLS, rede, user_id nulo), a exceção propaga silenciosamente — o botão parece não fazer nada.

### Solução
Envolver o bloco assíncrono em `try/catch` e exibir `toast(err.message, 'error')` em caso de falha. Padrão já usado em `saveInvestment()`.

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

---

## Fix B — Ranking: exibir capital investido

### Problema
O ranking exibe nome + barra de ROI, mas o capital investido (`principal`) está oculto — o usuário precisa abrir o modal de edição para vê-lo.

### Solução
Em `renderRankings()` (linha ~3396), adicionar abaixo do nome de cada item uma linha com `fmtBRL(item.inv.principal)`, em `text-[10px] text-secondary/50`, sempre visível.

```html
<span class="text-xs font-semibold text-on-surface truncate">${item.inv.name}</span>
<span class="text-[10px] text-secondary/50 tabular-nums">${fmtBRL(item.inv.principal)}</span>
```

---

## Fix C — Calendário: aviso de deságio 10% em Cripto

### Problema
Quando o usuário abre o detalhe de um dia no calendário e há investimentos com `showInBDM = true`, os valores em Cripto são exibidos sem nenhuma nota sobre o deságio de 10% no saque.

### Solução
Em `openDayModal()` (linha ~2716) e no bloco equivalente da view desktop (renderização inline dos eventos do dia), verificar se há eventos BDM visíveis. Se sim, appender ao HTML uma nota de rodapé:

```html
<p class="text-[10px] text-secondary/40 mt-3 pt-2 border-t border-white/5 leading-relaxed">
  <span class="material-symbols-outlined text-[11px] align-middle" style="font-variation-settings:'wght' 400">info</span>
  Valores em Cripto exibem o lucro bruto. O saque tem deságio de 10% sobre o lucro.
</p>
```

Condição de exibição: `bdmEvts.length > 0 && App.bdmRate > 0`.

---

## Feature — Ativo sem Ganho Periódico ("Só Valorização")

### Conceito
Ativos que o usuário possui em carteira mas que não geram renda periódica — apenas se valorizam (ex: tokens, cotas, criptoativos). São contabilizados como patrimônio e distribuição, mas **não** como renda.

### Banco de Dados

Adicionar 3 colunas à tabela `investments` no Supabase:

```sql
ALTER TABLE investments
  ADD COLUMN type TEXT NOT NULL DEFAULT 'periodic',
  ADD COLUMN unit_value NUMERIC,
  ADD COLUMN quantity NUMERIC;
```

- `type`: `'periodic'` (investimento existente) | `'asset'` (novo)
- `unit_value`: valor por unidade do ativo (R$)
- `quantity`: quantidade de unidades
- `principal`: continua sendo o total — para ativos, `principal = unit_value × quantity` (gravado no save)

### Modelo JS

Atualizar `mapInvestmentFromDB` e `mapInvestmentToDB`:

```js
// fromDB
type: r.type || 'periodic',
unitValue: r.unit_value ? parseFloat(r.unit_value) : null,
quantity: r.quantity ? parseFloat(r.quantity) : null,

// toDB
type: inv.type || 'periodic',
unit_value: inv.unitValue || null,
quantity: inv.quantity || null,
```

### Modal — Seletor de Tipo

O modal `#modal-investment` recebe, logo abaixo do título, dois pill-tabs:

```
[ ● Com Rendimento ]   [   Só Valorização   ]
```

- Implementados como dois `<button>` com classe ativa via JS (`inv-type-periodic` / `inv-type-asset`)
- Campo hidden `#inv-type` guarda o valor atual (`'periodic'` | `'asset'`)
- Ao trocar de tipo, função `switchInvestmentType(type)` mostra/oculta os blocos de campos:
  - **`#inv-periodic-fields`**: Lucro/Período, Data de Início, Frequência, Duração (visível apenas em `periodic`)
  - **`#inv-asset-fields`**: Valor por Unidade (R$/un), Quantidade, Total read-only (visível apenas em `asset`)
  - Nome, Categoria e "Exibir em Cripto" são comuns — sempre visíveis

### Total read-only (assets)
Campo `#inv-asset-total` atualizado em tempo real via `oninput` em `#inv-unit-value` e `#inv-quantity`:

```js
function updateAssetTotal() {
  const uv = parseFloat(document.getElementById('inv-unit-value').value) || 0;
  const qty = parseFloat(document.getElementById('inv-quantity').value) || 0;
  document.getElementById('inv-asset-total').textContent = fmtBRL(uv * qty);
}
```

### Lógica de Save

Em `saveInvestment()`:
- Se `type === 'asset'`: validar apenas nome, unit_value > 0, quantity > 0; `principal = unitValue × quantity`; não chamar `generateEvents()`
- Se `type === 'periodic'`: comportamento atual sem mudança

### Lógica de Edit

Em `editInvestment()`, detectar `inv.type` e chamar `switchInvestmentType(inv.type)`, preencher `#inv-unit-value` e `#inv-quantity`.

### FAB Speed Dial (Mobile)

O dial passa de 2 para 3 itens (esquerda → direita):

| Posição | Label | Ação | Ícone |
|---|---|---|---|
| Esquerda | Ativo | `openAddModal('asset'); closeFAB()` | `inventory_2` |
| Centro | Investimento | `openAddModal('periodic'); closeFAB()` | `add_circle` |
| Direita | Categoria | `openCategoryModal(); closeFAB()` | `label` |

`openAddModal()` aceita um parâmetro opcional `type` (default `'periodic'`) e chama `switchInvestmentType(type)` antes de exibir o modal.

### Sidebar Desktop

Abaixo do botão "Novo Investimento" (linha ~971), adicionar:

```html
<button onclick="openAddModal('asset')"
  class="mx-1 mb-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary/10 border border-primary/20 text-primary font-semibold text-sm hover:bg-primary/15 transition-all">
  <span class="material-symbols-outlined text-[18px]" style="font-variation-settings:'wght' 400">inventory_2</span>
  Novo Ativo
</button>
```

### Cálculos — O que muda

| Função | Mudança |
|---|---|
| `getTotalPatrimony()` | Nenhuma — usa `principal`, que já inclui ativos |
| `getMonthlyIncomeEst()` | Filtrar `inv.type !== 'asset'` antes do loop |
| `getInvestmentROI()` | Nenhuma — ativos não têm eventos, ROI = 0 |
| `renderRankings()` | Filtrar `inv.type !== 'asset'` no array `ranked` |
| Donut chart | Nenhuma — usa `principal`, inclui ativos automaticamente |
| Milestones | Nenhuma — usa `getTotalPatrimony()`, já inclui |

### Seção "Ativos em Carteira" (Insights)

Card novo de largura total (`col-span-2`), posicionado abaixo do grid Ranking + Milestones. Exibido condicionalmente apenas quando `App.investments.some(i => i.type === 'asset')`.

Cada linha de ativo exibe:
- Dot colorido por categoria
- Nome
- `{qty} × {fmtBRL(unitValue)}`
- Total em R$ (negrito, cor primária)
- Valor em Cripto se `showInBDM && App.bdmRate > 0`
- Botões editar/excluir no hover (mesmo padrão do ranking)

Header do card: `"Ativos em Carteira"` + subtítulo `"Patrimônio sem rendimento periódico"`.

---

## Ordem de Implementação Sugerida

1. Migração SQL no Supabase (3 colunas)
2. Fix A — try/catch em saveCategory
3. Fix B — capital no ranking
4. Fix C — aviso deságio no calendário
5. Modelo JS (mapFromDB/toDB)
6. Modal — pill-tabs + campos asset + switchInvestmentType
7. saveInvestment + openAddModal + editInvestment para suportar type
8. FAB speed dial — 3º item
9. Sidebar desktop — botão "Novo Ativo"
10. Filtros nos cálculos (getMonthlyIncomeEst, renderRankings)
11. Seção "Ativos em Carteira" no Insights
