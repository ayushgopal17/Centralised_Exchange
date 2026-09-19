import prisma from "../db";
import { exchangeTransaction } from "../exchange";

const [username, usdInput, solInput, ...flags] = process.argv.slice(2);
const usdTotal = Number(usdInput);
const solTotal = Number(solInput);
if (!username || usdInput === undefined || solInput === undefined ||
    !Number.isFinite(usdTotal) || !Number.isFinite(solTotal) || usdTotal < 0 || solTotal < 0 ||
    flags.some(flag => !["--apply", "--cancel-open-orders"].includes(flag))) {
  console.error("Usage: bun scripts/reconcile-balance.ts USERNAME TOTAL_USD TOTAL_SOL [--cancel-open-orders] [--apply]");
  process.exit(1);
}
try {
  await exchangeTransaction(async tx => {
    const user = await tx.user.findUnique({ where: { username } });
    if (!user) throw new Error("Account not found");
    if (await tx.balance.findUnique({ where: { userId: user.id } })) {
      throw new Error("Account already has a persisted balance; refusing to overwrite it");
    }
    const orders = await tx.order.findMany({ where: {
      userId: user.id, status: { in: ["OPEN", "PARTIALLY_FILLED"] },
    } });
    const cancelOpen = flags.includes("--cancel-open-orders");
    let usdLocked = 0;
    let solLocked = 0;
    for (const order of orders) {
      if (cancelOpen) continue;
      const remaining = order.qty - order.filledQty;
      if (order.market !== "sol" || remaining < 0 || order.price <= 0 || !["buy", "sell"].includes(order.side)) {
        throw new Error("Invalid legacy order; review it before reconciliation");
      }
      if (order.side === "buy") usdLocked += order.price * remaining;
      else solLocked += remaining;
    }
    if (usdTotal < usdLocked || solTotal < solLocked) throw new Error("Totals do not cover existing order reservations");
    const data = { userId: user.id, usdAvailable: usdTotal - usdLocked, usdLocked, solAvailable: solTotal - solLocked, solLocked };
    console.log(JSON.stringify({ username, balance: data, cancelOpenOrders: cancelOpen ? orders.map(order => order.id) : [], mode: flags.includes("--apply") ? "apply" : "preview" }, null, 2));
    if (!flags.includes("--apply")) return;
    if (cancelOpen) {
      await tx.order.updateMany({ where: { userId: user.id, status: { in: ["OPEN", "PARTIALLY_FILLED"] } }, data: { status: "CANCELLED" } });
    }
    await tx.balance.create({ data });
  });
} finally {
  await prisma.$disconnect();
}
