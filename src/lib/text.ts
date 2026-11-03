export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeBody(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function bodyHash(value: string): string {
  // Short stable hash for duplicate detection. Not a secret.
  let h = 2166136261;
  const text = normalizeBody(value);
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function isExcludedStaffName(displayName: string, staff: string[]): boolean {
  const normalized = normalizeName(displayName);
  const first = normalized.split(" ")[0] ?? normalized;
  return staff.some((entry) => {
    const staffName = normalizeName(entry);
    if (normalized === staffName) return true;
    if (!staffName.includes(" ") && first === staffName) return true;
    return false;
  });
}
