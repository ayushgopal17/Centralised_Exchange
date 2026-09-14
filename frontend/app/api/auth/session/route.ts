import { NextRequest, NextResponse } from "next/server";
export async function GET(request: NextRequest) {
  if (!request.cookies.get("cex_session")?.value) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true });
}
