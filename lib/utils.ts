export function nowIso() {
  return new Date().toISOString();
}

export function normalizeName(value: string) {
  return value.trim().toLowerCase();
}
