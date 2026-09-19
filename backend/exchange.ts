import prisma from "./db";
import type { Prisma } from "./generated/prisma/client";

type Tx = Prisma.TransactionClient;
export class ExchangeError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// Serialize exchange writes across processes, not just within one server.
export async function exchangeTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(731902)`;
    return work(tx);
  }, { timeout: 15000 });
}

export async function ensureBalance(tx: Tx, userId: string) {
  const existing = await tx.balance.findUnique({ where: { userId } });
  if (existing) return existing;
  if (!await tx.user.findUnique({ where: { id: userId } })) {
    throw new ExchangeError(403, "Account not found");
  }
  const orders = await tx.order.findMany({ where: { userId } });
  const fills = await tx.fill.findMany({ where: { userId } });
  // V1 did not record both sides of a trade and deleted cancelled orders.
  // Never mint a fresh starting balance when historical funds are uncertain.
  if (fills.length || orders.some(order => order.filledQty > 0)) {
    throw new ExchangeError(409, "Historical balance requires reconciliation: this account traded before balances were persisted. Contact the exchange administrator.");
  }
  let usdLocked = 0;
  let solLocked = 0;
  for (const order of orders) {
    if (order.status !== "OPEN" && order.status !== "PARTIALLY_FILLED") continue;
    if (order.market !== "sol" || order.qty <= 0 || order.price <= 0) {
      throw new ExchangeError(409, "Historical orders require reconciliation");
    }
    if (order.side === "buy") usdLocked += order.price * order.qty;
    else if (order.side === "sell") solLocked += order.qty;
    else throw new ExchangeError(409, "Historical orders require reconciliation");
  }
  if (usdLocked > 10000 || solLocked > 10) {
    throw new ExchangeError(409, "Historical balance requires reconciliation");
  }
  return tx.balance.create({ data: {
    userId, usdAvailable: 10000 - usdLocked, usdLocked,
    solAvailable: 10 - solLocked, solLocked,
  } });
}

export function formatBalance(balance: { usdAvailable: number; usdLocked: number; solAvailable: number; solLocked: number }) {
  return {
    usd: { available: balance.usdAvailable, locked: balance.usdLocked },
    sol: { available: balance.solAvailable, locked: balance.solLocked },
  };
}

export async function getBalance(userId: string) {
  return exchangeTransaction(async tx => formatBalance(await ensureBalance(tx, userId)));
}
