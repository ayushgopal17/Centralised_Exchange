import type { Balances, Depth, Fill, Order } from "./types";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const USER_KEY = "cex_username";

export const session = {
  username: () => (typeof window === "undefined" ? null : localStorage.getItem(USER_KEY)),
  set: (username: string) => {
    localStorage.setItem(USER_KEY, username);
  },
  clear: () => {
    localStorage.removeItem(USER_KEY);
  },
};

async function request<T>(path: string, options: RequestInit = {}, authenticated = false): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (authenticated) headers.set("x-cex-authenticated-request", "1");

  let response: Response;
  try {
    response = await fetch(`/api/proxy${path}`, { ...options, headers, cache: "no-store" });
  } catch {
    throw new ApiError("Unable to reach the exchange service", 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.message || "Something went wrong", response.status);
  return data as T;
}

export const api = {
  signup: (username: string, password: string) => request<{ message: string }>("/signup", { method: "POST", body: JSON.stringify({ username, password }) }),
  signin: async (username: string, password: string) => {
    const response = await fetch("/api/auth/signin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(data.message || "Unable to sign in", response.status);
    return data as { username: string };
  },
  signout: () => fetch("/api/auth/logout", { method: "POST" }),
  session: async () => {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    return response.ok;
  },
  depth: (symbol: string) => request<{ depth: Depth }>(`/depth/${symbol}`),
  balances: () => request<{ balance: Balances }>("/balance", {}, true),
  orders: () => request<{ order: Order[] }>("/order", {}, true),
  fills: () => request<{ fill: Fill[] }>("/fills", {}, true),
  createOrder: (payload: { market: string; price: number; qty: number; side: "buy" | "sell"; type: "LIMIT" }) =>
    request<{ message: string }>("/order", { method: "POST", body: JSON.stringify(payload) }, true),
  cancelOrder: (id: string) => request<{ message: string }>(`/order/${id}`, { method: "DELETE" }, true),
};
