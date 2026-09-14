export type AssetBalance = { available: number; locked: number };
export type Balances = Record<string, AssetBalance>;

export type Order = {
  id: string;
  userId: string;
  market: string;
  price: number;
  qty: number;
  filledQty: number;
  side: "buy" | "sell";
  type: string;
  status: "OPEN" | "PARTIALLY_FILLED" | "FILLED" | string;
  createdAt: string;
};

export type Fill = {
  id: string;
  market: string;
  price: number;
  qty: number;
  side: "buy" | "sell";
  type: string;
  originalOrderId: string;
  createdAt: string;
};

export type Depth = { bids: Order[]; ask: Order[] };

