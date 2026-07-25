const CHANNELS_PREFIX = "bainsla_channels";
const REQUESTS_PREFIX = "bainsla_channel_requests";

function scopedKey(prefix: string, email: string | null | undefined): string | null {
  const identity = email?.trim().toLowerCase();
  return identity ? `${prefix}:${identity}` : null;
}

function readScopedValue<T>(prefix: string, email: string | null | undefined): T[] {
  if (typeof window === "undefined") return [];
  const key = scopedKey(prefix, email);
  if (!key) return [];

  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T[]) : [];
  } catch {
    return [];
  }
}

function writeScopedValue<T>(prefix: string, email: string | null | undefined, value: T[]): void {
  if (typeof window === "undefined") return;
  const key = scopedKey(prefix, email);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function readStoredChannels<T>(email: string | null | undefined): T[] {
  return readScopedValue<T>(CHANNELS_PREFIX, email);
}

export function writeStoredChannels<T>(email: string | null | undefined, channels: T[]): void {
  writeScopedValue(CHANNELS_PREFIX, email, channels);
}

export function readChannelRequests<T>(email: string | null | undefined): T[] {
  return readScopedValue<T>(REQUESTS_PREFIX, email);
}

export function writeChannelRequests<T>(email: string | null | undefined, requests: T[]): void {
  writeScopedValue(REQUESTS_PREFIX, email, requests);
}
