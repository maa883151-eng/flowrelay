import { NextRequest, NextResponse } from "next/server";
import { deleteConnector } from "@/lib/store";

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/connectors/[id]">) {
  const { id } = await ctx.params;
  const ok = deleteConnector(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
