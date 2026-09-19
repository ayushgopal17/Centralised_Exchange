"use client";
import { useCallback, useEffect, useState } from "react";
import { marketData } from "./market-data";
import type { MarketInterval } from "./market-data-types";

function usePolling<T>(key: string, fetcher: () => Promise<T>, pollMs: number) {
  const [state, setState] = useState<{ key: string; data?: T; error?: string; loading: boolean }>({ key, loading: true });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true, running = false;
    setState(previous => previous.key === key ? previous : { key, loading: true });
    const load = async () => {
      if (running) return;
      running = true;
      try { const data = await fetcher(); if (active) setState({ key, data, loading: false }); }
      catch (e) { if (active) setState(previous => ({ ...previous, key, loading: false, error: e instanceof Error ? e.message : "Market data unavailable" })); }
      finally { running = false; }
    };
    void load(); const timer = setInterval(load, pollMs);
    return () => { active = false; clearInterval(timer); };
  }, [key, fetcher, pollMs, revision]);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  return { ...(state.key === key ? state : { key, loading: true }), refresh };
}
export function useMarketSnapshot(symbol = "SOLUSDT", pollMs = 5000) {
  const load = useCallback(() => marketData.snapshot(symbol), [symbol]);
  const result = usePolling(symbol, load, pollMs);
  return { ...result, refreshing: result.loading };
}
export function useMarketCandles(symbol: string, interval: MarketInterval, pollMs = 15000) {
  const load = useCallback(() => marketData.candles(symbol, interval), [symbol, interval]);
  const result = usePolling(`${symbol}-${interval}`, load, pollMs);
  return { ...result, candles: result.data?.candles ?? [] };
}
export function useMarketOverview(pollMs = 15000) {
  const load = useCallback(() => marketData.overview(), []);
  const result = usePolling("overview", load, pollMs);
  return { ...result, markets: result.data?.markets ?? [] };
}
