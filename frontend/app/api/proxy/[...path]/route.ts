import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const destination = `${BACKEND_URL}/${path.join("/")}${request.nextUrl.search}`;
  const headers = new Headers();
  const token = request.cookies.get("cex_session")?.value;
  if (token) headers.set("token", token);
  headers.set("Content-Type", "application/json");

  try {
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
    const response = await fetch(destination, { method: request.method, headers, body, cache: "no-store" });
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") || "application/json" },
    });
  } catch {
    return NextResponse.json({ message: "Exchange API is unavailable. Check that the backend is running." }, { status: 503 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
