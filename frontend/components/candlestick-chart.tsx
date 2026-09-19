"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { CandlestickSeries, ColorType, createChart, HistogramSeries, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import { MARKET_INTERVALS, type MarketInterval } from "@/lib/market-data-types";
import { useMarketCandles } from "@/lib/use-market-data";

const labels: Record<MarketInterval, string> = { "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1H", "4h": "4H", "1d": "1D" };

export function CandlestickChart({ asset = "SOL" }: { asset?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const fitted = useRef("");
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeries = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [interval, setInterval] = useState<MarketInterval>("5m");
  const { candles, loading, error, refresh } = useMarketCandles(`${asset}USDT`, interval);

  useEffect(() => {
    if (!container.current) return;
    const chart = createChart(container.current, {
      width: container.current.clientWidth,
      height: 410,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#737986", fontFamily: "var(--font-ui)", fontSize: 11 },
      grid: { vertLines: { color: "#181b20" }, horzLines: { color: "#181b20" } },
      rightPriceScale: { borderColor: "#262a31", scaleMargins: { top: 0.08, bottom: 0.25 } },
      timeScale: { borderColor: "#262a31", timeVisible: true, secondsVisible: false, rightOffset: 3 },
      crosshair: { vertLine: { color: "#6f767f", labelBackgroundColor: "#30343b" }, horzLine: { color: "#6f767f", labelBackgroundColor: "#30343b" } },
    });
    chartRef.current = chart;
    candleSeries.current = chart.addSeries(CandlestickSeries, { upColor: "#42e6a4", downColor: "#ff5975", borderVisible: false, wickUpColor: "#42e6a4", wickDownColor: "#ff5975", priceFormat: { type: "price", precision: ["DOGE", "ADA", "XRP"].includes(asset) ? 5 : 2, minMove: ["DOGE", "ADA", "XRP"].includes(asset) ? 0.00001 : 0.01 } });
    volumeSeries.current = chart.addSeries(HistogramSeries, { priceScaleId: "volume", priceFormat: { type: "volume" }, color: "rgba(66,230,164,.22)" });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });
    const observer = new ResizeObserver(([entry]) => chart.applyOptions({ width: entry.contentRect.width }));
    observer.observe(container.current);
    return () => { observer.disconnect(); chart.remove(); chartRef.current = null; candleSeries.current = null; volumeSeries.current = null; };
  }, []);

  useEffect(() => {
    candleSeries.current?.setData(candles.map(({ time, open, high, low, close }) => ({ time: time as Time, open, high, low, close })));
    volumeSeries.current?.setData(candles.map((candle) => ({ time: candle.time as Time, value: candle.volume, color: candle.close >= candle.open ? "rgba(66,230,164,.22)" : "rgba(255,89,117,.20)" })));
    if (candles.length && fitted.current !== `${asset}-${interval}`) { chartRef.current?.timeScale().fitContent(); fitted.current = `${asset}-${interval}`; }
  }, [candles, interval, asset]);

  return (
    <section className="panel chart-panel">
      <div className="panel-heading chart-heading">
        <div><h2>{asset} / USDT <span className="chart-spot">SPOT</span></h2><span className="source-label"><i /> Live candlesticks · Binance</span></div>
        <div className="chart-controls"><div className="intervals">{MARKET_INTERVALS.map((value) => <button key={value} className={interval === value ? "active" : ""} onClick={() => setInterval(value)}>{labels[value]}</button>)}</div><button className={`chart-refresh ${loading ? "loading" : ""}`} onClick={refresh} aria-label="Refresh candles"><RefreshCw size={13} /></button></div>
      </div>
      <div className="chart-wrap" ref={container} />
      {loading && candles.length === 0 && <div className="chart-loading"><i /><span>Loading {labels[interval]} candles</span></div>}
      {error && candles.length === 0 && <div className="chart-empty"><AlertTriangle size={22} /><strong>Chart data unavailable</strong><small>{error}</small><button onClick={refresh}>Try again</button></div>}
      {error && candles.length > 0 && <div className="stale-badge">Showing last update · refresh failed</div>}
    </section>
  );
}
