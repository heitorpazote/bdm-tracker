# Project State

## Last Updated
2026-06-06

## Recent Changes
- 2026-06-06: Markdown headings (#, ##, ###) agora renderizam corretamente no Agente IA (`_renderMsg`)
- 2026-06-06: Insights mobile: altura constrangida a `100dvh - 8rem` com `overflow-y: auto` — tela agora fica estática como as outras
- 2026-06-06: Agente IA mobile: viewport meta atualizado com `interactive-widget=resizes-content` — teclado agora redimensiona o viewport, evitando que o campo de digitação cubra os botões de ação rápida
- 2026-06-06: AI screen e Insights screen usam `100dvh` (dynamic viewport height) como fallback moderno
- 2026-06-04: Gráfico comparativo Ativos × Recorrentes adicionado na tela Insights
- 2026-06-04: Sistema de tooltips (ícone ?) adicionado em Insights e modal de investimento
- 2026-06-04: Descrição adicionada no header do Calendário
- 2026-06-04: Atribuição "Feito por: Heitor Pazote" adicionada
- 2026-06-04: CLAUDE.md e STATE.md criados

## Screen Status
| Tela | Status | Observações |
|---|---|---|
| Calendário | stable | Descrição do header expandida |
| Insights | stable | Fix mobile: scroll interno, não rola a página |
| Calculadora | stable | Sem alterações recentes |
| Agente IA | stable | Fix: headings markdown + teclado mobile |

## Open Issues / TODOs
- Nenhum pendente

## Design Decisions
- Tooltips: CSS hover (desktop) + JS tap (mobile) via classe `.tip-open`
- Gráfico comparativo: barra horizontal split, always-visible, full-width
- Atribuição: sidebar desktop (bottom) + Insights screen (footer mobile)
- CLAUDE.md: max ~60 linhas, objetivo e sem redundância com o código
- Mobile viewport: `interactive-widget=resizes-content` garante que teclado redimensiona o layout — afeta modais também (comportamento benéfico)
- Markdown headings: `<p>` com inline styles para manter consistência com o restante de `_renderMsg()`

> **Instrução ao agente:** Ao final de cada sessão de trabalho, ATUALIZAR este arquivo com as mudanças feitas, novos TODOs e decisões tomadas.
