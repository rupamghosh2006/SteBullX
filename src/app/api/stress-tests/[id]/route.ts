import { NextResponse } from "next/server";
import { getResult } from "@/services/result-store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getResult(id);
  if (!result) return NextResponse.json({ error: "Stress test not found. Results are held in-process in this MVP; rerun the test after a server restart." }, { status: 404 });
  return NextResponse.json(result);
}
