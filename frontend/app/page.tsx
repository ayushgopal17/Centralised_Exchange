"use client";

import { useCallback } from "react";
import { AlertTriangle, ChevronDown, RefreshCw, Star } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CandlestickChart } from "@/components/candlestick-chart";
import { MarketActivity } from "@/components/market-activity";
import { OrderBook } from "@/components/order-book";
import { OrderPanel } from "@/components/order-panel";
import { OrdersTable } from "@/components/orders-table";
import { WebMcpTools } from "@/components/webmcp-tools";
import { useExchangeData } from "@/lib/use-exchange-data";
import { useMarketSnapshot } from "@/lib/use-market-data";

function compact(value: number) { return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(value); }

export default function TradingPage() {
  const account = useExchangeData(4000);
  const market = useMarketSnapshot("SOLUSDT", 5000);
  const bestBid = market.data?.depth.bids[0]?.[0];
  const bestAsk = market.data?.depth.asks[0]?.[0];
  const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : market.data?.ticker.price;
  const refreshData = useCallback(() => void account.refresh(), [account.refresh]);
  const refreshAll = () => { void account.refresh(); void market.refresh(); };
  const ticker = market.data?.ticker;

  return (
    <AppShell>
      <WebMcpTools onOrderCreated={refreshData} />
      <div className="market-strip">
        <div className="market-identity"><button aria-label="Favorite SOL"><Star size={17} /></button><span className="coin sol-coin">S</span><div><strong>SOL / USD</strong><small>CEX spot market</small></div><ChevronDown size={16} /></div>
        <div className="quote-block primary-quote"><span>Reference price</span><strong>{ticker ? `$${ticker.price.toFixed(2)}` : "—"}</strong><small><i className="market-live-dot" /> Binance SOL/USDT</small></div>
        <div className="quote-block"><span>24h change</span><strong className={ticker && ticker.changePercent < 0 ? "negative" : "positive"}>{ticker ? `${ticker.changePercent >= 0 ? "+" : ""}${ticker.changePercent.toFixed(2)}%` : "—"}</strong><small>{ticker ? `H ${ticker.high.toFixed(2)} · L ${ticker.low.toFixed(2)}` : market.error || "Loading market"}</small></div>
        <div className="quote-block"><span>Best bid / ask</span><strong>{bestBid && bestAsk ? `${bestBid.toFixed(2)} / ${bestAsk.toFixed(2)}` : "—"}</strong><small>External reference</small></div>
        <div className="quote-block"><span>24h volume</span><strong>{ticker ? `${compact(ticker.volume)} SOL` : "—"}</strong><small>{ticker ? `$${compact(ticker.quoteVolume)} USDT` : "Public market data"}</small></div>
        <button className={`refresh-button ${market.refreshing ? "loading" : ""}`} onClick={refreshAll} aria-label="Refresh account and market data"><RefreshCw size={15} /></button>
      </div>
      {account.error && <div className="error-banner"><AlertTriangle size={17} /><span>Account data: {account.error}</span><button onClick={() => void account.refresh()}>Retry</button></div>}
      {market.error && market.data && <div className="stale-market-banner">Market reference refresh failed. Showing the latest available Binance snapshot.</div>}
      <div className="trading-grid">
        <CandlestickChart />
        <OrderBook depth={market.data?.depth} loading={market.loading} error={market.error} midPrice={midPrice} />
        <OrderPanel balances={account.balances} bestBid={bestBid} bestAsk={bestAsk} onCreated={refreshData} />
        <MarketActivity trades={market.data?.trades || []} loading={market.loading} error={market.error} />
        <OrdersTable orders={account.orders} fills={account.fills} loading={account.loading} onChanged={refreshData} />
      </div>
    </AppShell>
  );
}
