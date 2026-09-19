# Nexora CEX V1

Nexora is an educational centralized exchange prototype built to demonstrate the core workflow behind a spot trading platform: account creation, authenticated order placement, balance locking, order matching, trade settlement, and portfolio tracking.

The project combines a custom exchange backend with a polished trading interface. Orders are executed by the local matching engine, while live Binance spot data is used only as a visual market reference.

> [!IMPORTANT]
> This is a learning project, not a production exchange. It does not custody real assets or submit orders to Binance.

## What the project includes

- Username/password registration and JWT-based sessions
- SOL/USD limit buy and sell orders
- A persistent bid/ask book and custom matching engine
- Full and partial order fills
- Available and locked USD/SOL balances
- Order, fill, and portfolio views
- Live reference tickers, depth, trades, and candlesticks from Binance
- Searchable market overview for popular USDT pairs
- Responsive Next.js trading dashboard
- An optional browser Model Context tool for creating SOL limit orders

## Architecture

```mermaid
flowchart LR
    U[User] --> F[Next.js frontend\nlocalhost:3001]
    F -->|Auth and exchange requests| P[Next.js API proxy]
    P -->|JWT in token header| B[Express API\nlocalhost:3000]
    B --> E[Transactional matching engine]
    E --> D[(PostgreSQL via Prisma)]
    B --> D
    F -->|Server-side market request| X[Next.js market API]
    X -->|Public read-only data| BN[Binance Data API]
```

The two data paths are deliberately separate:

- **Exchange data** comes from the local backend. This includes users, balances, orders, fills, and execution.
- **Market reference data** comes from Binance through the frontend's server-side API route. It powers charts and market displays but never affects local order execution automatically.

## Trading workflow

1. A user registers through the frontend.
2. The backend creates the user and grants a demo balance of **10,000 USD** and **10 SOL**.
3. On sign-in, the backend returns a JWT. The frontend stores it in an HTTP-only `cex_session` cookie.
4. When a limit order is submitted, the backend checks the user's available balance.
5. The required USD or SOL is moved from `available` to `locked`.
6. The matching engine scans the opposite side of the persisted order book:
   - a buy matches a sell priced at or below the buy limit;
   - a sell matches a buy priced at or above the sell limit.
7. Matching quantities are settled, order fill quantities/statuses are updated, and fills for both counterparties are written to PostgreSQL.
8. Any unmatched quantity remains on the local order book.
9. The frontend polls account and market endpoints to refresh balances, orders, fills, depth, and live market visuals.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript |
| Forms and validation | React Hook Form, Zod |
| Charts | Lightweight Charts |
| Backend | Bun, Express 5, TypeScript |
| Database | PostgreSQL, Prisma 7 |
| Authentication | JSON Web Tokens |
| Market reference | Binance public Data API |

## Project structure

```text
cex-project/
├── backend/
│   ├── index.ts                 # REST API and transactional account operations
│   ├── engine.ts                # Limit-order matching and settlement
│   ├── middleware.ts            # JWT authentication middleware
│   ├── db.ts                    # Prisma client
│   ├── prisma/
│   │   ├── schema.prisma        # User, Balance, Stock, Order, and Fill models
│   │   └── migrations/          # PostgreSQL migrations
│   └── test.ts                  # End-to-end API smoke workflow
└── frontend/
    ├── app/                     # Pages and server-side API routes
    ├── components/              # Trading and account UI
    ├── lib/                     # API clients, types, and polling hooks
    └── proxy.ts                 # Route-level session protection
```

## Prerequisites

Install the following before starting:

- [Bun](https://bun.sh/) 1.x
- [Node.js](https://nodejs.org/) 20.9 or newer
- PostgreSQL

## Local setup

### 1. Configure and start the backend

Create `backend/.env` with a PostgreSQL connection string:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/cex"
```

Then install dependencies, generate the Prisma client, apply the migrations, and start the API:

```bash
cd backend
bun install
bunx prisma generate
bunx prisma migrate deploy
bun run index.ts
```

The backend runs at `http://localhost:3000`.

For a new database during development, `bunx prisma migrate dev` can be used instead of `migrate deploy`.

### 2. Configure and start the frontend

In another terminal:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

The frontend runs at `http://localhost:3001`. The included example points it to the local backend:

```env
BACKEND_URL=http://localhost:3000
```

Open `http://localhost:3001/register`, create two accounts, and use opposite buy/sell orders to exercise the matching flow.

## Example match

To see a complete trade locally:

1. Register and sign in as a seller.
2. Place a sell order for `2 SOL` at `95 USD`.
3. Sign out, register another account, and sign in as the buyer.
4. Place a buy order for `2 SOL` at `100 USD`.
5. The orders cross, so the engine executes the trade using the resting sell order's price.
6. Check the Orders, Fills, and Portfolio sections for the result.

You can also run the backend smoke script while the API is running:

```bash
cd backend
bun run test.ts
```

The script creates a buyer and seller, authenticates both, submits crossing SOL orders, and prints their order records.

## API overview

Authenticated endpoints expect the JWT in a `token` request header. The frontend handles this through its HTTP-only session cookie and API proxy.

| Method | Endpoint | Authentication | Purpose |
| --- | --- | --- | --- |
| `POST` | `/signup` | No | Create a demo account |
| `POST` | `/signin` | No | Return a JWT |
| `POST` | `/order` | Yes | Place a limit order |
| `GET` | `/order` | Yes | List the user's orders |
| `GET` | `/order/:orderId` | Yes | Fetch one owned order |
| `DELETE` | `/order/:orderId` | Yes | Cancel an owned order |
| `GET` | `/fills` | Yes | List the user's fills |
| `GET` | `/balance` | Yes | Return all balances |
| `GET` | `/balance/usd` | Yes | Return the USD balance |
| `GET` | `/depth/:symbol` | No | Return the persisted open-order book |

Example order request:

```bash
curl -X POST http://localhost:3000/order \
  -H 'Content-Type: application/json' \
  -H 'token: YOUR_JWT' \
  -d '{"market":"sol","price":100,"qty":2,"side":"buy","type":"LIMIT"}'
```

## Frontend pages

| Route | Description |
| --- | --- |
| `/` | SOL/USD terminal with chart, reference book, trades, order entry, orders, and fills |
| `/markets` | Searchable Binance market overview; only SOL is locally tradable |
| `/wallet` | Available and locked USD/SOL balances with an estimated reference value |
| `/settings` | Local interface preferences and session controls |
| `/login`, `/register` | Authentication screens |

## Current V1 limitations

- Passwords are currently stored as plain text and the JWT secret is hard-coded. Use password hashing, environment-managed secrets, expiry, and stronger validation before any real deployment.
- Accounts created before balance persistence may need manual reconciliation: the old engine recorded only one side of trades and deleted cancelled orders. Accounts with recorded trading activity and no persisted balance return a clear HTTP 409 rather than receiving invented funds.
- The executable market is currently limited to SOL/USD limit orders with whole-number quantities.
- Exchange writes use a database advisory lock for correctness across API instances. This serializes trading and prioritizes correctness over throughput.
- Monetary values still use floating-point numbers; production accounting would require fixed-point/decimal amounts.
- Exchange updates are polled rather than streamed over WebSockets.
- Deposits, withdrawals, fees, market orders, admin controls, and production-grade accounting are not implemented.
- Binance prices and depth are visual references only and can differ from the local exchange book and execution price.

## Roadmap

- Hash passwords and move JWT configuration to environment variables
- Add schema validation and centralized error handling to the backend
- Expose a public trade tape
- Add WebSocket updates for books, orders, fills, and balances
- Expand automated regression coverage
- Support more assets, market orders, deposits, and withdrawals

## Author

Built by **Ayush Gopal** as a hands-on exploration of exchange architecture and full-stack trading interfaces.


## Deploying the balance-persistence fix (Render + Neon)

The frontend API response shape is unchanged; this fix is in the backend.

1. Back up the Neon database and stop the old backend while switching versions. The old process must not continue accepting trades after the new version starts, because it still changes only its private in-memory balances.
2. Push these repository changes to the branch deployed by Render.
3. From `backend/`, with `DATABASE_URL` pointing to the intended Neon database, run:

   ```bash
   bun install --frozen-lockfile
   bun run build
   bun run db:migrate
   ```

   `build` regenerates the Prisma client. `db:migrate` applies the new `Balance` table migration without deleting users, orders, or fills. Configure the deployment to run the migration before starting the new API; do not run `prisma migrate reset`.
4. Start the updated API with `bun run start`. Keep the existing frontend `BACKEND_URL` pointing at this Render service.
5. Sign in, inspect balances and open orders, restart the Render backend, and sign in again. Balances and reservations should stay unchanged.

New accounts receive starting demo funds exactly once, within the signup transaction. Existing accounts with no recorded trades can initialize their balance while retaining reservations for open orders. Existing traded accounts without a persisted balance require administrator reconciliation. Because the old version could delete cancelled orders and omit counterparty fills, historical records may be incomplete; audit legacy accounts against any available backups.

### Recovering a legacy account

The recovery command refuses to overwrite an existing persisted balance. It previews its changes unless `--apply` is supplied, and retains order/fill history. Supply verified **total** USD and SOL amounts, including any locked funds:

```bash
cd backend
bun scripts/reconcile-balance.ts USERNAME TOTAL_USD TOTAL_SOL
# After checking the preview:
bun scripts/reconcile-balance.ts USERNAME TOTAL_USD TOTAL_SOL --apply
```

Without `--cancel-open-orders`, existing open orders stay open and their remaining reservations are deducted from the supplied totals. Reconcile old counterparties before allowing trading against their orders; settlement involving an unreconciled account fails and rolls back atomically.

If you choose to reset the **demo** account `Ayush1` instead of reconstructing its lost balance, preview this explicit reset:

```bash
bun scripts/reconcile-balance.ts Ayush1 10000 10 --cancel-open-orders
```

Only after deciding to reset, repeat with `--apply`. This cancels open orders and grants the chosen demo starting amounts. It is not recovery of the original traded balance. Historical orders and fills remain intact.

### Regression tests

```bash
cd backend
bun run typecheck
TEST_DATABASE_URL=postgresql://USER@127.0.0.1:PORT/TEST_DATABASE bun run test:persistence
```

Use an isolated local PostgreSQL database. The suite creates and migrates a unique schema, starts a test API on port 55440, restarts it during the test, and removes its schema afterward. It covers persistence across login/restart, matching and both-sided fills, price-improvement refunds, partial cancellation, double-cancel prevention, concurrent spending, transaction rollback, and preview/apply legacy reconciliation. It refuses remote database URLs.
