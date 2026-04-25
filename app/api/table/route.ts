import { chipTableService } from "@/lib/services/chip-table-service";
import { ok, fail, toAppError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const result = chipTableService.updateTable({ name: body?.name });
    return ok(result);
  } catch (error) {
    return fail(toAppError(error));
  }
}
