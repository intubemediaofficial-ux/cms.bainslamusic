import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { removeChannelFromAllCaches } from "@/lib/client-data-cache";
import { kv } from "@/lib/redis";

export interface ChannelToken {
  channelId: string;
  channelTitle?: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry?: number;
  createdAt: string;
  updatedAt: string;
  lastValidatedAt?: string;
  lastChannelVerifiedAt?: string;
  googleChannelId?: string;
  grantedScopes?: string;
}

interface EncryptedChannelToken {
  kind: "encrypted-channel-token";
  version: 1;
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  ciphertext: string;
}

export type GoogleRevocationResult = "revoked" | "already_invalid" | "not_found";

const TOKEN_PREFIX = "channel_token:";
const CHANNEL_REVALIDATION_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

function getEncryptionKey(): Buffer {
  const secret =
    process.env.CHANNEL_TOKEN_ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) {
    throw new Error("Channel token encryption secret is not configured");
  }

  return createHash("sha256")
    .update(`intubemedia:channel-token:v1:${secret}`)
    .digest();
}

function isEncryptedChannelToken(value: unknown): value is EncryptedChannelToken {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<EncryptedChannelToken>;
  return (
    record.kind === "encrypted-channel-token" &&
    record.version === 1 &&
    record.algorithm === "aes-256-gcm" &&
    typeof record.iv === "string" &&
    typeof record.authTag === "string" &&
    typeof record.ciphertext === "string"
  );
}

function isPlainChannelToken(value: unknown): value is ChannelToken {
  if (!value || typeof value !== "object") return false;
  const token = value as Partial<ChannelToken>;
  return (
    typeof token.channelId === "string" &&
    typeof token.accessToken === "string" &&
    typeof token.refreshToken === "string" &&
    typeof token.createdAt === "string" &&
    typeof token.updatedAt === "string"
  );
}

export function encryptChannelTokenForStorage(token: ChannelToken): EncryptedChannelToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(token), "utf8"),
    cipher.final(),
  ]);

  return {
    kind: "encrypted-channel-token",
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptChannelTokenFromStorage(record: unknown): ChannelToken {
  if (!isEncryptedChannelToken(record)) {
    throw new Error("Unsupported encrypted channel token format");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(record.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(record.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
  const token = JSON.parse(plaintext) as unknown;
  if (!isPlainChannelToken(token)) {
    throw new Error("Decrypted channel token is invalid");
  }
  return token;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function getChannelToken(channelId: string): Promise<ChannelToken | null> {
  try {
    const stored = await kv.get<unknown>(`${TOKEN_PREFIX}${channelId}`);
    if (!stored) return null;
    if (isEncryptedChannelToken(stored)) {
      return decryptChannelTokenFromStorage(stored);
    }
    if (isPlainChannelToken(stored)) {
      await kv.set(`${TOKEN_PREFIX}${channelId}`, encryptChannelTokenForStorage(stored));
      return stored;
    }
    throw new Error("Stored channel token has an invalid format");
  } catch (error) {
    console.error(`[KV] Failed to load token for ${channelId}: ${errorMessage(error)}`);
    throw error;
  }
}

export async function setChannelToken(channelId: string, token: ChannelToken): Promise<void> {
  try {
    await kv.set(`${TOKEN_PREFIX}${channelId}`, encryptChannelTokenForStorage(token));
    console.log(`[KV] Encrypted token stored for ${channelId}`);
  } catch (error) {
    console.error(`[KV] Failed to store token for ${channelId}: ${errorMessage(error)}`);
    throw error;
  }
}

export async function deleteChannelToken(channelId: string): Promise<void> {
  try {
    await kv.del(`${TOKEN_PREFIX}${channelId}`);
    console.log(`[KV] Token deleted for ${channelId}`);
  } catch (error) {
    console.error(`[KV] Failed to delete token for ${channelId}: ${errorMessage(error)}`);
    throw error;
  }
}

export async function revokeGoogleCredential(
  token: string
): Promise<Exclude<GoogleRevocationResult, "not_found">> {
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });

  if (response.ok) return "revoked";
  if (response.status === 400) return "already_invalid";
  throw new Error(`Google token revocation failed with status ${response.status}`);
}

export async function revokeChannelAuthorization(
  channelId: string
): Promise<GoogleRevocationResult> {
  const channelToken = await getChannelToken(channelId);
  let result: GoogleRevocationResult = "not_found";
  let revocationError: unknown;
  if (channelToken) {
    const tokenToRevoke = channelToken.refreshToken || channelToken.accessToken;
    try {
      result = await revokeGoogleCredential(tokenToRevoke);
    } catch (error) {
      revocationError = error;
    }
  }

  await Promise.all([
    deleteChannelToken(channelId),
    removeChannelFromAllCaches(channelId),
  ]);
  if (revocationError) throw revocationError;
  return result;
}

async function deleteInvalidAuthorizationData(channelId: string): Promise<void> {
  await Promise.all([
    deleteChannelToken(channelId),
    removeChannelFromAllCaches(channelId),
  ]);
}

export async function getTokenStatus(channelId: string): Promise<"valid" | "expired" | "none"> {
  const token = await getChannelToken(channelId);
  if (!token) return "none";

  const accessToken = await getValidAccessToken(channelId);
  if (accessToken) return "valid";
  return (await getChannelToken(channelId)) ? "expired" : "none";
}

export async function refreshChannelToken(channelId: string): Promise<ChannelToken | null> {
  const token = await getChannelToken(channelId);
  if (!token?.refreshToken) return null;

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    if (!response.ok) {
      const responseBody = (await response.json().catch(() => ({}))) as { error?: string };
      if (responseBody.error === "invalid_grant" || responseBody.error === "invalid_token") {
        await deleteInvalidAuthorizationData(channelId);
      }
      return null;
    }

    const data = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    const updatedToken: ChannelToken = {
      ...token,
      accessToken: data.access_token,
      tokenExpiry: Date.now() + (data.expires_in || 3600) * 1000,
      updatedAt: new Date().toISOString(),
      lastValidatedAt: new Date().toISOString(),
    };

    await setChannelToken(channelId, updatedToken);
    return updatedToken;
  } catch (error) {
    console.warn(`[OAuth] Token refresh failed for ${channelId}: ${errorMessage(error)}`);
    return null;
  }
}

async function revalidateChannelAuthorization(
  channelId: string,
  token: ChannelToken
): Promise<ChannelToken | null> {
  const lastVerifiedAt = token.lastChannelVerifiedAt
    ? Date.parse(token.lastChannelVerifiedAt)
    : 0;
  if (
    Number.isFinite(lastVerifiedAt) &&
    Date.now() - lastVerifiedAt < CHANNEL_REVALIDATION_INTERVAL_MS
  ) {
    return token;
  }

  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
    { headers: { Authorization: `Bearer ${token.accessToken}` } }
  );

  if (response.status === 401) {
    await deleteInvalidAuthorizationData(channelId);
    return null;
  }
  if (!response.ok) {
    console.warn(
      `[OAuth] Periodic channel revalidation failed for ${channelId} with status ${response.status}`
    );
    return null;
  }

  const data = (await response.json()) as { items?: Array<{ id?: string }> };
  const verifiedChannelId = data.items?.[0]?.id;
  if (verifiedChannelId !== channelId) {
    try {
      await revokeGoogleCredential(token.refreshToken || token.accessToken);
    } catch (error) {
      console.warn(
        `[OAuth] Failed to revoke mismatched authorization for ${channelId}: ${errorMessage(error)}`
      );
    }
    await deleteInvalidAuthorizationData(channelId);
    return null;
  }

  const updatedToken: ChannelToken = {
    ...token,
    googleChannelId: verifiedChannelId,
    lastChannelVerifiedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await setChannelToken(channelId, updatedToken);
  return updatedToken;
}

export async function getValidAccessToken(channelId: string): Promise<string | null> {
  let token = await getChannelToken(channelId);
  if (!token) return null;

  if (token.tokenExpiry && Date.now() > token.tokenExpiry) {
    token = await refreshChannelToken(channelId);
    if (!token) return null;
  }

  token = await revalidateChannelAuthorization(channelId, token);
  return token?.accessToken || null;
}

export async function getAnyValidAccessToken(channelIds: string[]): Promise<string | null> {
  for (const channelId of channelIds) {
    const token = await getValidAccessToken(channelId);
    if (token) return token;
  }
  return null;
}

export function isKVConfigured(): boolean {
  return true;
}
