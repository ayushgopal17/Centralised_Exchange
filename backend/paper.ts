import { Router } from "express";
import prisma from "./db";
import { authMiddleware } from "./middleware";
import { exchangeTransaction, ExchangeError } from "./exchange";
import { COINS, FEE_RATE, getQuote, type Quote } from "./paper-market";
import type { Prisma, PaperOrder } from "./generated/prisma/client";
import { logDatabaseError } from "./database-errors";
const OPEN = ["OPEN", "PARTIALLY_FILLED"];
const round = (v: number) => Math.round(v * 1e8) / 1e8;
type Tx = Prisma.TransactionClient;
const key = (userId: string, asset: string) => ({ userId_asset: { userId, asset } });

async function account(tx: Tx, userId: string) {
  if (!await tx.user.findUnique({ where: { id: userId } })) throw new ExchangeError(403, "Account not found");
  if (!await tx.paperAccount.findUnique({ where: { userId } })) {
    await tx.paperAccount.create({ data: { userId } });
    await tx.paperWallet.createMany({ data: ["USDT", ...COINS].map(asset => ({ userId, asset, available: asset === "USDT" ? 100000 : 0 })) });
  }
}
function executions(order: Pick<PaperOrder, "side" | "type" | "price" | "qty" | "filledQty">, quote: Quote) {
  let remaining = round(order.qty - order.filledQty);
  let quantity = 0, value = 0;
  for (const [price, liquidity] of order.side === "buy" ? quote.asks : quote.bids) {
    if (order.type === "LIMIT" && (order.side === "buy" ? price > order.price : price < order.price)) break;
    const qty = Math.min(remaining, liquidity);
    quantity = round(quantity + qty); value += qty * price; remaining = round(remaining - qty);
    if (remaining <= 0) break;
  }
  return { quantity, value: round(value) };
}
async function release(tx: Tx, order: PaperOrder) {
  const remaining = round(order.qty - order.filledQty);
  const amount = order.side === "buy" ? round(remaining * order.price * (1 + FEE_RATE)) : remaining;
  await tx.paperWallet.update({ where: key(order.userId, order.side === "buy" ? "USDT" : order.market), data: { available: { increment: amount }, locked: { decrement: amount } } });
}
async function settle(tx: Tx, order: PaperOrder, quote: Quote) {
  if (Date.now() - quote.at > 10000) throw new ExchangeError(503, "Execution quote expired; retry your order");
  if (!OPEN.includes(order.status) || order.lastQuoteId === quote.id) return order;
  const { quantity, value } = executions(order, quote);
  if (quantity <= 0) return order;
  const fee = round(value * FEE_RATE);
  const wallet = await tx.paperWallet.findUniqueOrThrow({ where: key(order.userId, order.market) });
  let realizedPnl = 0;
  if (order.side === "buy") {
    const reserved = round(quantity * order.price * (1 + FEE_RATE));
    await tx.paperWallet.update({ where: key(order.userId, "USDT"), data: { locked: { decrement: reserved }, available: { increment: round(reserved - value - fee) } } });
    const owned = wallet.available + wallet.locked;
    await tx.paperWallet.update({ where: key(order.userId, order.market), data: { available: { increment: quantity }, averageCost: (owned * wallet.averageCost + value + fee) / (owned + quantity) } });
  } else {
    realizedPnl = round(value - fee - quantity * wallet.averageCost);
    await tx.paperWallet.update({ where: key(order.userId, order.market), data: { locked: { decrement: quantity }, realizedPnl: { increment: realizedPnl } } });
    await tx.paperWallet.update({ where: key(order.userId, "USDT"), data: { available: { increment: round(value - fee) } } });
  }
  await tx.paperFill.create({ data: { userId: order.userId, originalOrderId: order.id, market: order.market, side: order.side, type: order.type, price: value / quantity, qty: quantity, fee, realizedPnl } });
  const filledQty = round(order.filledQty + quantity);
  return tx.paperOrder.update({ where: { id: order.id }, data: {
    filledQty, averagePrice: (order.averagePrice * order.filledQty + value) / filledQty,
    fees: { increment: fee }, status: filledQty >= order.qty ? "FILLED" : "PARTIALLY_FILLED", lastQuoteId: quote.id,
  } });
}
export const paperRouter = Router();
paperRouter.use(authMiddleware);
paperRouter.get("/account", async (req: any, res) => {
  const result = await exchangeTransaction(async tx => {
    await account(tx, req.userId);
    const [wallets, openOrders, closedOrders, fills] = await Promise.all([
      tx.paperWallet.findMany({ where: { userId: req.userId } }),
      tx.paperOrder.findMany({ where: { userId: req.userId, status: { in: OPEN } }, orderBy: { createdAt: "desc" } }),
      tx.paperOrder.findMany({ where: { userId: req.userId, status: { notIn: OPEN } }, orderBy: { createdAt: "desc" }, take: 200 }),
      tx.paperFill.findMany({ where: { userId: req.userId }, orderBy: { createdAt: "desc" }, take: 200 }),
    ]);
    const orders = [...openOrders, ...closedOrders].sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { wallets, orders, fills, initialCash: 100000, feeRate: FEE_RATE };
  });
  res.json(result);
});
paperRouter.post("/order", async (req: any, res) => {
  const { market, side, type, qty, price } = req.body;
  if (!COINS.includes(market) || !["buy", "sell"].includes(side) || !["LIMIT", "MARKET"].includes(type) ||
      typeof qty !== "number" || !Number.isFinite(qty) || qty < 0.00000001 || qty > 1e9 || Math.abs(round(qty) - qty) > 1e-12 ||
      (type === "LIMIT" && (typeof price !== "number" || !Number.isFinite(price) || price <= 0 || price > 1e9))) {
    throw new ExchangeError(400, "Choose a supported coin, a positive quantity (up to 8 decimals), and a valid order price");
  }
  const quote = await getQuote(market);
  const result = await exchangeTransaction(async tx => {
    await account(tx, req.userId);
    const plan = executions({ side, type, price: price ?? 0, qty, filledQty: 0 }, quote);
    if (type === "MARKET" && plan.quantity < qty) throw new ExchangeError(400, "Order exceeds visible market liquidity. Try a smaller quantity.");
    const reservePrice = type === "MARKET" ? plan.value / qty : price;
    const amount = side === "buy" ? round(qty * reservePrice * (1 + FEE_RATE)) : qty;
    if (amount <= 0 || qty * reservePrice < 1) throw new ExchangeError(400, "Minimum order value is 1 USDT");
    const asset = side === "buy" ? "USDT" : market;
    const wallet = await tx.paperWallet.findUniqueOrThrow({ where: key(req.userId, asset) });
    if (wallet.available + 1e-8 < amount) throw new ExchangeError(400, `Insufficient available ${asset}, including fees`);
    await tx.paperWallet.update({ where: key(req.userId, asset), data: { available: { decrement: amount }, locked: { increment: amount } } });
    const order = await tx.paperOrder.create({ data: { userId: req.userId, market, side, type, qty, price: reservePrice } });
    return settle(tx, order, quote);
  });
  res.status(201).json({ order: result, message: result.status === "FILLED" ? "Paper trade filled" : "Limit order placed" });
});
paperRouter.delete("/order/:id", async (req: any, res) => {
  await exchangeTransaction(async tx => {
    const order = await tx.paperOrder.findUnique({ where: { id: req.params.id } });
    if (!order || order.userId !== req.userId) throw new ExchangeError(404, "Order not found");
    if (!OPEN.includes(order.status)) throw new ExchangeError(409, "Order is no longer open");
    await release(tx, order);
    await tx.paperOrder.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
  });
  res.json({ message: "Order cancelled; remaining funds released" });
});
let running = false;
export async function processPaperOrders() {
  if (running) return;
  running = true;
  try {
    const markets = await prisma.paperOrder.findMany({ where: { status: { in: OPEN } }, distinct: ["market"], select: { market: true } });
    await Promise.allSettled(markets.map(async ({ market }) => {
      const quote = await getQuote(market);
      await exchangeTransaction(async tx => {
        const orders = await tx.paperOrder.findMany({ where: { market, status: { in: OPEN } }, orderBy: { createdAt: "asc" } });
        for (const order of orders) await settle(tx, order, quote);
      });
    }));
  } finally { running = false; }
}
export function startPaperWorker() {
  const tick = () => { void processPaperOrders().catch(error => logDatabaseError("Paper order check failed", error)); };
  tick(); return setInterval(tick, 5000);
}
