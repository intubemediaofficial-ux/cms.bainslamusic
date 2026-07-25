/**
 * Bainsla Music — Dynamic Content Loader
 * Loads content from admin panel API and updates the website in real-time.
 * Include this script in the static HTML after Next.js build.
 * <script src="/dynamic-loader.js"></script>
 */
(function () {
  const API_URL = '/api/data.php?section=public';

  async function loadContent() {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) return;
      const data = await res.json();
      if (data.settings) updateSettings(data.settings);
      if (data.releases) updateReleases(data.releases);
      if (data.artists) updateArtists(data.artists);
      if (data.videos) updateVideos(data.videos);
      if (data.catalogue) updateCatalogue(data.catalogue);
      if (data.licensing) updateLicensing(data.licensing);
    } catch (e) {
      // API not available (dev mode or no PHP), use static content
    }
  }

  function updateSettings(s) {
    // Update social links
    document.querySelectorAll('a[href*="youtube.com/@bainslaofficial"]').forEach(el => {
      if (s.youtube_url) el.href = s.youtube_url;
    });
    document.querySelectorAll('a[href*="instagram.com/bainslamusic"]').forEach(el => {
      if (s.instagram_url) el.href = s.instagram_url;
    });
    document.querySelectorAll('a[href*="facebook.com/bainslamusic"]').forEach(el => {
      if (s.facebook_url) el.href = s.facebook_url;
    });
    // Update WhatsApp links
    if (s.whatsapp) {
      document.querySelectorAll('a[href*="wa.me"]').forEach(el => {
        el.href = 'https://wa.me/' + s.whatsapp + '?text=Hi%2C%20I%20want%20to%20know%20about%20your%20services';
      });
    }
    // Update contact info text
    document.querySelectorAll('a[href^="tel:"]').forEach(el => {
      if (s.phone) { el.href = 'tel:' + s.phone.replace(/\s/g, ''); el.textContent = s.phone; }
    });
    document.querySelectorAll('a[href^="mailto:"]').forEach(el => {
      if (s.email) { el.href = 'mailto:' + s.email; el.textContent = s.email; }
    });
  }

  function updateReleases(releases) {
    const grid = document.querySelector('#releases .grid');
    if (!grid || releases.length === 0) return;
    grid.innerHTML = releases.map(r => `
      <a href="${r.url || '#'}" target="_blank" rel="noopener noreferrer" class="group">
        <div class="relative overflow-hidden rounded-lg aspect-square mb-2">
          <img src="${r.image || ''}" alt="${r.eng_title || ''}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <svg class="w-10 h-10 text-white fill-white" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
        <h3 class="text-sm font-bold text-amber-500 truncate">${r.hindi_title || ''}</h3>
        <p class="text-xs text-gray-400 truncate">${r.eng_title || ''}</p>
        <p class="text-[10px] text-gray-600">${r.label || 'Bainsla Music'}</p>
      </a>
    `).join('');
  }

  function updateArtists(artists) {
    const grid = document.querySelector('#artists .grid, #artists .flex');
    if (!grid || artists.length === 0) return;
    // Keep existing structure, just update images and names
  }

  function updateVideos(videos) {
    const grid = document.querySelector('#videos .grid');
    if (!grid || videos.length === 0) return;
    grid.innerHTML = videos.map(v => `
      <a href="https://www.youtube.com/watch?v=${v.youtube_id || ''}" target="_blank" rel="noopener noreferrer" class="group">
        <div class="relative overflow-hidden rounded-lg aspect-video mb-2">
          <img src="${v.thumbnail || `https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`}" alt="${v.eng_title || ''}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
          <div class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <svg class="w-12 h-12 text-white fill-white" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <div class="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-white">${v.duration || ''}</div>
          <div class="absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[10px] text-amber-500">${v.views || ''} views</div>
        </div>
        <h3 class="font-bold text-sm text-white group-hover:text-amber-500 transition-colors">${v.hindi_title || ''}</h3>
        <p class="text-xs text-gray-500 mt-0.5">${v.eng_title || ''}</p>
        <p class="text-[11px] text-gray-600 mt-0.5">Bainsla Music</p>
      </a>
    `).join('');
  }

  function updateCatalogue(catalogue) {
    const grid = document.querySelector('#catalogue .grid');
    if (!grid || catalogue.length === 0) return;
    grid.innerHTML = catalogue.map(c => `
      <div class="bg-[#111] border border-gray-800 rounded-xl p-5 hover:border-amber-500/30 transition-all group cursor-pointer">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <svg class="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
          <div>
            <h3 class="font-bold text-sm text-white group-hover:text-amber-500 transition-colors">${c.name || ''}</h3>
            <p class="text-[10px] text-gray-600">${c.hindi || ''}</p>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-amber-500 font-bold text-lg">${c.count || 0}</span>
          <span class="text-[10px] text-gray-500">Songs</span>
        </div>
      </div>
    `).join('');
  }

  function updateLicensing(licensing) {
    const grid = document.querySelector('#licensing .grid');
    if (!grid || licensing.length === 0) return;
    // Keep existing layout
  }

  // Load on page ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadContent);
  } else {
    loadContent();
  }
})();
