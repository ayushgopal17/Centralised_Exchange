"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { marketData, MarketDataError } from "./market-data";
import type { MarketCandle, MarketInterval, MarketSnapshot, MarketTicker } from "./market-data-types";

function message(error: unknown) { return error instanceof MarketDataError ? error.message : "Live market data is unavailable"; }

export function useMarketSnapshot(symbol = "SOLUSDT", pollMs = 5000) {
  const [data, setData] = useState<MarketSnapshot>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const running = useRef(false);
  const refresh = useCallback(async (quiet = false) => {
    if (running.current) return;
    running.current = true; quiet ? setRefreshing(true) : setLoading(true);
    try { setData(await marketData.snapshot(symbol)); setError(undefined); }
    catch (reason) { setError(message(reason)); }
    finally { setLoading(false); setRefreshing(false); running.current = false; }
  }, [symbol]);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(true), pollMs); return () => window.clearInterval(timer); }, [pollMs, refresh]);
  return { data, loading, refreshing, error, refresh: () => refresh(true) };
}

export function useMarketCandles(symbol: string, interval: MarketInterval, pollMs = 15000) {
  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try { const result = await marketData.candles(symbol, interval); setCandles(result.candles); setError(undefined); }
    catch (reason) { setError(message(reason)); }
    finally { setLoading(false); }
  }, [interval, symbol]);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(true), pollMs); return () => window.clearInterval(timer); }, [pollMs, refresh]);
  return { candles, loading, error, refresh: () => refresh(true) };
}

export function useMarketOverview(pollMs = 15000) {
  const [markets, setMarkets] = useState<MarketTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try { const result = await marketData.overview(); setMarkets(result.markets); setError(undefined); }
    catch (reason) { setError(message(reason)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(true), pollMs); return () => window.clearInterval(timer); }, [pollMs, refresh]);
  return { markets, loading, error, refresh: () => refresh(true) };
}

