import { chipTableService } from "@/lib/services/chip-table-service";
import { ok, fail, toAppError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = chipTableService.joinPlayer({ name: body?.name });
    return ok(result, 201);
  } catch (error) {
    return fail(toAppError(error));
  }
}
