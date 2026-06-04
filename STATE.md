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
- Atribuição: sidebar desktop (bottom) + Insights screen (footer mobile)
- CLAUDE.md: max ~60 linhas, objetivo e sem redundância com o código

> **Instrução ao agente:** Ao final de cada sessão de trabalho, ATUALIZAR este arquivo com as mudanças feitas, novos TODOs e decisões tomadas.
