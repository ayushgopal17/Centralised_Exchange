"use client";

import { ArrowDownToLine, ArrowUpFromLine, Landmark, LockKeyhole, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useExchangeData } from "@/lib/use-exchange-data";
import { useMarketOverview } from "@/lib/use-market-data";

export default function WalletPage() {
  const { balances, loading } = useExchangeData(7000);
  const market = useMarketOverview(20000);
  const usd = balances?.usd;
  const sol = balances?.sol;
  const solPrice = market.markets.find((item) => item.symbol === "SOLUSDT")?.price;
  const usdTotal = (usd?.available || 0) + (usd?.locked || 0);
  const solTotal = (sol?.available || 0) + (sol?.locked || 0);
  const estimatedValue = solPrice ? usdTotal + solTotal * solPrice : undefined;
  return <AppShell><div className="content-page wallet-page">
    <div className="page-title-row"><div><div className="eyebrow">ACCOUNT</div><h1>Portfolio</h1><p>Available and committed assets across your exchange account.</p></div><div className="wallet-actions"><button disabled title="Not supported by the V1 API"><ArrowDownToLine size={17} /> Deposit</button><button disabled title="Not supported by the V1 API"><ArrowUpFromLine size={17} /> Withdraw</button></div></div>
    <section className="portfolio-summary"><div><span>Estimated portfolio value</span><strong>{loading || !estimatedValue ? "—" : `$${estimatedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</strong><small>{solPrice ? `CEX balances valued with Binance SOL/USDT reference at $${solPrice.toFixed(2)}` : "CEX balances loaded · market reference unavailable"}</small></div><div className="portfolio-icon"><WalletCards /></div></section>
    <div className="metric-grid"><div className="metric-card"><Landmark /><span>Available USD</span><strong>{loading ? "—" : `$${(usd?.available || 0).toFixed(2)}`}</strong></div><div className="metric-card"><LockKeyhole /><span>USD in orders</span><strong>{loading ? "—" : `$${(usd?.locked || 0).toFixed(2)}`}</strong></div><div className="metric-card"><span className="coin sol-coin">S</span><span>Available SOL</span><strong>{loading ? "—" : `${(sol?.available || 0).toFixed(4)} SOL`}</strong></div><div className="metric-card"><LockKeyhole /><span>SOL in orders</span><strong>{loading ? "—" : `${(sol?.locked || 0).toFixed(4)} SOL`}</strong></div></div>
    <section className="panel balances-card"><div className="panel-heading"><div><h2>Balances</h2><span>Spot account</span></div></div><div className="balance-table table-head"><span>Asset</span><span>Available</span><span>In orders</span><span>Total</span></div>{[["USD", usd], ["SOL", sol]].map(([symbol, balance]) => { const item = balance as typeof usd; return <div className="balance-table" key={symbol as string}><span className="asset-cell"><i className={`coin ${symbol === "SOL" ? "sol-coin" : "usd-coin"}`}>{symbol === "SOL" ? "S" : "$"}</i><strong>{symbol as string}</strong></span><span>{item ? item.available.toFixed(symbol === "USD" ? 2 : 4) : "—"}</span><span>{item ? item.locked.toFixed(symbol === "USD" ? 2 : 4) : "—"}</span><strong>{item ? (item.available + item.locked).toFixed(symbol === "USD" ? 2 : 4) : "—"}</strong></div>; })}</section>
    <div className="feature-unavailable"><LockKeyhole size={18} /><div><strong>Transfers are not enabled in V1</strong><span>The backend does not expose deposit or withdrawal endpoints. No transfer action will be simulated.</span></div></div>
  </div></AppShell>;
}
