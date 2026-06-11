# Project State

## Last Updated
2026-06-11

## Recent Changes
- 2026-06-11: **Grupo A — Agente IA (mic mobile, teclado, conhecimento)** — (A1) **Microfone desativado no mobile**: no APK (WebView) a permissão `RECORD_AUDIO` não é concedida → "acesso negado". `initSTT()` agora oculta `#ai-mic-btn` e retorna cedo quando `pointer:coarse`, sem registrar listeners de toque. Todo o código STT (`sttStart`, `_sttStartSpeechAPI`, `_sttStartWhisper`, `sttStop`, `_sttTranscribe`, `_sttSetUI`) **preservado** para reativação futura; desktop inalterado. (A2) **Sobreposição do cabeçalho ao abrir/fechar o teclado corrigida**: removido o handler `visualViewport.scroll → aiScreen.style.top` (o `#screen-ai` é estático, `top` não posiciona e deixava layout defasado na transição). `initAIMobileKeyboardFix()` agora só ajusta a **altura** via `applyVV` (guardado por `active` + `<768px` + `window.visualViewport`); reset idempotente `resetVV` no blur. Header/input são `flex-shrink-0`, só `#ai-messages` (`flex-1`) encolhe. (A3) **Conhecimento do agente com números reais**: novo helper puro `BDMSchedule.buildAIInvestmentMetrics(inv,{ipcaRate})` em `js/schedule.js` (3 testes, total 14 verdes) calcula, nos cenários fixo + reinvestido, lucro bruto/líquido por período, totais (fixo e composto), lucro mensal médio, APR nominal e yield real pós-IPCA. `_buildContext()` injeta esses números + próximo pagamento/status (de `App.events`, mesma data local via `dateKey` p/ evitar off-by-one) + agregados (patrimônio total, renda mensal estimada). Prompt: nova **R11** ("use os números prontos, nunca recalcule") + seção **SISTEMÁTICA DO PROJETO** (composição a cada recebimento, deságio só em saque/`showInBDM`, frequências, APR×APY). **Verificação pendente do usuário (real device/APK)**: A1 (mic some no app) e A2 (teclado não sobrepõe). Branch `feat/grupo-a-agente-ia`.
- 2026-06-11: **Reinvestimento periódico (composição a cada recebimento)** — antes o reinvestimento só compunha no vencimento; agora cada recebimento periódico é reaplicado no mesmo investimento assim que cai, compondo o principal (juros sobre juros). Nova função pura `BDMSchedule.compoundedPeriods(inv, {reinvest, horizonMonths, applyDesagio?})` em `js/schedule.js` é a **fonte única** consumida por Calendário e Insights. Deságio de 10% incide por período **apenas** em ativos `showInBDM`. Calendário: cada evento mantém o valor fixo real e ganha a linha "Se reinvestir os recebimentos anteriores" (valor composto) a partir do 2º período, nas 3 views (agenda, detail panel, day modal) via helper `reinvestProfitForEvent`. Insights: `buildProfitByMonth` reescrita para delegar a `compoundedPeriods` (gráfico de projeção, IPCA, marcos). Textos/tooltips atualizados de "no vencimento" → "a cada recebimento". **Removido** `totalReinvest` de `computeSchedule` (artefato do modelo antigo, agora sem uso) e suas 2 asserções obsoletas nos testes. Testes: `tests/schedule.test.js` cobre `compoundedPeriods` (11 testes, todos verdes).
- 2026-06-11: **UX mobile tátil** — (1) **swipe horizontal** na grade troca o mês (`initCalendarSwipe`, usa `BDMGestures.swipeDirection` com direction-lock + animação slide); (2) **modais bottom-sheet** arrastáveis no mobile (<640px): alça visual + arrastar p/ baixo >110px fecha (`initBottomSheet` em `showModal`); (3) **feedback háptico** `haptic()` (navigator.vibrate, no-op onde não suportado) em swipe, abrir/fechar modal, troca de view, navegação e salvar; (4) **long-press** num dia abre popover de preview dos eventos sem navegar (`initDayLongPress`, `#day-preview`); (5) **pull-to-refresh** no topo re-sincroniza o Supabase (`initPullToRefresh`, `#ptr`). Novo módulo puro `js/gestures.js` (`BDMGestures`: `swipeDirection`, `dominantAxis`, `isTap`) com testes em `tests/gestures.test.js` (3 testes). Desktop inalterado (gestos guardados por viewport/touch).
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
| Calendário | stable | Reinvestimento composto por recebimento (linha "Se reinvestir"); swipe de mês, long-press preview, modais bottom-sheet, pull-to-refresh no mobile |
| Insights | stable | Projeção/marcos usam composição a cada recebimento (`compoundedPeriods`); rentabilidade APR linear; scroll horizontal fixado no mobile |
| Calculadora | stable | Sem alterações recentes |
| Agente IA | stable | Números reais injetados (`buildAIInvestmentMetrics`) + prompt R11/sistemática; mic desativado no mobile (APK); teclado mobile só ajusta altura (sem `top`). Verificação de mic/teclado pendente em device real |

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
- **Reinvestimento compõe a cada recebimento (não no vencimento)**: modela melhor a realidade — o usuário recebe o lucro periódico e o reaplica imediatamente, em vez de esperar o prazo acabar. `compoundedPeriods` cresce o principal a cada período continuamente pelo horizonte (a fronteira de vencimento deixa de ter efeito especial, pois o capital já cresce a cada pagamento = renovação implícita).
- **Deságio só em ativos `showInBDM`**: o deságio de 10% é taxa de SAQUE do BDM; reaplicar o lucro não é sacar, então só incide quando o ativo é exibido/sacado em cripto. A UI sempre sinaliza o "(−10% deságio)" quando aplica.
- **Calendário mostra base + linha "se reinvestir"**: o evento mantém o valor fixo real (o que de fato cai no mês); o valor composto aparece como linha secundária projetada, evitando confundir "recebido" com "reinvestido". Aparece a partir do 2º período (no 1º não há ganho de composição).
- **Fonte única `compoundedPeriods`**: Calendário e Insights consomem a mesma função pura → os números nunca divergem. Matemática isolada em `js/schedule.js`, testável em Node.
- **Gestos mobile em módulo puro + wiring no index.html**: `js/gestures.js` (`BDMGestures`) tem só matemática de detecção (testável); o DOM/touch fica no index.html. Listeners idempotentes via `dataset.*Bound`; `{passive:true}` para não travar scroll; gestos só no mobile (viewport/touch), desktop intacto.
- **Rentabilidade APR vs APY**: mudou para APR (linear) pois os investimentos pagam lucro fixo sobre principal sem capitalização automática. APR é mais fiel à realidade e evita inflação percebida dos números.
- **create_asset no Agente**: ativo não gera eventos no calendário (durationMonths=0), apenas registro de patrimônio. confirmAICreateAsset não chama generateEvents/dbPutEvents.
- **Visual Viewport API**: abordagem mais robusta para iOS (onde `interactive-widget=resizes-content` não funciona). Height do screen-ai é ajustado dinamicamente; resetado no blur e no navigate.
- Tooltips: CSS hover (desktop) + JS tap (mobile) via classe `.tip-open`
- Markdown headings: `<p>` com inline styles para manter consistência com o restante de `_renderMsg()`

> **Instrução ao agente:** Ao final de cada sessão de trabalho, ATUALIZAR este arquivo com as mudanças feitas, novos TODOs e decisões tomadas.
