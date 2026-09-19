"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export type Wallet = { asset: string; available: number; locked: number; averageCost: number; realizedPnl: number };
export type PaperOrder = { id: string; market: string; side: "buy" | "sell"; type: "LIMIT" | "MARKET"; price: number; qty: number; filledQty: number; averagePrice: number; fees: number; status: string; createdAt: string };
export type PaperFill = { id: string; market: string; side: string; price: number; qty: number; fee: number; realizedPnl: number; createdAt: string };
export type PaperAccount = { wallets: Wallet[]; orders: PaperOrder[]; fills: PaperFill[]; initialCash: number; feeRate: number };
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy/paper${path}`, { ...options, headers: { "Content-Type": "application/json" }, cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Paper trading is unavailable");
  return data;
}
export const paper = {
  account: () => request<PaperAccount>("/account"),
  order: (body: { market: string; side: string; type: string; qty: number; price?: number }) => request<{ order: PaperOrder; message: string }>("/order", { method: "POST", body: JSON.stringify(body) }),
  cancel: (id: string) => request(`/order/${id}`, { method: "DELETE" }),
};
export function usePaperAccount() {
  const [data, setData] = useState<PaperAccount>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++sequence.current;
    try { const result = await paper.account(); if(id === sequence.current) { setData(result); setError(undefined); } }
    catch (e) { if(id === sequence.current) setError(e instanceof Error ? e.message : "Account unavailable"); }
    finally { if(id === sequence.current) setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); const timer = setInterval(refresh, 4000); return () => { clearInterval(timer); sequence.current++; }; }, [refresh]);
  return { data, error, loading, refresh };
}
export const money = (n?: number) => n === undefined || !Number.isFinite(n) ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const priceText = (n?: number) => n === undefined ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 6 : n < 10 ? 4 : 2 });
export const quantityText = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 8 });
