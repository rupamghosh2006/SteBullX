import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * API-key gate for hosted deployments. Local open-source use remains possible
 * when STEBULLX_API_KEY is intentionally unset.
 */
export function requireApiKey(request: Request): NextResponse | null {
  const expected = process.env.STEBULLX_API_KEY;
  if (!expected) return null;
  const received = request.headers.get("x-api-key") ?? "";
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  if (expectedBytes.length !== receivedBytes.length || !timingSafeEqual(expectedBytes, receivedBytes)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "www-authenticate": "ApiKey" } });
  }
  return null;
}
