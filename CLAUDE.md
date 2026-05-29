# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite, localhost:5173)
npm run build     # Production build
npm run build:dev # Dev-mode build (preserves source maps)
npm run lint      # ESLint
npm run preview   # Preview production build locally
```

There is no test suite. There are no test files in this repo.

## Architecture

This is a **Vite + React + TypeScript SPA** backed by **Supabase** (Postgres + Auth + Edge Functions). The app is a personal equity trade journal for Indian stock market traders.

### Data flow

```
Supabase DB (trades, exits tables)
  → useTrades hook (all CRUD)
    → groupTradesBySymbol (client-side aggregation)
      → TradesTable / StatsCard (display)
```

The DB stores **individual trade rows** (one per entry). The UI always aggregates them by symbol via `groupTradesBySymbol` in `src/lib/groupTrades.ts` before rendering. A `GroupedTrade` has `id: "group:<symbol>"` and a `sourceTrades` array. All stats on the dashboard operate on grouped trades, not raw trades.

### Key files

| File | Role |
|---|---|
| `src/hooks/useTrades.ts` | Single source of truth for all trade/exit CRUD against Supabase. Also contains Kite (Zerodha) holdings/orders import and CSV import logic. |
| `src/lib/groupTrades.ts` | `groupTradesBySymbol` — aggregates trades by symbol (weighted avg entry, summed qty/PnL). `computeGroupedMetrics` — sums charge/interest metrics across source trades. |
| `src/lib/charges.ts` | Zerodha brokerage charge calculator (STT, exchange, SEBI, stamp, GST, DP) + MTF interest at `0.0399%/day`. All computed client-side from hardcoded rates. |
| `src/hooks/useLivePrices.ts` | Polls the `fetch-stock-price` Supabase Edge Function every 5 minutes for open trade symbols. Uses refs to avoid stale closures in the interval. |
| `src/contexts/AuthContext.tsx` | Supabase auth wrapper. `signOut` clears all Supabase localStorage keys manually before redirecting. |
| `src/integrations/supabase/types.ts` | Auto-generated Supabase DB types. Do not hand-edit. |

### Supabase Edge Functions (server-side)

The frontend calls these via `supabase.functions.invoke(...)` or direct `fetch`:
- `kite-auth` — handles Kite Connect OAuth flow, fetches holdings and orders from Zerodha API
- `fetch-stock-price` — fetches live NSE prices for a batch of symbols
- `fetch-ipo-data` — fetches IPO listing date and allotment price from Chittorgarh (used during CSV import)

Edge Function source is **not** in this repo.

### Trade model

- `tradeType`: `LONG | SHORT | IPO`
- `status`: `OPEN | PARTIAL | CLOSED` — derived from `remainingQuantity`; updated on every exit add/delete/edit
- `isMtf`: Margin Trade Funding flag — when true, brokerage is charged at 0.03% and daily interest accrues on the funded portion
- `marginContribution`: user's own capital in an MTF trade; defaults to 25% of entry value if not set

### P&L accounting

- `bookedProfit` / `totalPnl` on the trade row are kept in sync in Supabase on every exit mutation (not computed on read)
- `unrealizedPnl` is computed client-side from `currentPrice` and `remainingQuantity`
- Net P&L shown in the UI = `grossPnl - totalCharges - mtfInterest` (see `computeTradeMetrics`)

### Import paths

Three ways trades enter the system:
1. **Manual** — `AddTradeDialog` → `useTrades.addTrade`
2. **Kite Connect** — OAuth login → auto-imports holdings; orders imported via `importKiteOrders` using FIFO matching (SELLs matched against oldest open LONG)
3. **CSV** — `KiteImportDialog` → `importCSVTrades`; IPO rows trigger an Edge Function call to auto-fill listing date and allotment price

Duplicate guards in all three paths check `(symbol, entry_price, entry_date)` uniqueness per user.

### Path aliases

`@/` maps to `src/` (configured in Vite and TypeScript).

### Environment variables

Required `.env` keys (all `VITE_` prefixed, values in `.env`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
