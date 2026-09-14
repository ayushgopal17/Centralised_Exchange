export const MARKET_SYMBOLS = [
  { symbol: "SOLUSDT", base: "SOL", name: "Solana" },
  { symbol: "BTCUSDT", base: "BTC", name: "Bitcoin" },
  { symbol: "ETHUSDT", base: "ETH", name: "Ethereum" },
  { symbol: "BNBUSDT", base: "BNB", name: "BNB" },
  { symbol: "XRPUSDT", base: "XRP", name: "XRP" },
  { symbol: "DOGEUSDT", base: "DOGE", name: "Dogecoin" },
  { symbol: "ADAUSDT", base: "ADA", name: "Cardano" },
  { symbol: "AVAXUSDT", base: "AVAX", name: "Avalanche" },
] as const;

export const MARKET_INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
export type MarketInterval = (typeof MARKET_INTERVALS)[number];

export type MarketTicker = {
  symbol: string;
  base: string;
  name: string;
  price: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  quoteVolume: number;
};

export type MarketCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MarketDepth = {
  bids: [number, number][];
  asks: [number, number][];
  lastUpdateId: number;
};

export type MarketTrade = {
  id: number;
  price: number;
  quantity: number;
  time: number;
  side: "buy" | "sell";
};

export type MarketSnapshot = {
  ticker: MarketTicker;
  depth: MarketDepth;
  trades: MarketTrade[];
  updatedAt: number;
  source: "Binance";
};

