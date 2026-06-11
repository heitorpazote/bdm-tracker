# Spec — Reinvestimento Periódico + UX Mobile Tátil

**Data:** 2026-06-10
**Projeto:** Cripto Tracker (AgendaInvestimento_BDM)
**Status:** Aprovado para planejamento

---

## 1. Contexto e Objetivo

Duas frentes independentes, planejadas juntas e a serem implementadas no mesmo ciclo:

1. **Matemática de reinvestimento periódico** — corrigir o cálculo de lucros para que, com reinvestimento ligado, cada recebimento periódico seja reaplicado **no momento em que é recebido** (compondo o principal a cada período), em vez de apenas no vencimento do investimento. Afeta Calendário e Insights.
2. **UX Mobile tátil** — adicionar gestos e padrões mobile-first (swipe, bottom-sheet, háptico, long-press, pull-to-refresh) para uma experiência de toque satisfatória.

---

## 2. Workstream 1 — Reinvestimento Periódico

### 2.1 Modelo atual (a substituir)

- `js/schedule.js → computeSchedule` calcula `netPerPeriod` fixo sobre o principal original e um `totalReinvest = principal + netPerPeriod` usado só no vencimento.
- `index.html → buildProfitByMonth` (~3370) compõe o principal **apenas no vencimento** de cada ciclo (`principal += netPer * numPeriods; cycleStartM += durationMonths`).
- O Calendário mostra uma linha "com reinvestimento no vencimento" somente no último pagamento (`isLastPayment`).

### 2.2 Modelo novo

Com reinvestimento LIGADO, para cada investimento:

- `principal` começa em `inv.principal`.
- A cada período `p` (espaçado por `interval` meses):
  - `grossProfit = principal × (inv.profitPercentage / 100)`
  - `desagio = inv.showInBDM ? WITHDRAWAL_DESAGIO : 0` (10%)
  - `netProfit = grossProfit × (1 - desagio)`
  - `principal += netProfit` (composição imediata)
- Os períodos continuam de forma contínua através do horizonte de projeção; as fronteiras de ciclo/vencimento deixam de ter efeito especial, pois o capital já cresce a cada pagamento (renovação implícita).

**Exemplo (1000 @ 25% a cada 4 meses, sem `showInBDM`):**

| Período | Mês | Gross (25% × principal) | Net | Principal após |
|---|---|---|---|---|
| 1 | 4 | 250,00 | 250,00 | 1250,00 |
| 2 | 8 | 312,50 | 312,50 | 1562,50 |
| 3 | 12 | 390,63 | 390,63 | 1953,13 |
| … | … | … | … | … |

**Regra do deságio (10%):** incide sobre o lucro de cada período **somente quando `inv.showInBDM === true`** (opção "mostrar valor em cripto" ativa). Quando aplicado, a UI **sempre menciona** o deságio ao usuário. Mantém o default existente `applyDesagio = inv.showInBDM` de `computeSchedule`.

**Reinvestimento DESLIGADO:** comportamento idêntico ao atual — lucro fixo sobre o principal original, sem composição.

### 2.3 Arquitetura — fonte única da verdade

Adicionar ao módulo `BDMSchedule` (`js/schedule.js`) um gerador:

```
compoundedPeriods(inv, { reinvest, horizonMonths, applyDesagio? }) → Array<{
  periodIndex,        // 1, 2, 3, ...
  monthOffset,        // meses a partir do startDate do investimento
  principalBefore,    // principal antes deste período
  grossProfit,
  netProfit,
  principalAfter
}>
```

- `reinvest = false` → retorna períodos com lucro fixo sobre o principal original (sem composição), limitado a `numPeriods`.
- `reinvest = true` → compõe `principal += netProfit` a cada período, gerando períodos até cobrir `horizonMonths`.
- `applyDesagio` segue `inv.showInBDM` por default; pode ser sobrescrito.
- Reaproveita `frequencyMonths` e a lógica de `computeSchedule` (que permanece para compatibilidade com chamadas existentes não relacionadas à projeção).

Tanto o **Calendário** quanto o `buildProfitByMonth` consomem este gerador → calendário e insights nunca divergem.

### 2.4 Mudanças no Calendário

Locais: views de detalhe do dia e lista de eventos (`index.html` ~2846, ~2944, ~3023).

- Cada evento periódico mantém seu **valor fixo real** como número primário (ex.: `R$ 250,00`).
- Com o toggle de reinvestimento LIGADO, adicionar uma linha secundária **"se reinvestir"** com o lucro **composto** projetado daquele período (período 2 → `R$ 312,50`), obtido de `compoundedPeriods` mapeando o evento ao seu `periodIndex` dentro do investimento.
- **Remover** a linha atual "com reinvestimento no vencimento" (modelo só-no-vencimento descontinuado), substituída pela linha por-período acima.
- Quando `showInBDM`, a linha indica que o deságio de 10% foi aplicado.

### 2.5 Mudanças nos Insights

- `buildProfitByMonth` (`index.html:3370`): substituir o laço de composição-no-vencimento pelo gerador `compoundedPeriods` (composição a cada período, contínua pelo horizonte). Preservar o parâmetro `spread` (distribuição do lucro pelos meses do intervalo) usado nos marcos.
- Propagação automática para: gráfico de projeção (`getProjectionData`), projeção real/IPCA, marcos (`calculateMilestone`) e textos de `generateDynamicInsights`.
- Atualizar os textos das tooltips/avisos que dizem "ao vencer / no vencimento" para refletir a composição **a cada recebimento**.

### 2.6 Fora de escopo

- Tela **Calculadora** (`calculator`) — usuário especificou Calendário + Insights.
- KPIs de estado atual (estimativa de renda mensal, yield atual) permanecem sobre o principal presente; descrevem "agora", não a projeção.
- Eventos persistidos no Supabase (`App.events`) **não são mutados** — a composição é projeção/what-if derivada em runtime.

---

## 3. Workstream 2 — UX Mobile Tátil

Todos os gestos são **mobile-only**, ativados por detecção de toque + viewport; desktop permanece inalterado. Implementação em touch events nativos (sem novas dependências). Um **helper de gestos compartilhado** centraliza a matemática de swipe/long-press/drag para evitar duplicação.

### 3.1 Swipe de mês no calendário (baseline)

- Swipe horizontal sobre a grade do calendário troca o mês (anterior/próximo) com transição de slide sutil.
- Threshold mínimo de distância + **direction-lock**: se o gesto for predominantemente vertical, o scroll normal prevalece (não captura).
- Integra com a navegação de mês existente.

### 3.2 Modais como bottom-sheet

- No mobile, `glass-modal` sobe a partir da base com uma **alça (drag handle)** no topo.
- Arrastar para baixo além de um threshold (ou tocar no backdrop) fecha o modal.
- Desktop mantém os modais centralizados (sem alteração).

### 3.3 Feedback háptico

- `navigator.vibrate()` com micro-pulsos em: troca de mês, abertura/fechamento de modal, ações de confirmação.
- Feature-detected; silencioso onde não suportado (iOS Safari não suporta — degradar sem erro).

### 3.4 Long-press no dia

- Pressionar e segurar um dia do calendário abre um **popover leve** com preview dos eventos daquele dia, sem navegação completa.
- Cancelar ao mover o dedo além de um threshold (distingue de scroll/swipe).

### 3.5 Pull-to-refresh

- Puxar para baixo no topo da tela re-sincroniza dados do Supabase, com indicador de carregamento (spinner).
- Só dispara quando o scroll está no topo; threshold de ativação para evitar disparos acidentais.

---

## 4. Critérios de Sucesso

- Com reinvestimento ligado, calendário e insights mostram valores compostos **idênticos** para o mesmo período (mesma fonte: `compoundedPeriods`).
- Exemplo de referência (1000 @ 25%/4mo) bate com a tabela da seção 2.2.
- Deságio de 10% aplicado por período somente quando `showInBDM`, com aviso visível.
- Reinvestimento desligado produz exatamente os números atuais.
- Em mobile: swipe troca mês; modais funcionam como bottom-sheet arrastável; háptico responde onde suportado; long-press abre preview; pull-to-refresh re-sincroniza.
- Desktop sem regressões nos gestos/modais.

---

## 5. Notas de Implementação

- Manter o padrão single-file (`index.html`) + módulo `js/schedule.js`; sem build step.
- Reusar classes do design system (`glass-modal`, `premium-card`, `fi`, `.tog`).
- Atualizar `STATE.md` ao final, conforme convenção do projeto.
