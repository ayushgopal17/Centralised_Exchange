"use client";
import Link from "next/link";
import { ArrowUpRight, Wallet, TrendingUp, CircleDollarSign } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useMarketOverview } from "@/lib/use-market-data";
import { money, priceText, quantityText, usePaperAccount } from "@/lib/paper";
export default function PortfolioPage() {
  const account = usePaperAccount(); const market = useMarketOverview();
  const wallets = account.data?.wallets ?? [];
  const positions = wallets.filter(w => w.asset !== "USDT" && w.available + w.locked > 1e-8);
  const cash = wallets.find(w => w.asset === "USDT");
  const value = (asset: string) => market.markets.find(m => m.base === asset)?.price;
  const complete = !!account.data && positions.every(w => value(w.asset) !== undefined);
  const equity = complete ? wallets.reduce((sum,w) => sum + (w.available + w.locked) * (w.asset === "USDT" ? 1 : value(w.asset) || 0), 0) : undefined;
  const realized = wallets.reduce((sum,w) => sum + w.realizedPnl, 0);
  const unrealized = complete ? positions.reduce((sum,w) => sum + (w.available + w.locked) * ((value(w.asset) || 0) - w.averageCost), 0) : undefined;
  return <AppShell><div className="content-page wallet-page"><div className="page-title-row"><div><div className="eyebrow">YOUR PAPER ACCOUNT</div><h1>Portfolio overview</h1><p>A clear view of your positions, performance, and available capital.</p></div><Link href="/" className="portfolio-link">Back to trading <ArrowUpRight size={17} /></Link></div>
  {account.error && <div className="error-banner">{account.error}<button onClick={() => void account.refresh()}>Retry</button></div>}{market.error && <div className="stale-market-banner">Live valuation unavailable or delayed. Last available prices are shown.</div>}
  <section className="portfolio-summary"><div><span>Total portfolio value <em className="paper-tag">VIRTUAL USDT</em></span><strong>${money(equity)}</strong><small>Starting capital: 100,000 USDT · includes reserved funds</small></div><div className="portfolio-icon"><Wallet /></div></section>
  <div className="metric-grid"><div className="metric-card"><CircleDollarSign /><span>Available cash</span><strong>${money(cash?.available)}</strong></div><div className="metric-card"><Wallet /><span>Cash in open orders</span><strong>${money(cash?.locked)}</strong></div><div className="metric-card"><TrendingUp /><span>Realized P&L · after fees</span><strong className={realized < 0 ? "negative" : "positive"}>${account.data ? money(realized) : "—"}</strong></div><div className="metric-card"><TrendingUp /><span>Unrealized P&L</span><strong className={(unrealized || 0) < 0 ? "negative" : "positive"}>${money(unrealized)}</strong></div></div>
  <section className="panel positions-card"><div className="panel-heading"><h2>Your positions</h2><span>{positions.length} assets</span></div><div className="table-scroll"><div className="position-row table-head"><span>Asset</span><span>Quantity / Locked</span><span>Average cost</span><span>Market price</span><span>Market value</span><span>Unrealized P&L</span><span /></div>{positions.map(w => { const qty = w.available + w.locked, price = value(w.asset), pnl = price === undefined ? undefined : qty * (price - w.averageCost); return <div className="position-row" key={w.asset}><strong>{w.asset}<small>{w.asset}/USDT</small></strong><span>{quantityText(qty)}<small>{quantityText(w.locked)} in orders</small></span><span>{priceText(w.averageCost)}</span><span>{priceText(price)}</span><span>{money(price === undefined ? undefined : qty * price)}</span><span className={(pnl || 0) < 0 ? "negative" : "positive"}>{money(pnl)} USDT</span><Link className="positive" href={`/?coin=${w.asset}`}>Trade ↗</Link></div>; })}{!positions.length && <div className="table-empty"><Wallet size={28} /><strong>{account.loading ? "Loading portfolio" : "Your next idea starts here"}</strong><span>Buy a coin with virtual funds to start building your portfolio.</span><Link className="portfolio-link" href="/">Explore the terminal <ArrowUpRight size={14} /></Link></div>}</div></section><p className="info-note">Average cost includes buy fees. Realized P&L includes sell fees. Paper funds cannot be deposited or withdrawn. Legacy exchange records remain separate.</p></div></AppShell>;
}
