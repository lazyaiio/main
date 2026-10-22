import "server-only";
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { ExtractError } from "./errors";
import type { Resolver, Transport } from "./safe-fetch";

/** Resolves a hostname to all its addresses. Validation happens in the caller. */
export const nodeResolve: Resolver = async (hostname) => {
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    return records.map((r) => ({ address: r.address, family: r.family === 6 ? 6 : 4 }));
  } catch {
    throw new ExtractError("dns_failed");
  }
};

/**
 * Real HTTP transport. It connects to the pre-validated IP address (the lookup hook returns that
 * address, so no second DNS lookup can be tampered with) while keeping the hostname for the Host
 * header and TLS certificate checks.
 */
export const nodeTransport: Transport = (req) =>
  new Promise((resolve, reject) => {
    // Both modules share the same request options; "servername" is simply ignored by plain http.
    const send = (req.url.protocol === "https:" ? https.request : http.request) as typeof https.request;
    const hostname = req.url.hostname.replace(/^\[|\]$/g, "");

    const request = send(
      {
        protocol: req.url.protocol,
        hostname,
        port: req.url.port || undefined,
        path: `${req.url.pathname}${req.url.search}`,
        method: "GET",
        headers: { ...req.headers, host: req.url.host, "accept-encoding": "gzip, deflate", connection: "close" },
        timeout: req.timeoutMs,
        servername: hostname,
        lookup: (_host: string, options: unknown, callback: unknown) => {
          const done = callback as (...args: unknown[]) => void;
          if (options && (options as { all?: boolean }).all) {
            done(null, [{ address: req.address, family: req.family }]);
          } else {
            done(null, req.address, req.family);
          }
        },
      },
      (response) => {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(response.headers)) {
          if (typeof value === "string") headers[key] = value;
          else if (Array.isArray(value) && value[0]) headers[key] = value[0];
        }
        resolve({ status: response.statusCode ?? 0, headers, body: response });
      },
    );

    request.on("timeout", () => request.destroy(new Error("timed out")));
    request.on("error", (error) => reject(error));
    request.end();
  });
