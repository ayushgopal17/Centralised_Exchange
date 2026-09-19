import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Subprocess } from "bun";

// Never run this suite against the developer's configured/live database.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("Set TEST_DATABASE_URL to an isolated localhost PostgreSQL database with migrations applied");
}
const schema = `regression_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const isolatedUrl = new URL(databaseUrl);
isolatedUrl.searchParams.set("schema", schema);
process.env.DATABASE_URL = isolatedUrl.toString();
const migration = Bun.spawnSync(["bunx", "--no-install", "prisma", "migrate", "deploy"], {
  cwd: import.meta.dir + "/..", env: process.env, stdout: "pipe", stderr: "pipe",
});
if (migration.exitCode !== 0) throw new Error(migration.stderr.toString());
const { default: prisma } = await import("../db");
const base = "http://127.0.0.1:55440";
let server: Subprocess;
const prefix = `regression-${Date.now()}`;
const password = "test-password";
async function start() {
  server = Bun.spawn(["bun", "index.ts"], {
    cwd: import.meta.dir + "/..", env: { ...process.env, DATABASE_URL: isolatedUrl.toString(), PORT: "55440" },
    stdout: "ignore", stderr: "inherit",
  });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/depth/sol`)).ok) return; } catch {}
    await Bun.sleep(50);
  }
  throw new Error("Test API failed to start");
}
async function stop() { server.kill(); await server.exited; }
async function request(path: string, token?: string, body?: unknown, method?: string) {
  const response = await fetch(base + path, {
    method: method ?? (body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", ...(token ? { token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() as any };
}
async function login(name: string) {
  const response = await request("/signin", undefined, { username: prefix + name, password });
  expect(response.status).toBe(201);
  return response.data.token as string;
}
async function signup(name: string) {
  expect((await request("/signup", undefined, { username: prefix + name, password })).status).toBe(200);
  return login(name);
}
async function balance(token: string) { return (await request("/balance", token)).data.balance; }
async function order(token: string, side: string, price: number, qty: number) {
  return request("/order", token, { market: "sol", price, qty, side, type: "LIMIT" });
}
beforeAll(start);
afterAll(async () => {
  await stop();
  // This random schema belongs exclusively to this test run on localhost.
  await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await prisma.$disconnect();
});

test("balances and open orders survive process restart, settlement and cancellation are atomic", async () => {
  let buyer = await signup("buyer");
  const seller = await signup("seller");
  expect((await order(seller, "sell", 95, 2)).status).toBe(201);
  await stop(); await start();
  buyer = await login("buyer");
  expect(await balance(buyer)).toEqual({ usd: { available: 10000, locked: 0 }, sol: { available: 10, locked: 0 } });
  expect((await order(buyer, "buy", 100, 3)).status).toBe(201);
  expect(await balance(buyer)).toEqual({ usd: { available: 9710, locked: 100 }, sol: { available: 12, locked: 0 } });
  expect(await balance(seller)).toEqual({ usd: { available: 10190, locked: 0 }, sol: { available: 8, locked: 0 } });
  expect((await request("/fills", buyer)).data.fill).toHaveLength(1);
  expect((await request("/fills", seller)).data.fill).toHaveLength(1);
  const buyOrder = (await request("/order", buyer)).data.order[0];
  expect(buyOrder.filledQty).toBe(2);
  expect((await request(`/order/${buyOrder.id}`, buyer)).status).toBe(200);
  expect((await request(`/order/${buyOrder.id}`, seller, undefined, "DELETE")).status).toBe(403);
  await stop(); await start();
  buyer = await login("buyer");
  expect((await balance(buyer)).usd).toEqual({ available: 9710, locked: 100 });
  expect((await request(`/order/${buyOrder.id}`, buyer, undefined, "DELETE")).status).toBe(200);
  expect((await balance(buyer)).usd).toEqual({ available: 9810, locked: 0 });
  expect((await request(`/order/${buyOrder.id}`, buyer, undefined, "DELETE")).status).toBe(409);
  expect((await request("/depth/sol")).data.depth.bids).toHaveLength(0);
  expect((await request("/signin", undefined, { username: prefix + "buyer", password: "wrong" })).status).toBe(403);
  expect((await request("/balance", "invalid-token")).status).toBe(403);
}, 20000);

test("concurrent orders cannot spend the same funds twice", async () => {
  const token = await signup("concurrent");
  const results = await Promise.all([order(token, "buy", 6000, 1), order(token, "buy", 6000, 1)]);
  expect(results.map(r => r.status).sort()).toEqual([201, 403]);
  expect((await balance(token)).usd).toEqual({ available: 4000, locked: 6000 });
  const open = (await request("/order", token)).data.order[0];
  await request(`/order/${open.id}`, token, undefined, "DELETE");
});

test("incoming sells settle resting bids at their price and refund only unfilled SOL", async () => {
  const buyer = await signup("resting-buyer");
  const seller = await signup("incoming-seller");
  expect((await order(buyer, "buy", 100, 2)).status).toBe(201);
  expect((await order(seller, "sell", 95, 3)).status).toBe(201);
  expect(await balance(buyer)).toEqual({ usd: { available: 9800, locked: 0 }, sol: { available: 12, locked: 0 } });
  expect(await balance(seller)).toEqual({ usd: { available: 10200, locked: 0 }, sol: { available: 7, locked: 1 } });
  const sellOrder = (await request("/order", seller)).data.order[0];
  expect((await request(`/order/${sellOrder.id}`, seller, undefined, "DELETE")).status).toBe(200);
  expect((await balance(seller)).sol).toEqual({ available: 8, locked: 0 });
});

test("legacy unfilled orders retain reservations; missing trade history is never reset", async () => {
  const legacy = await prisma.user.create({ data: { username: prefix + "legacy", password } });
  await prisma.order.create({ data: { userId: legacy.id, market: "sol", price: 50, qty: 2, side: "buy", type: "LIMIT", filledQty: 0, status: "OPEN" } });
  const token = await login("legacy");
  expect((await balance(token)).usd).toEqual({ available: 9900, locked: 100 });
  const traded = await prisma.user.create({ data: { username: prefix + "traded", password } });
  await prisma.order.create({ data: { userId: traded.id, market: "sol", price: 50, qty: 2, side: "buy", type: "LIMIT", filledQty: 2, status: "FILLED" } });
  const response = await request("/balance", await login("traded"));
  expect(response.status).toBe(409);
  expect(response.data.message).toContain("reconciliation");
  expect(await prisma.balance.findUnique({ where: { userId: traded.id } })).toBeNull();
});

test("a settlement failure rolls back new orders and reserved funds", async () => {
  const legacy = await prisma.user.create({ data: { username: prefix + "broken-seller", password } });
  await prisma.order.createMany({ data: [
    { userId: legacy.id, market: "sol", price: 1, qty: 1, side: "sell", type: "LIMIT", filledQty: 1, status: "FILLED" },
    { userId: legacy.id, market: "sol", price: 1, qty: 1, side: "sell", type: "LIMIT", filledQty: 0, status: "OPEN" },
  ] });
  const buyer = await signup("rollback-buyer");
  expect((await order(buyer, "buy", 1, 1)).status).toBe(409);
  expect((await balance(buyer)).usd).toEqual({ available: 10000, locked: 0 });
  expect((await request("/order", buyer)).data.order).toHaveLength(0);
  expect((await order(buyer, "buy", -1, 1)).status).toBe(400);
});


test("legacy reconciliation previews changes and applies only once", async () => {
  const user = await prisma.user.create({ data: { username: prefix + "reconcile", password } });
  const open = await prisma.order.create({ data: { userId: user.id, market: "sol", price: 50, qty: 2, side: "buy", type: "LIMIT", filledQty: 0, status: "OPEN" } });
  const run = (...flags: string[]) => Bun.spawnSync(["bun", "scripts/reconcile-balance.ts", user.username, "10000", "10", ...flags], {
    cwd: import.meta.dir + "/..", env: process.env, stdout: "pipe", stderr: "pipe",
  });
  expect(run("--cancel-open-orders").exitCode).toBe(0);
  expect(await prisma.balance.findUnique({ where: { userId: user.id } })).toBeNull();
  expect((await prisma.order.findUnique({ where: { id: open.id } }))?.status).toBe("OPEN");
  expect(run("--cancel-open-orders", "--apply").exitCode).toBe(0);
  expect((await prisma.balance.findUnique({ where: { userId: user.id } }))?.usdAvailable).toBe(10000);
  expect((await prisma.order.findUnique({ where: { id: open.id } }))?.status).toBe("CANCELLED");
  expect(run("--apply").exitCode).not.toBe(0);
});
