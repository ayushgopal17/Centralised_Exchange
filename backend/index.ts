import express from "express";
import prisma from "./db";
import jwt from "jsonwebtoken";
import { authMiddleware } from "./middleware";
import { matchOrder } from "./engine";
import { ensureBalance, exchangeTransaction, ExchangeError, getBalance } from "./exchange";

import { paperRouter, startPaperWorker } from "./paper";
import { logDatabaseError, isSchemaError } from "./database-errors";

export const app = express();
app.use(express.json());
app.use("/paper", paperRouter);

app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== "string" || !username.trim() || typeof password !== "string" || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }
  await exchangeTransaction(async tx => {
    if (await tx.user.findUnique({ where: { username } })) {
      throw new ExchangeError(403, "user with this username already exist");
    }
    await tx.user.create({ data: { username, password, balance: { create: {} } } });
  });
  return res.status(200).json({ message: "Signed up successfully" });
});

app.post("/signin", async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "Username and password are required" });
  }
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || user.password !== password) return res.status(403).json({ message: "Wrong credentials" });
  const token = jwt.sign({ id: user.id }, "Secret123");
  return res.status(201).json({ token });
});

app.post("/order", authMiddleware, async (req: any, res) => {
  const { market, price, qty, side, type } = req.body;
  if (market !== "sol" || type !== "LIMIT" || !["buy", "sell"].includes(side) ||
      !Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(qty) || qty <= 0 || qty > 2147483647 || !Number.isFinite(price * qty)) {
    return res.status(400).json({ message: "Use a SOL LIMIT buy/sell order with a positive price and whole-number quantity" });
  }
  await exchangeTransaction(async tx => {
    const balance = await ensureBalance(tx, req.userId);
    const total = price * qty;
    if (side === "buy") {
      if (balance.usdAvailable < total) throw new ExchangeError(403, "Insufficient balance");
      await tx.balance.update({ where: { userId: req.userId }, data: {
        usdAvailable: { decrement: total }, usdLocked: { increment: total },
      } });
    } else {
      if (balance.solAvailable < qty) throw new ExchangeError(403, "Insufficient asset");
      await tx.balance.update({ where: { userId: req.userId }, data: {
        solAvailable: { decrement: qty }, solLocked: { increment: qty },
      } });
    }
    const order = await tx.order.create({ data: {
      userId: req.userId, market, price, qty, side, type, filledQty: 0, status: "OPEN",
    } });
    await matchOrder(tx, order);
  });
  return res.status(201).json({ message: "order created successfully" });
});

app.get("/order/:orderId", authMiddleware, async (req: any, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
  if (!order) throw new ExchangeError(404, "order not found");
  if (order.userId !== req.userId) throw new ExchangeError(403, "you are not the owner");
  return res.json({ order });
});

app.delete("/order/:orderId", authMiddleware, async (req: any, res) => {
  await exchangeTransaction(async tx => {
    const order = await tx.order.findUnique({ where: { id: req.params.orderId } });
    if (!order) throw new ExchangeError(404, "order not found");
    if (order.userId !== req.userId) throw new ExchangeError(403, "you are not the owner");
    if (!["OPEN", "PARTIALLY_FILLED"].includes(order.status)) throw new ExchangeError(409, "Order is no longer open");
    await ensureBalance(tx, req.userId);
    const remaining = order.qty - order.filledQty;
    await tx.balance.update({ where: { userId: req.userId }, data: order.side === "buy" ? {
      usdAvailable: { increment: order.price * remaining }, usdLocked: { decrement: order.price * remaining },
    } : { solAvailable: { increment: remaining }, solLocked: { decrement: remaining } } });
    await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
  });
  return res.json({ message: "order cancelled successfully" });
});

app.get("/depth/:symbol", async (req, res) => {
  if (!["sol", "btc"].includes(req.params.symbol)) throw new ExchangeError(404, "Market not found");
  const orders = await prisma.order.findMany({
    where: { market: req.params.symbol, status: { in: ["OPEN", "PARTIALLY_FILLED"] } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const open = orders.map(order => ({ ...order, qty: order.qty - order.filledQty }));
  return res.json({ depth: {
    bids: open.filter(order => order.side === "buy").sort((a, b) => b.price - a.price),
    ask: open.filter(order => order.side === "sell").sort((a, b) => a.price - b.price),
  } });
});
app.get("/order", authMiddleware, async (req: any, res) => {
  return res.json({ order: await prisma.order.findMany({ where: { userId: req.userId } }) });
});
app.get("/fills", authMiddleware, async (req: any, res) => {
  return res.json({ fill: await prisma.fill.findMany({ where: { userId: req.userId } }) });
});
app.get("/balance/usd", authMiddleware, async (req: any, res) => {
  return res.json({ usd: (await getBalance(req.userId)).usd });
});
app.get("/balance", authMiddleware, async (req: any, res) => {
  return res.json({ balance: await getBalance(req.userId) });
});
app.use((error: any, _req: any, res: any, _next: any) => {
  if (error instanceof ExchangeError) return res.status(error.status).json({ message: error.message });
  logDatabaseError("Exchange request failed", error);
  if (isSchemaError(error)) {
    return res.status(503).json({ message: "Exchange database is not ready. Please try again after the backend database migrations are applied." });
  }
  return res.status(500).json({ message: "Exchange request failed" });
});
if (import.meta.main) {
  app.listen(Number(process.env.PORT) || 3000);
  if (process.env.PAPER_WORKER !== "off") startPaperWorker();
}
