import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    const response = await fetch(`${BACKEND_URL}/signin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }), cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token) return NextResponse.json({ message: data.message || "Unable to sign in" }, { status: response.status });
    const result = NextResponse.json({ username });
    result.cookies.set("cex_session", data.token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 });
    return result;
  } catch {
    return NextResponse.json({ message: "Exchange API is unavailable" }, { status: 503 });
  }
}
