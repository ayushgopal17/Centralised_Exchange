import { ExchangeError } from "./exchange";
export const COINS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX"];
export const FEE_RATE = 0.001;
export type Quote = { id: string; at: number; bids: [number, number][]; asks: [number, number][] };
export async function getQuote(asset: string): Promise<Quote> {
  if (!COINS.includes(asset)) throw new ExchangeError(400, "Unsupported coin");
  try {
    const response = await fetch(`${process.env.MARKET_DATA_BASE_URL || "https://data-api.binance.vision/api/v3"}/depth?symbol=${asset}USDT&limit=100`, { signal: AbortSignal.timeout(7000), cache: "no-store" });
    if (!response.ok) throw new Error("Provider unavailable");
    const raw = await response.json() as { lastUpdateId: number; bids: string[][]; asks: string[][] };
    const parse = (levels: string[][]): [number, number][] => levels.map(row => [Number(row[0]), Number(row[1])]);
    const quote = { id: String(raw.lastUpdateId), at: Date.now(), bids: parse(raw.bids), asks: parse(raw.asks) };
    if (!quote.bids.length || !quote.asks.length || !Number.isFinite(raw.lastUpdateId) ||
        [...quote.bids, ...quote.asks].some(([p, q]) => !Number.isFinite(p) || !Number.isFinite(q) || p <= 0 || q <= 0)) throw new Error("Invalid market data");
    quote.bids.sort((a,b) => b[0]-a[0]); quote.asks.sort((a,b) => a[0]-b[0]);
    return quote;
  } catch { throw new ExchangeError(503, "Live execution prices are unavailable. No simulated trade was made; try again shortly."); }
}
