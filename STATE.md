# Project State

## Last Updated
2026-06-09

## Recent Changes
- 2026-06-09: **3 bugs corrigidos** — (1) Duplicação de eventos: `saveInvestment` ganhou guard `_savingInvestment` com `finally` nos dois branches (asset e periódico), impedindo double-submit. (2) Exclusão mobile em Insights: botões edit/delete mudaram de `opacity-0 group-hover:opacity-100` para `opacity-100 md:opacity-0 md:group-hover:opacity-100` — sempre visíveis em mobile, hover-only no desktop. (3) Microfone IA em mobile: CSS `#screen-ai.active` agora desconta `env(safe-area-inset-bottom)` da altura, evitando que o input/mic fique atrás da bottom nav em iPhones com home indicator; JS keyboard fix atualizado para usar `bottomNav.offsetHeight` real.
- 2026-06-08: **Calendário — clareza de deságio**: valor bruto (sem deságio) agora é o valor principal em todas as visualizações; valor líquido (−10%) exibido abaixo quando há investimento BDM. Aplica-se a: detail panel desktop, modal mobile, agenda view. `totalReinvest` no schedule.js corrigido para usar `netPerPeriod` (deságio sobre o lucro), mostrando o valor líquido real no reinvestimento.
- 2026-06-08: **STT — Web Speech API como primário**: `_SpeechAPI` (SpeechRecognition nativo) agora é tentado primeiro; sem necessidade de backend para Chrome/Edge/Android. MediaRecorder+Whisper mantido como fallback para browsers sem suporte. Edge function `ai-stt` atualizada para retornar sempre HTTP 200 (erros no body) — elimina FunctionsHttpError opaco do Supabase client. **Ação necessária**: reimplantar `supabase/functions/ai-stt` com `npx supabase functions deploy ai-stt`.
- 2026-06-06: **STT (Voz → Texto) no Agente IA**: botão mic adicionado; Mobile = segurar para gravar, Desktop = clique para iniciar + botão stop; 30s máx com progress bar; transcrição via Edge Function `ai-stt` + OpenRouter Gemini 2.5 Flash Lite; estados visuais: idle/recording (vermelho pulsando)/loading (spinner)
- 2026-06-06: **Agente IA — Cadastro de Ativos**: MODO 7 `create_asset` adicionado ao system prompt; `_showCreateAssetCard`, `confirmAICreateAsset` implementados; `_handleAIActions` roteia `create_asset`; `_buildContext` separado em periódicos + ativos
- 2026-06-06: **Agente IA — System prompt enriquecido**: conhecimento da plataforma (cálculos APR, deságio, tipos de investimento, análise profissional), R10 obrigando uso de ### em respostas longas, checklist específico por tipo (periódico vs ativo)
- 2026-06-06: **Agente IA — Quick action chips**: chips atualizados para "Analisar Carteira", "Melhor Rendimento", "Rebalancear", "Novo Investimento", "Novo Ativo"
- 2026-06-06: **Insights — Rentabilidade corrigida**: `getAvgAnnualYield` mudou de composta `(1+r)^12-1` para linear `avgMonthly × 12` (APR nominal). Tooltip e label atualizados para "Nominal a.a. (APR)"
- 2026-06-06: **Mobile — Insights horizontal scroll**: `overflow-x: hidden` adicionado ao `#screen-insights.active` mobile
- 2026-06-06: **Mobile — Agente teclado virtual**: `initAIMobileKeyboardFix()` usa Visual Viewport API para redimensionar o screen-ai quando teclado abre no iOS; fallback `scrollIntoView` para browsers sem suporte; reset ao blur e ao navegar
- 2026-06-06: Markdown headings (#, ##, ###) agora renderizam corretamente no Agente IA (`_renderMsg`)
- 2026-06-06: Insights mobile: altura constrangida a `100dvh - 8rem` com `overflow-y: auto` — tela agora fica estática como as outras
- 2026-06-06: Agente IA mobile: viewport meta atualizado com `interactive-widget=resizes-content`
- 2026-06-06: AI screen e Insights screen usam `100dvh` (dynamic viewport height) como fallback moderno
- 2026-06-04: Gráfico comparativo Ativos × Recorrentes adicionado na tela Insights
- 2026-06-04: Sistema de tooltips (ícone ?) adicionado em Insights e modal de investimento
- 2026-06-04: Descrição adicionada no header do Calendário
- 2026-06-04: Atribuição "Feito por: Heitor Pazote" adicionada
- 2026-06-04: CLAUDE.md e STATE.md criados

## Screen Status
| Tela | Status | Observações |
|---|---|---|
| Calendário | stable | Sem alterações recentes |
| Insights | stable | Rentabilidade corrigida (APR linear); scroll horizontal fixado no mobile |
| Calculadora | stable | Sem alterações recentes |
| Agente IA | stable | Cadastro de ativos; system prompt enriquecido; chips atualizados; teclado mobile via Visual Viewport API |

## Open Issues / TODOs
- Nenhum pendente

## Sessão 2026-06-06 (continuação)
- **STT Edge Function corrigida e deployada**:
  - Criado `supabase/functions/ai-stt/index.ts` (seguindo padrão do `ai-chat`)
  - Deploy feito via Supabase CLI (`npx supabase`) usando access token — função `ai-stt` agora está ACTIVE no projeto `rzsciusbrlqvgazizsuq`
  - Modelo trocado: `google/gemini-2.5-flash-lite-preview-09-2025` (ID inválido no OpenRouter) → `google/gemini-2.0-flash-001` (suporta áudio, estável)
  - Edge function agora retorna sempre HTTP 200; erros do OpenRouter ficam no body (evita `FunctionsHttpError` opaco no cliente)
  - Frontend: tratamento de `data.error` corrigido — extrai `data.error.message` quando for objeto

## Bugs Corrigidos (sessão atual)
- Agente: chips "Analisar Carteira" e "Melhor Rendimento" usavam textos ambíguos ("investimentos ativos" podia ser interpretado como tipo asset) → corrigidos para mencionar explicitamente periódicos e ativos
- Agente: `categoryId` estava no CHECKLIST OBRIGATORIO de ativos com "SEMPRE pergunte" → bloqueava criação de ativos sem categoria via agente. Corrigido: campo agora é OPCIONAL, R5 atualizado para não bloquear campos opcionais
- Modal: sem bloqueio frontend para categoria em ativos (categoryId = null é permitido). Se houver erro de DB, verificar constraint `category_id NOT NULL` na tabela `investments` do Supabase

## Design Decisions
- **Rentabilidade APR vs APY**: mudou para APR (linear) pois os investimentos pagam lucro fixo sobre principal sem capitalização automática. APR é mais fiel à realidade e evita inflação percebida dos números.
- **create_asset no Agente**: ativo não gera eventos no calendário (durationMonths=0), apenas registro de patrimônio. confirmAICreateAsset não chama generateEvents/dbPutEvents.
- **Visual Viewport API**: abordagem mais robusta para iOS (onde `interactive-widget=resizes-content` não funciona). Height do screen-ai é ajustado dinamicamente; resetado no blur e no navigate.
- Tooltips: CSS hover (desktop) + JS tap (mobile) via classe `.tip-open`
- Markdown headings: `<p>` com inline styles para manter consistência com o restante de `_renderMsg()`

> **Instrução ao agente:** Ao final de cada sessão de trabalho, ATUALIZAR este arquivo com as mudanças feitas, novos TODOs e decisões tomadas.
