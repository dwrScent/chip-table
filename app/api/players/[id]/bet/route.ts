import { chipTableService } from "@/lib/services/chip-table-service";
import { ok, fail, toAppError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const body = await request.json();
    const result = chipTableService.betToPot({
      playerId: params.id,
      amount: body?.amount
    });
    return ok(result);
  } catch (error) {
    return fail(toAppError(error));
  }
}
