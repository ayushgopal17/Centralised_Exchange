"use client";

import { AlertTriangle } from "lucide-react";
import type { MarketDepth } from "@/lib/market-data-types";

export function OrderBook({ depth, loading, error, midPrice, asset = "SOL" }: { depth?: MarketDepth; loading: boolean; error?: string; midPrice?: number; asset?: string }) {
  const asks = (depth?.asks || []).slice(0, 7).reverse();
  const bids = (depth?.bids || []).slice(0, 7);
  const maxQty = Math.max(1, ...asks.map(([, qty]) => qty), ...bids.map(([, qty]) => qty));
  const row = ([price, qty]: [number, number], side: "ask" | "bid") => (
    <div className="book-row" key={`${side}-${price}`}>
      <span className="depth-bar" style={{ width: `${Math.min(100, (qty / maxQty) * 100)}%` }} data-side={side} />
      <span className={side}>{price.toFixed(price < 1 ? 5 : 2)}</span><span>{qty.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span><span>{(price * qty).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
    </div>
  );
  return (
    <section className="panel orderbook-panel">
      <div className="panel-heading"><div><h2>Market depth</h2><span className="source-label"><i /> Live Binance depth</span></div><span className="reference-pill">MARKET</span></div>
      <div className="book-labels"><span>Price (USDT)</span><span>Amount ({asset})</span><span>Total</span></div>
      {error && !depth ? <div className="book-error"><AlertTriangle size={18} /><span>{error}</span></div> : <>
        <div className="book-side asks">{loading && !depth ? <BookSkeleton /> : asks.map((level) => row(level, "ask"))}</div>
        <div className="spread-row"><strong>{midPrice ? midPrice.toFixed(midPrice < 1 ? 5 : 2) : "—"}</strong><span>Last market price</span></div>
        <div className="book-side bids">{loading && !depth ? <BookSkeleton /> : bids.map((level) => row(level, "bid"))}</div>
      </>}
      <div className="reference-footer">Live liquidity · simulated execution</div>
    </section>
  );
}

function BookSkeleton() { return <>{[1,2,3,4,5].map((i) => <div className="book-skeleton" key={i} style={{ width: `${94 - i * 6}%` }} />)}</>; }
