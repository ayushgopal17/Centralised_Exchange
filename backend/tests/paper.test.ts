import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Subprocess } from "bun";
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)) throw new Error("Use an isolated localhost TEST_DATABASE_URL");
const schema = `paper_test_${Date.now()}`;
const url = new URL(databaseUrl); url.searchParams.set("schema", schema); process.env.DATABASE_URL = url.toString();
const migration = Bun.spawnSync(["bunx", "--no-install", "prisma", "migrate", "deploy"], { cwd: import.meta.dir + "/..", env: process.env, stdout: "pipe", stderr: "pipe" });
if (migration.exitCode) throw new Error(migration.stderr.toString());
const { default: prisma } = await import("../db");
let ask = 100, bid = 99, liquidity = 1000, quoteId = 1, unavailable = false;
const fixture = Bun.serve({ port: 55442, hostname: "127.0.0.1", fetch() {
  if (unavailable) return new Response("unavailable", { status: 503 });
  return Response.json({ lastUpdateId: quoteId, bids: [[String(bid), String(liquidity)]], asks: [[String(ask), String(liquidity)]] });
} });
let server: Subprocess;
async function start() {
  server = Bun.spawn(["bun", "index.ts"], { cwd: import.meta.dir + "/..", env: { ...process.env, PORT: "55441", MARKET_DATA_BASE_URL: "http://127.0.0.1:55442", PAPER_WORKER: "on" }, stdout: "ignore", stderr: "inherit" });
  for (let i=0;i<100;i++) { try { if ((await fetch("http://127.0.0.1:55441/depth/sol")).ok) return; } catch {} await Bun.sleep(50); }
  throw new Error("API failed to start");
}
async function stop() { server.kill(); await server.exited; }
async function request(path: string, token?: string, body?: unknown, method?: string) {
  const res = await fetch(`http://127.0.0.1:55441${path}`, { method: method || (body ? "POST" : "GET"), headers: { "Content-Type": "application/json", ...(token ? { token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, data: await res.json() as any };
}
async function user(name: string) { await request("/signup", undefined, { username: name, password: "testing123" }); return (await request("/signin", undefined, { username:name, password:"testing123" })).data.token as string; }
async function account(token: string) { return (await request("/paper/account", token)).data; }
const wallet = (data: any, asset: string) => data.wallets.find((w: any) => w.asset === asset);
const order = (token: string, market: string, side: string, qty: number, type = "MARKET", price?: number) => request("/paper/order", token, { market, side, qty, type, price });
beforeAll(start);
afterAll(async () => { await stop(); fixture.stop(true); await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`); await prisma.$disconnect(); });

test("fractional multi-coin trades, fees, cost basis and P&L survive restart", async () => {
  const token = await user("paper-main");
  expect(wallet(await account(token), "USDT").available).toBe(100000);
  expect(wallet(await account(token), "USDT").available).toBe(100000);
  expect((await order(token, "BTC", "buy", 1.5)).status).toBe(201);
  expect((await order(token, "ETH", "buy", .25)).status).toBe(201);
  let data = await account(token);
  expect(wallet(data,"USDT").available).toBeCloseTo(99824.825, 7);
  expect(wallet(data,"BTC").available).toBe(1.5);
  expect(wallet(data,"BTC").averageCost).toBeCloseTo(100.1, 7);
  expect(data.fills).toHaveLength(2);
  bid=110; ask=111; quoteId++;
  expect((await order(token,"BTC","sell",.5)).status).toBe(201);
  data = await account(token);
  expect(wallet(data,"BTC").realizedPnl).toBeCloseTo(4.895, 7);
  expect(wallet(data,"USDT").available).toBeCloseTo(99879.77, 7);
  await stop(); await start();
  expect(wallet(await account(token),"USDT").available).toBeCloseTo(99879.77,7);
  expect((await order(token,"SOL","sell",1)).status).toBe(400);
  expect((await order(token,"FAKE","buy",1)).status).toBe(400);
  expect((await order(token,"BTC","buy",-1)).status).toBe(400);
});

test("resting limits survive restart, partial fills do not reuse a quote, cancellation releases remaining funds", async () => {
  const token = await user("paper-limit"); ask=100; bid=99; quoteId++;
  const placed = await order(token,"SOL","buy",2,"LIMIT",90);
  expect(placed.data.order.status).toBe("OPEN");
  expect(wallet(await account(token),"USDT").locked).toBeCloseTo(180.18,7);
  await stop(); await start();
  expect((await account(token)).orders[0].status).toBe("OPEN");
  ask=89; bid=88; liquidity=.5; quoteId++;
  await Bun.sleep(5500);
  let data=await account(token);
  expect(data.orders[0].filledQty).toBe(.5);
  expect(data.orders[0].status).toBe("PARTIALLY_FILLED");
  await Bun.sleep(5500);
  expect((await account(token)).orders[0].filledQty).toBe(.5);
  expect((await request(`/paper/order/${placed.data.order.id}`,token,undefined,"DELETE")).status).toBe(200);
  data=await account(token);
  expect(wallet(data,"USDT").locked).toBeCloseTo(0,7);
  expect(wallet(data,"USDT").available).toBeCloseTo(99955.4555,7);
  expect((await request(`/paper/order/${placed.data.order.id}`,token,undefined,"DELETE")).status).toBe(409);
  liquidity=1000;
}, 20000);

test("insufficient liquidity and provider failures do not change balances", async () => {
  const token=await user("paper-fail"); ask=100; bid=99; liquidity=.1; quoteId++;
  expect((await order(token,"BTC","buy",1)).status).toBe(400);
  unavailable=true;
  expect((await order(token,"BTC","buy",.1)).status).toBe(503);
  unavailable=false; liquidity=1000;
  expect(wallet(await account(token),"USDT").available).toBe(100000);
  expect((await account(token)).orders).toHaveLength(0);
});

test("concurrent orders cannot overspend; other users cannot cancel orders", async () => {
  const token=await user("paper-concurrent"), stranger=await user("paper-stranger"); ask=100; bid=99; quoteId++;
  const results=await Promise.all([order(token,"BTC","buy",600),order(token,"BTC","buy",600)]);
  expect(results.map(r=>r.status).sort()).toEqual([201,400]);
  const placed=await order(token,"BTC","sell",1,"LIMIT",200);
  expect((await request(`/paper/order/${placed.data.order.id}`,stranger,undefined,"DELETE")).status).toBe(404);
  expect((await request(`/paper/order/${placed.data.order.id}`,token,undefined,"DELETE")).status).toBe(200);
  expect(wallet(await account(token),"BTC").locked).toBeCloseTo(0,7);
});
