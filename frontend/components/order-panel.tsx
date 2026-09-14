"use client";

import { useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { Balances } from "@/lib/types";

export function OrderPanel({ balances, bestBid, bestAsk, onCreated }: { balances?: Balances; bestBid?: number; bestAsk?: number; onCreated: () => void }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const total = useMemo(() => Number(price) * Number(qty), [price, qty]);
  const available = side === "buy" ? balances?.usd?.available : balances?.sol?.available;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const numericPrice = Number(price), numericQty = Number(qty);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) return toast.error("Enter a valid limit price");
    if (!Number.isInteger(numericQty) || numericQty <= 0) return toast.error("Quantity must be a whole number");
    if (side === "buy" && total > (balances?.usd?.available ?? 0)) return toast.error("Insufficient USD balance");
    if (side === "sell" && numericQty > (balances?.sol?.available ?? 0)) return toast.error("Insufficient SOL balance");
    setSubmitting(true);
    try {
      await api.createOrder({ market: "sol", price: numericPrice, qty: numericQty, side, type: "LIMIT" });
      toast.success(`${side === "buy" ? "Buy" : "Sell"} order placed`);
      setQty(""); onCreated();
    } catch (error) { toast.error(error instanceof ApiError ? error.message : "Order could not be placed"); }
    finally { setSubmitting(false); }
  };

  return (
    <section className="panel order-panel">
      <div className="side-tabs"><button className={side === "buy" ? "active buy" : ""} onClick={() => setSide("buy")}>Buy</button><button className={side === "sell" ? "active sell" : ""} onClick={() => setSide("sell")}>Sell</button></div>
      <form onSubmit={submit}>
        <div className="order-meta"><span>Available</span><strong>{available === undefined ? "—" : `${available.toFixed(4)} ${side === "buy" ? "USD" : "SOL"}`}</strong></div>
        <label className="trade-label">Limit price <span>Binance reference shown</span></label>
        <div className="trade-input"><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={side === "buy" ? bestAsk?.toString() || "0.00" : bestBid?.toString() || "0.00"} /><span>USD</span></div>
        <label>Quantity</label>
        <div className="trade-input"><input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" /><span>SOL</span></div>
        <div className="percent-row">{[25, 50, 75, 100].map((percent) => <button type="button" key={percent} onClick={() => {
          if (!available || !Number(price)) return;
          setQty(String(side === "buy" ? Math.floor((available * percent / 100) / Number(price)) : Math.floor(available * percent / 100)));
        }}>{percent}%</button>)}</div>
        <div className="order-summary"><span>Order value</span><strong>{Number.isFinite(total) && total > 0 ? `$${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}</strong></div>
        <button className={`trade-button ${side}`} disabled={submitting}>{submitting && <LoaderCircle className="spin" size={17} />}{side === "buy" ? "Buy SOL" : "Sell SOL"}</button>
        <p className="order-note">Submitted to the CEX V1 backend · market visuals are reference-only.</p>
      </form>
    </section>
  );
}
