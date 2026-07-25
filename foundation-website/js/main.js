/* ============================================
   Hope 4 Kids Care Foundation - Main JS
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {

  // === Preloader ===
  const preloader = document.querySelector('.preloader');
  if (preloader) {
    window.addEventListener('load', () => {
      setTimeout(() => preloader.classList.add('hidden'), 500);
    });
    // Fallback
    setTimeout(() => preloader.classList.add('hidden'), 3000);
  }

  // === Navbar Scroll Effect ===
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
    });
  }

  // === Mobile Menu Toggle ===
  const mobileToggle = document.querySelector('.mobile-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      mobileToggle.classList.toggle('active');
    });

    // Close on link click
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        mobileToggle.classList.remove('active');
      });
    });
  }

  // === Back to Top ===
  const backToTop = document.querySelector('.back-to-top');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      backToTop.classList.toggle('visible', window.scrollY > 400);
    });
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // === Scroll Animations (Intersection Observer) ===
  const animatedElements = document.querySelectorAll('.fade-up, .fade-left, .fade-right');
  if (animatedElements.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    animatedElements.forEach(el => observer.observe(el));
  }

  // === Counter Animation ===
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length > 0) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(counter => counterObserver.observe(counter));
  }

  function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-count'));
    const suffix = el.getAttribute('data-suffix') || '';
    const prefix = el.getAttribute('data-prefix') || '';
    const duration = 2000;
    const step = Math.ceil(target / (duration / 16));
    let current = 0;

    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      el.textContent = prefix + formatNumber(current) + suffix;
    }, 16);
  }

  function formatNumber(num) {
    if (num >= 100000) {
      return (num / 100000).toFixed(1) + 'L';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(num >= 10000 ? 0 : 1) + 'K';
    }
    return num.toLocaleString('en-IN');
  }

  // === Donate Amount Selection ===
  const donateAmounts = document.querySelectorAll('.donate-amount');
  const customInput = document.querySelector('.custom-amount input');
  
  donateAmounts.forEach(btn => {
    btn.addEventListener('click', () => {
      donateAmounts.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (customInput) {
        customInput.value = btn.textContent.replace('₹', '').replace(',', '').trim();
      }
    });
  });

  // === Progress Bar Animation ===
  const progressBars = document.querySelectorAll('.progress-fill');
  if (progressBars.length > 0) {
    const progressObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const width = entry.target.getAttribute('data-width');
          entry.target.style.width = width + '%';
          progressObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    progressBars.forEach(bar => {
      bar.style.width = '0%';
      progressObserver.observe(bar);
    });
  }

  // === Smooth Scroll for Anchor Links ===
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // === Active Nav Link ===
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links > a, .nav-links .dropdown > a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // === Form Validation (Contact & Volunteer) ===
  const forms = document.querySelectorAll('form[data-validate]');
  forms.forEach(form => {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      let isValid = true;
      const requiredFields = form.querySelectorAll('[required]');
      
      requiredFields.forEach(field => {
        field.style.borderColor = '';
        if (!field.value.trim()) {
          field.style.borderColor = '#ef4444';
          isValid = false;
        }
        if (field.type === 'email' && field.value && !isValidEmail(field.value)) {
          field.style.borderColor = '#ef4444';
          isValid = false;
        }
      });

      if (isValid) {
        showNotification('Thank you! Your message has been sent successfully.', 'success');
        form.reset();
      } else {
        showNotification('Please fill in all required fields correctly.', 'error');
      }
    });
  });

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // === Notification System ===
  function showNotification(message, type) {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <span>${type === 'success' ? '&#10004;' : '&#9888;'}</span>
      <p>${message}</p>
      <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '15px 20px',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      zIndex: '10000',
      animation: 'slideIn 0.3s ease',
      background: type === 'success' ? '#10b981' : '#ef4444',
      color: 'white',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      maxWidth: '400px',
      fontSize: '0.9rem'
    });

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  }

  // === Ticker Duplication for Infinite Scroll ===
  const tickerContent = document.querySelector('.ticker-content');
  if (tickerContent) {
    const clone = tickerContent.innerHTML;
    tickerContent.innerHTML += clone;
  }

  // === Gallery Lightbox ===
  const galleryItems = document.querySelectorAll('.gallery-item');
  galleryItems.forEach(item => {
    item.addEventListener('click', () => {
      const img = item.querySelector('img');
      if (!img) return;
      
      const lightbox = document.createElement('div');
      Object.assign(lightbox.style, {
        position: 'fixed',
        inset: '0',
        background: 'rgba(0,0,0,0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '10000',
        cursor: 'pointer',
        animation: 'fadeIn 0.3s ease'
      });

      const imgEl = document.createElement('img');
      imgEl.src = img.src;
      imgEl.alt = img.alt;
      Object.assign(imgEl.style, {
        maxWidth: '90%',
        maxHeight: '90vh',
        borderRadius: '12px',
        boxShadow: '0 0 50px rgba(0,0,0,0.5)'
      });

      lightbox.appendChild(imgEl);
      lightbox.addEventListener('click', () => lightbox.remove());
      document.body.appendChild(lightbox);
    });
  });

  // === Donate Button Animation ===
  const donateButtons = document.querySelectorAll('.btn-donate');
  donateButtons.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-3px) scale(1.05)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });

  // Add slideIn keyframe
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  `;
  document.head.appendChild(style);

});
