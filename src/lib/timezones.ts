export const DEFAULT_TIMEZONE = "Asia/Dhaka";

const FALLBACK = ["Asia/Dhaka", "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York"];

export function isValidTimeZone(value: string): boolean {
  if (!value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function getTimeZoneOptions(): string[] {
  let list: string[];
  try {
    list = Intl.supportedValuesOf("timeZone");
  } catch {
    list = FALLBACK;
  }
  if (!list.includes(DEFAULT_TIMEZONE)) list = [DEFAULT_TIMEZONE, ...list];
  if (!list.includes("UTC")) list = [...list, "UTC"];
  return list;
}
