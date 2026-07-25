import { PublicFooter, PublicHeader } from "@/components/branding/PublicSiteChrome";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <PublicHeader active="about" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Page Title */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">About InTubeMedia</h2>
          <p className="text-lg text-slate-600">
            Empowering content creators and music labels with powerful YouTube channel management tools.
          </p>
        </div>

        {/* Who We Are */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Who We Are</h3>
            <p className="text-slate-600 leading-relaxed mb-4">
              InTubeMedia is a technology company specializing in YouTube channel management solutions.
              We provide a comprehensive Content Management System (CMS) designed specifically for
              content creators, music labels, and multi-channel networks (MCNs) who need powerful
              tools to manage their YouTube presence efficiently.
            </p>
            <p className="text-slate-600 leading-relaxed">
              Our platform helps creators track revenue, manage videos, monitor analytics,
              handle payments, and distribute music — all from a single, intuitive dashboard.
              Whether you manage one channel or hundreds, InTubeMedia scales with your needs.
            </p>
          </div>
        </section>

        {/* Our Mission */}
        <section className="mb-16">
          <div className="bg-red-50 rounded-2xl border border-red-100 p-8">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Our Mission</h3>
            <p className="text-slate-700 leading-relaxed text-lg">
              To simplify YouTube channel management for creators of all sizes by providing
              transparent, real-time analytics, revenue tracking, and comprehensive tools that
              help them focus on what matters most — creating great content.
            </p>
          </div>
        </section>

        {/* What We Offer */}
        <section className="mb-16">
          <h3 className="text-2xl font-bold text-slate-900 mb-8 text-center">What We Offer</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Revenue Analytics</h4>
              <p className="text-sm text-slate-600">Real-time revenue tracking with daily breakdowns, monthly reports, per-channel and per-video analytics, and INR conversion for Indian creators.</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Channel Management</h4>
              <p className="text-sm text-slate-600">Manage multiple YouTube channels from one dashboard. Track subscribers, views, watch time, CPM, RPM, and more across all your channels.</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Music Distribution</h4>
              <p className="text-sm text-slate-600">Distribute your music to major streaming platforms like Spotify, Apple Music, Amazon Music, and more — all from within the InTubeMedia platform.</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Copyright Protection</h4>
              <p className="text-sm text-slate-600">Monitor copyright claims, submit release requests, and manage Content ID claims. Protect your content with our automated claim detection system.</p>
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="mb-16">
          <h3 className="text-2xl font-bold text-slate-900 mb-8 text-center">Why Choose InTubeMedia</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Real-Time Data</h4>
              <p className="text-sm text-slate-600">Get instant access to your YouTube analytics. No delays, no outdated numbers — just real-time insights.</p>
            </div>
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Secure & Private</h4>
              <p className="text-sm text-slate-600">OAuth tokens are encrypted at rest, and authorized YouTube data is limited to stated service purposes. Revoke access in the CMS or through Google permissions.</p>
            </div>
            <div className="text-center p-6">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-2">Multi-Channel Support</h4>
              <p className="text-sm text-slate-600">Built for MCNs and creators with multiple channels. Manage everything from a single account.</p>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
