# Bainsla Music - YouTube CMS

Modern YouTube Channel Management System built with Next.js, TypeScript, and Tailwind CSS.

## Features

- **Dashboard** — Real-time channel stats (views, subscribers, videos, watch time, revenue, RPM) with trend charts
- **Video Management** — Search, filter, and track video performance
- **Channel Management** — Multi-channel support with stats overview
- **Analytics** — Traffic sources, demographics, geographic data, device breakdown
- **Revenue Tracking** — Revenue breakdown, per-video earnings, RPM tracking
- **User Management** — Team roles (Super Admin, Manager, Editor, Viewer)
- **Settings** — General, API keys, notifications, security, data management
- **Google OAuth** — Sign in with Google to connect YouTube channels
- **Real YouTube Data** — Pulls live data via YouTube Data API v3 and YouTube Analytics API

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Charts:** Recharts
- **Auth:** NextAuth.js (Google OAuth 2.0)
- **APIs:** YouTube Data API v3, YouTube Analytics API
- **Icons:** Lucide React

## Getting Started

### Prerequisites

- Node.js 20+
- Google Cloud Project with YouTube APIs enabled

### Installation

```bash
git clone https://github.com/vijendra95/bainsla-music-cms.git
cd bainsla-music-cms
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_random_secret_key
```

### Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable these APIs:
   - YouTube Data API v3
   - YouTube Analytics API
   - YouTube Reporting API
3. Create OAuth 2.0 credentials (Web application)
4. Add redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Add YouTube scopes: `youtube.readonly`, `yt-analytics.readonly`, `yt-analytics-monetary.readonly`

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect repo on [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Update Google OAuth redirect URI to your Vercel domain

## License

MIT
# Migrated to DigitalOcean Redis
