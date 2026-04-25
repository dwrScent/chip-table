import { chipTableService } from "@/lib/services/chip-table-service";
import { ok, fail, toAppError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Number.parseInt(url.searchParams.get("logLimit") ?? "", 10);
    const data = chipTableService.getStatePayload(Number.isNaN(limit) ? undefined : limit);
    return ok(data);
  } catch (error) {
    return fail(toAppError(error));
  }
}
