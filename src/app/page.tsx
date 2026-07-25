import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/branding/PublicSiteChrome";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <PublicHeader active="home" />

      {/* Hero Section */}
      <main>
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight">
              Manage Your YouTube Channels
              <span className="text-red-600"> All in One Place</span>
            </h2>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed">
              InTubeMedia is a comprehensive YouTube channel management system (CMS) designed for
              content creators and music labels. Track revenue, manage videos, monitor
              analytics, and handle payments — everything you need to grow your YouTube business.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link
                href="/login"
                className="px-8 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors text-lg"
              >
                Get Started
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <h3 className="text-2xl font-bold text-slate-900 text-center mb-12">
            What InTubeMedia Does For You
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Revenue Tracking</h4>
              <p className="text-sm text-slate-600">
                Monitor your YouTube revenue in real-time with daily breakdowns, monthly reports,
                and INR conversion. See per-channel and per-video revenue analytics.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Channel Analytics</h4>
              <p className="text-sm text-slate-600">
                View subscribers, views, watch time, CPM, and RPM across all your channels.
                Compare performance with customizable date ranges and monthly filters.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.125 8.25C3.504 8.25 3 8.754 3 9.375v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M6 7.125v1.5" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Video Management</h4>
              <p className="text-sm text-slate-600">
                Manage all your videos across channels. Filter by privacy status, monetization,
                and copyright claims. Detect and manage duplicate videos easily.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Payment Tracking</h4>
              <p className="text-sm text-slate-600">
                Track payment history, manage withdrawal requests, and view per-channel payment
                breakdowns. Supports TDS calculations for Indian creators.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Music Distribution</h4>
              <p className="text-sm text-slate-600">
                Distribute your music to major platforms. Upload tracks with artwork, manage
                releases, and track distribution status all from one dashboard.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Copyright Claims</h4>
              <p className="text-sm text-slate-600">
                Monitor and manage copyright claims across your channels. Submit claim release
                requests and track their status with admin review workflow.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="bg-white border-t border-slate-200 py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h3 className="text-2xl font-bold text-slate-900 text-center mb-12">
              How It Works
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-red-600">1</span>
                </div>
                <h4 className="text-lg font-semibold text-slate-900 mb-2">Create Account</h4>
                <p className="text-sm text-slate-600">
                  Sign up with your email or Google account. Your account will be reviewed and
                  approved by our admin team.
                </p>
              </div>
              <div>
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-red-600">2</span>
                </div>
                <h4 className="text-lg font-semibold text-slate-900 mb-2">Connect YouTube Channels</h4>
                <p className="text-sm text-slate-600">
                  Link your YouTube channels by authorizing access through Google OAuth. We use
                  YouTube Data API and YouTube Analytics API to fetch your channel data securely.
                </p>
              </div>
              <div>
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-red-600">3</span>
                </div>
                <h4 className="text-lg font-semibold text-slate-900 mb-2">Track &amp; Manage</h4>
                <p className="text-sm text-slate-600">
                  View your revenue, analytics, videos, and payments in a unified dashboard.
                  Export reports, manage claims, and grow your channel.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Data Usage Section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Your Data, Your Control</h3>
            <p className="text-slate-600 mb-4">
              InTubeMedia uses the YouTube Data API and YouTube Analytics API to provide
              channel management features. We only access data that you explicitly authorize:
            </p>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Channel statistics (subscribers, views, video count) for your dashboard overview</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Revenue and analytics data for revenue tracking and reporting</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Video metadata for video management and duplicate detection</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>You can revoke access at any time through your Google account settings</span>
              </li>
            </ul>
            <p className="text-sm text-slate-500 mt-4">
              Read our full{" "}
              <Link href="/privacy-policy" className="text-red-600 hover:underline">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/terms" className="text-red-600 hover:underline">
                Terms &amp; Conditions
              </Link>{" "}
              for details on how we handle your data.
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
