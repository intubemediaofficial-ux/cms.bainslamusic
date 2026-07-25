const DEFAULT_APP_URL = "https://cms.bainslamusic.com";

/**
 * Canonical public origin for this CMS instance.
 * Driven by env so each independent deployment stays isolated to its own domain.
 */
export function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  const base = configured && configured.trim() ? configured.trim() : DEFAULT_APP_URL;
  try {
    return new URL(base).origin;
  } catch {
    return DEFAULT_APP_URL;
  }
}

export function getLoginUrl(): string {
  return `${getAppUrl()}/login`;
}
