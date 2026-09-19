"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, RefreshCw, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useMarketOverview } from "@/lib/use-market-data";

function compact(value: number) { return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(value); }

export default function MarketsPage() {
  const { markets, loading, error, refresh } = useMarketOverview();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => markets.filter((market) => `${market.base} ${market.name}`.toLowerCase().includes(query.toLowerCase())), [markets, query]);
  return <AppShell><div className="content-page">
    <div className="page-title-row"><div><div className="eyebrow">MARKET INTELLIGENCE</div><h1>Markets</h1><p>Discover your next trade. Eight live markets, one virtual portfolio.</p></div><div className="market-tools"><div className="search-box"><Search size={17} /><input aria-label="Search markets" placeholder="Search markets" value={query} onChange={(event) => setQuery(event.target.value)} /></div><button className="page-refresh" onClick={refresh} aria-label="Refresh markets"><RefreshCw size={16} /></button></div></div>
    <div className="data-provenance"><span><i /> Live public data</span><strong>Binance USDT spot markets</strong><small>Live prices · simulated spot execution</small></div>
    {error && !markets.length && <div className="market-error-state"><AlertTriangle /><strong>Markets are temporarily unavailable</strong><span>{error}</span><button onClick={refresh}>Try again</button></div>}
    <section className="panel markets-card">
      <div className="market-table market-table-head"><span>Market</span><span>Last price</span><span>24h change</span><span>24h high / low</span><span>24h volume</span><span>Trading</span><span /></div>
      {loading && !markets.length ? [1,2,3,4,5,6].map((row) => <div className="market-table market-loading-row" key={row}><i /><i /><i /><i /><i /><i /></div>) : filtered.map((market) => {
        const tradable = true;
        return <div className="market-table" key={market.symbol}><span className="asset-cell"><i className={`coin ${market.base === "SOL" ? "sol-coin" : market.base === "BTC" ? "btc-coin" : "market-coin"}`}>{market.base === "BTC" ? "₿" : market.base[0]}</i><span><strong>{market.base} / USDT</strong><small>{market.name}</small></span></span><strong>${market.price.toLocaleString(undefined, { maximumFractionDigits: market.price < 1 ? 5 : 2 })}</strong><span className={market.changePercent < 0 ? "negative" : "positive"}>{market.changePercent >= 0 ? "+" : ""}{market.changePercent.toFixed(2)}%</span><span><strong>${market.high.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong><small>${market.low.toLocaleString(undefined, { maximumFractionDigits: 2 })}</small></span><span>{compact(market.volume)} {market.base}</span><span><em data-status={tradable ? "OPEN" : "VIEW_ONLY"}>{tradable ? "PAPER TRADING" : "MARKET DATA"}</em></span>{tradable ? <Link href={`/?coin=${market.base}`}>Trade <ArrowUpRight size={14} /></Link> : <span className="muted">Reference</span>}</div>;
      })}
      {!loading && !error && filtered.length === 0 && <div className="table-empty"><Search size={22} /><strong>No matching markets</strong><span>Try another symbol or name.</span></div>}
    </section>
    {error && markets.length > 0 && <div className="info-note">Showing the latest market snapshot because refresh failed.</div>}
  </div></AppShell>;
}
