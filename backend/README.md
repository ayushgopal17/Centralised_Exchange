# Nexora backend

Express and Bun API with Prisma/PostgreSQL persistence, simulated multi-coin execution, and a five-second paper limit-order worker.

See the [main README](../README.md) for setup, Render/Neon deployment, execution rules, API documentation, and tests. The [legacy guide](../docs/legacy-exchange.md) covers the earlier exchange and recovery tools.

```bash
bun install --frozen-lockfile
bun run build
bun run db:migrate
bun run start
```

Set `DATABASE_URL` before migrations/startup. The API uses `PORT` or defaults to 3000. The paper order worker runs automatically; `PAPER_WORKER=off` is only for processes where another worker is running or for specific tests.
