// Dynamic Content Loader - loads admin-managed content on live website
(function() {
  const API_URL = '/admin/api.php';

  async function loadData(type) {
    try {
      const res = await fetch(API_URL + '?action=load&type=' + type);
      return await res.json();
    } catch(e) { return null; }
  }

  // Load Donor Wall ticker
  async function loadDonorWall() {
    const donors = await loadData('donorWall');
    if (!donors || donors.length === 0) return;
    const tickers = document.querySelectorAll('.donor-ticker-row, .ticker-row');
    if (tickers.length === 0) return;
    const html = donors.map(d => `<div class="donor-item"><span class="donor-name">${d.name}</span><span class="donor-amount">₹${Number(d.amount).toLocaleString()}</span><span class="donor-time">${d.time}</span></div>`).join('');
    tickers.forEach(t => { t.innerHTML = html + html; });
  }

  // Load Bank Details on donate page
  async function loadBankDetails() {
    const bank = await loadData('bankDetails');
    if (!bank || !bank.bankName) return;
    // Update bank details on page if elements exist
    const bankSection = document.querySelector('.bank-details, .payment-info');
    if (bankSection) {
      const fields = bankSection.querySelectorAll('[data-field]');
      fields.forEach(f => { if (bank[f.dataset.field]) f.textContent = bank[f.dataset.field]; });
    }
  }

  // Load Razorpay and activate payment button
  async function loadRazorpay() {
    const rzp = await loadData('razorpay');
    if (!rzp || !rzp.keyId) return;
    // Add Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    document.head.appendChild(script);

    // Find donate buttons and attach Razorpay
    script.onload = function() {
      document.querySelectorAll('.razorpay-btn, [data-razorpay]').forEach(btn => {
        btn.style.display = 'inline-flex';
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          const amount = btn.dataset.amount || document.querySelector('#donateAmount')?.value || 500;
          const options = {
            key: rzp.keyId,
            amount: parseInt(amount) * 100,
            currency: 'INR',
            name: rzp.name || 'Hope 4 Kids Care Foundation',
            description: rzp.description || 'Donation',
            image: rzp.logo || '',
            handler: function(response) {
              alert('Thank you! Payment successful. ID: ' + response.razorpay_payment_id);
            },
            prefill: {},
            theme: { color: '#1d4ed8' }
          };
          const pay = new Razorpay(options);
          pay.open();
        });
      });
    };
  }

  // Load Gallery
  async function loadGallery() {
    const gallery = await loadData('gallery');
    if (!gallery || gallery.length === 0) return;
    const grid = document.querySelector('.gallery-grid, .gallery-container, #dynamicGallery');
    if (!grid) return;
    grid.innerHTML = gallery.map(p => `<div class="gallery-item"><img src="${p.url}" alt="${p.caption || ''}" loading="lazy"><div class="gallery-overlay"><p>${p.caption || ''}</p></div></div>`).join('');
  }

  // Load Settings (phone, email, social links)
  async function loadSettings() {
    const settings = await loadData('settings');
    if (!settings || !settings.phone) return;
    // Update phone numbers
    document.querySelectorAll('[data-phone], .phone-number').forEach(el => { el.textContent = settings.phone; });
    document.querySelectorAll('a[href*="tel:"]').forEach(a => { a.href = 'tel:' + settings.phone.replace(/\s/g, ''); });
    // Update emails
    document.querySelectorAll('[data-email], .email-address').forEach(el => { el.textContent = settings.email; });
    // Update WhatsApp
    document.querySelectorAll('a[href*="wa.me"]').forEach(a => { a.href = 'https://wa.me/' + settings.whatsapp; });
    // Update social links
    if (settings.fb) document.querySelectorAll('a[href*="facebook"]').forEach(a => { a.href = settings.fb; });
    if (settings.insta) document.querySelectorAll('a[href*="instagram"]').forEach(a => { a.href = settings.insta; });
    if (settings.yt) document.querySelectorAll('a[href*="youtube"]').forEach(a => { a.href = settings.yt; });
  }

  // Load Banner/Homepage content
  async function loadBanner() {
    const banner = await loadData('bannerContent');
    if (!banner || !banner.title1) return;
    const heroTitle = document.querySelector('.hero-title, .hero h1');
    if (heroTitle) heroTitle.innerHTML = banner.title1 + ' <span>' + banner.title2 + '</span>';
    const heroSub = document.querySelector('.hero-subtitle, .hero p');
    if (heroSub) heroSub.textContent = banner.subtitle;
    // Update impact stats
    if (banner.impChildren) { const el = document.querySelector('[data-stat="children"], .stat-children'); if (el) el.textContent = banner.impChildren; }
    if (banner.impPrograms) { const el = document.querySelector('[data-stat="programs"], .stat-programs'); if (el) el.textContent = banner.impPrograms; }
    if (banner.impVolunteers) { const el = document.querySelector('[data-stat="volunteers"], .stat-volunteers'); if (el) el.textContent = banner.impVolunteers; }
    if (banner.impDistricts) { const el = document.querySelector('[data-stat="districts"], .stat-districts'); if (el) el.textContent = banner.impDistricts; }
  }

  // Load Blog/News posts
  async function loadBlogs() {
    const blogs = await loadData('blogs');
    if (!blogs || blogs.length === 0) return;
    const container = document.querySelector('.blog-grid, .news-grid, #dynamicBlogs, .blog-container');
    if (!container) return;
    container.innerHTML = blogs.map(b => `<div class="blog-card"><div class="blog-image"><img src="${b.image || 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=400&h=250&fit=crop'}" alt="${b.title}" loading="lazy"></div><div class="blog-content"><span class="blog-category">${b.category}</span><h3>${b.title}</h3><p>${b.content.substring(0, 120)}...</p><div class="blog-meta"><span>${new Date(b.date).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}</span></div></div></div>`).join('');
  }

  // Load Team Members
  async function loadTeam() {
    const team = await loadData('team');
    if (!team || team.length === 0) return;
    const container = document.querySelector('.team-grid, .team-container, #dynamicTeam');
    if (!container) return;
    container.innerHTML = team.map(t => `<div class="team-card"><div class="team-image">${t.photo ? '<img src="' + t.photo + '" alt="' + t.name + '">' : '<div class="team-avatar">' + t.name.charAt(0) + '</div>'}</div><div class="team-info"><h4>${t.name}</h4><p class="team-role">${t.role}</p>${t.phone ? '<p class="team-contact"><i class="fas fa-phone"></i> ' + t.phone + '</p>' : ''}${t.email ? '<p class="team-contact"><i class="fas fa-envelope"></i> ' + t.email + '</p>' : ''}</div></div>`).join('');
  }

  // Load Programs
  async function loadPrograms() {
    const programs = await loadData('programs');
    if (!programs || programs.length === 0) return;
    const container = document.querySelector('.programs-grid, .programs-container, #dynamicPrograms');
    if (!container) return;
    container.innerHTML = programs.map(p => `<div class="program-card"><div class="program-icon"><i class="${p.icon}"></i></div><h3>${p.name}</h3><p>${p.desc}</p>${p.count ? '<span class="program-count"><i class="fas fa-users"></i> ' + p.count + '</span>' : ''}</div>`).join('');
  }

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', function() {
    loadDonorWall();
    loadSettings();
    // Page-specific loading
    if (window.location.pathname.includes('donate')) { loadBankDetails(); loadRazorpay(); }
    if (window.location.pathname.includes('gallery')) { loadGallery(); }
    if (window.location.pathname.includes('blog') || window.location.pathname.includes('news')) { loadBlogs(); }
    if (window.location.pathname.includes('about')) { loadTeam(); }
    if (window.location.pathname.includes('programs')) { loadPrograms(); }
    if (window.location.pathname === '/' || window.location.pathname.includes('index')) { loadBanner(); loadRazorpay(); }
  });
})();
