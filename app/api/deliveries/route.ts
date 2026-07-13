import { NextResponse } from "next/server";
import { listDeliveries } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ deliveries: listDeliveries() });
}
