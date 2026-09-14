import { NextRequest, NextResponse } from "next/server";
import { MARKET_INTERVALS, MARKET_SYMBOLS, type MarketCandle, type MarketDepth, type MarketSnapshot, type MarketTicker, type MarketTrade } from "@/lib/market-data-types";

const BINANCE_MARKET_DATA = "https://data-api.binance.vision/api/v3";
const allowedSymbols = new Map<string, (typeof MARKET_SYMBOLS)[number]>(MARKET_SYMBOLS.map((market) => [market.symbol, market]));

async function binance<T>(path: string, revalidate = 3): Promise<T> {
  const response = await fetch(`${BINANCE_MARKET_DATA}${path}`, {
    next: { revalidate },
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Market data provider returned ${response.status}`);
  return response.json() as Promise<T>;
}

function normalizeTicker(raw: Record<string, string>): MarketTicker {
  const market = allowedSymbols.get(raw.symbol);
  if (!market) throw new Error("Unsupported market response");
  return {
    symbol: raw.symbol,
    base: market.base,
    name: market.name,
    price: Number(raw.lastPrice),
    changePercent: Number(raw.priceChangePercent),
    high: Number(raw.highPrice),
    low: Number(raw.lowPrice),
    volume: Number(raw.volume),
    quoteVolume: Number(raw.quoteVolume),
  };
}

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") || "snapshot";
  const symbol = (request.nextUrl.searchParams.get("symbol") || "SOLUSDT").toUpperCase();
  if (!allowedSymbols.has(symbol)) return NextResponse.json({ message: "Unsupported market" }, { status: 400 });

  try {
    if (kind === "candles") {
      const interval = request.nextUrl.searchParams.get("interval") || "5m";
      if (!MARKET_INTERVALS.includes(interval as never)) return NextResponse.json({ message: "Unsupported timeframe" }, { status: 400 });
      const rows = await binance<(string | number)[][]>(`/klines?symbol=${symbol}&interval=${interval}&limit=240`, 10);
      const candles: MarketCandle[] = rows.map((row) => ({ time: Math.floor(Number(row[0]) / 1000), open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]) }));
      return NextResponse.json({ candles, source: "Binance", updatedAt: Date.now() });
    }

    if (kind === "overview") {
      const symbols = encodeURIComponent(JSON.stringify(MARKET_SYMBOLS.map((market) => market.symbol)));
      const rows = await binance<Record<string, string>[]>(`/ticker/24hr?symbols=${symbols}`, 5);
      return NextResponse.json({ markets: rows.map(normalizeTicker), source: "Binance", updatedAt: Date.now() });
    }

    if (kind !== "snapshot") return NextResponse.json({ message: "Unsupported market-data request" }, { status: 400 });
    const [tickerRaw, depthRaw, tradesRaw] = await Promise.all([
      binance<Record<string, string>>(`/ticker/24hr?symbol=${symbol}`, 3),
      binance<{ lastUpdateId: number; bids: [string, string][]; asks: [string, string][] }>(`/depth?symbol=${symbol}&limit=20`, 2),
      binance<{ a: number; p: string; q: string; T: number; m: boolean }[]>(`/aggTrades?symbol=${symbol}&limit=30`, 2),
    ]);
    const depth: MarketDepth = { lastUpdateId: depthRaw.lastUpdateId, bids: depthRaw.bids.map(([price, qty]) => [Number(price), Number(qty)]), asks: depthRaw.asks.map(([price, qty]) => [Number(price), Number(qty)]) };
    const trades: MarketTrade[] = tradesRaw.map((trade) => ({ id: trade.a, price: Number(trade.p), quantity: Number(trade.q), time: trade.T, side: trade.m ? "sell" : "buy" }));
    const snapshot: MarketSnapshot = { ticker: normalizeTicker(tickerRaw), depth, trades, updatedAt: Date.now(), source: "Binance" };
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError" ? "Market data request timed out" : "Live market data is temporarily unavailable";
    return NextResponse.json({ message }, { status: 502 });
  }
}
