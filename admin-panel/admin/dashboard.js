/* ═══════ Bainsla Music Admin Dashboard — Full JS ═══════ */
const API = '/api/data.php';
const LOGIN_API = '/api/login.php';
const LOGOUT_API = '/api/logout.php';
let DATA = {};

/* ─── Toast ─── */
function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* ─── API helpers ─── */
async function api(method, section, body, id) {
  let url = API + '?section=' + section;
  if (id) url += '&id=' + id;
  const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}

async function loadData() {
  try {
    const res = await fetch(API + '?section=public');
    DATA = await res.json();
    updateBadges();
  } catch (e) {
    console.error('Load failed', e);
    DATA = { settings: {}, banners: [], releases: [], artists: [], videos: [], catalogue: [], licensing: [], inquiries: [], distribution: [], directors: [], team: [] };
  }
}

function updateBadges() {
  const badge = document.getElementById('inquiryBadge');
  const count = (DATA.inquiries || []).length;
  if (badge) badge.textContent = count > 0 ? count : '';
}

/* ─── Login ─── */
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = document.getElementById('loginUser').value;
  const pass = document.getElementById('loginPass').value;
  try {
    const res = await fetch(LOGIN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: user, password: pass })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('loginPage').style.display = 'none';
      document.getElementById('dashboard').style.display = 'flex';
      await loadData();
      showSection('overview');
    } else {
      document.getElementById('loginError').textContent = 'Invalid credentials';
    }
  } catch (err) {
    document.getElementById('loginError').textContent = 'Connection error';
  }
});

/* ─── Logout & Dropdown ─── */
document.getElementById('logoutBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  await fetch(LOGOUT_API, { credentials: 'include' });
  location.reload();
});
document.getElementById('adminDropdown').addEventListener('click', () => {
  const m = document.getElementById('dropdownMenu');
  m.style.display = m.style.display === 'none' ? 'block' : 'none';
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.admin-profile') && !e.target.closest('.dropdown-menu')) {
    document.getElementById('dropdownMenu').style.display = 'none';
  }
});

/* ─── Hamburger ─── */
document.getElementById('hamburgerBtn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

/* ─── Navigation ─── */
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    showSection(item.dataset.section);
    document.getElementById('sidebar').classList.remove('open');
  });
});

const SECTION_META = {
  overview: { title: 'Dashboard', subtitle: "Welcome back, Admin! Here's what's happening with Bainsla Music." },
  banners: { title: 'Home Banner', subtitle: 'Manage homepage hero banners for the website.' },
  artists: { title: 'Artists', subtitle: 'Manage and explore all artists associated with Bainsla Music Private Limited.' },
  releases: { title: 'RELEASES', subtitle: 'Manage and upload your music releases.' },
  videos: { title: 'VIDEOS', subtitle: 'Upload, manage and publish devotional music videos.' },
  catalogue: { title: '🎵 Music Catalogue', subtitle: 'Manage your complete music catalogue.' },
  licensing: { title: 'LICENSING MANAGEMENT', subtitle: 'Manage licensing inquiries, copyright requests, and content usage permissions.' },
  distribution: { title: 'Distribution Overview', subtitle: 'Manage and monitor your music distribution across all platforms.' },
  inquiries: { title: 'Contact Inquiries', subtitle: 'View and manage contact form submissions.' },
  analytics: { title: 'Analytics Overview', subtitle: 'Track performance, audience insights and content growth across all platforms.' },
  settings: { title: '⚙️ Settings', subtitle: 'Manage company information, contact details, and social links.' },
  directors: { title: 'Directors & Team', subtitle: 'Manage company directors, leadership team and their profiles.' }
};

function showSection(s) {
  const meta = SECTION_META[s] || { title: s, subtitle: '' };
  document.getElementById('pageTitle').textContent = meta.title;
  document.getElementById('pageSubtitle').textContent = meta.subtitle;
  const area = document.getElementById('contentArea');
  switch (s) {
    case 'overview': renderOverview(area); break;
    case 'banners': renderBanners(area); break;
    case 'artists': renderArtists(area); break;
    case 'releases': renderReleases(area); break;
    case 'videos': renderVideos(area); break;
    case 'catalogue': renderCatalogue(area); break;
    case 'licensing': renderLicensing(area); break;
    case 'distribution': renderDistribution(area); break;
    case 'inquiries': renderInquiries(area); break;
    case 'analytics': renderAnalytics(area); break;
    case 'settings': renderSettings(area); break;
    case 'directors': renderDirectors(area); break;
  }
  initUploadZones(area);
}

/* ═══════ HELPERS ═══════ */
async function uploadImage(file, folder) {
  const fd = new FormData();
  fd.append('image', file);
  fd.append('folder', folder);
  const res = await fetch('/api/upload.php', { method: 'POST', credentials: 'include', body: fd });
  return res.json();
}

function imageUploadField(label, name, value, folder) {
  const uid = Math.random().toString(36).slice(2,8);
  const previewId = 'preview_' + uid;
  const inputId = 'file_' + uid;
  const dropId = 'drop_' + uid;
  const statusId = 'status_' + uid;
  return `<div class="form-group"><label>${label}</label>
    <input type="file" id="${inputId}" accept="image/*" style="display:none" data-upload-folder="${folder}" data-upload-name="${name}">
    <input type="hidden" name="${name}" value="${value || ''}">
    <div id="${dropId}" class="upload-drop-zone" data-file-input="${inputId}" data-preview="${previewId}" data-status="${statusId}" data-folder="${folder}" data-hidden-name="${name}" style="border:2px dashed var(--border2);border-radius:8px;padding:20px;text-align:center;cursor:pointer;transition:all .2s;background:rgba(245,158,11,.03);min-height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center">
      <div id="${previewId}">${value ? `<img src="${value}" style="max-height:100px;border-radius:6px;margin-bottom:8px">` : '<div style="font-size:36px;margin-bottom:8px">📷</div>'}</div>
      <div style="font-size:13px;font-weight:600;color:#f59e0b">Click to upload or drag & drop</div>
      <div style="font-size:11px;color:#666;margin-top:4px">JPG, PNG or WEBP. Max 5MB.</div>
      <div id="${statusId}" style="font-size:11px;margin-top:6px;color:#999"></div>
    </div>
  </div>`;
}

function initUploadZones(container) {
  (container || document).querySelectorAll('.upload-drop-zone').forEach(function(drop) {
    if (drop._uploadInit) return;
    drop._uploadInit = true;
    var inputId = drop.dataset.fileInput;
    var previewId = drop.dataset.preview;
    var statusId = drop.dataset.status;
    var folder = drop.dataset.folder;
    var hiddenName = drop.dataset.hiddenName;
    var inp = document.getElementById(inputId);
    var prev = document.getElementById(previewId);
    var stat = document.getElementById(statusId);
    var hidden = drop.parentElement.querySelector('input[name="' + hiddenName + '"]');
    if (!inp || !prev || !stat || !hidden) return;
    async function handleFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      if (file.size > 5*1024*1024) { stat.textContent = 'File too large (max 5MB)'; stat.style.color = '#ef4444'; return; }
      var reader = new FileReader();
      reader.onload = function(e) { prev.innerHTML = '<img src="' + e.target.result + '" style="max-height:100px;border-radius:6px;margin-bottom:8px">'; };
      reader.readAsDataURL(file);
      stat.textContent = 'Uploading...'; stat.style.color = '#f59e0b';
      try {
        var r = await uploadImage(file, folder);
        if (r.url) { hidden.value = r.url; stat.textContent = 'Uploaded!'; stat.style.color = '#22c55e'; drop.style.borderColor = '#22c55e'; }
        else { stat.textContent = 'Error: ' + (r.error || 'Upload failed'); stat.style.color = '#ef4444'; }
      } catch(e) { stat.textContent = 'Upload failed'; stat.style.color = '#ef4444'; }
    }
    drop.addEventListener('click', function() { inp.click(); });
    inp.addEventListener('change', function() { if (this.files[0]) handleFile(this.files[0]); });
    drop.addEventListener('dragover', function(e) { e.preventDefault(); e.stopPropagation(); this.style.borderColor = '#f59e0b'; this.style.background = 'rgba(245,158,11,.08)'; });
    drop.addEventListener('dragleave', function(e) { e.preventDefault(); e.stopPropagation(); this.style.borderColor = 'var(--border2)'; this.style.background = 'rgba(245,158,11,.03)'; });
    drop.addEventListener('drop', function(e) { e.preventDefault(); e.stopPropagation(); this.style.borderColor = 'var(--border2)'; this.style.background = 'rgba(245,158,11,.03)'; if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
  });
}

function field(label, name, value, type = 'text', required = false) {
  const req = required ? ' <span class="required">*</span>' : '';
  return `<div class="form-group"><label>${label}${req}</label><input type="${type}" name="${name}" value="${value || ''}" placeholder="Enter ${label.toLowerCase()}"></div>`;
}
function textareaField(label, name, value, placeholder) {
  return `<div class="form-group"><label>${label}</label><textarea name="${name}" placeholder="${placeholder || 'Enter ' + label.toLowerCase()}">${value || ''}</textarea></div>`;
}
function selectField(label, name, options, selected) {
  return `<div class="form-group"><label>${label}</label><select name="${name}">${options.map(o => `<option value="${o.value || o}" ${(o.value || o) === selected ? 'selected' : ''}>${o.label || o}</option>`).join('')}</select></div>`;
}
function formActions() {
  return `<div class="form-actions"><button type="button" class="btn btn-secondary cancel-btn">Cancel</button><button type="submit" class="btn btn-primary">Save</button></div>`;
}
function platformIcons() {
  return `<div class="platform-icons">
    <span class="platform-icon pi-yt" title="YouTube">▶</span>
    <span class="platform-icon pi-spotify" title="Spotify">♪</span>
    <span class="platform-icon pi-jio" title="JioSaavn">J</span>
    <span class="platform-icon pi-apple" title="Apple Music">♫</span>
    <span class="platform-icon pi-wynk" title="Wynk">W</span>
    <span class="platform-icon pi-more">+2</span>
  </div>`;
}
function randomChartBars(count, maxH) {
  let bars = '';
  for (let i = 0; i < count; i++) {
    const h = Math.floor(Math.random() * maxH) + 20;
    bars += `<div class="chart-bar" style="height:${h}px"></div>`;
  }
  return bars;
}

/* ═══════ MODAL ═══════ */
function showModal(title, formHtml, onSubmit) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<h3>${title}</h3>${formHtml}`;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  initUploadZones(modal);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  modal.querySelector('.cancel-btn')?.addEventListener('click', () => overlay.remove());
  modal.querySelector('form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = Object.fromEntries(fd.entries());
    if (obj.count) obj.count = parseInt(obj.count) || 0;
    await onSubmit(obj);
    overlay.remove();
  });
}

/* ═══════════════════════════════════════════════
   1. DASHBOARD OVERVIEW (Reference Photo 9)
   ═══════════════════════════════════════════════ */
function renderOverview(area) {
  const s = DATA.settings || {};
  const releases = DATA.releases || [];
  const artists = DATA.artists || [];
  const videos = DATA.videos || [];
  const inquiries = DATA.inquiries || [];
  const totalSongs = (DATA.catalogue || []).reduce((a, c) => a + (c.count || 0), 0);

  area.innerHTML = `
    <!-- Stats Cards -->
    <div class="stats-row cols-4">
      <div class="stat-card">
        <div class="stat-icon">🎵</div>
        <div class="stat-label">Total Songs</div>
        <div class="stat-number">${s.stats_songs || totalSongs}</div>
        <div class="stat-change">+18 this month ↑</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-label">Total Artists</div>
        <div class="stat-number">${s.stats_artists || artists.length}</div>
        <div class="stat-change">+5 this month ↑</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">▶</div>
        <div class="stat-label">YouTube Videos</div>
        <div class="stat-number">${s.stats_videos || videos.length}</div>
        <div class="stat-change">+14 this month ↑</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✉</div>
        <div class="stat-label">Contact Leads</div>
        <div class="stat-number">${inquiries.length || 89}</div>
        <div class="stat-change">+21 this month ↑</div>
      </div>
    </div>

    <!-- Recent Releases + Upload Form -->
    <div class="grid-2">
      <!-- Recent Releases Table -->
      <div class="panel">
        <div class="panel-header">
          <h2>🎵 Recent Releases</h2>
          <button class="btn btn-outline btn-sm" onclick="document.querySelector('[data-section=releases]').click()">View All</button>
        </div>
        <div class="panel-body no-pad">
          <table class="data-table">
            <thead><tr><th>#</th><th>Title</th><th>Artist</th><th>Release Date</th><th>Status</th><th>Platform</th></tr></thead>
            <tbody>
              ${releases.slice(0, 5).map((r, i) => `<tr>
                <td>${i + 1}</td>
                <td class="cover-cell">${r.image ? `<img src="${r.image}" alt="">` : ''}<div><div class="title-col">${r.hindi_title || r.eng_title || ''}</div><div class="subtitle-col">${r.eng_title || ''}</div></div></td>
                <td>${r.artist || 'Bainsla Music'}</td>
                <td>${r.release_date || '2024'}</td>
                <td><span class="badge badge-green">Published</span></td>
                <td>${platformIcons()}</td>
              </tr>`).join('')}
            </tbody>
          </table>
          <div class="pagination">
            <span>Showing 1 to ${Math.min(5, releases.length)} of ${releases.length} releases</span>
            <button class="page-btn active">1</button>
            <button class="page-btn">2</button>
            <button class="page-btn">3</button>
          </div>
        </div>
      </div>

      <!-- Upload New Release -->
      <div class="panel">
        <div class="panel-header">
          <h2>⬆ Upload New Release</h2>
        </div>
        <div class="panel-body">
          <form id="quickReleaseForm">
            ${field('Release Title', 'hindi_title', '', 'text', true)}
            ${selectField('Artist', 'artist', ['Select Artist', ...artists.map(a => a.name)], '')}
            <div class="form-row">
              ${selectField('Release Type', 'type', ['Single', 'Album', 'EP'], '')}
              <div class="form-group"><label>Audio File</label><div style="display:flex;gap:8px"><button type="button" class="btn btn-outline btn-sm">Choose File</button><span class="text-xs text-muted">No file chosen</span></div></div>
            </div>
            <div class="form-group"><label>Cover Image</label><div style="display:flex;gap:8px"><button type="button" class="btn btn-outline btn-sm">Choose File</button><span class="text-xs text-muted">No file chosen</span></div></div>
            <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center">⬆ Upload Release</button>
          </form>
        </div>
      </div>
    </div>

    <!-- Artist Management + Video Performance + Recent Inquiries -->
    <div class="grid-3-col" style="margin-top:20px">
      <!-- Artist Management -->
      <div class="panel">
        <div class="panel-header">
          <h2>👥 Artist Management</h2>
          <button class="btn btn-outline btn-sm" onclick="document.querySelector('[data-section=artists]').click()">View All Artists</button>
        </div>
        <div class="panel-body">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;text-align:center">
            ${artists.slice(0, 4).map(a => `<div>
              <div style="width:70px;height:70px;border-radius:50%;background:var(--card2);margin:0 auto 6px;overflow:hidden;border:2px solid var(--border)">
                ${a.image ? `<img src="${a.image}" style="width:100%;height:100%;object-fit:cover">` : '<div style="font-size:24px;line-height:70px">👤</div>'}
              </div>
              <div class="text-xs fw-700">${a.name || ''}</div>
              <div class="text-xs text-muted">${a.role || ''}</div>
              <div class="actions" style="justify-content:center;margin-top:6px">
                <button class="action-btn" title="Edit">✏</button>
                <button class="action-btn" title="View">👁</button>
                <button class="action-btn danger" title="Delete">🗑</button>
              </div>
            </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- Video Performance -->
      <div class="panel">
        <div class="panel-header">
          <h2>📊 Video Performance (YouTube)</h2>
          <button class="btn btn-outline btn-sm" onclick="document.querySelector('[data-section=analytics]').click()">View Analytics</button>
        </div>
        <div class="panel-body">
          <div class="stats-row cols-4" style="margin-bottom:16px">
            <div style="text-align:center"><div class="text-amber fw-800" style="font-size:18px">2.45M</div><div class="text-xs text-muted">Total Views</div><div class="text-xs text-green">+12.5%</div></div>
            <div style="text-align:center"><div class="text-amber fw-800" style="font-size:18px">145.8K</div><div class="text-xs text-muted">Watch Time (hrs)</div><div class="text-xs text-green">+9.4%</div></div>
            <div style="text-align:center"><div class="text-amber fw-800" style="font-size:18px">98.6K</div><div class="text-xs text-muted">Likes</div><div class="text-xs text-green">+8.1%</div></div>
            <div style="text-align:center"><div class="text-amber fw-800" style="font-size:18px">52.3K</div><div class="text-xs text-muted">Subscribers</div><div class="text-xs text-green">+11.7%</div></div>
          </div>
          <div class="chart-area" style="height:140px">${randomChartBars(20, 120)}</div>
        </div>
      </div>

      <!-- Recent Inquiries -->
      <div class="panel">
        <div class="panel-header">
          <h2>📩 Recent Inquiries</h2>
          <button class="btn btn-outline btn-sm" onclick="document.querySelector('[data-section=inquiries]').click()">View All</button>
        </div>
        <div class="panel-body">
          ${inquiries.length === 0 ? generateSampleInquiries() : inquiries.slice(0, 5).map(inq => `
            <div class="inquiry-item">
              <div class="inq-avatar" style="background:${['#dc2626','#f59e0b','#3b82f6','#8b5cf6','#16a34a'][Math.floor(Math.random()*5)]}">${(inq.name || 'A')[0].toUpperCase()}</div>
              <div class="inq-info">
                <div class="inq-name">${inq.name || 'Anonymous'}</div>
                <div class="inq-type">${inq.type || 'General Inquiry'}</div>
              </div>
              <div class="inq-time">${inq.created_at || 'Recently'}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>`;

  // Quick release form submit
  document.getElementById('quickReleaseForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = Object.fromEntries(fd.entries());
    await api('POST', 'releases', obj);
    toast('Release added');
    await loadData();
    showSection('overview');
  });
}

function generateSampleInquiries() {
  const samples = [
    { name: 'Ramesh Patel', type: 'Licensing Inquiry', time: '2 mins ago', color: '#dc2626' },
    { name: 'Asha Sharma', type: 'Distribution Inquiry', time: '15 mins ago', color: '#f59e0b' },
    { name: 'Mahesh Bansal', type: 'General Inquiry', time: '1 hour ago', color: '#3b82f6' },
    { name: 'Pooja Kumari', type: 'Artist Collaboration', time: '2 hours ago', color: '#8b5cf6' },
    { name: 'Vikram Singh', type: 'Copyright Inquiry', time: '3 hours ago', color: '#16a34a' }
  ];
  return samples.map(s => `
    <div class="inquiry-item">
      <div class="inq-avatar" style="background:${s.color}">${s.name[0]}</div>
      <div class="inq-info">
        <div class="inq-name">${s.name}</div>
        <div class="inq-type">${s.type}</div>
      </div>
      <div class="inq-time">${s.time}</div>
    </div>
  `).join('');
}

/* ═══════════════════════════════════════════════
   2. HOME BANNER (Reference Photo 8)
   ═══════════════════════════════════════════════ */
function renderBanners(area) {
  const banners = DATA.banners || [];
  area.innerHTML = `
    <!-- Live Preview -->
    <div class="panel mb-20">
      <div class="panel-header"><h2>LIVE PREVIEW</h2></div>
      <div class="panel-body">
        <div class="banner-preview" id="bannerPreview" style="display:flex;gap:12px;overflow-x:auto;padding:8px 0">
          ${banners.map((b, i) => b.image ? `<div style="position:relative;flex-shrink:0"><img src="${b.image}" alt="" style="height:180px;border-radius:8px;border:${i===0?'2px solid #f59e0b':'1px solid #333'}"><div style="position:absolute;bottom:8px;left:8px;background:rgba(0,0,0,.7);color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">${b.title || 'Banner '+(i+1)}</div></div>` : '').join('')}
          ${banners.length === 0 ? '<div style="color:#666;text-align:center;padding:40px;width:100%">No banners added yet. Drag & drop photos below to add banners.</div>' : ''}
        </div>
      </div>
    </div>

    <!-- Add New Banner (Drag & Drop Only) -->
    <div class="panel mb-20">
      <div class="panel-header"><h2>ADD NEW BANNER (Drag & Drop)</h2><span style="color:#888;font-size:12px">${banners.length} banner(s) added — add unlimited</span></div>
      <div class="panel-body">
        ${imageUploadField('Drop banner photo here', 'new_banner_image', '', 'hero')}
        ${field('Banner Title (optional)', 'new_banner_title', '')}
        <button class="btn btn-primary" id="addBannerBtn" style="margin-top:12px">+ ADD THIS BANNER</button>
      </div>
    </div>

    <!-- All Banners Grid -->
    <div class="panel">
      <div class="panel-header"><h2>ALL BANNERS (${banners.length})</h2></div>
      <div class="panel-body">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px">
          ${banners.map((b, i) => `
            <div style="position:relative;border:1px solid #333;border-radius:8px;overflow:hidden;background:#111">
              ${b.image ? `<img src="${b.image}" alt="" style="width:100%;height:140px;object-fit:cover">` : '<div style="height:140px;display:flex;align-items:center;justify-content:center;color:#666">No image</div>'}
              <div style="padding:8px">
                <div style="font-size:12px;color:#fff;font-weight:600">${b.title || 'Banner '+(i+1)}</div>
                <div style="display:flex;gap:4px;margin-top:6px">
                  <button class="btn btn-outline btn-sm edit-banner" data-id="${b.id}" style="padding:3px 8px;font-size:10px">✏ Edit</button>
                  <button class="btn btn-outline btn-sm del-banner" data-id="${b.id}" style="padding:3px 8px;font-size:10px;border-color:#ef4444;color:#ef4444">🗑 Delete</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        ${banners.length === 0 ? '<p style="color:#666;text-align:center;padding:20px">No banners yet. Use the drag & drop area above to add photos.</p>' : ''}
      </div>
    </div>`;

  // Add banner
  document.getElementById('addBannerBtn')?.addEventListener('click', async () => {
    const img = area.querySelector('input[name="new_banner_image"]')?.value;
    const title = area.querySelector('input[name="new_banner_title"]')?.value || '';
    if (!img) { toast('Please drag & drop a photo first', 'error'); return; }
    await api('POST', 'banners', { image: img, title: title });
    toast('Banner added!');
    await loadData();
    showSection('banners');
  });
  // Edit banner
  area.querySelectorAll('.edit-banner').forEach(b => {
    b.addEventListener('click', () => {
      const item = banners.find(x => x.id === b.dataset.id);
      showModal('Edit Banner', `<form>
        ${imageUploadField('Banner Photo (drag & drop)', 'image', item?.image || '', 'hero')}
        ${field('Title', 'title', item?.title)}
        ${formActions()}
      </form>`, async (obj) => {
        await api('PUT', 'banners', obj, item.id);
        toast('Banner updated');
        await loadData();
        showSection('banners');
      });
    });
  });
  // Delete banner
  area.querySelectorAll('.del-banner').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm('Delete this banner?')) return;
      await api('DELETE', 'banners', null, b.dataset.id);
      toast('Banner deleted');
      await loadData();
      showSection('banners');
    });
  });
}

/* ═══════════════════════════════════════════════
   3. ARTISTS (Reference Photo 7)
   ═══════════════════════════════════════════════ */
function renderArtists(area) {
  const artists = DATA.artists || [];
  const totalSongs = (DATA.catalogue || []).reduce((a, c) => a + (c.count || 0), 0);

  area.innerHTML = `
    <!-- Stats -->
    <div class="stats-row cols-4">
      <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-label">Total Artists</div><div class="stat-number">${artists.length || 24}</div></div>
      <div class="stat-card"><div class="stat-icon">⭐</div><div class="stat-label">Featured Artists</div><div class="stat-number">${Math.floor(artists.length / 2) || 12}</div></div>
      <div class="stat-card"><div class="stat-icon">🎵</div><div class="stat-label">Total Songs</div><div class="stat-number">${totalSongs || 128}</div></div>
      <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-label">Active This Month</div><div class="stat-number">${Math.min(artists.length, 8)}</div></div>
    </div>

    <!-- Search + Filters -->
    <div class="search-bar">
      <input type="text" class="search-input" placeholder="Search artists by name, role, or genre..." id="artistSearch">
      <select class="filter-select"><option>All Roles</option><option>Singer</option><option>Producer</option><option>Lyricist</option><option>Composer</option></select>
      <select class="filter-select"><option>All Genres</option><option>Devotional</option><option>Folk</option><option>Rasiya</option><option>Bhajan</option></select>
      <select class="filter-select"><option>All Status</option><option>Active</option><option>Inactive</option></select>
      <button class="btn btn-secondary btn-sm">RESET</button>
      <button class="btn btn-primary btn-sm" id="addArtistBtn">+ ADD NEW ARTIST</button>
    </div>

    <!-- Artist Cards + Add Form -->
    <div class="grid-2-1">
      <div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px" id="artistGrid">
          ${artists.map(a => `
            <div class="artist-card" style="position:relative">
              <div style="position:absolute;top:8px;right:8px;display:flex;gap:4px;z-index:2">
                <button class="btn btn-outline btn-sm edit-artist-btn" data-id="${a.id}" style="padding:4px 8px;font-size:10px">✏ Edit</button>
                <button class="btn btn-outline btn-sm delete-artist-btn" data-id="${a.id}" style="padding:4px 8px;font-size:10px;border-color:#ef4444;color:#ef4444">✕ Delete</button>
              </div>
              <div class="featured-badge">FEATURED</div>
              ${a.image ? `<img src="${a.image}" class="artist-img" alt="${a.name}">` : '<div class="artist-img" style="background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:32px">👤</div>'}
              <div class="artist-name">${a.name || ''}</div>
              <div class="artist-role">${a.role || 'Singer'}</div>
              <div class="artist-genre">${a.genre || 'Devotional, Folk'}</div>
              <div class="artist-desc">${a.description || ''}</div>
              <div class="artist-contact">
                ${a.phone ? `<div>📞 ${a.phone}</div>` : ''}
                ${a.email ? `<div>✉ ${a.email}</div>` : ''}
                ${a.address ? `<div>📍 ${a.address}</div>` : ''}
                ${a.profile_url ? `<div><a href="${a.profile_url}" target="_blank" style="color:#f59e0b;text-decoration:none">🔗 Profile</a></div>` : ''}
              </div>
              <div class="artist-social">
                ${a.youtube_url ? `<a href="${a.youtube_url}" target="_blank" class="platform-icon pi-yt">▶</a>` : ''}
                ${a.instagram_url ? `<a href="${a.instagram_url}" target="_blank" class="platform-icon pi-spotify" style="background:#e1306c">📷</a>` : ''}
                ${a.facebook_url ? `<a href="${a.facebook_url}" target="_blank" class="platform-icon pi-apple" style="background:#1877f2">f</a>` : ''}
                ${a.spotify_url ? `<a href="${a.spotify_url}" target="_blank" class="platform-icon pi-spotify">♪</a>` : ''}
                ${!a.youtube_url && !a.instagram_url && !a.facebook_url && !a.spotify_url ? '<span style="color:#666;font-size:11px">No social links</span>' : ''}
              </div>
            </div>
          `).join('')}
        </div>
        <div class="pagination" style="margin-top:16px">
          <span>Showing 1 to ${artists.length} of ${artists.length} artists</span>
          <button class="page-btn active">1</button>
          <button class="page-btn">2</button>
          <button class="page-btn">3</button>
          <button class="page-btn">4</button>
        </div>
      </div>

      <!-- Add New Artist Form -->
      <div>
        <div class="panel">
          <div class="panel-header"><h2>Add New Artist</h2></div>
          <div class="panel-body">
            <form id="addArtistForm">
              ${imageUploadField('Artist Photo', 'image', '', 'artists')}
              ${field('Artist Name', 'name', '', 'text', true)}
              ${selectField('Role', 'role', ['Select Role', 'Singer', 'Producer', 'Lyricist', 'Composer', 'Music Director'], '')}
              ${selectField('Genre / Category', 'genre', ['Select Genre', 'Devotional', 'Folk', 'Rasiya', 'Bhajan', 'DJ Rasiya', 'Classical'], '')}
              ${textareaField('Short Biography', 'description', '', 'Write a short biography about the artist...')}
              ${field('Contact Number', 'phone', '', 'tel')}
              ${field('Email Address', 'email', '', 'email')}
              ${field('Address', 'address', '')}
              ${field('Profile Link (Website)', 'profile_url', '', 'url')}
              <div class="form-group"><label style="color:#f59e0b;font-weight:700">Social Media Links</label></div>
              ${field('YouTube URL', 'youtube_url', '', 'url')}
              ${field('Instagram URL', 'instagram_url', '', 'url')}
              ${field('Facebook URL', 'facebook_url', '', 'url')}
              ${field('Spotify URL', 'spotify_url', '', 'url')}
              <div class="form-actions">
                <button type="button" class="btn btn-secondary cancel-btn" onclick="showSection('artists')">CANCEL</button>
                <button type="submit" class="btn btn-primary">ADD ARTIST</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>`;

  // Add artist form
  document.getElementById('addArtistForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = Object.fromEntries(fd.entries());
    await api('POST', 'artists', obj);
    toast('Artist added');
    await loadData();
    showSection('artists');
  });
  document.getElementById('addArtistBtn')?.addEventListener('click', () => {
    document.getElementById('addArtistForm')?.scrollIntoView({ behavior: 'smooth' });
  });
  // Edit artist
  document.querySelectorAll('.edit-artist-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const a = (DATA.artists || []).find(x => x.id === id);
      if (!a) return;
      showModal('Edit Artist', `<form>
        ${imageUploadField('Artist Photo', 'image', a.image || '', 'artists')}
        ${field('Artist Name', 'name', a.name, 'text', true)}
        ${selectField('Role', 'role', ['Singer', 'Producer', 'Lyricist', 'Composer', 'Music Director'], a.role || '')}
        ${selectField('Genre / Category', 'genre', ['Devotional', 'Folk', 'Rasiya', 'Bhajan', 'DJ Rasiya', 'Classical'], a.genre || '')}
        ${textareaField('Short Biography', 'description', a.description || '', 'Write a short biography...')}
        ${field('Contact Number', 'phone', a.phone || '', 'tel')}
        ${field('Email Address', 'email', a.email || '', 'email')}
        ${field('Address', 'address', a.address || '')}
        ${field('Profile Link (Website)', 'profile_url', a.profile_url || '', 'url')}
        <div class="form-group"><label style="color:#f59e0b;font-weight:700">Social Media Links</label></div>
        ${field('YouTube URL', 'youtube_url', a.youtube_url || '', 'url')}
        ${field('Instagram URL', 'instagram_url', a.instagram_url || '', 'url')}
        ${field('Facebook URL', 'facebook_url', a.facebook_url || '', 'url')}
        ${field('Spotify URL', 'spotify_url', a.spotify_url || '', 'url')}
        ${formActions()}
      </form>`, async (obj) => {
        await api('PUT', 'artists', obj, id);
        toast('Artist updated');
        await loadData();
        showSection('artists');
      });
    });
  });
  // Delete artist
  document.querySelectorAll('.delete-artist-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete this artist?')) return;
      await api('DELETE', 'artists', null, btn.dataset.id);
      toast('Artist deleted', 'error');
      await loadData();
      showSection('artists');
    });
  });
}

/* ═══════════════════════════════════════════════
   4. RELEASES (Reference Photo 6)
   ═══════════════════════════════════════════════ */
function renderReleases(area) {
  const releases = DATA.releases || [];
  const artists = DATA.artists || [];

  area.innerHTML = `
    <div class="flex-between mb-20">
      <div></div>
      <div class="panel-actions">
        <input type="text" class="search-input" placeholder="Search releases..." style="width:250px">
        <button class="btn btn-secondary btn-sm">🔍</button>
      </div>
    </div>
    <div class="grid-2">
      <!-- Add New Release Form -->
      <div class="panel">
        <div class="panel-header"><h2>ADD NEW RELEASE</h2></div>
        <div class="panel-body">
          <form id="addReleaseForm">
            ${field('Release Title', 'hindi_title', '', 'text', true)}
            ${selectField('Artist', 'artist', ['Select or enter artist name', ...artists.map(a => a.name)], '')}
            ${selectField('Singer', 'singer', ['Select or enter singer name', ...artists.filter(a => a.role === 'Singer').map(a => a.name)], '')}
            ${selectField('Genre / Category', 'category', ['Select genre or category', 'Krishna Bhajan', 'Radha Bhajan', 'Hanuman Bhajan', 'Ram Bhajan', 'Shiv Bhajan', 'Gurjar Rasiya', 'DJ Rasiya', 'Folk Song'], '')}
            ${field('Release Date', 'release_date', '', 'date', true)}
            ${imageUploadField('Cover Image', 'image', '', 'songs')}
            ${textareaField('Lyrics', 'lyrics', '', 'Enter lyrics here...')}
            ${field('ISRC / Catalogue Number', 'isrc', '', 'text')}
            ${field('English Title', 'eng_title', '')}
            <div class="form-group"><label>Platform Links (Optional)</label></div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
              <input type="url" name="url" placeholder="YouTube link" style="flex:1;min-width:140px;padding:8px 12px;background:#1a1a1a;border:1px solid var(--border2);border-radius:var(--radius-xs);color:#fff;font-size:12px">
              <input type="url" name="spotify_url" placeholder="Spotify link" style="flex:1;min-width:140px;padding:8px 12px;background:#1a1a1a;border:1px solid var(--border2);border-radius:var(--radius-xs);color:#fff;font-size:12px">
              <input type="url" name="apple_url" placeholder="Apple Music link" style="flex:1;min-width:140px;padding:8px 12px;background:#1a1a1a;border:1px solid var(--border2);border-radius:var(--radius-xs);color:#fff;font-size:12px">
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
              <input type="url" name="jiosaavn_url" placeholder="JioSaavn link" style="flex:1;min-width:140px;padding:8px 12px;background:#1a1a1a;border:1px solid var(--border2);border-radius:var(--radius-xs);color:#fff;font-size:12px">
              <input type="url" name="wynk_url" placeholder="Wynk Music link" style="flex:1;min-width:140px;padding:8px 12px;background:#1a1a1a;border:1px solid var(--border2);border-radius:var(--radius-xs);color:#fff;font-size:12px">
            </div>
            ${selectField('Publish Status', 'status', ['Draft', 'Scheduled', 'Published'], 'Draft')}
            <div style="display:flex;gap:8px;margin-top:16px">
              <button type="button" class="btn btn-secondary">SAVE AS DRAFT</button>
              <button type="button" class="btn btn-outline">📅 SCHEDULE RELEASE</button>
              <button type="submit" class="btn btn-primary">🎵 PUBLISH NOW</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Recent Releases Table -->
      <div class="panel">
        <div class="panel-header"><h2>RECENT RELEASES</h2></div>
        <div class="panel-body no-pad">
          <table class="data-table">
            <thead><tr><th>COVER</th><th>TITLE</th><th>ARTIST</th><th>RELEASE DATE</th><th>STATUS</th><th>PLATFORMS</th><th>ACTIONS</th></tr></thead>
            <tbody>
              ${releases.map(r => `<tr>
                <td>${r.image ? `<img src="${r.image}" alt="">` : '<div style="width:45px;height:45px;background:var(--card2);border-radius:6px"></div>'}</td>
                <td><div class="title-col">${r.hindi_title || ''}</div><div class="subtitle-col">${r.eng_title || ''}</div></td>
                <td>${r.artist || 'Bainsla Music'}</td>
                <td class="text-xs">${r.release_date || '-'}</td>
                <td><span class="badge ${r.status === 'Published' ? 'badge-green' : r.status === 'Scheduled' ? 'badge-amber' : 'badge-gray'}">${r.status || 'PUBLISHED'}</span></td>
                <td>${platformIcons()}</td>
                <td class="actions">
                  <button class="action-btn edit-release" data-id="${r.id}" title="Edit">✏</button>
                  <button class="action-btn danger del-release" data-id="${r.id}" title="Delete">🗑</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
          <div class="pagination">
            <span>Showing 1 to ${releases.length} of ${releases.length} releases</span>
            <button class="page-btn active">1</button>
            <button class="page-btn">2</button>
            <button class="page-btn">3</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Cards -->
    <div class="stats-row cols-4" style="margin-top:20px">
      <div class="panel"><div class="panel-body" style="text-align:center"><div style="font-size:24px;margin-bottom:4px">🎵</div><div class="text-amber fw-700">MUSIC CATALOGUE</div><div class="text-xs text-muted" style="margin:6px 0">Explore our wide range of Devotional, Folk & Rasiya songs.</div><button class="btn btn-outline btn-sm">EXPLORE CATALOGUE</button></div></div>
      <div class="panel"><div class="panel-body" style="text-align:center"><div style="font-size:24px;margin-bottom:4px">▶</div><div class="text-amber fw-700">YOUTUBE VIDEOS</div><div class="text-xs text-muted" style="margin:6px 0">Watch our latest videos and subscribe our official YouTube channel.</div><button class="btn btn-outline btn-sm">WATCH NOW</button></div></div>
      <div class="panel"><div class="panel-body" style="text-align:center"><div style="font-size:24px;margin-bottom:4px">©</div><div class="text-amber fw-700">LICENSING</div><div class="text-xs text-muted" style="margin:6px 0">For music licensing, copyright claims, YouTube CMS.</div><button class="btn btn-outline btn-sm">LEARN MORE</button></div></div>
      <div class="panel"><div class="panel-body" style="text-align:center"><div style="font-size:24px;margin-bottom:4px">🌐</div><div class="text-amber fw-700">DISTRIBUTION</div><div class="text-xs text-muted" style="margin:6px 0">We provide digital music distribution across all major platforms.</div><button class="btn btn-outline btn-sm">DISTRIBUTE NOW</button></div></div>
    </div>`;

  // Event listeners
  document.getElementById('addReleaseForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = Object.fromEntries(fd.entries());
    obj.label = 'Bainsla Music';
    await api('POST', 'releases', obj);
    toast('Release published');
    await loadData();
    showSection('releases');
  });
  area.querySelectorAll('.edit-release').forEach(b => {
    b.addEventListener('click', () => {
      const item = releases.find(x => x.id === b.dataset.id);
      showModal('Edit Release', `<form>
        ${field('Hindi Title', 'hindi_title', item?.hindi_title)}
        ${field('English Title', 'eng_title', item?.eng_title)}
        ${field('Artist', 'artist', item?.artist)}
        ${imageUploadField('Cover Image', 'image', item?.image || '', 'songs')}
        ${field('YouTube / Link URL', 'url', item?.url, 'url')}
        ${field('Spotify URL', 'spotify_url', item?.spotify_url || '', 'url')}
        ${field('Apple Music URL', 'apple_url', item?.apple_url || '', 'url')}
        ${field('JioSaavn URL', 'jiosaavn_url', item?.jiosaavn_url || '', 'url')}
        ${field('Release Date', 'release_date', item?.release_date, 'date')}
        ${selectField('Status', 'status', ['Draft', 'Scheduled', 'Published'], item?.status || 'Published')}
        ${formActions()}
      </form>`, async (obj) => {
        obj.label = 'Bainsla Music';
        await api('PUT', 'releases', obj, item.id);
        toast('Release updated');
        await loadData();
        showSection('releases');
      });
    });
  });
  area.querySelectorAll('.del-release').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm('Delete this release?')) return;
      await api('DELETE', 'releases', null, b.dataset.id);
      toast('Release deleted');
      await loadData();
      showSection('releases');
    });
  });
}

/* ═══════════════════════════════════════════════
   5. VIDEOS (Reference Photo 5)
   ═══════════════════════════════════════════════ */
function renderVideos(area) {
  const videos = DATA.videos || [];

  area.innerHTML = `
    <div class="flex-between mb-20">
      <div></div>
      <button class="btn btn-primary" id="addVideoTopBtn">+ UPLOAD NEW VIDEO</button>
    </div>

    <!-- Upload Form -->
    <div class="panel mb-20">
      <div class="panel-header"><h2>UPLOAD / PUBLISH NEW VIDEO</h2></div>
      <div class="panel-body">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:16px">
          <!-- Thumbnail -->
          <div>
            ${imageUploadField('VIDEO THUMBNAIL', 'thumbnail', '', 'songs')}
            <div style="background:var(--amber-bg);border-radius:var(--radius-xs);padding:10px;margin-top:8px;text-align:center">
              <div class="text-xs">Video will be published on <span style="color:red">▶ YouTube</span></div>
              <div class="text-xs text-muted">Make sure the video is already uploaded to your YouTube channel.</div>
            </div>
          </div>

          <!-- Title & URL -->
          <div>
            ${field('YOUTUBE VIDEO URL', 'youtube_url_input', '', 'text', true)}
            <div class="text-xs text-muted" style="margin-top:-10px;margin-bottom:12px">Paste YouTube URL \u2014 thumbnail & ID auto-fetch!</div>
            <button type="button" class="btn btn-secondary btn-sm" id="fetchYtBtn" style="margin-bottom:12px">\ud83d\udd04 Auto-Fetch from YouTube</button>
            ${field('VIDEO TITLE', 'hindi_title', '', 'text', true)}
            ${selectField('CATEGORY', 'category', ['Select Category', 'Krishna Bhajan', 'Radha Bhajan', 'Hanuman Bhajan', 'Ram Bhajan', 'Shiv Bhajan', 'Gurjar Rasiya', 'DJ Rasiya', 'Folk Song'], '')}
            ${selectField('PLAYLIST', 'playlist', ['Select Playlist (Optional)', 'Top Krishna Bhajans', 'Radha Rani Special', 'Hanuman Chalisa Collection', 'Gurjar Rasiya Hits'], '')}
          </div>

          <!-- Description & Tags -->
          <div>
            ${textareaField('DESCRIPTION', 'description', '', 'Enter video description...')}
            <div class="form-group"><label>TAGS</label><input type="text" name="tags" placeholder="Enter tags and press Enter"></div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:-8px">
              ${['devotional', 'bhajan', 'krishna', 'radha'].map(t => `<span class="tag">${t} <span class="tag-remove">×</span></span>`).join('')}
            </div>
          </div>

          <!-- Schedule & Status -->
          <div>
            <div class="form-group"><label>SCHEDULE PUBLISH</label><input type="datetime-local" name="schedule" style="width:100%;padding:10px;background:#1a1a1a;border:1px solid var(--border2);border-radius:var(--radius-xs);color:#fff;font-size:12px"></div>
            <div class="flex-between" style="margin:16px 0"><label class="text-sm fw-700">FEATURED VIDEO</label><div class="toggle" id="featuredToggle"></div></div>
            <div class="text-xs text-muted">Show this video on homepage / featured section</div>
            ${selectField('STATUS', 'status', ['Draft', 'Published', 'Scheduled'], 'Draft')}
            <div style="background:var(--amber-bg);border-radius:var(--radius-xs);padding:10px;margin-top:12px">
              <div class="text-xs">ℹ Once published, the video details will be visible on the website under Videos.</div>
            </div>
            <div style="display:flex;gap:8px;margin-top:16px">
              <button type="button" class="btn btn-secondary">RESET</button>
              <button class="btn btn-primary" id="publishVideoBtn">🎵 PUBLISH VIDEO</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Video Library -->
    <div class="panel">
      <div class="panel-header">
        <h2>VIDEO LIBRARY</h2>
        <div class="panel-actions">
          <input type="text" class="search-input" placeholder="Search videos..." style="width:200px">
          <button class="btn btn-secondary btn-sm">🔍 FILTER</button>
        </div>
      </div>
      <div class="panel-body no-pad">
        <table class="data-table">
          <thead><tr><th>#</th><th>THUMBNAIL</th><th>TITLE</th><th>CATEGORY</th><th>DURATION</th><th>VIEWS</th><th>PUBLISHED ON</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
          <tbody>
            ${videos.map((v, i) => `<tr>
              <td>${i + 1}</td>
              <td><div style="position:relative;width:80px;height:45px;border-radius:4px;overflow:hidden;background:var(--card2)">
                ${v.thumbnail ? `<img src="${v.thumbnail}" style="width:100%;height:100%;object-fit:cover">` : `<img src="https://img.youtube.com/vi/${v.youtube_id || ''}/default.jpg" style="width:100%;height:100%;object-fit:cover">`}
                <span style="position:absolute;bottom:2px;left:2px;background:rgba(0,0,0,.8);color:#fff;font-size:9px;padding:1px 4px;border-radius:2px">${v.duration || ''}</span>
              </div></td>
              <td><div class="title-col">${v.hindi_title || ''}</div><div class="subtitle-col">${v.eng_title || ''}</div></td>
              <td class="text-xs">${v.category || 'Devotional'}</td>
              <td>${v.duration || '-'}</td>
              <td class="text-amber fw-700">${v.views || '-'}</td>
              <td class="text-xs text-muted">${v.published_on || '-'}</td>
              <td><span class="badge ${v.status === 'Draft' ? 'badge-amber' : v.status === 'Scheduled' ? 'badge-blue' : 'badge-green'}">${v.status || 'Published'}</span></td>
              <td class="actions">
                <button class="action-btn" title="View">👁</button>
                <button class="action-btn edit-video" data-id="${v.id}" title="Edit">✏</button>
                <button class="action-btn danger del-video" data-id="${v.id}" title="Delete">🗑</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div class="pagination">
          <span>Showing 1 to ${videos.length} of ${videos.length} videos</span>
          <button class="page-btn active">1</button>
          <button class="page-btn">2</button>
          <button class="page-btn">3</button>
          <button class="page-btn">4</button>
        </div>
      </div>
    </div>

    <!-- Bottom Stats -->
    <div class="stats-row cols-5" style="margin-top:20px">
      <div class="stat-card" style="text-align:center"><div style="font-size:24px;margin-bottom:4px">📹</div><div class="stat-number" style="font-size:24px">${videos.length || 24}</div><div class="stat-label">TOTAL VIDEOS</div><div class="text-xs text-muted">All uploaded videos</div></div>
      <div class="stat-card" style="text-align:center"><div style="font-size:24px;margin-bottom:4px">📅</div><div class="stat-number" style="font-size:24px;color:var(--green)">${videos.filter(v => v.status === 'Published').length || 18}</div><div class="stat-label">PUBLISHED</div><div class="text-xs text-muted">Live on website</div></div>
      <div class="stat-card" style="text-align:center"><div style="font-size:24px;margin-bottom:4px">📝</div><div class="stat-number" style="font-size:24px;color:var(--amber)">${videos.filter(v => v.status === 'Draft').length || 3}</div><div class="stat-label">DRAFTS</div><div class="text-xs text-muted">Saved as draft</div></div>
      <div class="stat-card" style="text-align:center"><div style="font-size:24px;margin-bottom:4px">⏰</div><div class="stat-number" style="font-size:24px;color:var(--blue)">2</div><div class="stat-label">SCHEDULED</div><div class="text-xs text-muted">Scheduled to publish</div></div>
      <div class="stat-card" style="text-align:center"><div style="font-size:24px;margin-bottom:4px">📊</div><div class="stat-number text-amber" style="font-size:24px">8.2M</div><div class="stat-label">TOTAL VIEWS</div><div class="text-xs text-muted">Across all videos</div></div>
    </div>`;

  // YouTube Auto-Fetch
  document.getElementById('fetchYtBtn')?.addEventListener('click', () => {
    const urlInput = area.querySelector('input[name="youtube_url_input"]');
    const url = urlInput?.value || '';
    let videoId = '';
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    if (m) videoId = m[1];
    else if (url.length === 11) videoId = url;
    if (!videoId) { toast('Invalid YouTube URL', 'error'); return; }
    // Set thumbnail preview
    const thumbInput = area.querySelector('input[name="thumbnail"]');
    if (thumbInput) thumbInput.value = 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg';
    const prevEl = area.querySelector('#preview_' + (area.querySelector('.upload-drop-zone')?.id?.replace('drop_','') || ''));
    if (prevEl) prevEl.innerHTML = '<img src="https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg" style="max-height:100px;border-radius:6px;margin-bottom:8px">';
    // Set youtube_id hidden
    const ytIdInput = area.querySelector('input[name="youtube_id"]');
    if (!ytIdInput) {
      const hiddenInput = document.createElement('input');
      hiddenInput.type = 'hidden'; hiddenInput.name = 'youtube_id'; hiddenInput.value = videoId;
      urlInput.parentElement.appendChild(hiddenInput);
    } else { ytIdInput.value = videoId; }
    toast('YouTube ID: ' + videoId + ' \u2014 Thumbnail loaded!');
  });

  // Video CRUD listeners
  document.getElementById('publishVideoBtn')?.addEventListener('click', async () => {
    const inputs = area.querySelectorAll('.panel-body input, .panel-body select, .panel-body textarea');
    const obj = {};
    inputs.forEach(inp => { if (inp.name) obj[inp.name] = inp.value; });
    // Extract youtube_id from URL if not already set
    if (!obj.youtube_id && obj.youtube_url_input) {
      const m2 = obj.youtube_url_input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
      if (m2) obj.youtube_id = m2[1];
    }
    if (!obj.youtube_id) obj.youtube_id = obj.youtube_url_input || '';
    if (!obj.thumbnail && obj.youtube_id) obj.thumbnail = 'https://img.youtube.com/vi/' + obj.youtube_id + '/hqdefault.jpg';
    delete obj.youtube_url_input;
    if (!obj.hindi_title) { toast('Please enter video title', 'error'); return; }
    await api('POST', 'videos', obj);
    toast('Video published');
    await loadData();
    showSection('videos');
  });
  area.querySelectorAll('.edit-video').forEach(b => {
    b.addEventListener('click', () => {
      const item = videos.find(x => x.id === b.dataset.id);
      showModal('Edit Video', `<form>
        ${field('Hindi Title', 'hindi_title', item?.hindi_title)}
        ${field('English Title', 'eng_title', item?.eng_title)}
        ${field('YouTube Video ID', 'youtube_id', item?.youtube_id)}
        ${selectField('Category', 'category', ['Krishna Bhajan', 'Radha Bhajan', 'Hanuman Bhajan', 'Ram Bhajan', 'Shiv Bhajan', 'Gurjar Rasiya', 'DJ Rasiya', 'Folk Song', 'Guru Bhajan', 'Devotional'], item?.category || '')}
        ${field('Duration', 'duration', item?.duration)}
        ${field('Views', 'views', item?.views)}
        ${imageUploadField('Thumbnail', 'thumbnail', item?.thumbnail || '', 'songs')}
        ${selectField('Status', 'status', ['Draft', 'Published', 'Scheduled'], item?.status || 'Published')}
        ${formActions()}
      </form>`, async (obj) => {
        await api('PUT', 'videos', obj, item.id);
        toast('Video updated');
        await loadData();
        showSection('videos');
      });
    });
  });
  area.querySelectorAll('.del-video').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm('Delete this video?')) return;
      await api('DELETE', 'videos', null, b.dataset.id);
      toast('Video deleted');
      await loadData();
      showSection('videos');
    });
  });
}

/* ═══════════════════════════════════════════════
   6. MUSIC CATALOGUE (Reference Photo 4)
   ═══════════════════════════════════════════════ */
function renderCatalogue(area) {
  const catalogue = DATA.catalogue || [];
  const releases = DATA.releases || [];

  area.innerHTML = `
    <div class="flex-between mb-20">
      <div></div>
      <button class="btn btn-primary" id="addSongTopBtn">+ Add New Song</button>
    </div>

    <!-- Top Row: Bulk Upload + Categories + Playlists -->
    <div class="grid-3-col mb-20">
      <!-- Bulk Upload -->
      <div class="panel">
        <div class="panel-header"><h2>BULK UPLOAD / IMPORT</h2></div>
        <div class="panel-body">
          <p class="text-xs text-muted mb-16">Upload multiple songs, or import from external sources.</p>
          <div class="upload-area" style="min-height:100px">
            <div class="upload-icon">🎵</div>
            <div class="upload-text">Drag & Drop files here<br>or click to browse</div>
            <div class="upload-hint">Supports: MP3, WAV, FLAC | Max 2GB per file</div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn-primary btn-sm">UPLOAD FILES</button>
            <button class="btn btn-outline btn-sm">IMPORT CSV</button>
          </div>
          <a href="#" class="text-xs" style="margin-top:8px;display:block">Download Sample CSV</a>
        </div>
      </div>

      <!-- Categories -->
      <div class="panel">
        <div class="panel-header">
          <h2>CATEGORIES</h2>
          <button class="btn btn-outline btn-sm" id="manageCatsBtn">Manage Categories</button>
        </div>
        <div class="panel-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${catalogue.map(c => `<div class="flex items-center gap-8" style="padding:8px 12px;background:var(--card2);border-radius:var(--radius-xs)">
              <span>🎵</span>
              <span class="text-sm fw-700" style="flex:1">${c.name || ''}</span>
              <span class="text-amber fw-700">${c.count || 0}</span>
            </div>`).join('')}
          </div>
          <a href="#" class="text-xs" style="display:block;text-align:center;margin-top:12px">View All Categories</a>
        </div>
      </div>

      <!-- Playlists/Collections -->
      <div class="panel">
        <div class="panel-header">
          <h2>PLAYLISTS / COLLECTIONS</h2>
          <button class="btn btn-outline btn-sm">Manage Collections</button>
        </div>
        <div class="panel-body">
          ${['Top Krishna Bhajans|25', 'Radha Rani Special|18', 'Hanuman Chalisa Collection|20', 'Top Gurjar Rasiya|30'].map(p => {
            const [name, count] = p.split('|');
            return `<div class="flex items-center gap-8" style="padding:8px 0;border-bottom:1px solid var(--border)">
              <div style="width:40px;height:40px;background:var(--card2);border-radius:var(--radius-xs);display:flex;align-items:center;justify-content:center;font-size:18px">🎵</div>
              <div style="flex:1"><div class="text-sm fw-700">${name}</div><div class="text-xs text-muted">${count} Songs</div></div>
              <div class="actions">
                <button class="action-btn" title="Play">▶</button>
                <button class="action-btn" title="Edit">✏</button>
                <button class="action-btn" title="More">⋮</button>
              </div>
            </div>`;
          }).join('')}
          <button class="btn btn-outline btn-sm" style="width:100%;margin-top:12px;justify-content:center">+ Create New Collection</button>
        </div>
      </div>
    </div>

    <!-- Search & Filters -->
    <div class="search-bar">
      <input type="text" class="search-input" placeholder="Search songs..." style="flex:2">
      <select class="filter-select"><option>All Categories</option>${catalogue.map(c => `<option>${c.name}</option>`).join('')}</select>
      <select class="filter-select"><option>All Artists</option></select>
      <select class="filter-select"><option>All Status</option><option>Published</option><option>Draft</option></select>
      <button class="btn btn-secondary btn-sm">🔍 FILTERS</button>
      <button class="btn btn-secondary btn-sm">↻ RESET</button>
    </div>

    <!-- Songs Table -->
    <div class="panel">
      <div class="panel-body no-pad">
        <table class="data-table">
          <thead><tr><th>#</th><th>SONG TITLE</th><th>ARTIST</th><th>ALBUM</th><th>DURATION</th><th>PLATFORMS</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
          <tbody>
            ${releases.map((r, i) => `<tr>
              <td>${i + 1}</td>
              <td class="cover-cell">${r.image ? `<img src="${r.image}" alt="">` : '<div style="width:45px;height:45px;background:var(--card2);border-radius:6px"></div>'}<div><div class="title-col">${r.hindi_title || ''}</div><div class="subtitle-col">${r.category || 'Bhajan'}</div></div></td>
              <td><div class="text-sm">${r.artist || 'Bainsla Music'}</div></td>
              <td class="text-xs text-muted">${r.album || 'Bainsla Music'}</td>
              <td>${r.duration || '04:35'}</td>
              <td>${platformIcons()}</td>
              <td><span class="badge badge-green">● Published</span></td>
              <td class="actions">
                <button class="action-btn edit-cat" data-id="${r.id}" title="Edit">✏</button>
                <button class="action-btn" title="Analytics">📊</button>
                <button class="action-btn" title="More">⋮</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div class="pagination">
          <span>Showing 1 to ${releases.length} of 725 songs</span>
          <button class="page-btn active">1</button>
          <button class="page-btn">2</button>
          <button class="page-btn">3</button>
          <span>...</span>
          <button class="page-btn">91</button>
          <span style="margin-left:auto" class="text-xs text-muted">Rows per page: <select class="filter-select" style="width:auto;padding:4px 8px"><option>10</option><option>25</option><option>50</option></select></span>
        </div>
      </div>
    </div>`;

  // Manage categories
  document.getElementById('manageCatsBtn')?.addEventListener('click', () => {
    showModal('Manage Categories', `<form>
      ${catalogue.map((c, i) => `<div class="form-row" style="margin-bottom:8px;align-items:end">
        <div class="form-group mb-0">${i === 0 ? '<label>Category Name</label>' : ''}
          <input type="text" name="name_${i}" value="${c.name || ''}"></div>
        <div class="form-group mb-0">${i === 0 ? '<label>Hindi Name</label>' : ''}
          <input type="text" name="hindi_${i}" value="${c.hindi || ''}"></div>
      </div>`).join('')}
      ${formActions()}
    </form>`, async (obj) => {
      toast('Categories updated');
      await loadData();
      showSection('catalogue');
    });
  });
}

/* ═══════════════════════════════════════════════
   7. LICENSING (Reference Photo 3)
   ═══════════════════════════════════════════════ */
function renderLicensing(area) {
  const licensing = DATA.licensing || [];

  area.innerHTML = `
    <!-- Stats -->
    <div class="stats-row cols-5">
      <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-label">Total Inquiries</div><div class="stat-number">128</div><div class="stat-change">+18% this month</div></div>
      <div class="stat-card"><div class="stat-icon">🔵</div><div class="stat-label">Active Requests</div><div class="stat-number">42</div><div class="stat-change">+12% this month</div></div>
      <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-label">Approved Licenses</div><div class="stat-number">76</div><div class="stat-change">+22% this month</div></div>
      <div class="stat-card"><div class="stat-icon">©</div><div class="stat-label">Copyright Claims</div><div class="stat-number">14</div><div class="stat-change">+7% this month</div></div>
      <div class="stat-card"><div class="stat-icon">₹</div><div class="stat-label">Revenue (YTD)</div><div class="stat-number">₹18.75L</div><div class="stat-change">+28% this year</div></div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <div class="tab active">LICENSING INQUIRY</div>
      <div class="tab">COPYRIGHT CLAIMS</div>
      <div class="tab">PERMISSIONS</div>
      <div class="tab">LICENSE HISTORY</div>
      <div class="tab">REPORTS</div>
    </div>

    <!-- Main Content: Form + Status -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 250px;gap:16px">
      <!-- Client Details -->
      <div class="panel">
        <div class="panel-header"><h2>CLIENT / COMPANY DETAILS</h2></div>
        <div class="panel-body">
          ${field('Full Name / Company', 'client_name', '', 'text', true)}
          ${field('Contact Person', 'contact_person', '', 'text', true)}
          ${field('Email Address', 'email', '', 'email', true)}
          ${field('Phone Number', 'phone', '', 'tel', true)}
          ${field('Company / Organization', 'company', '')}
          ${selectField('Country', 'country', ['Select Country', 'India', 'USA', 'UK', 'UAE', 'Other'], '')}
        </div>
      </div>

      <!-- Content & Usage -->
      <div class="panel">
        <div class="panel-header"><h2>CONTENT & USAGE DETAILS</h2></div>
        <div class="panel-body">
          ${selectField('Select Song / Content', 'song', ['Select Song', ...(DATA.releases || []).map(r => r.hindi_title || r.eng_title)], '', true)}
          ${selectField('License Type', 'license_type', ['Select License Type', 'Synchronization', 'Broadcast', 'Digital', 'Mechanical', 'Master Use'], '', true)}
          ${selectField('Usage Type', 'usage_type', ['Select Usage Type', 'Music Video', 'TV Program', 'Film', 'YouTube', 'Podcast', 'Advertising', 'Live Event'], '', true)}
          ${field('Planned Start Date', 'start_date', '', 'date', true)}
          ${textareaField('Project / Purpose', 'purpose', '', 'Enter project or purpose details')}
        </div>
      </div>

      <!-- License & Tracking -->
      <div class="panel">
        <div class="panel-header"><h2>LICENSE & TRACKING DETAILS</h2></div>
        <div class="panel-body">
          ${selectField('License Duration', 'duration', ['Select Duration', '1 Month', '3 Months', '6 Months', '1 Year', '2 Years', 'Perpetual'], '', true)}
          ${selectField('Territory', 'territory', ['Select Territory', 'India', 'Worldwide', 'Asia', 'North America', 'Europe', 'Custom'], '')}
          ${selectField('Media / Platform', 'platform', ['Select Platform', 'YouTube', 'TV', 'Film', 'Radio', 'Social Media', 'Multiple'], '')}
          ${field('Estimated Audience / Reach', 'reach', '')}
          ${selectField('Priority', 'priority', ['Low', 'Medium', 'High'], 'Medium')}
          <button class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:12px">SUBMIT INQUIRY</button>
        </div>
      </div>

      <!-- Status Tracking + Team -->
      <div>
        <div class="panel mb-20">
          <div class="panel-header"><h2>STATUS TRACKING</h2></div>
          <div class="panel-body">
            <div class="timeline-item"><div class="timeline-dot green">✓</div><div class="timeline-content"><div class="timeline-title">Inquiry Received</div><div class="timeline-date">12 May 2024, 10:30 AM</div></div></div>
            <div class="timeline-item"><div class="timeline-dot green">✓</div><div class="timeline-content"><div class="timeline-title">Under Review</div><div class="timeline-date">12 May 2024, 11:15 AM</div></div></div>
            <div class="timeline-item"><div class="timeline-dot amber">3</div><div class="timeline-content"><div class="timeline-title text-amber">In Discussion</div><div class="timeline-date">13 May 2024, 02:00 PM</div></div></div>
            <div class="timeline-item"><div class="timeline-dot gray">○</div><div class="timeline-content"><div class="timeline-title text-muted">Approval Pending</div><div class="timeline-date text-muted">Pending</div></div></div>
            <div class="timeline-item"><div class="timeline-dot gray">○</div><div class="timeline-content"><div class="timeline-title text-muted">License Issued</div><div class="timeline-date text-muted">Pending</div></div></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><h2>ASSIGNED TEAM MEMBER</h2></div>
          <div class="panel-body" style="text-align:center">
            <div style="width:60px;height:60px;border-radius:50%;background:var(--card2);margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:24px">👤</div>
            <div class="fw-700">Rashmi Nishad</div>
            <div class="text-xs text-muted">Licensing Manager</div>
            <div class="text-xs" style="margin-top:8px">📞 +91 72978 97628</div>
            <div class="text-xs">✉ licensing@bainslamusic.com</div>
            <button class="btn btn-outline btn-sm" style="margin-top:12px">CONTACT MEMBER</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Licensing Requests Table -->
    <div class="panel" style="margin-top:20px">
      <div class="panel-header"><h2>RECENT LICENSING REQUESTS</h2></div>
      <div class="panel-body no-pad">
        <table class="data-table">
          <thead><tr><th>ID ↕</th><th>Client / Company</th><th>Content / Song</th><th>License Type</th><th>Usage</th><th>Territory</th><th>Status</th><th>Assigned To</th><th>Date</th><th>Action</th></tr></thead>
          <tbody>
            ${[
              ['LIC-2024-128','Saregama India Ltd.','Shyam Teri Bansi Pagal Kar...','Synchronization','Music Video','Worldwide','Under Review','Rashmi Nishad','12 May 2024'],
              ['LIC-2024-127','Zee Entertainment','Radha Rani Meri Hai','Broadcast','TV Program','India','In Discussion','DG Mawai','11 May 2024'],
              ['LIC-2024-126','Times Music','Hanuman Chalisa','Digital','YouTube','Worldwide','Approved','Ajeet Bainsla','10 May 2024'],
              ['LIC-2024-125','Sony Music India','Ram Naam Ki Mahima','Synchronization','Film','India','Approval Pending','Bhumika Sharma','09 May 2024'],
              ['LIC-2024-124','Spiritual TV','Shyam Teri Bansi Pagal Kar...','Broadcast','TV Channel','India','License Issued','Rashmi Nishad','08 May 2024']
            ].map(r => `<tr>
              <td class="text-amber">${r[0]}</td><td>${r[1]}</td><td class="text-xs">${r[2]}</td><td class="text-xs">${r[3]}</td><td class="text-xs">${r[4]}</td><td>${r[5]}</td>
              <td><span class="badge ${r[6]==='Approved'?'badge-green':r[6]==='Under Review'?'badge-blue':r[6]==='In Discussion'?'badge-amber':r[6]==='License Issued'?'badge-green':'badge-gray'}">${r[6]}</span></td>
              <td class="text-xs">${r[7]}</td><td class="text-xs">${r[8]}</td>
              <td><button class="action-btn">👁</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div class="stats-row cols-5" style="margin-top:20px">
      <div class="panel"><div class="panel-body" style="text-align:center"><div style="font-size:28px;margin-bottom:4px">©</div><div class="text-amber fw-700 text-sm">LICENSING & COPYRIGHT</div><div class="text-xs text-muted">For music licensing, copyright claims, YouTube CMS and other inquiries.</div></div></div>
      <div class="panel"><div class="panel-body"><div class="text-amber fw-700 text-sm mb-8">QUICK ACTIONS</div><div class="text-xs">› New Licensing Inquiry</div><div class="text-xs">› Copyright Claim</div><div class="text-xs">› Usage Permission</div></div></div>
      <div class="panel"><div class="panel-body"><div class="text-amber fw-700 text-sm mb-8">DOCUMENTS</div><div class="text-xs">License Agreements</div><div class="text-xs">Terms & Conditions</div><div class="text-xs">Pricing & Policy</div></div></div>
      <div class="panel"><div class="panel-body" style="text-align:center"><div class="text-amber fw-700 text-sm">REVENUE (YTD)</div><div class="fw-800" style="font-size:28px;margin:8px 0">₹18.75L</div><div class="text-xs text-green">+28% from last year</div></div></div>
      <div class="panel"><div class="panel-body" style="text-align:center"><div style="font-size:28px;margin-bottom:4px;color:var(--red)">📥</div><div class="text-amber fw-700 text-sm">EXPORT REPORT</div><div class="text-xs text-muted" style="margin:4px 0">Download licensing reports and analytics</div><button class="btn btn-primary btn-sm">EXPORT NOW</button></div></div>
    </div>`;
}

/* ═══════════════════════════════════════════════
   8. DISTRIBUTION (Reference Photo 2)
   ═══════════════════════════════════════════════ */
function renderDistribution(area) {
  area.innerHTML = `
    <!-- Stats -->
    <div class="stats-row cols-5">
      <div class="stat-card"><div class="stat-icon">🎵</div><div class="stat-label">TOTAL RELEASES DISTRIBUTED</div><div class="stat-number">128</div><div class="stat-change">+18 this month</div></div>
      <div class="stat-card"><div class="stat-icon">🌐</div><div class="stat-label">TOTAL PLATFORMS</div><div class="stat-number">12</div><div class="stat-change text-muted">Active Platforms</div></div>
      <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-label">TOTAL TRACKS DELIVERED</div><div class="stat-number">546</div><div class="stat-change">+72 this month</div></div>
      <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-label">SUCCESSFUL DELIVERIES</div><div class="stat-number">512</div><div class="stat-change">93.77% Success Rate</div></div>
      <div class="stat-card"><div class="stat-icon">⏳</div><div class="stat-label">PENDING DELIVERIES</div><div class="stat-number">34</div><div class="stat-change text-amber">In Progress</div></div>
    </div>

    <!-- Platform Status + Release Queue + Checklist -->
    <div class="grid-3-col">
      <!-- Platform Delivery Status -->
      <div class="panel">
        <div class="panel-header"><h2>PLATFORM DELIVERY STATUS</h2><button class="btn btn-outline btn-sm">View All Platforms</button></div>
        <div class="panel-body">
          ${[
            ['▶ YouTube','98%','128 / 131','badge-green','Delivered'],
            ['♪ Spotify','96%','125 / 131','badge-green','Delivered'],
            ['J JioSaavn','95%','124 / 131','badge-green','Delivered'],
            ['♫ Apple Music','93%','122 / 131','badge-green','Delivered'],
            ['A Amazon Music','90%','118 / 131','badge-amber','In Progress'],
            ['W Wynk Music','85%','117 / 131','badge-amber','In Progress'],
            ['H Hungama','85%','111 / 131','badge-amber','In Progress'],
            ['R Resso','82%','107 / 131','badge-amber','In Progress']
          ].map(([name, pct, count, badge, status]) => `
            <div class="delivery-item">
              <span style="font-size:16px;width:20px">${name.split(' ')[0]}</span>
              <span class="platform-name">${name.split(' ').slice(1).join(' ')}</span>
              <span class="delivery-pct">${pct}</span>
              <span class="delivery-count">${count}</span>
              <span class="badge ${badge}">${status}</span>
            </div>
          `).join('')}
          <div class="text-xs text-muted" style="margin-top:12px">+ 3 more platforms</div>
          <button class="btn btn-outline btn-sm" style="margin-top:8px">View All Platforms</button>
        </div>
      </div>

      <!-- Release Queue -->
      <div class="panel">
        <div class="panel-header"><h2>RELEASE QUEUE</h2><button class="btn btn-outline btn-sm">View Full Queue</button></div>
        <div class="panel-body">
          ${[
            ['Radha Rani Meri Hai','High Priority','badge-red','May 25, 2024'],
            ['Shyam Teri Bansi','Medium Priority','badge-amber','May 26, 2024'],
            ['Hanuman Chalisa (New Version)','Medium Priority','badge-amber','May 27, 2024'],
            ['Gurjar Rasiya 2024','Low Priority','badge-gray','May 28, 2024'],
            ['Ram Naam Mahima','Low Priority','badge-gray','May 30, 2024']
          ].map(([title, priority, badge, date]) => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
              <div style="width:40px;height:40px;background:var(--card2);border-radius:var(--radius-xs);display:flex;align-items:center;justify-content:center;font-size:16px">🎵</div>
              <div style="flex:1">
                <div class="text-sm fw-700">${title}</div>
                <div class="text-xs text-muted">Bainsla Music</div>
              </div>
              <span class="badge ${badge}">${priority}</span>
              <div class="text-xs text-muted">${date}</div>
              <button class="action-btn">⋮</button>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Upload Package Checklist -->
      <div class="panel">
        <div class="panel-header"><h2>UPLOAD PACKAGE CHECKLIST</h2></div>
        <div class="panel-body" style="text-align:center">
          <div class="progress-ring" style="margin-bottom:16px">
            <svg width="120" height="120"><circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" stroke-width="8"/><circle cx="60" cy="60" r="50" fill="none" stroke="var(--amber)" stroke-width="8" stroke-dasharray="314" stroke-dashoffset="63" stroke-linecap="round"/></svg>
            <div class="ring-text"><div class="ring-pct">80%</div><div class="ring-label">Overall Progress</div></div>
          </div>
          ${[['✅ Audio Files','15 / 15'],['✅ Artwork','15 / 15'],['⏳ Metadata','13 / 15'],['✅ ISRC Codes','15 / 15'],['✅ Permissions','10 / 15'],['✅ Release Notes','15 / 15']].map(([item, count]) => `
            <div class="checklist-item"><span class="check-icon">${item.split(' ')[0]}</span><span class="check-label">${item.split(' ').slice(1).join(' ')}</span><span class="check-count">${count}</span></div>
          `).join('')}
          <button class="btn btn-primary" style="margin-top:16px">Continue Setup →</button>
        </div>
      </div>
    </div>

    <!-- Bottom Row: Validation + Royalty + Top Earning -->
    <div class="grid-3-col" style="margin-top:20px">
      <!-- Metadata Validation -->
      <div class="panel">
        <div class="panel-header"><h2>METADATA VALIDATION</h2></div>
        <div class="panel-body" style="text-align:center">
          <div class="donut-chart" style="margin-bottom:16px">
            <svg width="140" height="140"><circle cx="70" cy="70" r="55" fill="none" stroke="var(--green)" stroke-width="12" stroke-dasharray="246 100" transform="rotate(-90 70 70)"/><circle cx="70" cy="70" r="55" fill="none" stroke="var(--amber)" stroke-width="12" stroke-dasharray="45 301" stroke-dashoffset="-246" transform="rotate(-90 70 70)"/><circle cx="70" cy="70" r="55" fill="none" stroke="var(--red)" stroke-width="12" stroke-dasharray="31 315" stroke-dashoffset="-291" transform="rotate(-90 70 70)"/></svg>
            <div class="donut-center"><div class="donut-number text-green">78%</div><div class="donut-label">Valid</div></div>
          </div>
          <div class="flex" style="justify-content:center;gap:16px">
            <div class="text-xs"><span class="text-green">●</span> Valid 102 (78%)</div>
            <div class="text-xs"><span class="text-amber">●</span> Warnings 17 (13%)</div>
            <div class="text-xs"><span class="text-red">●</span> Errors 12 (9%)</div>
          </div>
          <button class="btn btn-outline btn-sm" style="margin-top:12px">View Issues</button>
        </div>
      </div>

      <!-- Royalty Distribution Summary -->
      <div class="panel">
        <div class="panel-header"><h2>ROYALTY DISTRIBUTION SUMMARY</h2></div>
        <div class="panel-body">
          <div class="grid-2" style="margin-bottom:16px">
            <div style="text-align:center"><div class="text-xs text-muted">Total Earnings</div><div class="fw-800 text-amber" style="font-size:22px">₹2,48,750</div><div class="text-xs text-green">+22.5% vs last month</div></div>
            <div style="text-align:center"><div class="text-xs text-muted">Total Payouts</div><div class="fw-800" style="font-size:22px">₹2,15,600</div><div class="text-xs text-green">+18.7% vs last month</div></div>
          </div>
          <div class="grid-2">
            <div style="text-align:center;padding:12px;background:var(--card2);border-radius:var(--radius-xs)"><div class="text-xs text-muted">Pending Payouts</div><div class="fw-700" style="font-size:18px">₹33,150</div></div>
            <div style="text-align:center;padding:12px;background:var(--card2);border-radius:var(--radius-xs)"><div class="text-xs text-muted">Next Payout Date</div><div class="fw-700" style="font-size:18px">Jun 07, 2024</div></div>
          </div>
        </div>
      </div>

      <!-- Top Earning Platforms -->
      <div class="panel">
        <div class="panel-header"><h2>TOP EARNING PLATFORMS</h2></div>
        <div class="panel-body">
          ${[['▶ YouTube','₹98,750','39.7%'],['♪ Spotify','₹67,540','27.1%'],['J JioSaavn','₹38,850','15.6%'],['♫ Apple Music','₹22,680','9.1%'],['A Amazon Music','₹10,930','4.4%']].map(([name, amount, pct]) => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:14px">${name.split(' ')[0]}</span>
              <span class="text-sm" style="flex:1">${name.split(' ').slice(1).join(' ')}</span>
              <span class="text-amber fw-700">${amount}</span>
              <span class="text-xs text-muted">${pct}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Distribution History -->
    <div class="panel" style="margin-top:20px">
      <div class="panel-header">
        <h2>DISTRIBUTION HISTORY</h2>
        <div class="panel-actions">
          <input type="text" class="search-input" placeholder="Search releases..." style="width:200px">
          <select class="filter-select"><option>All Platforms</option></select>
          <select class="filter-select"><option>All Status</option></select>
          <button class="btn btn-outline btn-sm">📥 Export</button>
        </div>
      </div>
      <div class="panel-body no-pad">
        <table class="data-table">
          <thead><tr><th>#</th><th>RELEASE TITLE</th><th>ARTIST</th><th>PLATFORMS</th><th>RELEASE DATE</th><th>STATUS</th><th>DELIVERY %</th><th>EARNINGS</th><th>ACTIONS</th></tr></thead>
          <tbody>
            ${[
              ['1','Shyam Teri Bansi','Bainsla Music','May 20, 2024','Delivered','100%','₹48,750'],
              ['2','Radha Rani Meri Hai','Bainsla Music','May 18, 2024','Delivered','100%','₹37,620'],
              ['3','Hanuman Chalisa','Bainsla Music','May 15, 2024','Delivered','100%','₹28,450'],
              ['4','Ram Naam Ki Mahima','Bainsla Music','May 10, 2024','Partially Delivered','85%','₹18,780'],
              ['5','Gurjar Rasiya 2024','Bainsla Music','May 05, 2024','In Progress','60%','₹12,340']
            ].map(r => `<tr>
              <td>${r[0]}</td><td class="fw-700">${r[1]}</td><td>${r[2]}</td>
              <td>${platformIcons()}</td>
              <td class="text-xs">${r[3]}</td>
              <td><span class="badge ${r[4]==='Delivered'?'badge-green':r[4]==='In Progress'?'badge-blue':'badge-amber'}">${r[4]}</span></td>
              <td><div class="delivery-bar" style="width:80px"><div class="delivery-bar-fill" style="width:${r[5]}"></div></div><span class="text-xs text-muted">${r[5]}</span></td>
              <td class="text-amber fw-700">${r[6]}</td>
              <td class="actions"><button class="action-btn">👁</button><button class="action-btn">📥</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div class="pagination">
          <span>Showing 1 to 5 of 128 entries</span>
          <button class="page-btn">‹</button>
          <button class="page-btn active">1</button>
          <button class="page-btn">2</button>
          <button class="page-btn">3</button>
          <span>...</span>
          <button class="page-btn">26</button>
          <button class="page-btn">›</button>
        </div>
      </div>
    </div>`;
}

/* ═══════════════════════════════════════════════
   9. INQUIRIES
   ═══════════════════════════════════════════════ */
function renderInquiries(area) {
  const inquiries = DATA.inquiries || [];
  area.innerHTML = `
    <div class="search-bar">
      <input type="text" class="search-input" placeholder="Search inquiries...">
      <select class="filter-select"><option>All Types</option><option>Licensing</option><option>Distribution</option><option>Copyright</option><option>General</option><option>Collaboration</option></select>
      <select class="filter-select"><option>All Status</option><option>New</option><option>Read</option><option>Replied</option></select>
    </div>
    <div class="panel">
      <div class="panel-header">
        <h2>📩 All Inquiries (${inquiries.length})</h2>
      </div>
      <div class="panel-body no-pad">
        ${inquiries.length === 0 ? '<div class="empty-state"><p>No inquiries yet.</p></div>' : `
        <table class="data-table">
          <thead><tr><th>#</th><th>NAME</th><th>EMAIL</th><th>PHONE</th><th>TYPE</th><th>MESSAGE</th><th>DATE</th><th>ACTIONS</th></tr></thead>
          <tbody>
            ${inquiries.map((inq, i) => `<tr>
              <td>${i + 1}</td>
              <td class="fw-700">${inq.name || 'Anonymous'}</td>
              <td class="text-xs">${inq.email || '-'}</td>
              <td class="text-xs">${inq.phone || '-'}</td>
              <td><span class="badge badge-amber">${inq.type || 'General'}</span></td>
              <td class="text-xs" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${inq.message || '-'}</td>
              <td class="text-xs">${inq.created_at || '-'}</td>
              <td class="actions">
                <button class="action-btn" title="View">👁</button>
                <button class="action-btn danger del-inquiry" data-id="${inq.id}" title="Delete">🗑</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`}
      </div>
    </div>`;
  area.querySelectorAll('.del-inquiry').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm('Delete this inquiry?')) return;
      await api('DELETE', 'inquiries', null, b.dataset.id);
      toast('Inquiry deleted');
      await loadData();
      showSection('inquiries');
    });
  });
}

/* ═══════════════════════════════════════════════
   10. ANALYTICS (Reference Photo 1)
   ═══════════════════════════════════════════════ */
function renderAnalytics(area) {
  area.innerHTML = `
    <div class="flex-between mb-20">
      <div></div>
      <div class="panel-actions">
        <span class="text-sm text-muted">May 18 – Jun 14, 2024</span>
        <button class="btn btn-secondary btn-sm">📅</button>
        <button class="btn btn-secondary btn-sm">📥</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-row cols-6">
      <div class="stat-card"><div class="stat-icon">👁</div><div class="stat-label">Total Views</div><div class="stat-number">12.84M</div><div class="stat-change">↑ 18.6%</div></div>
      <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-label">Subscribers</div><div class="stat-number">256K</div><div class="stat-change">↑ 14.2%</div></div>
      <div class="stat-card"><div class="stat-icon">⏱</div><div class="stat-label">Watch Time (Hours)</div><div class="stat-number">1.92M</div><div class="stat-change">↑ 22.7%</div></div>
      <div class="stat-card"><div class="stat-icon">🎵</div><div class="stat-label">Total Releases</div><div class="stat-number">48</div><div class="stat-change">↑ 9.1%</div></div>
      <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-label">Engagement Rate</div><div class="stat-number">6.74%</div><div class="stat-change">↑ 8.3%</div></div>
      <div class="stat-card"><div class="stat-icon">₹</div><div class="stat-label">Total Revenue</div><div class="stat-number">₹18.7L</div><div class="stat-change">↑ 16.5%</div></div>
    </div>

    <!-- Charts Row -->
    <div class="grid-3-col">
      <div class="panel">
        <div class="panel-header"><h2>▶ YouTube Views</h2><div class="panel-actions"><span class="text-amber fw-800" style="font-size:22px">8.65M</span><span class="text-xs text-green">↑ 17.4%</span></div></div>
        <div class="panel-body"><div class="chart-area" style="height:180px">${randomChartBars(30, 160)}</div></div>
      </div>
      <div class="panel">
        <div class="panel-header"><h2>Subscribers Growth</h2><div class="panel-actions"><span class="text-amber fw-800" style="font-size:22px">256K</span><span class="text-xs text-green">↑ 14.2%</span></div></div>
        <div class="panel-body"><div class="chart-area" style="height:180px">${randomChartBars(30, 160)}</div></div>
      </div>
      <div class="panel">
        <div class="panel-header"><h2>Watch Time (Hours)</h2><div class="panel-actions"><span class="text-amber fw-800" style="font-size:22px">1.92M</span><span class="text-xs text-green">↑ 22.7%</span></div></div>
        <div class="panel-body"><div class="chart-area" style="height:180px">${randomChartBars(30, 160)}</div></div>
      </div>
    </div>

    <!-- Top Songs + Top Videos + Growth + Category -->
    <div class="stats-row cols-4" style="margin-top:20px">
      <!-- Top Songs -->
      <div class="panel">
        <div class="panel-header"><h2>🎵 Top Performing Songs</h2><a href="#" class="text-xs">VIEW ALL</a></div>
        <div class="panel-body">
          ${['Shyam Teri Bansi Pagaal Kar Jaati Hai|1.24M','Radha Rani Meri Hai|1.08M','Hanuman Chalisa|985K','Ram Naam Ki Mahima|842K','Gurjar Rasiya|764K'].map((s, i) => {
            const [name, views] = s.split('|');
            return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
              <span class="text-amber fw-700" style="width:16px">${i+1}</span>
              <div style="width:35px;height:35px;background:var(--card2);border-radius:4px;flex-shrink:0"></div>
              <div style="flex:1"><div class="text-xs fw-700">${name}</div><div class="text-xs text-muted">Bainsla Music</div></div>
              <span class="text-amber fw-700 text-sm">${views}</span>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Top Videos -->
      <div class="panel">
        <div class="panel-header"><h2>▶ Top Videos</h2><a href="#" class="text-xs">VIEW ALL</a></div>
        <div class="panel-body">
          ${['Shyam Teri Bansi Pagaal Kar Jaati Hai|2.45M','Radha Rani Meri Hai|2.12M','Hanuman Chalisa|1.78M','Ram Naam Ki Mahima|1.45M','DJ Rasiya 2024|1.10M'].map((s, i) => {
            const [name, views] = s.split('|');
            return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
              <span class="text-amber fw-700" style="width:16px">${i+1}</span>
              <div style="width:35px;height:35px;background:var(--card2);border-radius:4px;flex-shrink:0"></div>
              <div style="flex:1"><div class="text-xs fw-700">${name}</div><div class="text-xs text-muted">Bainsla Music</div></div>
              <span class="text-amber fw-700 text-sm">${views}</span>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Recent Growth -->
      <div class="panel">
        <div class="panel-header"><h2>Recent Growth</h2><select class="filter-select" style="width:auto"><option>Last 7 Days</option></select></div>
        <div class="panel-body"><div class="chart-area" style="height:200px">${randomChartBars(14, 180)}</div></div>
      </div>

      <!-- Releases by Category -->
      <div class="panel">
        <div class="panel-header"><h2>Releases by Category</h2><a href="#" class="text-xs">VIEW ALL</a></div>
        <div class="panel-body" style="text-align:center">
          <div class="donut-chart" style="margin-bottom:16px">
            <svg width="140" height="140"><circle cx="70" cy="70" r="55" fill="none" stroke="var(--amber)" stroke-width="14" stroke-dasharray="144 202" transform="rotate(-90 70 70)"/><circle cx="70" cy="70" r="55" fill="none" stroke="var(--amber-dark)" stroke-width="14" stroke-dasharray="101 245" stroke-dashoffset="-144" transform="rotate(-90 70 70)"/><circle cx="70" cy="70" r="55" fill="none" stroke="#92400e" stroke-width="14" stroke-dasharray="58 288" stroke-dashoffset="-245" transform="rotate(-90 70 70)"/></svg>
            <div class="donut-center"><div class="donut-number">48</div><div class="donut-label">Total</div></div>
          </div>
          ${['Devotional|41.7%','Rasiya|29.2%','Bhajan|16.7%','Folk|8.3%','Others|4.1%'].map(s => {
            const [name, pct] = s.split('|');
            return `<div class="flex-between text-xs" style="padding:3px 0"><span>${name}</span><span class="text-amber">${pct}</span></div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Platform Performance + Audience + Locations -->
    <div class="grid-3-col" style="margin-top:20px">
      <div class="panel">
        <div class="panel-header"><h2>Platform-wise Performance</h2></div>
        <div class="panel-body">
          ${[['▶ YouTube','8.65M'],['f Facebook','1.45M'],['📷 Instagram','1.12M'],['♪ Spotify','620K'],['J JioSaavn','480K'],['♫ Apple Music','310K']].map(([name, views]) => `
            <div style="display:flex;align-items:center;gap:10px;padding:6px 0">
              <span style="width:80px" class="text-xs">${name}</span>
              <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden"><div style="height:100%;background:var(--amber);width:${parseInt(views)*100/8650}%;border-radius:4px"></div></div>
              <span class="text-xs text-amber fw-700">${views}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><h2>Audience Sources</h2></div>
        <div class="panel-body" style="text-align:center">
          <div class="donut-chart" style="margin-bottom:12px">
            <svg width="140" height="140"><circle cx="70" cy="70" r="55" fill="none" stroke="var(--amber)" stroke-width="14" stroke-dasharray="167 179" transform="rotate(-90 70 70)"/><circle cx="70" cy="70" r="55" fill="none" stroke="var(--amber-dark)" stroke-width="14" stroke-dasharray="78 268" stroke-dashoffset="-167" transform="rotate(-90 70 70)"/></svg>
            <div class="donut-center"><div class="donut-number text-amber">12.84M</div><div class="donut-label">Total Views</div></div>
          </div>
          ${['YouTube Search|48.2%','Browse Features|22.6%','Suggested Videos|15.3%','External|7.8%','Others|6.1%'].map(s => {
            const [name, pct] = s.split('|');
            return `<div class="flex-between text-xs" style="padding:3px 0"><span>${name}</span><span class="text-amber">${pct}</span></div>`;
          }).join('')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><h2>Top Locations</h2></div>
        <div class="panel-body">
          <div class="map-placeholder mb-16">🗺 World Map</div>
          ${[['🇮🇳 India','78.6%'],['🇺🇸 United States','6.4%'],['🇳🇵 Nepal','3.2%'],['🇦🇪 United Arab Emirates','2.1%'],['🇬🇧 United Kingdom','1.7%'],['🌍 Others','8.0%']].map(([loc, pct]) => `
            <div style="display:flex;align-items:center;gap:10px;padding:5px 0">
              <span class="text-xs" style="flex:1">${loc}</span>
              <div style="width:80px;height:6px;background:var(--border);border-radius:3px;overflow:hidden"><div style="height:100%;background:var(--amber);width:${parseFloat(pct)}%;border-radius:3px"></div></div>
              <span class="text-xs text-amber">${pct}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Export Actions -->
    <div class="stats-row cols-4" style="margin-top:20px">
      <div class="panel"><div class="panel-body" style="text-align:center"><div style="font-size:28px;margin-bottom:4px">📊</div><div class="text-amber fw-700 text-sm">EXPORT REPORTS</div><div class="text-xs text-muted">Download detailed analytics reports</div><button class="btn btn-primary btn-sm" style="margin-top:8px">EXPORT NOW</button></div></div>
      <div class="panel"><div class="panel-body" style="text-align:center"><div style="font-size:28px;margin-bottom:4px">📅</div><div class="text-amber fw-700 text-sm">CUSTOM RANGE</div><div class="text-xs text-muted">Analyze custom date ranges</div><button class="btn btn-outline btn-sm" style="margin-top:8px">SELECT DATES</button></div></div>
      <div class="panel"><div class="panel-body" style="text-align:center"><div style="font-size:28px;margin-bottom:4px">⚡</div><div class="text-amber fw-700 text-sm">COMPARE METRICS</div><div class="text-xs text-muted">Compare performance metrics</div><button class="btn btn-outline btn-sm" style="margin-top:8px">COMPARE NOW</button></div></div>
      <div class="panel"><div class="panel-body" style="text-align:center"><div style="font-size:28px;margin-bottom:4px">📈</div><div class="text-amber fw-700 text-sm">TRACK GROWTH</div><div class="text-xs text-muted">Monitor your channel growth</div><button class="btn btn-outline btn-sm" style="margin-top:8px">VIEW GROWTH</button></div></div>
    </div>`;
}

/* ═══════════════════════════════════════════════
   11. SETTINGS
   ═══════════════════════════════════════════════ */
function renderSettings(area) {
  const s = DATA.settings || {};
  area.innerHTML = `
    <form id="settingsForm">
      <div class="grid-2" style="margin-bottom:20px">
        <div class="panel">
          <div class="panel-header"><h2>Company Info</h2></div>
          <div class="panel-body">
            ${field('Company Name', 'company_name', s.company_name)}
            ${field('Tagline', 'tagline', s.tagline)}
            ${textareaField('Short Description', 'description', s.description, 'Enter company description...')}
            ${textareaField('About Text', 'about_text', s.about_text, 'Detailed about text...')}
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><h2>Contact Details</h2></div>
          <div class="panel-body">
            ${field('Phone', 'phone', s.phone, 'tel')}
            ${field('Email', 'email', s.email, 'email')}
            ${field('Support Email', 'support_email', s.support_email, 'email')}
            ${field('WhatsApp (without +)', 'whatsapp', s.whatsapp)}
            ${textareaField('Address', 'address', s.address, 'Enter address...')}
          </div>
        </div>
      </div>
      <div class="grid-2" style="margin-bottom:20px">
        <div class="panel">
          <div class="panel-header"><h2>Social Media Links</h2></div>
          <div class="panel-body">
            ${field('YouTube URL', 'youtube_url', s.youtube_url, 'url')}
            ${field('Instagram URL', 'instagram_url', s.instagram_url, 'url')}
            ${field('Facebook URL', 'facebook_url', s.facebook_url, 'url')}
            ${field('Spotify URL', 'spotify_url', s.spotify_url, 'url')}
            ${field('Twitter / X URL', 'twitter_url', s.twitter_url || '', 'url')}
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><h2>Display Stats (shown on website)</h2></div>
          <div class="panel-body">
            <div class="form-row">
              ${field('Songs Count', 'stats_songs', s.stats_songs)}
              ${field('Artists Count', 'stats_artists', s.stats_artists)}
            </div>
            <div class="form-row">
              ${field('Videos Count', 'stats_videos', s.stats_videos)}
              ${field('Views Count', 'stats_views', s.stats_views)}
            </div>
          </div>
        </div>
      </div>
      <div class="grid-2" style="margin-bottom:20px">
        <div class="panel">
          <div class="panel-header"><h2>Google Maps Location</h2></div>
          <div class="panel-body">
            ${field('Google Maps Embed URL', 'google_maps_url', s.google_maps_url || '', 'url')}
            <div class="text-xs text-muted" style="margin-top:-8px;margin-bottom:12px">Go to Google Maps \u2192 Share \u2192 Embed a map \u2192 Copy the src URL from the iframe code.</div>
            ${s.google_maps_url ? `<div style="border-radius:8px;overflow:hidden;margin-top:8px"><iframe src="${s.google_maps_url}" width="100%" height="200" style="border:0" allowfullscreen loading="lazy"></iframe></div>` : '<div style="color:#666;font-size:12px;text-align:center;padding:20px;border:1px dashed #333;border-radius:8px">No map location set. Add Google Maps embed URL above.</div>'}
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><h2>Website Embed Code</h2></div>
          <div class="panel-body">
            <div class="text-xs text-muted" style="margin-bottom:8px">The Google Maps location will automatically show on the Contact section of the website.</div>
            <div class="text-xs text-muted">Social media links (YouTube, Instagram, Facebook) will show on the website footer and floating icons.</div>
          </div>
        </div>
      </div>
      <div style="text-align:right">
        <button type="submit" class="btn btn-primary btn-lg">Save Settings</button>
      </div>
    </form>`;

  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const obj = Object.fromEntries(fd.entries());
    await api('POST', 'settings', obj);
    toast('Settings saved');
    await loadData();
  });
}

/* ═══════════════════════════════════════════════
   12. DIRECTORS & TEAM
   ═══════════════════════════════════════════════ */
function renderDirectors(area) {
  const directors = DATA.directors || [];
  const team = DATA.team || [];

  function personCard(d, type) {
    var cls = type === 'director' ? 'edit-director-btn' : 'edit-team-btn';
    var delCls = type === 'director' ? 'delete-director-btn' : 'delete-team-btn';
    return `<div class="artist-card" style="position:relative">
      <div style="position:absolute;top:8px;right:8px;display:flex;gap:4px;z-index:2">
        <button class="btn btn-outline btn-sm ${cls}" data-id="${d.id}" style="padding:4px 8px;font-size:10px">✏ Edit</button>
        <button class="btn btn-outline btn-sm ${delCls}" data-id="${d.id}" style="padding:4px 8px;font-size:10px;border-color:#ef4444;color:#ef4444">✕ Delete</button>
      </div>
      ${d.image ? `<img src="${d.image}" class="artist-img" alt="${d.name}">` : '<div class="artist-img" style="background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:32px">👤</div>'}
      <div class="artist-name">${d.name || ''}</div>
      <div class="artist-role">${d.role || ''}</div>
      <div style="font-size:11px;color:#888;margin-top:6px;padding:0 12px">${d.description || ''}</div>
      <div class="artist-contact" style="font-size:11px;color:#999;padding:0 12px;margin-top:4px">
        ${d.email ? `<div>✉ ${d.email}</div>` : ''}
        ${d.phone ? `<div>📞 ${d.phone}</div>` : ''}
        ${d.address ? `<div>📍 ${d.address}</div>` : ''}
      </div>
      <div class="artist-social" style="margin-top:8px">
        ${d.youtube_url ? `<a href="${d.youtube_url}" target="_blank" class="platform-icon pi-yt">▶</a>` : ''}
        ${d.instagram_url ? `<a href="${d.instagram_url}" target="_blank" class="platform-icon" style="background:#e1306c">📷</a>` : ''}
        ${d.facebook_url ? `<a href="${d.facebook_url}" target="_blank" class="platform-icon" style="background:#1877f2">f</a>` : ''}
        ${d.linkedin_url ? `<a href="${d.linkedin_url}" target="_blank" class="platform-icon" style="background:#0077b5">in</a>` : ''}
      </div>
    </div>`;
  }

  area.innerHTML = `
    <div class="grid-2" style="margin-bottom:20px">
      <div class="panel" style="grid-column:1/-1">
        <div class="panel-header"><h2>Company Directors & Leadership</h2><button class="btn btn-primary btn-sm" id="addDirectorBtn">+ Add Director</button></div>
        <div class="panel-body">
          <div class="grid-3">
            ${directors.map(d => personCard(d, 'director')).join('')}
          </div>
          ${directors.length === 0 ? '<p style="color:#666;text-align:center;padding:40px">No directors added yet. Click "+ Add Director" to add your first director.</p>' : ''}
        </div>
      </div>
    </div>
    <div class="grid-2" style="margin-bottom:20px">
      <div class="panel" style="grid-column:1/-1">
        <div class="panel-header"><h2>Team Members</h2><button class="btn btn-primary btn-sm" id="addTeamBtn">+ Add Team Member</button></div>
        <div class="panel-body">
          <div class="grid-3">
            ${team.map(t => personCard(t, 'team')).join('')}
          </div>
          ${team.length === 0 ? '<p style="color:#666;text-align:center;padding:40px">No team members added yet. Click "+ Add Team Member" to add your first team member.</p>' : ''}
        </div>
      </div>
    </div>`;

  // Add Director
  document.getElementById('addDirectorBtn').addEventListener('click', () => {
    showModal('Add Director', `<form>
      ${imageUploadField('Director Photo', 'image', '', 'artists')}
      ${field('Full Name', 'name', '', 'text', true)}
      ${field('Designation / Role', 'role', '', 'text', true)}
      ${textareaField('Bio / Description', 'description', '', 'Write a short bio...')}
      ${field('Phone', 'phone', '', 'tel')}
      ${field('Email', 'email', '', 'email')}
      ${field('Address', 'address', '')}
      <div class="form-group"><label style="color:#f59e0b;font-weight:700">Social Media Links</label></div>
      ${field('YouTube URL', 'youtube_url', '', 'url')}
      ${field('Instagram URL', 'instagram_url', '', 'url')}
      ${field('Facebook URL', 'facebook_url', '', 'url')}
      ${field('LinkedIn URL', 'linkedin_url', '', 'url')}
      ${formActions()}
    </form>`, async (obj) => {
      await api('POST', 'directors', obj);
      toast('Director added');
      await loadData();
      showSection('directors');
    });
  });

  // Edit Director
  document.querySelectorAll('.edit-director-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const d = (DATA.directors || []).find(x => x.id === id);
      if (!d) return;
      showModal('Edit Director', `<form>
        ${imageUploadField('Director Photo', 'image', d.image || '', 'artists')}
        ${field('Full Name', 'name', d.name, 'text', true)}
        ${field('Designation / Role', 'role', d.role, 'text', true)}
        ${textareaField('Bio / Description', 'description', d.description || '', 'Write a short bio...')}
        ${field('Phone', 'phone', d.phone || '', 'tel')}
        ${field('Email', 'email', d.email || '', 'email')}
        ${field('Address', 'address', d.address || '')}
        <div class="form-group"><label style="color:#f59e0b;font-weight:700">Social Media Links</label></div>
        ${field('YouTube URL', 'youtube_url', d.youtube_url || '', 'url')}
        ${field('Instagram URL', 'instagram_url', d.instagram_url || '', 'url')}
        ${field('Facebook URL', 'facebook_url', d.facebook_url || '', 'url')}
        ${field('LinkedIn URL', 'linkedin_url', d.linkedin_url || '', 'url')}
        ${formActions()}
      </form>`, async (obj) => {
        await api('PUT', 'directors', obj, id);
        toast('Director updated');
        await loadData();
        showSection('directors');
      });
    });
  });

  // Delete Director
  document.querySelectorAll('.delete-director-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete this director?')) return;
      await api('DELETE', 'directors', null, btn.dataset.id);
      toast('Director deleted', 'error');
      await loadData();
      showSection('directors');
    });
  });

  // Add Team Member
  document.getElementById('addTeamBtn').addEventListener('click', () => {
    showModal('Add Team Member', `<form>
      ${imageUploadField('Photo', 'image', '', 'artists')}
      ${field('Full Name', 'name', '', 'text', true)}
      ${field('Designation / Role', 'role', '', 'text', true)}
      ${textareaField('Bio / Description', 'description', '', 'Write a short bio...')}
      ${field('Phone', 'phone', '', 'tel')}
      ${field('Email', 'email', '', 'email')}
      ${field('Address', 'address', '')}
      <div class="form-group"><label style="color:#f59e0b;font-weight:700">Social Media Links</label></div>
      ${field('YouTube URL', 'youtube_url', '', 'url')}
      ${field('Instagram URL', 'instagram_url', '', 'url')}
      ${field('Facebook URL', 'facebook_url', '', 'url')}
      ${field('LinkedIn URL', 'linkedin_url', '', 'url')}
      ${formActions()}
    </form>`, async (obj) => {
      await api('POST', 'team', obj);
      toast('Team member added');
      await loadData();
      showSection('directors');
    });
  });

  // Edit Team Member
  document.querySelectorAll('.edit-team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const t = (DATA.team || []).find(x => x.id === id);
      if (!t) return;
      showModal('Edit Team Member', `<form>
        ${imageUploadField('Photo', 'image', t.image || '', 'artists')}
        ${field('Full Name', 'name', t.name, 'text', true)}
        ${field('Designation / Role', 'role', t.role, 'text', true)}
        ${textareaField('Bio / Description', 'description', t.description || '', 'Write a short bio...')}
        ${field('Phone', 'phone', t.phone || '', 'tel')}
        ${field('Email', 'email', t.email || '', 'email')}
        ${field('Address', 'address', t.address || '')}
        <div class="form-group"><label style="color:#f59e0b;font-weight:700">Social Media Links</label></div>
        ${field('YouTube URL', 'youtube_url', t.youtube_url || '', 'url')}
        ${field('Instagram URL', 'instagram_url', t.instagram_url || '', 'url')}
        ${field('Facebook URL', 'facebook_url', t.facebook_url || '', 'url')}
        ${field('LinkedIn URL', 'linkedin_url', t.linkedin_url || '', 'url')}
        ${formActions()}
      </form>`, async (obj) => {
        await api('PUT', 'team', obj, id);
        toast('Team member updated');
        await loadData();
        showSection('directors');
      });
    });
  });

  // Delete Team Member
  document.querySelectorAll('.delete-team-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete this team member?')) return;
      await api('DELETE', 'team', null, btn.dataset.id);
      toast('Team member deleted', 'error');
      await loadData();
      showSection('directors');
    });
  });
}
