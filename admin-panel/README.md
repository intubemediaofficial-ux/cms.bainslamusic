# Bainsla Music Admin Panel

Admin dashboard for managing the Bainsla Music Private Limited website.

## Access

- **URL:** `https://bainslamusic.com/admin/`
- **Username:** `admin`
- **Password:** `Bainsla@2024`

## Features

- **Dashboard** — Overview with stats, recent releases, artist management, video performance, inquiries
- **Home Banner** — Manage homepage hero banners with live preview
- **Artists** — Add/edit/delete artists with profiles, social links, top songs
- **Releases** — Upload new releases with cover images, platform links, ISRC codes
- **Videos** — Manage YouTube videos with thumbnails, categories, scheduling
- **Music Catalogue** — Category-wise song management, bulk upload, playlists
- **Licensing** — Manage licensing inquiries, copyright claims, permissions
- **Distribution** — Monitor platform delivery status, release queue, checklists
- **Contact Inquiries** — View and reply to contact form submissions
- **Analytics** — YouTube views, subscribers, watch time, top songs/videos/locations
- **Settings** — Company profile, contact details, logo, social media, SEO, security

## Deployment

Upload the `admin-panel` contents to Hostinger `public_html`:

```
public_html/
├── admin/
│   ├── index.html
│   ├── dashboard.css
│   └── dashboard.js
├── api/
│   ├── config.php
│   ├── data.php
│   ├── frontend-data.php
│   ├── login.php
│   └── logout.php
├── data/
│   ├── .htaccess
│   └── content.json
└── dynamic-loader.js
```

Set `data/` folder permissions to 755.
