# Cripto Tracker — CLAUDE.md

## O Projeto
SPA de gestão de investimentos em cripto/DeFi. Usuário cadastra investimentos e ativos, o sistema gera calendário de rendimentos e analytics.

## Stack
- **Single file:** `index.html` (~4600 linhas) — HTML + CSS inline + JS inline
- **CSS:** Tailwind CDN (dark mode class), custom CSS no `<style>`
- **Charts:** Chart.js 4.4 (CDN)
- **Backend:** Supabase (auth + DB)
- **Sem build step** — abrir `index.html` no browser

## Telas (navegação via `navigate(screen)`)
| Tela | ID | Descrição |
|---|---|---|
| Calendário | `calendar` | Calendário mensal de eventos de rendimento |
| Insights | `insights` | Analytics: KPIs, gráficos, projeções, marcos |
| Calculadora | `calculator` | Simulador de investimento |
| Agente IA | `ai` | Chat com Supabase Edge Function |

## Design System
- **Background:** `#09090b` / **Surface:** `#18181b`
- **Primary:** `#0EA5E9` (azul) / **Amber:** `#F59E0B`
- **Texto:** `#eae1d4` (on-surface) / `#c7c6c4` (secondary)
- **Cards:** classe `premium-card` / modais: `glass-modal`
- **Inputs:** classe `fi` / Toggles: `.tog`
- **Font:** Inter (Google Fonts)

## Estado Global
```js
App = {
  investments: [],   // {id, name, type, principal, profitPercentage, durationMonths, startDate, categoryId, ...}
  events: [],        // {id, investmentId, date, amount, isLastPayment}
  categories: [],    // {id, name, color}
  bdmRate: null,     // cotação cripto em R$
  useIPCA: true,
  ipcaRate: 5.0,
  reinvestInsights: true,
  charts: {}         // instâncias Chart.js
}
```

## Tipos de Investimento
- `periodic` — paga lucro periodicamente (padrão)
- `asset` — ativo de valorização, sem rendimento periódico

## Módulo BDMSchedule (em `js/schedule.js`)
- `computeSchedule(inv, opts)` — calcula numPeriods, interval, netPerPeriod
- `WITHDRAWAL_DESAGIO = 0.10` — deságio de 10% nos saques

## Supabase
- Tabelas: `investments`, `categories`, `events`
- Auth: email/password via `sb.auth`
- Regras RLS ativas — cada usuário vê só seus dados

## Padrões de Renderização
- Cada tela tem `render<Screen>()` — ex: `renderInsights()`, `renderCalendar()`
- Charts são destruídos e recriados em `App.charts.<name>`
- Chamar `renderInsights()` sempre que dados mudarem e a tela estiver ativa

## Como Testar
Abrir `index.html` no browser. Não há servidor local necessário para UI (Supabase é remoto).
Para testar autenticado: usar credenciais reais ou configurar usuário no Supabase dashboard.
