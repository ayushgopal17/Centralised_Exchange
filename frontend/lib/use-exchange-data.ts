"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
import type { Balances, Depth, Fill, Order } from "./types";

export function useExchangeData(pollMs = 5000) {
  const [balances, setBalances] = useState<Balances>();
  const [depth, setDepth] = useState<Depth>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const running = useRef(false);

  const refresh = useCallback(async (quiet = false) => {
    if (running.current) return;
    running.current = true;
    if (!quiet) setLoading(true);
    const results = await Promise.allSettled([api.balances(), api.depth("sol"), api.orders(), api.fills()]);
    const [balanceResult, depthResult, ordersResult, fillsResult] = results;
    if (balanceResult.status === "fulfilled") setBalances(balanceResult.value.balance);
    if (depthResult.status === "fulfilled") setDepth(depthResult.value.depth);
    if (ordersResult.status === "fulfilled") setOrders(ordersResult.value.order);
    if (fillsResult.status === "fulfilled") setFills(fillsResult.value.fill);
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected?.status === "rejected") setError(rejected.reason instanceof ApiError ? rejected.reason.message : "Some exchange data could not be loaded");
    else setError(undefined);
    setLoading(false);
    running.current = false;
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(true), pollMs);
    return () => window.clearInterval(timer);
  }, [pollMs, refresh]);

  const refreshQuiet = useCallback(() => refresh(true), [refresh]);
  return { balances, depth, orders, fills, loading, error, refresh: refreshQuiet };
}
