import { z } from "zod";

/**
 * bKash Tokenized Checkout (API v1.2.0-beta). Pure functions with an injectable fetch, so they can be tested
 * without bKash. Server only: the credentials never reach the browser.
 *
 * Flow: grant token -> create payment (bKash returns a page address) -> the customer pays on bKash ->
 * bKash sends the customer back to our callback address -> we EXECUTE the payment and read the result.
 * We never trust the callback's query string for the outcome; only the execute / status answer counts.
 */

export type BkashMode = "sandbox" | "live";

export type BkashCredentials = { mode: BkashMode; appKey: string; appSecret: string; username: string; password: string };

const BASES: Record<BkashMode, string> = {
  sandbox: "https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout",
  live: "https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout",
};

/** Hosts bKash may send the customer to. The page address from bKash is only followed when it is on one of these. */
const REDIRECT_SUFFIXES = [".bka.sh", ".bkash.com"];

export class BkashError extends Error {
  constructor(
    public readonly code: "not_configured" | "unavailable" | "rejected" | "bad_response" | "mismatch",
    message: string,
  ) {
    super(message);
    this.name = "BkashError";
  }
}

type FetchFn = typeof fetch;

async function post(fetchFn: FetchFn, url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    throw new BkashError("unavailable", "bKash is not reachable right now. Please try again in a moment.");
  }
  if (!response.ok) throw new BkashError("unavailable", "bKash is not available right now. Please try again later.");
  try {
    return await response.json();
  } catch {
    throw new BkashError("bad_response", "bKash returned an unexpected answer.");
  }
}

const tokenResponse = z.object({ id_token: z.string().min(10), statusCode: z.string().optional() });

/** Gets a short-lived token (valid about an hour). A new one is requested for each checkout step; this is cheap and simple. */
export async function grantToken(creds: BkashCredentials, fetchFn: FetchFn = fetch): Promise<string> {
  const json = await post(fetchFn, `${BASES[creds.mode]}/token/grant`, { username: creds.username, password: creds.password }, { app_key: creds.appKey, app_secret: creds.appSecret });
  const parsed = tokenResponse.safeParse(json);
  if (!parsed.success || (parsed.data.statusCode && parsed.data.statusCode !== "0000")) {
    throw new BkashError("rejected", "bKash did not accept the saved credentials.");
  }
  return parsed.data.id_token;
}

const createResponse = z.object({ statusCode: z.string(), paymentID: z.string().min(5).max(80).optional(), bkashURL: z.string().optional() });

export type CreatedPayment = { paymentId: string; redirectUrl: string };

export async function createPayment(
  creds: BkashCredentials,
  input: { amount: number; invoiceNumber: string; callbackUrl: string; payerReference: string },
  fetchFn: FetchFn = fetch,
): Promise<CreatedPayment> {
  const token = await grantToken(creds, fetchFn);
  const json = await post(
    fetchFn,
    `${BASES[creds.mode]}/create`,
    { authorization: token, "x-app-key": creds.appKey },
    {
      mode: "0011",
      payerReference: input.payerReference,
      callbackURL: input.callbackUrl,
      amount: input.amount.toFixed(2),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: input.invoiceNumber,
    },
  );
  const parsed = createResponse.safeParse(json);
  if (!parsed.success || parsed.data.statusCode !== "0000" || !parsed.data.paymentID || !parsed.data.bkashURL) {
    throw new BkashError("rejected", "bKash could not start the payment.");
  }
  if (!isBkashRedirect(parsed.data.bkashURL)) throw new BkashError("bad_response", "bKash returned an unexpected address.");
  return { paymentId: parsed.data.paymentID, redirectUrl: parsed.data.bkashURL };
}

export function isBkashRedirect(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && REDIRECT_SUFFIXES.some((suffix) => u.hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

const resultResponse = z.object({
  statusCode: z.string().optional(),
  transactionStatus: z.string().optional(),
  trxID: z.string().optional(),
  paymentID: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional(),
  merchantInvoiceNumber: z.string().optional(),
});

export type PaymentResult = { status: "completed" | "failed" | "pending"; trxId: string | null; amount: number | null; currency: string | null; invoiceNumber: string | null };

function readResult(json: unknown): PaymentResult {
  const parsed = resultResponse.safeParse(json);
  if (!parsed.success) throw new BkashError("bad_response", "bKash returned an unexpected answer.");
  const r = parsed.data;
  const amount = r.amount === undefined ? null : Number(r.amount);
  const completed = r.statusCode === "0000" && r.transactionStatus === "Completed";
  const pending = r.transactionStatus === "Initiated" || r.transactionStatus === "Authorized" || r.transactionStatus === "Pending";
  return {
    status: completed ? "completed" : pending && (r.statusCode === "0000" || r.statusCode === undefined) ? "pending" : "failed",
    trxId: r.trxID ?? null,
    amount: amount !== null && Number.isFinite(amount) ? amount : null,
    currency: r.currency ?? null,
    invoiceNumber: r.merchantInvoiceNumber ?? null,
  };
}

/** Asks bKash to take the money. Returns the real outcome. */
export async function executePayment(creds: BkashCredentials, paymentId: string, fetchFn: FetchFn = fetch): Promise<PaymentResult> {
  const token = await grantToken(creds, fetchFn);
  return readResult(await post(fetchFn, `${BASES[creds.mode]}/execute`, { authorization: token, "x-app-key": creds.appKey }, { paymentID: paymentId }));
}

/** Asks bKash what happened to a payment (used when execute was already called, or its answer was lost). */
export async function queryPayment(creds: BkashCredentials, paymentId: string, fetchFn: FetchFn = fetch): Promise<PaymentResult> {
  const token = await grantToken(creds, fetchFn);
  return readResult(await post(fetchFn, `${BASES[creds.mode]}/payment/status`, { authorization: token, "x-app-key": creds.appKey }, { paymentID: paymentId }));
}

const refundResponse = z.object({
  statusCode: z.string().optional(),
  transactionStatus: z.string().optional(),
  refundTrxID: z.string().optional(),
});

export type RefundResult = { status: "completed" | "failed"; refundTrxId: string | null };

/** Asks bKash to send money back for a completed payment. The refund is only trusted when bKash says Completed. */
export async function refundPayment(
  creds: BkashCredentials,
  input: { paymentId: string; trxId: string; amount: number; reason: string },
  fetchFn: FetchFn = fetch,
): Promise<RefundResult> {
  const token = await grantToken(creds, fetchFn);
  const json = await post(
    fetchFn,
    `${BASES[creds.mode]}/payment/refund`,
    { authorization: token, "x-app-key": creds.appKey },
    { paymentID: input.paymentId, trxID: input.trxId, amount: input.amount.toFixed(2), sku: "plan", reason: input.reason.slice(0, 100) },
  );
  const parsed = refundResponse.safeParse(json);
  if (!parsed.success) throw new BkashError("bad_response", "bKash returned an unexpected answer.");
  const done = parsed.data.statusCode === "0000" && parsed.data.transactionStatus === "Completed" && Boolean(parsed.data.refundTrxID);
  return { status: done ? "completed" : "failed", refundTrxId: parsed.data.refundTrxID ?? null };
}

/**
 * Checks that bKash confirmed exactly what we expected. The amount and invoice come from OUR database,
 * never from the customer's browser.
 */
export function confirmsExpected(result: PaymentResult, expected: { amount: number; invoiceNumber: string }): boolean {
  return (
    result.status === "completed" &&
    result.trxId !== null &&
    result.amount !== null &&
    Math.abs(result.amount - expected.amount) < 0.005 &&
    (result.currency === null || result.currency === "BDT") &&
    result.invoiceNumber === expected.invoiceNumber
  );
}
