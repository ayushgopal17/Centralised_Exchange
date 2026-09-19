import type { Prisma, Order } from "./generated/prisma/client";
import { ensureBalance } from "./exchange";

// The database is the order book, so restarts and multiple API instances agree.
export async function matchOrder(tx: Prisma.TransactionClient, incoming: Order) {
  const buying = incoming.side === "buy";
  const candidates = await tx.order.findMany({
    where: {
      market: incoming.market, side: buying ? "sell" : "buy",
      status: { in: ["OPEN", "PARTIALLY_FILLED"] },
      userId: { not: incoming.userId },
      price: buying ? { lte: incoming.price } : { gte: incoming.price },
    },
    orderBy: [{ price: buying ? "asc" : "desc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  let remaining = incoming.qty - incoming.filledQty;
  for (const resting of candidates) {
    if (remaining <= 0) break;
    const quantity = Math.min(remaining, resting.qty - resting.filledQty);
    if (quantity <= 0) continue;
    const buyer = buying ? incoming : resting;
    const seller = buying ? resting : incoming;
    await ensureBalance(tx, buyer.userId);
    await ensureBalance(tx, seller.userId);
    const value = quantity * resting.price;
    const reserved = quantity * buyer.price;
    await tx.balance.update({ where: { userId: buyer.userId }, data: {
      usdLocked: { decrement: reserved },
      usdAvailable: { increment: reserved - value },
      solAvailable: { increment: quantity },
    } });
    await tx.balance.update({ where: { userId: seller.userId }, data: {
      solLocked: { decrement: quantity }, usdAvailable: { increment: value },
    } });
    remaining -= quantity;
    const restingFilled = resting.filledQty + quantity;
    await tx.order.update({ where: { id: resting.id }, data: {
      filledQty: restingFilled, status: restingFilled === resting.qty ? "FILLED" : "PARTIALLY_FILLED",
    } });
    await tx.order.update({ where: { id: incoming.id }, data: {
      filledQty: incoming.qty - remaining, status: remaining === 0 ? "FILLED" : "PARTIALLY_FILLED",
    } });
    await tx.fill.createMany({ data: [buyer, seller].map(order => ({
      userId: order.userId, market: order.market, price: resting.price,
      qty: quantity, side: order.side, type: order.type, originalOrderId: order.id,
    })) });
  }
}
