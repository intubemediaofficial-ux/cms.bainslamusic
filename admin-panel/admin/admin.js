const API_BASE = '../api';
let currentSection = 'dashboard';
let siteData = {};

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    try {
        const res = await fetch(`${API_BASE}/login.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('login-page').style.display = 'none';
            document.getElementById('admin-panel').style.display = 'flex';
            loadDashboard();
        } else {
            document.getElementById('login-error').textContent = 'Invalid username or password';
        }
    } catch (err) {
        document.getElementById('login-error').textContent = 'Connection error';
    }
});

// Check session
async function checkSession() {
    try {
        const res = await fetch(`${API_BASE}/login.php`);
        const data = await res.json();
        if (data.logged_in) {
            document.getElementById('login-page').style.display = 'none';
            document.getElementById('admin-panel').style.display = 'flex';
            loadDashboard();
        }
    } catch (e) {}
}
checkSession();

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch(`${API_BASE}/logout.php`);
    location.reload();
});

// Navigation
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-menu a').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        currentSection = link.dataset.section;
        document.getElementById('page-title').textContent = link.textContent.trim();
        loadSection(currentSection);
    });
});

// Menu toggle (mobile)
document.getElementById('menu-toggle').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('open');
});

// Load all data
async function loadData() {
    const res = await fetch(`${API_BASE}/data.php`);
    siteData = await res.json();
    return siteData;
}

// Load dashboard
async function loadDashboard() {
    await loadData();
    loadSection('dashboard');
}

// Load section
function loadSection(section) {
    const area = document.getElementById('content-area');
    switch(section) {
        case 'dashboard': renderDashboard(area); break;
        case 'hero_slides': renderTable(area, 'hero_slides', ['video_id', 'title', 'active'], 'Hero Slides'); break;
        case 'videos': renderTable(area, 'videos', ['video_id', 'title', 'artist', 'views'], 'Videos'); break;
        case 'services': renderTable(area, 'services', ['title', 'description'], 'Services'); break;
        case 'channels': renderTable(area, 'channels', ['name', 'subscribers', 'url'], 'Partner Channels'); break;
        case 'directors': renderTable(area, 'directors', ['name', 'role', 'description'], 'Directors'); break;
        case 'testimonials': renderTable(area, 'testimonials', ['name', 'role', 'quote'], 'Testimonials'); break;
        case 'stats': renderStats(area); break;
        case 'settings': renderSettings(area); break;
    }
}

// Dashboard
function renderDashboard(area) {
    const s = siteData;
    area.innerHTML = `
        <div class="dashboard-grid">
            <div class="stat-card"><div class="number">${s.hero_slides?.length || 0}</div><div class="label">Hero Slides</div></div>
            <div class="stat-card"><div class="number">${s.videos?.length || 0}</div><div class="label">Videos</div></div>
            <div class="stat-card"><div class="number">${s.services?.length || 0}</div><div class="label">Services</div></div>
            <div class="stat-card"><div class="number">${s.channels?.length || 0}</div><div class="label">Channels</div></div>
            <div class="stat-card"><div class="number">${s.directors?.length || 0}</div><div class="label">Directors</div></div>
            <div class="stat-card"><div class="number">${s.testimonials?.length || 0}</div><div class="label">Testimonials</div></div>
        </div>
        <div class="stat-card" style="margin-top:16px">
            <h3 style="color:#f59e0b;margin-bottom:10px">Quick Info</h3>
            <p>Company: ${s.settings?.company_name || 'N/A'}</p>
            <p>Phone: ${s.settings?.phone || 'N/A'}</p>
            <p>Email: ${s.settings?.email || 'N/A'}</p>
            <p style="margin-top:10px;color:#888">Stats: ${s.stats?.years}+ Years | ${s.stats?.videos}+ Videos | ${s.stats?.artists}+ Artists | ${s.stats?.views}M+ Views</p>
        </div>`;
}

// Render Table
function renderTable(area, key, columns, title) {
    const items = siteData[key] || [];
    let tableRows = items.map(item => {
        let cells = columns.map(col => {
            if (col === 'video_id') return `<td><img class="thumbnail" src="https://img.youtube.com/vi/${item[col]}/hqdefault.jpg" alt=""></td>`;
            if (col === 'active') return `<td>${item[col] ? '✓ Active' : '✗ Inactive'}</td>`;
            if (col === 'url') return `<td><a href="${item[col]}" target="_blank" style="color:#f59e0b">${item[col]?.substring(0,30)}...</a></td>`;
            let val = item[col] || '';
            return `<td>${val.length > 50 ? val.substring(0,50) + '...' : val}</td>`;
        }).join('');
        return `<tr>${cells}<td class="actions">
            <button class="btn btn-primary btn-sm" onclick="editItem('${key}', ${item.id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteItem('${key}', ${item.id})">Delete</button>
        </td></tr>`;
    }).join('');

    let headers = columns.map(c => `<th>${c.replace('_',' ')}</th>`).join('') + '<th>Actions</th>';
    area.innerHTML = `
        <div class="section-header">
            <h3>${title} (${items.length})</h3>
            <button class="btn btn-success" onclick="addItem('${key}')">+ Add New</button>
        </div>
        <table class="data-table">
            <thead><tr>${headers}</tr></thead>
            <tbody>${tableRows || '<tr><td colspan="99" style="text-align:center;padding:30px;color:#888">No items yet. Click "Add New" to create one.</td></tr>'}</tbody>
        </table>`;
}

// Get fields for each section
function getFields(key) {
    switch(key) {
        case 'hero_slides': return [
            { name: 'video_id', label: 'YouTube Video ID', type: 'text', placeholder: 'e.g. mu8M7Nk8ywU' },
            { name: 'title', label: 'Title', type: 'text' },
            { name: 'subtitle', label: 'Subtitle', type: 'text' },
            { name: 'active', label: 'Active', type: 'select', options: [{ v: true, l: 'Active' }, { v: false, l: 'Inactive' }] }
        ];
        case 'videos': return [
            { name: 'video_id', label: 'YouTube Video ID', type: 'text', placeholder: 'e.g. mu8M7Nk8ywU (from URL)' },
            { name: 'title', label: 'Video Title', type: 'text' },
            { name: 'artist', label: 'Artist Name', type: 'text' },
            { name: 'views', label: 'Views (e.g. 20M+)', type: 'text' }
        ];
        case 'services': return [
            { name: 'icon', label: 'Icon Type', type: 'select', options: [
                {v:'youtube',l:'YouTube'},{v:'promotion',l:'Promotion'},{v:'distribution',l:'Distribution'},
                {v:'social',l:'Social Media'},{v:'callertune',l:'Caller Tune'},{v:'production',l:'Production'}
            ]},
            { name: 'title', label: 'Service Title', type: 'text' },
            { name: 'description', label: 'Description', type: 'textarea' }
        ];
        case 'channels': return [
            { name: 'name', label: 'Channel Name', type: 'text' },
            { name: 'url', label: 'YouTube Channel URL', type: 'text' },
            { name: 'subscribers', label: 'Subscribers (e.g. 1.51M)', type: 'text' }
        ];
        case 'directors': return [
            { name: 'name', label: 'Full Name', type: 'text' },
            { name: 'initials', label: 'Initials (e.g. AB)', type: 'text' },
            { name: 'role', label: 'Role', type: 'text' },
            { name: 'description', label: 'Description', type: 'textarea' }
        ];
        case 'testimonials': return [
            { name: 'name', label: 'Person Name', type: 'text' },
            { name: 'initials', label: 'Initials (e.g. R)', type: 'text' },
            { name: 'role', label: 'Role/Title', type: 'text' },
            { name: 'quote', label: 'Testimonial Text', type: 'textarea' },
            { name: 'rating', label: 'Rating (1-5)', type: 'number' }
        ];
        default: return [];
    }
}

// Add item
function addItem(key) {
    const fields = getFields(key);
    let formHtml = fields.map(f => {
        if (f.type === 'textarea') return `<div class="form-group"><label>${f.label}</label><textarea id="field-${f.name}" placeholder="${f.placeholder || ''}">${f.default || ''}</textarea></div>`;
        if (f.type === 'select') return `<div class="form-group"><label>${f.label}</label><select id="field-${f.name}">${f.options.map(o => `<option value="${o.v}">${o.l}</option>`).join('')}</select></div>`;
        return `<div class="form-group"><label>${f.label}</label><input type="${f.type}" id="field-${f.name}" placeholder="${f.placeholder || ''}"></div>`;
    }).join('');

    document.getElementById('modal-title').textContent = 'Add New';
    document.getElementById('modal-body').innerHTML = formHtml;
    document.getElementById('modal').style.display = 'flex';
    document.getElementById('modal-save').onclick = () => saveNewItem(key, fields);
}

// Edit item
function editItem(key, id) {
    const item = (siteData[key] || []).find(i => i.id === id);
    if (!item) return;
    const fields = getFields(key);
    let formHtml = fields.map(f => {
        let val = item[f.name] ?? '';
        if (f.type === 'textarea') return `<div class="form-group"><label>${f.label}</label><textarea id="field-${f.name}">${val}</textarea></div>`;
        if (f.type === 'select') return `<div class="form-group"><label>${f.label}</label><select id="field-${f.name}">${f.options.map(o => `<option value="${o.v}" ${String(o.v)===String(val)?'selected':''}>${o.l}</option>`).join('')}</select></div>`;
        return `<div class="form-group"><label>${f.label}</label><input type="${f.type}" id="field-${f.name}" value="${val}"></div>`;
    }).join('');

    document.getElementById('modal-title').textContent = 'Edit Item';
    document.getElementById('modal-body').innerHTML = formHtml;
    document.getElementById('modal').style.display = 'flex';
    document.getElementById('modal-save').onclick = () => saveEditItem(key, id, fields);
}

// Save new
async function saveNewItem(key, fields) {
    const data = {};
    fields.forEach(f => {
        let val = document.getElementById(`field-${f.name}`).value;
        if (f.type === 'number') val = parseInt(val) || 0;
        if (f.name === 'active') val = val === 'true';
        data[f.name] = val;
    });
    await fetch(`${API_BASE}/data.php?section=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    closeModal();
    await loadData();
    loadSection(currentSection);
}

// Save edit
async function saveEditItem(key, id, fields) {
    const data = {};
    fields.forEach(f => {
        let val = document.getElementById(`field-${f.name}`).value;
        if (f.type === 'number') val = parseInt(val) || 0;
        if (f.name === 'active') val = val === 'true';
        data[f.name] = val;
    });
    await fetch(`${API_BASE}/data.php?section=${key}&id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    closeModal();
    await loadData();
    loadSection(currentSection);
}

// Delete item
async function deleteItem(key, id) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    await fetch(`${API_BASE}/data.php?section=${key}&id=${id}`, { method: 'DELETE' });
    await loadData();
    loadSection(currentSection);
}

// Close modal
function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

// Stats
function renderStats(area) {
    const s = siteData.stats || {};
    area.innerHTML = `
        <div class="settings-form">
            <h3 style="margin-bottom:20px;color:#f59e0b">Website Statistics</h3>
            <div class="settings-form form-row">
                <div class="form-group"><label>Years of Experience</label><input type="number" id="stat-years" value="${s.years || ''}"></div>
                <div class="form-group"><label>Videos Published</label><input type="number" id="stat-videos" value="${s.videos || ''}"></div>
                <div class="form-group"><label>Artists & Channels</label><input type="number" id="stat-artists" value="${s.artists || ''}"></div>
                <div class="form-group"><label>Total Views (in Millions)</label><input type="number" id="stat-views" value="${s.views || ''}"></div>
            </div>
            <button class="btn btn-primary" onclick="saveStats()">Save Stats</button>
        </div>`;
}

async function saveStats() {
    const data = {
        years: document.getElementById('stat-years').value,
        videos: document.getElementById('stat-videos').value,
        artists: document.getElementById('stat-artists').value,
        views: document.getElementById('stat-views').value
    };
    await fetch(`${API_BASE}/data.php?section=stats`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    alert('Stats saved!');
    await loadData();
}

// Settings
function renderSettings(area) {
    const s = siteData.settings || {};
    area.innerHTML = `
        <div class="settings-form">
            <h3 style="margin-bottom:20px;color:#f59e0b">General Settings</h3>
            <div class="form-group"><label>Company Name</label><input type="text" id="set-company_name" value="${s.company_name || ''}"></div>
            <div class="form-group"><label>Tagline</label><input type="text" id="set-tagline" value="${s.tagline || ''}"></div>
            <div class="form-group"><label>Description</label><textarea id="set-description">${s.description || ''}</textarea></div>
            <div class="form-row">
                <div class="form-group"><label>Phone 1</label><input type="text" id="set-phone" value="${s.phone || ''}"></div>
                <div class="form-group"><label>Phone 2</label><input type="text" id="set-phone2" value="${s.phone2 || ''}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Email 1</label><input type="text" id="set-email" value="${s.email || ''}"></div>
                <div class="form-group"><label>Email 2</label><input type="text" id="set-email2" value="${s.email2 || ''}"></div>
            </div>
            <div class="form-group"><label>Address</label><input type="text" id="set-address" value="${s.address || ''}"></div>
            <div class="form-row">
                <div class="form-group"><label>YouTube URL</label><input type="text" id="set-youtube" value="${s.youtube || ''}"></div>
                <div class="form-group"><label>Instagram URL</label><input type="text" id="set-instagram" value="${s.instagram || ''}"></div>
            </div>
            <div class="form-group"><label>WhatsApp Number (with country code, no +)</label><input type="text" id="set-whatsapp" value="${s.whatsapp || ''}"></div>
            <button class="btn btn-primary" onclick="saveSettings()" style="margin-top:10px">Save Settings</button>
        </div>`;
}

async function saveSettings() {
    const fields = ['company_name','tagline','description','phone','phone2','email','email2','address','youtube','instagram','whatsapp'];
    const data = {};
    fields.forEach(f => { data[f] = document.getElementById(`set-${f}`).value; });
    await fetch(`${API_BASE}/data.php?section=settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    alert('Settings saved!');
    await loadData();
}
