"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import type { Fill, Order } from "@/lib/types";
import { api, ApiError } from "@/lib/api";

export function OrdersTable({ orders, fills, loading, onChanged }: { orders: Order[]; fills: Fill[]; loading: boolean; onChanged: () => void }) {
  const [tab, setTab] = useState<"open" | "history" | "fills">("open");
  const openOrders = orders.filter((order) => order.status === "OPEN" || order.status === "PARTIALLY_FILLED");
  const rows = tab === "open" ? openOrders : tab === "history" ? orders : fills;
  const cancel = async (id: string) => {
    try { await api.cancelOrder(id); toast.success("Order cancelled"); onChanged(); }
    catch (error) { toast.error(error instanceof ApiError ? error.message : "Could not cancel order"); }
  };
  return (
    <section className="panel orders-panel">
      <div className="table-tabs"><button className={tab === "open" ? "active" : ""} onClick={() => setTab("open")}>Open orders <span>{openOrders.length}</span></button><button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Order history</button><button className={tab === "fills" ? "active" : ""} onClick={() => setTab("fills")}>Trades</button></div>
      <div className="table-scroll">
        <div className="data-table table-head"><span>Market</span><span>Side</span><span>Price</span><span>Quantity</span><span>{tab === "fills" ? "Time" : "Filled"}</span><span>Status</span><span /></div>
        {loading ? <div className="table-loading"><i /><i /><i /></div> : rows.length === 0 ? <div className="table-empty"><ClipboardList size={24} /><strong>{tab === "open" ? "No open orders" : tab === "fills" ? "No trades yet" : "No order history"}</strong><span>Your activity will appear here.</span></div> : rows.map((row) => {
          const isOrder = "status" in row;
          return <div className="data-table" key={row.id}><span>{row.market.toUpperCase()} / USD</span><span className={row.side}>{row.side.toUpperCase()}</span><span>${row.price.toFixed(2)}</span><span>{row.qty} SOL</span><span>{isOrder ? `${row.filledQty} / ${row.qty}` : new Date(row.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span><span><em data-status={isOrder ? row.status : "FILLED"}>{isOrder ? row.status.replaceAll("_", " ") : "FILLED"}</em></span><span>{tab === "open" && isOrder ? <button className="text-button danger" onClick={() => cancel(row.id)}>Cancel</button> : ""}</span></div>;
        })}
      </div>
    </section>
  );
}

