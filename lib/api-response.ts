import { NextResponse } from "next/server";
import { AppError, isAppError } from "@/lib/errors";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error: AppError) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    },
    { status: error.status }
  );
}

export function toAppError(error: unknown) {
  if (isAppError(error)) {
    return error;
  }

  console.error("Unhandled error:", error);
  return new AppError(500, "INTERNAL_ERROR", "服务器内部错误");
}
