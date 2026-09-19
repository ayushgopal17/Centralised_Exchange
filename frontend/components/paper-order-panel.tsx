"use client";
import { useState } from "react";
import { ArrowDownUp, LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { money, paper, quantityText, type PaperAccount } from "@/lib/paper";
export function PaperOrderPanel({ asset, bid, ask, account, onCreated, stale }: { asset: string; bid?: number; ask?: number; account?: PaperAccount; onCreated: () => void; stale: boolean }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [price, setPrice] = useState(""); const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const quote = side === "buy" ? ask : bid;
  const executionPrice = type === "LIMIT" ? Number(price) : quote;
  const value = (executionPrice || 0) * Number(qty);
  const fee = value * (account?.feeRate ?? .001);
  const available = account?.wallets.find(w => w.asset === (side === "buy" ? "USDT" : asset))?.available ?? 0;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isFinite(Number(qty)) || Number(qty) <= 0) return toast.error("Enter a positive quantity");
    if (type === "LIMIT" && (!Number.isFinite(Number(price)) || Number(price) <= 0)) return toast.error("Enter a positive limit price");
    setBusy(true);
    try {
      const result = await paper.order({ market: asset, side, type, qty: Number(qty), ...(type === "LIMIT" ? { price: Number(price) } : {}) });
      if (localStorage.getItem("cex_confirmations") !== "false") toast.success(result.message); setQty(""); onCreated();
    } catch(e) { toast.error(e instanceof Error ? e.message : "Order failed"); }
    finally { setBusy(false); }
  }
  return <section className="panel order-panel"><div className="panel-heading"><h2>Place order</h2><span className="paper-tag">PAPER</span></div>
    <div className="side-tabs"><button className={side === "buy" ? "active buy" : ""} onClick={() => setSide("buy")}>Buy / Long</button><button className={side === "sell" ? "active sell" : ""} onClick={() => setSide("sell")}>Sell / Close</button></div>
    <form onSubmit={submit}><div className="order-type-tabs">{(["MARKET", "LIMIT"] as const).map(t => <button key={t} type="button" className={type === t ? "active" : ""} onClick={() => setType(t)}>{t === "MARKET" ? "Market" : "Limit"}</button>)}</div>
    <div className="order-meta"><span>Available balance</span><strong>{account ? quantityText(available) : "—"} {side === "buy" ? "USDT" : asset}</strong></div>
    <label htmlFor="order-price">{type === "MARKET" ? "Execution price" : "Limit price"}</label><div className="trade-input"><input id="order-price" aria-label="Order price" inputMode="decimal" value={type === "MARKET" ? "Best available price" : price} disabled={type === "MARKET"} onChange={e => setPrice(e.target.value)} placeholder={quote?.toString() || "0.00"} /><button type="button" className="input-unit" onClick={() => { if (type === "LIMIT" && quote) setPrice(String(quote)); }}>{type === "LIMIT" ? "Last" : "USDT"}</button></div>
    <label htmlFor="order-qty">Quantity</label><div className="trade-input"><input id="order-qty" inputMode="decimal" placeholder="0.00" value={qty} onChange={e => setQty(e.target.value)} /><span>{asset}</span></div>
    <div className="percent-row">{[25,50,75,100].map(percent => <button type="button" key={percent} onClick={() => {
      const amount = side === "buy" ? available / ((executionPrice || 1) * (1 + (account?.feeRate ?? .001))) : available;
      setQty(String(Math.floor(amount * percent / 100 * 1e8) / 1e8));
    }}>{percent}%</button>)}</div>
    <div className="order-estimate"><div><span>Estimated value</span><strong>{money(value)} USDT</strong></div><div><span>Trading fee · 0.10%</span><span>{money(fee)} USDT</span></div><div><span>{side === "buy" ? "Estimated total" : "Estimated proceeds"}</span><strong>{money(side === "buy" ? value + fee : value - fee)} USDT</strong></div></div>
    <button className={`trade-button ${side}`} disabled={busy || !account || stale || !quote}>{busy ? <LoaderCircle size={16} className="spin" /> : <ArrowDownUp size={16} />}{side === "buy" ? "Buy" : "Sell"} {asset}</button>
    <p className="order-note">{stale ? "Waiting for fresh market prices" : type === "MARKET" ? "Simulated execution across live order-book prices." : "Fills when a live quote reaches your limit. Checked every 5s."}</p>
    <div className="paper-assurance"><ShieldCheck size={17} /><span>Virtual funds. Real market experience.<small>Spot only · no leverage or short selling</small></span></div></form></section>;
}
