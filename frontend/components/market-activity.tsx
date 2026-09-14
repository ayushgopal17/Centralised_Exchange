"use client";

import { Activity, AlertTriangle } from "lucide-react";
import type { MarketTrade } from "@/lib/market-data-types";

export function MarketActivity({ trades, loading, error }: { trades: MarketTrade[]; loading: boolean; error?: string }) {
  const recent = [...trades].sort((a, b) => b.time - a.time).slice(0, 12);
  return <section className="panel activity-panel">
    <div className="activity-heading"><span><Activity size={14} />Recent market activity</span><small><i /> Binance SOL/USDT · visualization only</small></div>
    <div className="activity-tape">
      {loading && !recent.length ? [1,2,3,4,5,6].map((item) => <div className="trade-tick skeleton" key={item} />) : error && !recent.length ? <div className="activity-error"><AlertTriangle size={14} /> {error}</div> : recent.map((trade) => <div className="trade-tick" key={trade.id}><strong className={trade.side}>{trade.price.toFixed(2)}</strong><span>{trade.quantity.toFixed(3)} SOL</span><time>{new Date(trade.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></div>)}
    </div>
  </section>;
}
