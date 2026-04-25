import { chipTableService } from "@/lib/services/chip-table-service";
import { ok, fail, toAppError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = chipTableService.resetTable({ adminPin: body?.adminPin });
    return ok(result);
  } catch (error) {
    return fail(toAppError(error));
  }
}
