# Design — Reinvestimento configurável + Humanização do agente (BDM Tracker)

Data: 2026-05-26
Arquivo único afetado: `index.html` (SPA)

## Contexto e problema

O BDM Tracker é uma SPA (`index.html`, ~3965 linhas) com três telas (Calendário, Insights, Calculadora) e um agente de IA. Foram identificados dois conjuntos de problemas:

### A) Cálculo de reinvestimento incorreto
- `generateEvents(inv)` compõe o lucro a cada período (`currentPrincipal += profitAmt`), o que torna o cálculo impossível na prática para investimentos com lucro por período.
- Inconsistência adicional descoberta: `generateEvents` trata `profitPercentage` como **lucro por período**, mas `getProjectionData` / `getProjectionDataReal` tratam como % do período inteiro (`duration`). As telas Calendário e Insights discordam entre si hoje.
- O modelo mental correto do usuário: `profitPercentage` é o lucro **por período** (ex.: 28% a cada 4 meses), **fixo**, calculado sempre sobre o valor investido — nunca composto dentro do investimento.

### B) Agente de IA robótico
- Regra "Sem saudações" (R7) e tom seco.
- Expõe termos técnicos ao usuário: `true/false`, nomes de campos em inglês, JSON, lista de campos do checklist.
- Deve sempre conversar em português (ptbr), salvo pedido explícito.

## Decisões travadas com o usuário

1. **Botão "Considerar Reinvestimento"**: presente em Insights e Calendário, **independentes por aba**, **padrão Ativado**, no mesmo estilo dos outros toggles.
2. **Períodos sempre fixos**: cada período rende `principal × taxa` (sem compor). O efeito do reinvestimento aparece **só no vencimento**.
3. **Deságio de 10%**: aplicado **sempre** aos valores em **R$**, **nunca** aos valores exibidos em **BDM**. Porém o **cálculo do reinvestimento sempre usa o lucro líquido** (já com -10%), inclusive quando o ativo é exibido em BDM (porque reinvestir implica sacar, e o saque tem deságio).
4. **Projeção/marcos agregados dos Insights**: tratados em **R$ com deságio aplicado ao lucro**. Valores por ativo em BDM permanecem sem deságio nas telas de detalhe.

## Abordagem escolhida: motor de cálculo centralizado (Opção A)

Criar uma função única `computeSchedule(inv, { reinvest })` como fonte única de verdade. Calendário, Insights e o contexto do agente passam a usar essa função. Eventos guardam **lucro bruto**; o deságio é aplicado na **camada de exibição** conforme R$/BDM.

## Especificação detalhada

### Constantes
- `WITHDRAWAL_DESAGIO = 0.10` (10% de deságio no saque do lucro).

### `computeSchedule(inv, { reinvest })`
Entrada: investimento (`principal`, `profitPercentage`, `startDate`, `frequency`, `customFrequencyMonths`, `durationMonths`) e flag `reinvest`.

Cálculo base (igual em ON e OFF):
- `interval = frequencyMonths(...)`, `numPeriods = floor(durationMonths / interval)` (mínimo 1).
- Lucro bruto por período = `principal × (profitPercentage/100)` — **fixo, sem compor**.
- Lucro líquido por período = bruto × (1 − 0.10).

Saída:
- Lista de períodos com: data, lucro bruto, lucro líquido, flag `isLastPayment`.
- No último período: devolução do capital (`principalReturn = principal`).
- Resumo de vencimento ON: `totalReinvest = principal + (lucroLíquido × numPeriods)`.
  - Exemplo: 1000 + (252 × 3) = **1.756**.

### Tabela de referência (R$ 1.000, 28%/4 meses, 12 meses, 3 períodos)

| | Em BDM (sem deságio) | Em R$ (com −10%) |
|---|---|---|
| Lucro por período | 280 | 252 (28% → 25,2%) |
| OFF — total no fim | 3×280 = 840 lucro + 1.000 capital | 3×252 = 756 lucro + 1.000 capital |
| ON — total no vencimento | 1.756 (1.000 + 252×3) | 1.756 (1.000 + 252×3) |

Observação confirmada: no modo ON exibindo em BDM, os períodos mostram **280** (cheio), mas o total de reinvestimento usa o lucro **líquido** (252×3).

### Eventos (`generateEvents`)
- Sempre lucro **fixo** por período (remover `currentPrincipal += profitAmt`).
- Armazenar lucro **bruto** no evento; deságio aplicado na exibição.

### Camada de exibição (R$ vs BDM)
- Helper de exibição que decide: ativo em R$ → aplica −10% no lucro; ativo em BDM → lucro cheio.
- A escolha R$/BDM segue o `showInBDM` do investimento.

### Calendário
- Sempre mostra cada período fixo (280 BDM / 252 R$).
- Modo ON: evento de vencimento ganha resumo destacado ("Com reinvestimento: R$ 1.756").
- Modo OFF: vencimento mostra lucro do período + devolução do capital, sem resumo de reinvestimento.
- Botão "Considerar Reinvestimento" no topo da tela.

### Insights
- Botão "Considerar Reinvestimento" no topo da tela (independente do botão do Calendário).
- `getProjectionData` / `getProjectionDataReal`:
  - OFF: projeção **linear** (soma do lucro líquido fixo por período, sem compor).
  - ON: composição **somente no vencimento** de cada ativo (reaplica `principal + lucro líquido acumulado` no próximo ciclo). Lucro per período corrigido para semântica "por período".
- Marcos (`calculateMilestone`) e rendimentos médios: lineares no OFF, compostos por vencimento no ON.
- Aviso fixo de "reinvestimento automático" (atual linha ~2843) passa a ser **condicional** ao estado do botão.
- Texto explicativo perto do cálculo: o −10% é o deságio da plataforma no saque do lucro.

### Agente de IA
- Remover a regra "Sem saudações"; permitir saudações e tom acolhedor mantendo objetividade nas ações.
- **Zero termos técnicos ao usuário**: nunca expor `true/false`, nomes de campos em inglês ou JSON. Coleta de dados faltantes em português natural (ex.: "Quer exibir esse investimento em BDM ou em reais?" em vez de "showInBDM: true/false").
- **Sempre português (ptbr)**, salvo pedido explícito de outro idioma.
- Ajustar a análise para não afirmar reinvestimento automático fixo.

## Fora de escopo
- Refatorações não relacionadas ao reinvestimento ou ao agente.
- Mudanças no modelo de persistência (IndexedDB) além do necessário para o botão.

## Critérios de sucesso
- Períodos nunca compõem dentro do investimento (calendário e insights consistentes entre si).
- Botão por aba, padrão ligado, alterna OFF/ON conforme a tabela de referência.
- Deságio aplicado em R$ e nunca em BDM; reinvestimento sempre com lucro líquido.
- Agente saúda, fala português, nunca expõe termos técnicos.
