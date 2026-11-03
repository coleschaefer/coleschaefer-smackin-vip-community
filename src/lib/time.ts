const CHICAGO = "America/Chicago";

export function chicagoDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHICAGO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function chicagoWeekday(instant: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CHICAGO,
    weekday: "long",
  })
    .format(instant)
    .toLowerCase();
}

export function chicagoTime(instant: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CHICAGO,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
}

export function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function mondayOf(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = utc.getUTCDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  return addCalendarDays(isoDate, delta);
}

export function weekdayOfIso(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).toLowerCase();
}

export function addDaysToInstant(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * 24 * 60 * 60 * 1000);
}

export function asInstant(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Unreadable instant: ${String(value)}`);
    }
    return parsed;
  }
  throw new Error("Expected a timestamp");
}

export function asDateOnly(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  throw new Error("Expected a date");
}
