import { PublicFooter, PublicHeader } from "@/components/branding/PublicSiteChrome";
import { YouTubeAttribution } from "@/components/branding/YouTubeAttribution";

const externalLinkClass = "text-red-600 hover:underline break-words";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <PublicHeader />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between mb-10">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">Terms of Service</h1>
              <p className="text-sm text-slate-500 mt-2">Effective and last updated: June 7, 2026</p>
            </div>
            <YouTubeAttribution />
          </div>

          <div className="space-y-9 text-slate-700 leading-7">
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">1. Acceptance and service</h2>
              <p>
                These Terms govern use of InTubeMedia at cms.intubemedia.com. InTubeMedia provides
                role-based channel management, YouTube video operations, analytics, revenue reporting,
                exports, payments, and related CMS tools for authorized creators, companies, and
                administrators. By creating an account, using the service, or authorizing a channel, you
                agree to these Terms and the <a className={externalLinkClass} href="/privacy-policy">Privacy Policy</a>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">2. CMS accounts and Google credentials</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>You may authenticate your CMS account using a local InTubeMedia email/password or Google Sign-In.</li>
                <li>A local CMS password is separate from your Google and YouTube credentials. You must never enter a Google or YouTube password into an InTubeMedia email/password field.</li>
                <li>Google Sign-In and YouTube channel authorization are hosted by Google. InTubeMedia does not receive or store your Google password.</li>
                <li>You are responsible for accurate account information, protecting your CMS credentials, and promptly reporting unauthorized access.</li>
                <li>Accounts and channel assignments may require administrator approval and may be restricted according to the user&apos;s authorized role.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">3. YouTube authorization</h2>
              <p className="mb-3">
                InTubeMedia uses Google-hosted OAuth 2.0, the YouTube Data API, and the YouTube Analytics
                API. Before Google authorization, the channel owner or authorized manager must review the
                requested data and purposes, accept the policies, and confirm authority over the exact channel.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><code>youtube</code> supports authorized channel/video reads and explicit video update or delete actions.</li>
                <li><code>yt-analytics.readonly</code> supports analytics dashboards and reports.</li>
                <li><code>yt-analytics-monetary.readonly</code> supports revenue and monetary reporting.</li>
                <li>Authorization is channel-specific. InTubeMedia verifies the Google-returned channel ID against the assigned CMS channel and rejects mismatches.</li>
                <li>You represent that you own the channel or have valid authority from the owner to grant the requested access.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">4. Video and write actions</h2>
              <p>
                InTubeMedia does not silently edit or delete YouTube videos. An authorized user must
                deliberately initiate the specific update, privacy change, or delete action in the CMS.
                The service sends the request to YouTube first and updates local state only after YouTube
                confirms success or confirms that the item was already removed. You are responsible for
                reviewing the selected channel, video, and requested action before confirming it.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">5. Revocation, channel removal, and deletion</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>You may revoke channel access through InTubeMedia&apos;s Revoke Access, delink, or remove controls.</li>
                <li>An in-app revocation requests revocation from Google and deletes the local token and authorized channel caches. If cleanup fails, the service will not intentionally present the operation as successful.</li>
                <li>You may also revoke access through <a className={externalLinkClass} href="https://security.google.com/settings/security/permissions" target="_blank" rel="noopener noreferrer">Google Account permissions</a>. InTubeMedia detects invalid authorization during scheduled refresh/API revalidation and deletes related authorized data.</li>
                <li>Removing a channel from the CMS does not delete the YouTube channel itself. It removes the CMS assignment, authorization, and stored authorized data.</li>
                <li>Account or data-deletion requests can be sent to <a className={externalLinkClass} href="mailto:shivlalbainslaofficial@gmail.com">shivlalbainslaofficial@gmail.com</a>. We may require identity and channel verification before deletion.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">6. Analytics, revenue, and exports</h2>
              <p>
                Analytics and estimated revenue are obtained from YouTube APIs and may be delayed,
                corrected, withheld, rounded, or unavailable due to YouTube processing, channel
                permissions, API quota, invalid authorization, currency conversion, or other factors.
                Current-month figures may be incomplete. InTubeMedia may keep monthly caches while
                authorization remains valid so dashboards and authorized exports remain consistent, but
                revalidates or refreshes stored API statistics at least every 30 days. Reports are
                informational and do not replace YouTube&apos;s final accounting, contracts, tax records, or
                professional financial advice.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">7. Google API Limited Use</h2>
              <p>
                InTubeMedia&apos;s use and transfer of information received from Google APIs adheres to the{" "}
                <a className={externalLinkClass} href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
                  Google API Services User Data Policy
                </a>, including its Limited Use requirements. YouTube API data is not sold, used for
                targeted advertising, or used for unrelated credit, employment, or eligibility decisions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">8. Acceptable use</h2>
              <p>You must not:</p>
              <ul className="list-disc pl-6 mt-3 space-y-2">
                <li>authorize a channel you do not own or manage, impersonate another person, or provide misleading authorization information;</li>
                <li>attempt to access another client&apos;s channels, tokens, analytics, revenue, or account;</li>
                <li>circumvent Google consent, API quotas, role controls, security checks, or channel-ID verification;</li>
                <li>use the service to violate copyright, privacy, law, the YouTube Terms, or Google/YouTube API policies;</li>
                <li>extract, disclose, sell, or misuse Google or YouTube user data;</li>
                <li>interfere with the service, upload malicious code, or attempt unauthorized access.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">9. Third-party terms</h2>
              <p>
                Connected YouTube functionality is also governed by the{" "}
                <a className={externalLinkClass} href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>, the{" "}
                <a className={externalLinkClass} href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>, and applicable Google/YouTube API terms and policies. Google and YouTube may change, limit, or discontinue APIs independently of InTubeMedia.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">10. Suspension and termination</h2>
              <p>
                We may suspend or terminate access when reasonably necessary for security, inactivity,
                nonpayment, legal compliance, API-policy compliance, loss of authorization, false channel
                authority, or a material breach of these Terms. Where appropriate, we will provide notice
                and an opportunity to correct the issue. Users may stop using the service and request
                account/data deletion at any time.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">11. Availability, warranties, and liability</h2>
              <p>
                The service is provided on an &quot;as available&quot; basis. To the extent permitted by law,
                InTubeMedia does not guarantee uninterrupted API availability, exact real-time analytics,
                final revenue amounts, or that every third-party API operation will succeed. Nothing in
                these Terms excludes liability that cannot legally be excluded. To the extent permitted by
                law, InTubeMedia is not liable for indirect or consequential loss caused by third-party API
                outages, user error, unauthorized user actions, or data supplied by Google/YouTube.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">12. Changes, governing law, and contact</h2>
              <p>
                We may update these Terms when the service, API requirements, or law changes. Updated Terms
                will be posted with a revised effective date. These Terms are governed by applicable laws of
                India, and disputes will be subject to the competent courts in India, except where mandatory
                consumer law provides otherwise. Questions, complaints, or deletion requests should be sent to{" "}
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
