"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";

type Tool = { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => Promise<unknown> };
declare global { interface Document { modelContext?: { registerTool: (tool: Tool, options?: { signal?: AbortSignal }) => void | Promise<void> } } }

export function WebMcpTools({ onOrderCreated }: { onOrderCreated: () => void }) {
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const createOrder: Tool = {
      name: "create_sol_limit_order",
      title: "Create SOL limit order",
      description: "Place a real SOL/USD limit buy or sell order on the signed-in user's exchange account.",
      inputSchema: { type: "object", properties: { side: { type: "string", enum: ["buy", "sell"] }, price: { type: "number", exclusiveMinimum: 0 }, quantity: { type: "integer", minimum: 1 } }, required: ["side", "price", "quantity"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => {
        const value = input as { side?: string; price?: number; quantity?: number };
        if (!(["buy", "sell"] as unknown[]).includes(value.side) || !Number.isFinite(value.price) || Number(value.price) <= 0 || !Number.isInteger(value.quantity) || Number(value.quantity) < 1) throw new Error("Invalid side, price, or quantity");
        await api.createOrder({ market: "sol", side: value.side as "buy" | "sell", price: Number(value.price), qty: Number(value.quantity), type: "LIMIT" });
        onOrderCreated();
        return { status: "placed", market: "SOL/USD", side: value.side, price: value.price, quantity: value.quantity };
      },
    };
    try { void Promise.resolve(context.registerTool(createOrder, { signal: lifecycle.signal })).catch(() => undefined); } catch {}
    return () => lifecycle.abort();
  }, [onOrderCreated]);
  return null;
}

