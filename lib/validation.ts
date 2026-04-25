import { z } from "zod";
import { AppError } from "@/lib/errors";

const NAME_REGEX = /^[\p{L}\p{N}_\- ]+$/u;

export const playerNameSchema = z
  .string()
  .trim()
  .min(1, "玩家名称不能为空")
  .max(24, "玩家名称最多 24 个字符")
  .refine((value) => NAME_REGEX.test(value), "名称仅允许字母、数字、空格、_、-");

export const amountSchema = z
  .number({ invalid_type_error: "金额必须是数字" })
  .int("金额必须是整数")
  .positive("金额必须大于 0")
  .max(1_000_000_000, "金额超出允许范围");

export const idSchema = z.number().int().positive();

export function parseAmount(raw: unknown) {
  const numeric = typeof raw === "string" ? Number(raw) : raw;
  const result = amountSchema.safeParse(numeric);

  if (!result.success) {
    throw new AppError(400, "INVALID_AMOUNT", result.error.issues[0]?.message ?? "金额无效");
  }

  return result.data;
}

export function parsePlayerName(raw: unknown) {
  const result = playerNameSchema.safeParse(raw);
  if (!result.success) {
    throw new AppError(400, "INVALID_PLAYER_NAME", result.error.issues[0]?.message ?? "玩家名称无效");
  }

  return result.data;
}

export function parsePositiveId(raw: unknown, fieldName: string) {
  const numeric = typeof raw === "string" ? Number(raw) : raw;
  const result = idSchema.safeParse(numeric);

  if (!result.success) {
    throw new AppError(400, "INVALID_ID", `${fieldName} 无效`);
  }

  return result.data;
}
