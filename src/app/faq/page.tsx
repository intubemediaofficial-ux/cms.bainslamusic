import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/branding/PublicSiteChrome";

const faqs = [
  {
    question: "What is InTubeMedia?",
    answer: "InTubeMedia is a YouTube Channel Management System (CMS) designed for content creators, music labels, and multi-channel networks (MCNs). It helps you track revenue, manage videos, monitor analytics, handle payments, and distribute music — all from one dashboard."
  },
  {
    question: "How do I create an account?",
    answer: "You can create an InTubeMedia account with your email and a separate CMS password, or use Google Sign-In hosted by Google. New accounts require admin approval. A local CMS password is not a Google or YouTube password, and CMS login does not itself authorize a YouTube channel."
  },
  {
    question: "Is InTubeMedia free to use?",
    answer: "InTubeMedia is available for content creators and music labels who are part of our network. Contact us to learn about partnership opportunities and pricing."
  },
  {
    question: "How does InTubeMedia access my YouTube data?",
    answer: "We use Google-hosted OAuth 2.0 and the YouTube Data API and YouTube Analytics API. The channel owner or authorized manager reviews the exact permissions, confirms channel authority, and then signs in only on accounts.google.com. InTubeMedia never asks for or receives a Google or YouTube password. Access can be revoked in the CMS or through Google account permissions."
  },
  {
    question: "What YouTube data does InTubeMedia access?",
    answer: "With your permission, we access: channel statistics (subscribers, views, video count), video metadata (titles, thumbnails, privacy status, monetization), analytics data (views, watch time, revenue, CPM, RPM), and monetary reports. We only access data you explicitly authorize."
  },
  {
    question: "Is my data safe with InTubeMedia?",
    answer: "We use HTTPS for data in transit, hash local CMS passwords, and encrypt OAuth access and refresh tokens at rest with authenticated server-side encryption. We do not sell YouTube user data or use it for advertising. Limited disclosures to authorized personnel, infrastructure providers, and Google APIs are described in our Privacy Policy."
  },
  {
    question: "How do I connect my YouTube channel?",
    answer: "After adding an assigned channel, open its authorization link. Review the data-use disclosure, confirm you own or manage the exact channel, accept the Privacy Policy and Terms, and continue to Google. Google hosts sign-in and consent. InTubeMedia stores authorization only after the returned channel ID exactly matches the assigned channel."
  },
  {
    question: "Why is my channel token showing as 'Expired' or 'Not Validated'?",
    answer: "Google authorization can expire or be revoked. Use 'Validate Token' for the affected channel, review the disclosure, and authorize again through Google. If Google reports an invalid grant, InTubeMedia deletes the unusable token and related authorized cache data before showing the channel as not validated."
  },
  {
    question: "How accurate is the revenue data?",
    answer: "Revenue data comes directly from the YouTube Analytics API, which is the same source as YouTube Studio. Data is synced regularly and reflects the most recent information available from YouTube. Note that YouTube revenue data may have a 2-3 day delay."
  },
  {
    question: "Can I manage multiple YouTube channels?",
    answer: "Yes! InTubeMedia is built for multi-channel management. You can connect and manage unlimited YouTube channels from a single account. Each channel's data is tracked independently with consolidated dashboards."
  },
  {
    question: "What is Music Distribution?",
    answer: "Our music distribution feature allows you to distribute your music to major streaming platforms like Spotify, Apple Music, Amazon Music, JioSaavn, and more. Upload your tracks with artwork, fill in metadata, and we handle the distribution."
  },
  {
    question: "How do payments work?",
    answer: "InTubeMedia tracks your YouTube revenue and provides payment management features. You can view per-channel payment breakdowns, request withdrawals, and track payment history. TDS calculations are supported for Indian creators."
  },
  {
    question: "What are copyright claims and how do I manage them?",
    answer: "Copyright claims are made when Content ID detects your content in other videos or vice versa. InTubeMedia helps you monitor these claims, submit release requests, and track their resolution status."
  },
  {
    question: "How do I revoke InTubeMedia's access to my YouTube data?",
    answer: "You can revoke access anytime by visiting myaccount.google.com/permissions, finding InTubeMedia in the list of connected apps, and clicking 'Remove Access'. This will immediately stop our access to your YouTube data."
  },
  {
    question: "I'm having trouble logging in. What should I do?",
    answer: "Try these steps: 1) Clear your browser cache and cookies, 2) Try an incognito/private window, 3) Make sure you are using the correct InTubeMedia email and CMS password, 4) Use the password-reset option if needed. Never enter your Google or YouTube password on an InTubeMedia page. If problems persist, contact shivlalbainslaofficial@gmail.com."
  },
  {
    question: "How do I contact support?",
    answer: "You can reach us via email at shivlalbainslaofficial@gmail.com, or use the Contact Us page on our website. We typically respond within 24-48 hours during business hours (Monday-Saturday, 10 AM - 7 PM IST)."
  }
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <PublicHeader active="faq" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Page Title */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">Frequently Asked Questions</h2>
          <p className="text-lg text-slate-600">
            Find answers to common questions about InTubeMedia and our services.
          </p>
        </div>

        {/* FAQ List */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <details
              key={index}
              className="group bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <summary className="flex items-center justify-between cursor-pointer px-6 py-4 hover:bg-slate-50 transition-colors">
                <span className="text-base font-medium text-slate-900 pr-4">{faq.question}</span>
                <svg
                  className="w-5 h-5 text-slate-400 flex-shrink-0 transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </summary>
              <div className="px-6 pb-4">
                <p className="text-sm text-slate-600 leading-relaxed">{faq.answer}</p>
              </div>
            </details>
          ))}
        </div>

        {/* Still have questions */}
        <div className="mt-12 bg-red-50 rounded-2xl border border-red-100 p-8 text-center">
          <h3 className="text-xl font-bold text-slate-900 mb-2">Still have questions?</h3>
          <p className="text-slate-600 mb-4">
            Can&apos;t find the answer you&apos;re looking for? Our support team is happy to help.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
