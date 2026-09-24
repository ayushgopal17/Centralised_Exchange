# Nexora — Crypto Paper Trading

A crypto spot-trading simulator with live market charts, virtual capital, persistent portfolios, and simulated execution against public market depth. No real money, exchange API keys, deposits, or withdrawals are involved.

## Features

- Professional responsive terminal with watchlist, coin picker, market statistics, candlestick charts, volume, order book, and public trade tape
- BTC, ETH, SOL, BNB, XRP, DOGE, ADA, and AVAX paired with virtual USDT
- 100,000 virtual USDT per paper account, granted once
- Fractional quantities up to eight decimals; minimum order value 1 USDT
- Market and limit buys/sells; limit cancellation and partial fills
- Simulated 0.10% fees, live spread, and depth-weighted execution prices
- Persistent positions, available/reserved funds, orders, and fills
- Average cost, realized P&L after fees, unrealized P&L, and portfolio equity
- Separate paper accounts for existing users; legacy balances and trading history are retained

## How execution works

The frontend gets public Binance market data through its Next.js market-data route. The backend independently fetches live depth when a paper order is submitted. Client-provided market prices are never trusted for execution.

A market buy consumes visible ask levels; a market sell consumes bids. The weighted execution price includes the spread and available depth. Market orders that exceed the visible 100-level liquidity snapshot are rejected without changing balances.

A limit buy reserves `quantity × limit × 1.001` USDT; a sell reserves the coin quantity. The backend checks open orders every five seconds and fills eligible quantities at available prices within the limit. It releases price improvement, records fees, and keeps the unfilled portion reserved. Cancellation releases only the unfilled amount. A partially filled order cannot consume the same quote ID again.

Balances, orders, fills, cost basis, and realized P&L update within one PostgreSQL transaction. A database advisory lock serializes writes across API processes to prevent double spending. Open orders resume after a restart.

This is a snapshot-based simulator. Each order is evaluated independently against public liquidity; it does not model exchange queue position, competing users' impact, network latency, or historic price movements while the server is asleep. Quotes are polled, not streamed over WebSockets. Market data outages stop execution. The backend must stay running to check resting orders; a sleeping service checks current prices after waking, not missed historical prices.

Public data documentation: [Binance market-data-only endpoints](https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md).

## Stack

Next.js / React / TypeScript / Lightweight Charts / Express / Bun / Prisma / PostgreSQL.

```text
frontend/app/page.tsx                 Trading terminal
frontend/app/wallet/page.tsx          Positions and portfolio P&L
frontend/app/markets/page.tsx         Market discovery
frontend/components/paper-*.tsx       Paper order entry and history
frontend/lib/paper.ts                 Paper API and polling
backend/paper.ts                      Account, order execution, background checks
backend/paper-market.ts               Live execution quotes and supported coins
backend/prisma/schema.prisma         Legacy and paper trading tables
backend/tests/paper.test.ts           Isolated paper execution regression tests
```

## Local setup

Backend `.env`:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
PORT=3000
```

From `backend/`:

```bash
bun install --frozen-lockfile
bun run build
bun run db:migrate
bun run start
```

Frontend `.env.local`:

```dotenv
BACKEND_URL=http://localhost:3000
```

From `frontend/`:

```bash
npm ci
npm run dev
```

Open `http://localhost:3001`. Register or sign in with an existing account. Opening the terminal initializes a separate paper portfolio once. No legacy-account reconciliation is needed to use the new paper mode.

Webpack is configured for local development/builds because this workspace's Next.js installation lacks native Turbopack bindings on macOS ARM.

## Deploying your upgrade: Render + Neon + Vercel

1. Back up Neon and push these changes to the GitHub branch used by your deployments.
2. For the Render backend (`backend` root), install dependencies and generate Prisma:
   ```bash
   bun install --frozen-lockfile
   bun run build
   ```
3. Before starting the new backend, apply migrations against the intended Neon database:
   ```bash
   bun run db:migrate
   ```
   Use your deployment's migration step or run it locally from `backend/` with the correct `DATABASE_URL`. The two September migrations add `Balance` and the four `Paper*` tables without resetting balances. Review pending migrations on older databases: the July `fix_created_at` migration recreates the order/fill timestamp columns. Do not use `prisma migrate reset`.
4. Set Render's Start Command to `bun run start` (not `bun index.ts`). This now runs `prisma migrate deploy` before the API and worker, so a skipped migration step cannot launch the service with missing tables. If migration fails, startup stops and Render logs show the migration error. Keep development dependencies installed because the Prisma CLI is needed at startup. It honors Render's `PORT` environment variable. Leave `PAPER_WORKER` unset so the five-second order worker runs. Do not set `MARKET_DATA_BASE_URL` in production unless intentionally configuring another compatible market provider.
5. Deploy the frontend (`frontend` root) on Vercel. Build command: `npm run build`. Keep its `BACKEND_URL` pointed at the Render API URL.
6. Sign in and confirm the new paper account has 100,000 USDT. Place a small paper order, check positions/history, restart the backend, and confirm the paper portfolio persists.

Deploy the backend and migrations before the frontend. Keep the backend continuously running if you want resting limits checked while users are away. A frontend-only redeploy cannot add the paper trading API.

## Troubleshooting deployed signup and wallet failures

If signup, existing-account balances, and the paper worker fail together, check the Prisma error **code**, not just `PrismaClientKnownRequestError`. `P2021` means a missing table; `P2022` means a missing column. Signup requires `Balance`; paper portfolios and the worker require the four `Paper*` tables.

Render settings:

- Root Directory: `backend`
- Build Command: `bun install --frozen-lockfile && bun run build`
- Start Command: `bun run start`
- `DATABASE_URL`: the PostgreSQL database/branch/schema containing your existing users

Push the fix and redeploy Render. Startup should report that migrations were applied (or none are pending) before serving requests. If it fails, address the migration error from that deploy; do not reset the database or mark migrations applied without checking the actual schema.

On Vercel, set `BACKEND_URL=https://YOUR-SERVICE.onrender.com` for the deployment's environment and redeploy after changing it. Use the backend origin with no `/api` suffix. The frontend calls its own Next.js proxy, so browser CORS settings do not fix a backend Prisma failure.

If the error has another code, inspect that code and the Render migration output before changing data. A legacy `/balance` response mentioning reconciliation is a separate case; follow the [recovery guide](docs/legacy-exchange.md) using verified balances. Paper accounts are separate virtual portfolios and do not overwrite legacy funds.

## API

The existing HTTP-only session cookie and Next.js proxy pass a JWT in the backend `token` header.

| Method | Path | Purpose |
|---|---|---|
| GET | `/paper/account` | Initialize/read paper wallets, orders, fills, starting capital, and fee rate |
| POST | `/paper/order` | Submit a paper MARKET or LIMIT order |
| DELETE | `/paper/order/:id` | Cancel an owned open order |

Example payload:

```json
{ "market": "ETH", "side": "buy", "type": "LIMIT", "qty": 0.25, "price": 2500 }
```

For a MARKET order omit `price`. The account response includes all open orders and the latest 200 closed orders/fills. Use the terminal's current-coin filter to narrow the history.

## Verification

```bash
cd backend
bun run typecheck
TEST_DATABASE_URL=postgresql://USER@127.0.0.1:PORT/TEST_DATABASE bun run test:persistence
TEST_DATABASE_URL=postgresql://USER@127.0.0.1:PORT/TEST_DATABASE bun run test:paper
```

Run the two suites as separate commands. Each creates/migrates its own temporary schema and cleans it up. Both require an isolated localhost PostgreSQL database. Paper tests use controlled market quotes, not production data. Local ports 55440–55442 must be available.

```bash
cd frontend
npm run typecheck
npm run build
```

## Scope and remaining limitations

- Spot paper trading only: no shorts, leverage, futures, stop orders, real custody, deposits, or withdrawals.
- Polling intervals: market snapshot 4 seconds, account 4 seconds, overview/candles 15 seconds, order worker 5 seconds. Provider caching can add a small delay.
- P&L uses average cost including buy fees. Unrealized P&L does not subtract a hypothetical future sell fee. Virtual USDT is displayed at USD parity.
- Monetary storage still uses floating-point fields with eight-decimal settlement rounding; a real-money ledger would require fixed-point/decimal accounting.
- The inherited authentication still stores plaintext passwords and uses a hard-coded JWT secret. Password hashing, secret rotation, expiration, and rate limiting remain required before treating this as a production account system.
- Legacy CEX endpoints remain available separately. Historical balances with incomplete fills are not silently reset. See [legacy exchange and recovery instructions](docs/legacy-exchange.md).
