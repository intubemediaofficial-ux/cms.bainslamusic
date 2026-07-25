import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/branding/PublicSiteChrome";
import { YouTubeAttribution } from "@/components/branding/YouTubeAttribution";

const externalLinkClass = "text-red-600 hover:underline break-words";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <PublicHeader />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between mb-10">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">Privacy Policy</h1>
              <p className="text-sm text-slate-500 mt-2">Effective and last updated: June 7, 2026</p>
            </div>
            <YouTubeAttribution />
          </div>

          <div className="space-y-9 text-slate-700 leading-7">
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">1. Scope and operator</h2>
              <p>
                This Privacy Policy explains how InTubeMedia processes information through the
                InTubeMedia channel management service at cms.intubemedia.com. It covers local CMS
                accounts, Google Sign-In for CMS authentication, and separately authorized YouTube
                channel access. Privacy questions, complaints, and deletion requests can be sent to{" "}
                <a className={externalLinkClass} href="mailto:shivlalbainslaofficial@gmail.com">
                  shivlalbainslaofficial@gmail.com
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">2. Information we process</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>CMS account information, such as name, email, phone number, role, channel assignments, approval status, and support messages.</li>
                <li>Local CMS account passwords in the CMS user data store are retained as one-way hashes. Separately configured administrative login secrets remain in server-side environment configuration. A CMS password is separate from a Google or YouTube password.</li>
                <li>Google Sign-In profile information when a user chooses Google Sign-In for CMS authentication.</li>
                <li>YouTube channel and video metadata, including channel ID, channel title, thumbnails, subscriber/view/video counts, video titles, descriptions, privacy status, and monetization-related metadata.</li>
                <li>YouTube Analytics metrics, including views, watch time, traffic and audience metrics, CPM, RPM, estimated revenue, and other monetary analytics available to the authorized channel.</li>
                <li>OAuth authorization records, including one-time authorization state, consent version and time, access token, refresh token, token expiry, granted scopes, and the verified Google channel ID.</li>
                <li>Operational records such as essential session cookies, request timestamps, sync status, audit events, exports, payment/reporting records, and security logs. OAuth token values and Google authorization codes are not intentionally written to application logs.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">3. Google and YouTube APIs and scopes</h2>
              <p className="mb-3">
                InTubeMedia uses Google-hosted OAuth 2.0, the YouTube Data API, and the YouTube
                Analytics API. A channel owner or authorized manager must review the disclosure for
                the exact assigned channel and approve these scopes on Google&apos;s consent page:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><code>youtube</code>: read channel/video data and perform video updates or deletes only after an authorized user explicitly requests that action in the CMS.</li>
                <li><code>yt-analytics.readonly</code>: read channel analytics for dashboards, statistics, and reports.</li>
                <li><code>yt-analytics-monetary.readonly</code>: read estimated revenue and monetary analytics for revenue dashboards, monthly reports, and authorized exports.</li>
              </ul>
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                <strong>InTubeMedia never asks for, receives, or stores your Google or YouTube password.</strong>{" "}
                Google sign-in and YouTube permission approval occur only on Google-controlled domains.
                Google returns authorization tokens to our server after approval; it does not provide us
                with your Google password.
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">4. How authorization works</h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>An authenticated CMS user generates a random, one-time link bound to an exact assigned channel. The link expires after 15 minutes.</li>
                <li>The channel owner or authorized manager reviews the requested data and purposes, confirms channel authority, and accepts this Policy and the Terms.</li>
                <li>The user continues to Google, where Google authenticates the user and displays the requested permissions.</li>
                <li>Google returns an authorization code. InTubeMedia exchanges it on the server; access and refresh tokens are not returned to browser JavaScript.</li>
                <li>InTubeMedia calls <code>channels.list(mine=true)</code> and stores authorization only if Google returns the exact channel ID assigned in the CMS. Rejected or mismatched authorization is revoked and not stored.</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">5. How we use data</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Authenticate and administer CMS accounts and authorized roles.</li>
                <li>Display channel dashboards, statistics, videos, health information, and analytics.</li>
                <li>Generate monthly analytics, revenue reports, payment calculations, and authorized exports.</li>
                <li>Refresh channel data and detect invalid, expired, or externally revoked authorization.</li>
                <li>Perform video metadata updates, privacy changes, or video deletion only when an authorized user deliberately initiates the specific action.</li>
                <li>Secure, troubleshoot, audit, and improve the service and respond to support or compliance requests.</li>
              </ul>
              <p className="mt-3">
                Google API data is used only to provide or improve user-facing features that are
                prominent in InTubeMedia. Our use and transfer of information received from Google APIs
                adheres to the{" "}
                <a className={externalLinkClass} href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
                  Google API Services User Data Policy
                </a>, including its Limited Use requirements.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">6. Storage and security</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>HTTPS protects information in transit.</li>
                <li>OAuth access and refresh tokens are encrypted at rest using AES-256-GCM authenticated server-side encryption before storage in Redis/server infrastructure.</li>
                <li>Local CMS account passwords in the CMS user data store are one-way hashed before storage, and administrative login secrets are restricted to server-side environment configuration.</li>
                <li>Tokens remain server-side and are available only to service components that need them to call Google APIs.</li>
                <li>Role and channel-assignment checks limit which CMS users can access channel data or request channel actions.</li>
              </ul>
              <p className="mt-3">
                No internet service is risk-free. We use reasonable administrative and technical
                safeguards, investigate suspected misuse, and restrict authorized access to people and
                processors who need it for the purposes described here.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">7. Sharing and disclosures</h2>
              <p>We do not sell YouTube API data, use it for targeted advertising, or disclose it for unrelated purposes. We may disclose limited information only to:</p>
              <ul className="list-disc pl-6 mt-3 space-y-2">
                <li>the account&apos;s authorized client, company, administrator, or agent according to configured roles and channel assignments;</li>
                <li>Google APIs, as necessary to perform the user-authorized request;</li>
                <li>hosting, database/Redis, email, security, and infrastructure providers acting for InTubeMedia under appropriate confidentiality and security obligations;</li>
                <li>authorities or other parties when required by law, necessary to protect rights and safety, or involved in a properly structured business transfer subject to applicable safeguards.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">8. Retention, refresh, and deletion</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>OAuth tokens are retained only while the channel remains authorized and connected. Access tokens are refreshed and authorization is revalidated through scheduled sync and API use.</li>
                <li>Current, backup, snapshot, video, statistics, dashboard, date-range, monthly analytics, and monthly revenue-export caches may be retained to provide consistent historical dashboards and exports while authorization remains valid. Stored API statistics are refreshed or revalidated at least every 30 days.</li>
                <li>When a user chooses <strong>Revoke Access</strong> or delinks/removes a channel in the CMS, InTubeMedia requests immediate revocation at Google and deletes the local token and authorized channel caches as part of that operation. The interface does not report success if this cleanup fails.</li>
                <li>If Google authorization is revoked externally, InTubeMedia detects invalid authorization during scheduled token refresh or API revalidation, then deletes the unusable token and related authorized data. This detection and cleanup is designed to occur within 30 calendar days.</li>
                <li>After a verified account/data-deletion request, we delete the account and related authorized Google/YouTube data within seven calendar days unless limited retention is legally required. Separate invoices, payment evidence, fraud/security records, or legal records may be retained only as required and are not used to recreate revoked YouTube API data.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">9. Your controls</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Revoke a channel in InTubeMedia through Channels → Revoke Access / delink / remove.</li>
                <li>Revoke InTubeMedia externally through{" "}
                  <a className={externalLinkClass} href="https://security.google.com/settings/security/permissions" target="_blank" rel="noopener noreferrer">
                    Google Account permissions
                  </a>.
                </li>
                <li>Request access, correction, account deletion, or deletion of authorized data by emailing{" "}
                  <a className={externalLinkClass} href="mailto:shivlalbainslaofficial@gmail.com">shivlalbainslaofficial@gmail.com</a>{" "}
                  or using the <Link className={externalLinkClass} href="/contact">Contact page</Link>. Include the CMS email and relevant channel ID so we can verify the request.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">10. Cookies</h2>
              <p>
                InTubeMedia uses essential authentication and session cookies to sign users in, protect
                requests, and maintain account security. We do not use YouTube API data for advertising
                profiles. Browser controls may block cookies, but essential CMS functions may then stop working.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">11. Google and YouTube terms</h2>
              <p>
                Use of connected YouTube features is also subject to the{" "}
                <a className={externalLinkClass} href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>{" "}
                and the{" "}
                <a className={externalLinkClass} href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">12. Changes and contact</h2>
              <p>
                We may update this Policy when our services or legal obligations change. We will post the
                revised effective date here. For privacy questions, complaints, or deletion requests, email{" "}
                <a className={externalLinkClass} href="mailto:shivlalbainslaofficial@gmail.com">shivlalbainslaofficial@gmail.com</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
