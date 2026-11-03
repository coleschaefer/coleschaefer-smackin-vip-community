const SECRET_KEY = /api[_-]?key|authorization|password|secret|token|cookie|credential/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY.test(key) ? "[redacted]" : redact(inner);
    }
    return out;
  }
  if (typeof value === "string") {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/gi, "Bearer [redacted]")
      .replace(/\b(xai|sk|buf)[-_][A-Za-z0-9._\-]{8,}\b/gi, "[redacted]");
  }
  return value;
}

export function redactJson(value: unknown): string {
  return JSON.stringify(redact(value));
}
