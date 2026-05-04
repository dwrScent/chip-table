import { chipTableService } from "@/lib/services/chip-table-service";
import { ok, fail, toAppError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const logs = chipTableService.listLogs(Number.isNaN(limit) ? undefined : limit);
    return ok({ logs });
  } catch (error) {
    return fail(toAppError(error));
  }
}
