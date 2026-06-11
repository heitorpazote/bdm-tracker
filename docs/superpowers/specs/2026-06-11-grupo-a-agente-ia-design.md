# Grupo A — Agente IA (microfone mobile, sobreposição de teclado, conhecimento)

**Data:** 2026-06-11
**Escopo:** Primeiro de quatro grupos (A → B → C → D) de uma rodada de correções e adições.
Este spec cobre **apenas o Grupo A**. Grupos B (gráficos Insights), C (tela de Configurações) e
D (aviso de finalização de investimento) terão specs próprios.

## Contexto

Arquivo único `index.html` (~5400 linhas, HTML+CSS+JS inline). Módulos puros em `js/schedule.js`
(`BDMSchedule.computeSchedule`, `BDMSchedule.compoundedPeriods`) e `js/gestures.js`. Sem build step.
O Agente IA conversa com a Edge Function `ai-chat`; o estado do app é injetado a cada mensagem por
`_buildContext()` e antecedido pelo `AI_SYSTEM_PROMPT`.

## Itens

### A1 — Microfone: desativar no mobile (preservar código)

**Problema:** No APK Android (WebView) o microfone retorna "acesso negado" — causa é a permissão
nativa `RECORD_AUDIO` / `onPermissionRequest` do WebView, fora do alcance do JS. O usuário decidiu
**desativar o microfone no mobile**, sem remover o código (reativável no futuro).

**Mudança (`initSTT()` em `index.html`):**
- A detecção `const isTouch = window.matchMedia('(pointer:coarse)').matches;` já existe.
- Quando `isTouch` for verdadeiro: ocultar `#ai-mic-btn` (`style.display = 'none'`) e **retornar sem
  registrar** os listeners de gravação (`touchstart`/`touchend`/`touchcancel`).
- Quando não for touch (desktop): comportamento **inalterado** — clique para iniciar/parar, transcrição
  preenche `#ai-input`, envio manual.
- Toda a lógica STT (`sttStart`, `_sttStartSpeechAPI`, `_sttStartWhisper`, `sttStop`, `_sttTranscribe`,
  `_sttSetUI`) permanece intacta no arquivo.

**Critério de sucesso:** No mobile/touch o botão de microfone não aparece e nenhum prompt de permissão
é disparado. No desktop nada muda.

### A2 — Sobreposição de elementos no cabeçalho ao abrir/fechar o teclado

**Problema:** Na tela do Agente IA (mobile), ao focar/desfocar o `#ai-input` (teclado virtual abre e
fecha repetidamente), elementos se sobrepõem perto do cabeçalho superior.

**Causa provável:** `initAIMobileKeyboardFix()` manipula `aiScreen.style.height` (no
`visualViewport.resize`) e `aiScreen.style.top` (no `visualViewport.scroll`) de forma concorrente, e o
reset no `blur` não é totalmente idempotente — durante a transição teclado-abre→fecha o
reposicionamento deixa o header sobrepor a faixa de quick-actions / mensagens.

**Abordagem:** Tratar como bug com `systematic-debugging` na implementação (reproduzir, isolar a causa
raiz, só então corrigir). Direção provável:
- Garantir que **header** (`#screen-ai > .border-b` superior) e **input** permaneçam `flex-shrink-0` e
  que **somente** a área `#ai-messages` (`flex-1 overflow-y-auto`) absorva a mudança de altura.
- Evitar manipular `top` e `height` simultaneamente; preferir ajustar só a altura do container ao
  `visualViewport.height` e deixar o layout flex reposicionar.
- Reset idempotente de qualquer estilo inline (`height`, `top`) no `blur` **e** no `navigate()` para
  fora da tela.

**Critério de sucesso:** Abrir e fechar o teclado repetidamente (focar e desfocar o campo) nunca
sobrepõe o cabeçalho nem a faixa de ações rápidas; o input permanece acima do teclado.

### A3 — Conhecimento do agente: injetar números reais + sistematizar prompt

**Problema:** `_buildContext()` injeta apenas campos **brutos** dos investimentos (principal,
profitPercentage, frequency, durationMonths). O agente é obrigado a calcular schedules, totais e yields
por conta própria — e erra, gerando recomendações incorretas. O app já tem as funções corretas
(`computeSchedule`, `compoundedPeriods`).

**Parte 1 — Métricas pré-calculadas no contexto.** Novo helper puro
`buildAIInvestmentMetrics(inv, opts)` (em `js/schedule.js`, exportado no `BDMSchedule`, testável em
Node). Para cada investimento **periódico**, retorna nos **dois cenários** (fixo + reinvestido):
- Lucro **bruto** e **líquido** por período (líquido = −10% deságio **apenas** se `showInBDM`).
- Nº de períodos e total **fixo** (sem reinvestir) no horizonte/duração.
- Total **composto** (via `compoundedPeriods`, cenário "se reinvestir") no mesmo horizonte.
- **Yield mensal médio** e **APR nominal anual** (mensal × 12, conforme padrão do app).
- **Yield real pós-IPCA**: `(1 + APR) / (1 + IPCA) − 1`.
- **Próximo pagamento**: data + valor, derivado de `App.events` (próximo evento futuro do investimento).
- **Status**: ativo ou finalizado (todos os eventos no passado).

Para **ativos**: valor de mercado (`unitValue × quantity`) e % da carteira. **Agregados da carteira:**
patrimônio total (principais de periódicos + valor de mercado de ativos), **renda mensal estimada**
total e concentração por categoria e por tipo.

`_buildContext()` passa a montar o texto a partir desse helper (mantendo-se enxuto). Os números são
injetados em formato legível (texto/linguagem natural com rótulos), não JSON cru de cálculo.

**Parte 2 — Prompt (`AI_SYSTEM_PROMPT`).**
- Nova **regra absoluta**: *"USE os números pré-calculados fornecidos no CONTEXTO INJETADO. NUNCA
  recalcule schedules, totais, yields ou projeções por conta própria — apenas leia e interprete os
  valores dados."*
- Nova seção **"SISTEMÁTICA DO PROJETO"** descrevendo: modelo de composição **a cada recebimento**
  (não no vencimento), deságio de 10% **só em saque / ativos `showInBDM`**, mapa de frequências
  (monthly/bimonthly/quarterly/semiannual/at_maturity/custom → meses), diferença APR (nominal, linear)
  vs APY (composto), e que ativos rendem por valorização (sem evento periódico).
- Ajustar a seção "CÁLCULOS E MÉTRICAS" existente para **apontar aos campos injetados** em vez de pedir
  cálculo manual.

**Isolamento / testes:** A matemática fica em `buildAIInvestmentMetrics` (puro, em `js/schedule.js`),
coberto por testes em `tests/schedule.test.js`. O `index.html` apenas formata o texto e injeta no
contexto.

**Critério de sucesso:** Dado um investimento conhecido, os números que o agente cita (lucro por
período, total fixo, total reinvestido, APR, yield real, próximo pagamento) batem com os exibidos no
Calendário/Insights, e o agente não inventa contas próprias.

## Fora de escopo (Grupo A)

- Gráficos de Insights (Grupo B).
- Tela de Configurações (Grupo C).
- Aviso de finalização de investimento (Grupo D).
- Corrigir a permissão de microfone no APK nativo (decisão: desativar, não corrigir).

## Arquivos afetados

- `index.html` — `initSTT()` (A1), `initAIMobileKeyboardFix()` + CSS `#screen-ai` (A2),
  `_buildContext()` e `AI_SYSTEM_PROMPT` (A3).
- `js/schedule.js` — novo `buildAIInvestmentMetrics` no `BDMSchedule` (A3).
- `tests/schedule.test.js` — testes do novo helper (A3).
- `STATE.md` — registro da sessão ao final.
