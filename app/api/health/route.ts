import { initDatabase } from "@/lib/db";
import { ok, fail, toAppError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = initDatabase();
    return ok({
      status: "ok",
      databasePath: result.databasePath,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return fail(toAppError(error));
  }
}
