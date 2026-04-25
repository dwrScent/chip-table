import { chipTableService } from "@/lib/services/chip-table-service";
import { ok, fail, toAppError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const result = chipTableService.leavePlayer({ playerId: params.id });
    return ok(result);
  } catch (error) {
    return fail(toAppError(error));
  }
}
