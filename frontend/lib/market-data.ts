import type { MarketCandle, MarketInterval, MarketSnapshot, MarketTicker } from "./market-data-types";

export class MarketDataError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function marketRequest<T>(query: string): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/market?${query}`, { cache: "no-store" }); }
  catch { throw new MarketDataError("Unable to reach the market-data service", 0); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new MarketDataError(data.message || "Market data is unavailable", response.status);
  return data as T;
}

export const marketData = {
  snapshot: (symbol = "SOLUSDT") => marketRequest<MarketSnapshot>(`kind=snapshot&symbol=${symbol}`),
  candles: (symbol: string, interval: MarketInterval) => marketRequest<{ candles: MarketCandle[]; source: "Binance"; updatedAt: number }>(`kind=candles&symbol=${symbol}&interval=${interval}`),
  overview: () => marketRequest<{ markets: MarketTicker[]; source: "Binance"; updatedAt: number }>("kind=overview"),
};

