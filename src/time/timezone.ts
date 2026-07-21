export function toDate(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate() as Date;
  }
  return new Date(String(value));
}

export function zonedInputToDate(input: string, timeZone: string) {
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) throw new Error("Enter a valid date and time.");
  const [, year, month, day, hour, minute] = match.map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(desired);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = zonedParts(candidate, timeZone, true);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    candidate = new Date(candidate.getTime() + desired - represented);
  }

  const resolved = zonedParts(candidate, timeZone, true);
  if (
    resolved.year !== year ||
    resolved.month !== month ||
    resolved.day !== day ||
    resolved.hour !== hour ||
    resolved.minute !== minute
  ) {
    throw new Error("That local time does not exist in the Family Space timezone.");
  }

  return candidate;
}

export function toZonedDateTimeInput(value: unknown, timeZone: string) {
  if (value == null) return "";
  const parts = zonedParts(toDate(value), timeZone, true);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function dateKeyInZone(value: unknown, timeZone: string) {
  const parts = zonedParts(toDate(value), timeZone, false);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function formatInTimeZone(
  value: unknown,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone }).format(toDate(value));
}

function zonedParts(date: Date, timeZone: string, includeTime: boolean) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
  }).formatToParts(date);
  const number = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: number("year"),
    month: number("month"),
    day: number("day"),
    hour: includeTime ? number("hour") : 0,
    minute: includeTime ? number("minute") : 0,
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
