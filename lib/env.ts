function asNumber(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export const env = {
  databasePath: process.env.DATABASE_PATH ?? "./data/chip-table.db",
  adminPin: process.env.ADMIN_PIN ?? "123456",
  tableName: process.env.TABLE_NAME ?? "Main Table",
  logLimit: asNumber(process.env.LOG_LIMIT, 80)
};
