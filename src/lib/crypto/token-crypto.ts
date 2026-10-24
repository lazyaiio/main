import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Encrypts provider access tokens before they are stored (AES-256-GCM).
 *
 *  - The key is derived from the server's encryption secret (any random string of 32 or more characters).
 *  - Every value gets its own random IV, and is bound to a "context" (for example the workspace and
 *    Page it belongs to). A stored value copied to another row fails to decrypt.
 *  - Stored format: v1.<iv>.<auth tag>.<ciphertext>, each part base64url.
 *
 * Pure functions: the secret is passed in, so this file is easy to test and never reads the environment.
 */

const VERSION = "v1";
const SALT = Buffer.from("lazyai-token-encryption-salt-v1");
const MIN_SECRET_LENGTH = 32;

export class TokenCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenCryptoError";
  }
}

function deriveKey(secret: string): Buffer {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new TokenCryptoError(`The token encryption key must be at least ${MIN_SECRET_LENGTH} characters long.`);
  }
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), SALT, Buffer.from("token-encryption"), 32));
}

const b64 = (buffer: Buffer) => buffer.toString("base64url");

export function encryptToken(secret: string, context: string, plaintext: string): string {
  if (!plaintext) throw new TokenCryptoError("There is no token to encrypt.");
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, b64(iv), b64(cipher.getAuthTag()), b64(encrypted)].join(".");
}

export function decryptToken(secret: string, context: string, stored: string): string {
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new TokenCryptoError("The stored token has an unknown format.");
  const [, ivPart, tagPart, dataPart] = parts as [string, string, string, string];
  try {
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), Buffer.from(ivPart, "base64url"));
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error instanceof TokenCryptoError) throw error;
    // Wrong key, wrong context, or damaged data. Never include details.
    throw new TokenCryptoError("The stored token could not be decrypted.");
  }
}
