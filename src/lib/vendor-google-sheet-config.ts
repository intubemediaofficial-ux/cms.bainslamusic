import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { kv } from "@/lib/redis";

const CONFIG_KEY = "cms_vendor_google_sheet_config";
const SCOPED_SHEET_PREFIX = "cms_vendor_google_sheet_scope:";

export interface VendorGoogleSheetConfig {
  spreadsheetId: string;
  clientEmail: string;
  privateKey: string;
}

interface EncryptedConfig {
  version: 1;
  iv: string;
  authTag: string;
  ciphertext: string;
}

function encryptionKey(): Buffer {
  const secret =
    process.env.CHANNEL_TOKEN_ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error("Google Sheet credential encryption is not configured");
  return createHash("sha256")
    .update(`intubemedia:vendor-google-sheet:v1:${secret}`)
    .digest();
}

function encryptConfig(config: VendorGoogleSheetConfig): EncryptedConfig {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(config), "utf8"),
    cipher.final(),
  ]);
  return {
    version: 1,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function isEncryptedConfig(value: unknown): value is EncryptedConfig {
  if (!value || typeof value !== "object") return false;
  const stored = value as Partial<EncryptedConfig>;
  return stored.version === 1 &&
    typeof stored.iv === "string" &&
    typeof stored.authTag === "string" &&
    typeof stored.ciphertext === "string";
}

function decryptConfig(stored: EncryptedConfig): VendorGoogleSheetConfig {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(stored.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(stored.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(stored.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as VendorGoogleSheetConfig;
}

export async function saveVendorGoogleSheetConfig(
  config: VendorGoogleSheetConfig
): Promise<void> {
  await kv.set(CONFIG_KEY, encryptConfig(config));
}

export async function saveScopedVendorGoogleSheetConfig(
  scopeUserId: string,
  config: VendorGoogleSheetConfig
): Promise<void> {
  await kv.set(`${SCOPED_SHEET_PREFIX}${scopeUserId}`, encryptConfig(config));
}

async function getStoredVendorGoogleSheetConfig(): Promise<VendorGoogleSheetConfig | null> {
  const stored = await kv.get<unknown>(CONFIG_KEY);
  return isEncryptedConfig(stored) ? decryptConfig(stored) : null;
}

export async function getVendorGoogleSheetConfig(
  scopeUserId?: string
): Promise<VendorGoogleSheetConfig | null> {
  const storedConfig = await getStoredVendorGoogleSheetConfig();
  if (scopeUserId) {
    const scoped = await kv.get<unknown>(`${SCOPED_SHEET_PREFIX}${scopeUserId}`);
    return isEncryptedConfig(scoped) ? decryptConfig(scoped) : null;
  }

  const clientEmail =
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL?.trim() ||
    storedConfig?.clientEmail;
  const privateKey =
    process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n") ||
    storedConfig?.privateKey;
  const spreadsheetId =
    process.env.VENDOR_GOOGLE_SHEET_ID?.trim() ||
    storedConfig?.spreadsheetId;
  return spreadsheetId && clientEmail && privateKey
    ? { spreadsheetId, clientEmail, privateKey }
    : null;
}

export async function getVendorGoogleSheetServiceAccountEmail(
  scopeUserId?: string
): Promise<string> {
  if (scopeUserId) {
    return (await getVendorGoogleSheetConfig(scopeUserId))?.clientEmail || "";
  }
  const storedConfig = await getStoredVendorGoogleSheetConfig();
  return (
    process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL?.trim() ||
    storedConfig?.clientEmail ||
    ""
  );
}

export async function getConfiguredVendorGoogleSheetScopeIds(): Promise<string[]> {
  const keys = await kv.keys(`${SCOPED_SHEET_PREFIX}*`);
  return keys
    .map((key) => key.slice(SCOPED_SHEET_PREFIX.length))
    .filter(Boolean);
}
