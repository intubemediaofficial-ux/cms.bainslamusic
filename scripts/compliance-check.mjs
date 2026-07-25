import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

function includesAll(source, values, label) {
  for (const value of values) {
    assert.ok(source.includes(value), `${label} is missing: ${value}`);
  }
}

const oauth = read("src/lib/youtube-oauth.ts");
includesAll(oauth, [
  '"https://www.googleapis.com/auth/youtube"',
  '"https://www.googleapis.com/auth/yt-analytics.readonly"',
  '"https://www.googleapis.com/auth/yt-analytics-monetary.readonly"',
  'access_type: "offline"',
  'prompt: "consent"',
  "YOUTUBE_OAUTH_SCOPES.join",
], "OAuth configuration");
assert.ok(!oauth.includes("youtube.readonly"), "Redundant youtube.readonly scope must not return");
assert.ok(oauth.includes('process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL'), "OAuth redirects must use a configured public origin");
assert.ok(!oauth.includes("x-forwarded-host"), "OAuth redirects must not trust a caller-controlled forwarded host");

const tokenRoute = read("src/app/api/channel-tokens/route.ts");
includesAll(tokenRoute, [
  "randomBytes(32).toString(\"base64url\")",
  "15 * 60",
  "channel_oauth_state:",
  "/authorize-channel?state=",
  'request.method !== "DELETE"',
  'export async function DELETE(request: Request)',
], "OAuth invite and mutation flow");
assert.match(
  tokenRoute,
  /const mutationActions = new Set\(\[[\s\S]*?"bulkExpireTokens"[\s\S]*?\]\)/,
  "Bulk token revocation must require DELETE"
);

const consentRoute = read("src/app/api/channel-authorization/route.ts");
includesAll(consentRoute, [
  "acceptedPolicies",
  "confirmsChannelAuthority",
  "YOUTUBE_OAUTH_CONSENT_VERSION",
  '"Cache-Control": "no-store"',
], "Consent API");

const exchange = read("src/app/api/channel-tokens/exchange/route.ts");
includesAll(exchange, [
  "setIfNotExists(`${oauthStateKey}:used`",
  "await kv.del(oauthStateKey)",
  "const redirectUri = `${getPublicOrigin(request)}/callback`",
  "YOUTUBE_OAUTH_SCOPES.filter",
  "mine: true",
  "googleChannelId !== expectedChannelId",
  "safelyRevokeCredential(accessToken)",
  "removeChannelFromAllCaches(expectedChannelId)",
  "lastChannelVerifiedAt: now",
], "OAuth exchange");
assert.ok(!exchange.includes("redirectUri?:"), "The browser must not choose the token-exchange redirect URI");
assert.ok(!exchange.includes("tokenData,"), "Full Google token responses must not be logged");

const callback = read("src/app/callback/page.tsx");
assert.ok(callback.includes("JSON.stringify({ code, state })"), "Callback must send only code and state");
assert.ok(!callback.includes("window.location.origin}/callback"), "Callback must not supply its own redirect URI");

const youtubeRoute = read("src/app/api/youtube/route.ts");
includesAll(youtubeRoute, [
  'case "demographics"',
  "channelScope.approved.has(channelId)",
  "getValidAccessToken(channelId)",
  "getCountryData(accessToken, startDate, endDate, channelId)",
  "getDemographics(accessToken, startDate, endDate, channelId)",
], "Per-channel analytics access");
assert.ok(!youtubeRoute.includes("session.accessToken"), "YouTube API routes must not use CMS login tokens");

const tokens = read("src/lib/channel-tokens.ts");
includesAll(tokens, [
  'algorithm: "aes-256-gcm"',
  "createCipheriv(\"aes-256-gcm\"",
  "createDecipheriv(",
  "https://oauth2.googleapis.com/revoke",
  "removeChannelFromAllCaches(channelId)",
  "if (revocationError) throw revocationError",
  "CHANNEL_REVALIDATION_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000",
  "lastChannelVerifiedAt",
  "mine=true",
], "Token lifecycle");
assert.ok(!tokens.includes("memoryTokenStore"), "OAuth tokens must not fall back to process memory");
assert.ok(!tokens.includes("token.slice("), "OAuth token prefixes must not be logged");

const require = createRequire(import.meta.url);
const compiledTokens = ts.transpileModule(tokens, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText;
const tokenModule = { exports: {} };
const mockRequire = (id) => {
  if (id === "@/lib/redis") return { kv: {} };
  if (id === "@/lib/client-data-cache") {
    return { removeChannelFromAllCaches: async () => undefined };
  }
  return require(id);
};
new Function("require", "module", "exports", compiledTokens)(
  mockRequire,
  tokenModule,
  tokenModule.exports
);
const tokenExports = tokenModule.exports;
const previousEncryptionKey = process.env.CHANNEL_TOKEN_ENCRYPTION_KEY;
process.env.CHANNEL_TOKEN_ENCRYPTION_KEY = "compliance-test-encryption-key";
const sampleToken = {
  channelId: "UC_COMPLIANCE_TEST",
  channelTitle: "Compliance Test",
  accessToken: "access-token-must-not-appear-in-storage",
  refreshToken: "refresh-token-must-not-appear-in-storage",
  tokenExpiry: Date.now() + 3_600_000,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
const encryptedToken = tokenExports.encryptChannelTokenForStorage(sampleToken);
assert.equal(encryptedToken.algorithm, "aes-256-gcm", "Token encryption must use AES-256-GCM");
assert.ok(!JSON.stringify(encryptedToken).includes(sampleToken.accessToken), "Encrypted storage must not contain plaintext access tokens");
assert.deepEqual(tokenExports.decryptChannelTokenFromStorage(encryptedToken), sampleToken, "Encrypted tokens must decrypt without data loss");
if (previousEncryptionKey === undefined) delete process.env.CHANNEL_TOKEN_ENCRYPTION_KEY;
else process.env.CHANNEL_TOKEN_ENCRYPTION_KEY = previousEncryptionKey;

const auth = read("src/lib/auth.ts");
assert.ok(auth.includes('scope: "openid email profile"'), "CMS Google Sign-In must request identity scopes only");
assert.ok(!auth.includes("session.accessToken"), "OAuth tokens must not be exposed in the browser session");
assert.ok(!auth.includes("token.accessToken"), "CMS identity sessions must not retain Google access tokens");
assert.ok(!auth.includes("token.refreshToken"), "CMS identity sessions must not retain Google refresh tokens");
assert.ok(!auth.includes("refreshAccessToken"), "CMS identity login must not maintain unused Google API credentials");
assert.ok(!/ADMIN_PASSWORD_\d+\s*\|\|/.test(auth), "Admin passwords must not have source-code fallbacks");

const allSource = sourceFiles(join(root, "src")).map((path) => ({
  path: relative(root, path),
  source: readFileSync(path, "utf8"),
}));
for (const file of allSource) {
  assert.ok(!file.source.includes("NEXT_PUBLIC_GOOGLE_CLIENT_ID"), `${file.path} must use the single server-side Google OAuth client configuration`);
  assert.ok(!file.source.includes("session.accessToken"), `${file.path} exposes a session access token`);
  assert.ok(!file.source.includes("session?.accessToken"), `${file.path} depends on a browser access token`);
  assert.ok(!file.source.includes("M23.498 6.186"), `${file.path} contains an undersized inline YouTube logo`);
  if (file.source.includes("channel-tokens?action=deleteToken") || file.source.includes("channel-tokens?action=bulkExpireTokens") || file.source.includes("channel-tokens?action=removeChannel") || file.source.includes("channel-tokens?action=permanentRemoveChannel")) {
    assert.ok(file.source.includes('method: "DELETE"'), `${file.path} must use DELETE for channel authorization mutations`);
  }
  for (const line of file.source.split("\n")) {
    if (/console\.(log|warn|error)/.test(line)) {
      assert.ok(!/(accessToken|refreshToken|tokenData)/.test(line), `${file.path} may log OAuth credentials`);
    }
  }
}

for (const debugPath of [
  "src/app/api/youtube/debug/route.ts",
  "src/app/api/debug-kv/route.ts",
]) {
  const debugRoute = read(debugPath);
  includesAll(debugRoute, ['{ error: "Not found" }', "status: 404"], debugPath);
  assert.ok(!debugRoute.includes("getServerSession"), `${debugPath} must not inspect sessions or tokens`);
  assert.ok(!debugRoute.includes("process.env"), `${debugPath} must not expose environment configuration`);
  assert.ok(!debugRoute.includes("bainsla_users"), `${debugPath} must not expose user records`);
}

const authorizationPage = read("src/app/authorize-channel/page.tsx");
includesAll(authorizationPage, [
  "accounts.google.com",
  "never asks for, receives, or stores your Google or YouTube password",
  "owner or an authorized manager",
  'href="/privacy-policy"',
  'href="/terms"',
  "security.google.com/settings/security/permissions",
], "Authorization disclosure page");

const privacy = read("src/app/privacy-policy/page.tsx");
includesAll(privacy, [
  "YouTube Data API",
  "Analytics API",
  "yt-analytics-monetary.readonly",
  "never asks for, receives, or stores your Google or YouTube password",
  "AES-256-GCM",
  "Google API Services User Data Policy",
  "Limited Use",
  "security.google.com/settings/security/permissions",
  "account/data-deletion request",
], "Privacy Policy");

const terms = read("src/app/terms/page.tsx");
includesAll(terms, [
  "local CMS password is separate",
  "does not receive or store your Google password",
  "YouTube Terms of Service",
  "Google API Services User Data Policy",
  "Limited Use",
  "explicit video update or delete actions",
  "Revoke Access",
], "Terms of Service");

const attribution = read("src/components/branding/YouTubeAttribution.tsx");
includesAll(attribution, [
  'href="https://www.youtube.com/"',
  'src="/branding/developed-with-youtube.png"',
  "h-7",
  'alt="Developed with YouTube"',
], "YouTube attribution");

const contact = read("src/app/contact/page.tsx");
includesAll(contact, [
  "Privacy / Account or Data Deletion",
  "Privacy / Account or YouTube Data Deletion Request",
  "mailto:shivlalbainslaofficial@gmail.com",
], "Deletion request path");

console.log("Compliance checks passed");
