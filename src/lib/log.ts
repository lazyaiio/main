import "server-only";
import { redactObject, redactText } from "./redact";

/**
 * The only way server code should write to the logs. Everything passes through the redactor, so a token,
 * key, password, or cookie can never end up in Vercel's logs, even by accident. Log events and error
 * CODES, never message text from people, never request bodies.
 */
export function logError(event: string, details: Record<string, unknown> = {}): void {
  console.error(JSON.stringify({ level: "error", event: redactText(event).slice(0, 80), ...redactObject(details) }));
}

export function logInfo(event: string, details: Record<string, unknown> = {}): void {
  console.info(JSON.stringify({ level: "info", event: redactText(event).slice(0, 80), ...redactObject(details) }));
}

/** A safe summary of an unknown error: its name and a redacted, shortened message (never a stack with data). */
export function describeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: redactText(error.message).slice(0, 200) };
  return { name: "UnknownError", message: "" };
}
