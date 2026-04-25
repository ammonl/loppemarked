import { createHash, randomBytes } from "node:crypto";
import { CANCELLATION_TOKEN_TTL_DAYS } from "@loppemarked/shared";
import type { Kysely, Transaction } from "kysely";
import type { Database } from "../db/types.js";

const TOKEN_BYTES = 32;

/** A plaintext token only lives in memory; only the hash is persisted. */
export function generateCancellationToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashCancellationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildCancellationUrl(baseUrl: string, token: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/cancel?token=${encodeURIComponent(token)}`;
}

/**
 * Resolve the public web base URL used to anchor outbound email links.
 *
 * `PUBLIC_WEB_URL` is set on the Lambda by the deploy workflow from the
 * matching GitHub environment variable; the localhost fallback only
 * applies to local development.
 */
export function getPublicWebBaseUrl(): string {
  const explicit = process.env["PUBLIC_WEB_URL"];
  if (explicit && explicit.length > 0) return explicit;
  return "http://localhost:3000";
}

interface CreateTokenInput {
  registrationId: string;
  ttlDays?: number;
}

/**
 * Persist a cancellation-token hash for a registration and return the
 * plaintext token so the caller can embed it in the confirmation email.
 */
export async function createCancellationToken(
  db: Kysely<Database> | Transaction<Database>,
  input: CreateTokenInput,
): Promise<{ token: string; expiresAt: string }> {
  const token = generateCancellationToken();
  const tokenHash = hashCancellationToken(token);
  const ttlDays = input.ttlDays ?? CANCELLATION_TOKEN_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000).toISOString();

  await db
    .insertInto("registration_cancellation_tokens")
    .values({
      token_hash: tokenHash,
      registration_id: input.registrationId,
      expires_at: expiresAt,
    })
    .execute();

  return { token, expiresAt };
}

export interface ResolvedToken {
  id: string;
  registrationId: string;
  expiresAt: Date;
  consumedAt: Date | null;
}

/**
 * Resolve a plaintext token to its DB row, or null if the token has no
 * matching active record. A token is considered invalid if it is unknown,
 * already consumed, or expired — callers receive null for all of these cases
 * so they can respond with a single generic error message.
 */
export async function resolveCancellationToken(
  db: Kysely<Database> | Transaction<Database>,
  token: string,
): Promise<ResolvedToken | null> {
  if (!token) return null;
  const tokenHash = hashCancellationToken(token);
  const row = await db
    .selectFrom("registration_cancellation_tokens")
    .select(["id", "registration_id", "expires_at", "consumed_at"])
    .where("token_hash", "=", tokenHash)
    .executeTakeFirst();

  if (!row) return null;

  const expiresAt = new Date(row.expires_at);
  if (expiresAt.getTime() <= Date.now()) return null;
  if (row.consumed_at) return null;

  return {
    id: row.id,
    registrationId: row.registration_id,
    expiresAt,
    consumedAt: row.consumed_at ? new Date(row.consumed_at) : null,
  };
}

/**
 * Mark a token as consumed. Returns true if the update affected a row that
 * was not previously consumed, false otherwise. Used to enforce one-time use
 * under concurrent requests.
 */
export async function consumeCancellationToken(
  db: Kysely<Database> | Transaction<Database>,
  tokenId: string,
): Promise<boolean> {
  const result = await db
    .updateTable("registration_cancellation_tokens")
    .set({ consumed_at: new Date().toISOString() })
    .where("id", "=", tokenId)
    .where("consumed_at", "is", null)
    .executeTakeFirst();

  return Number(result.numUpdatedRows ?? 0) > 0;
}
