function showPlaceholder(wrapper) {
  if (!wrapper) return;
  const placeholder = wrapper.querySelector('.placeholder');
  const media = wrapper.querySelector('.media');
  if (media) media.classList.add('hidden');
  if (placeholder) placeholder.classList.remove('hidden');
}

function setupImageFallback(img) {
  const wrapper = img.closest('.media-wrap');
  img.addEventListener('error', () => showPlaceholder(wrapper), { once: true });
}

function setupVideoFallback(video) {
  const wrapper = video.closest('.media-wrap');
  video.addEventListener('error', () => showPlaceholder(wrapper), { once: true });
}

document.addEventListener('DOMContentLoaded', () => {
  // === Analytics (GA4 via Google tag / gtag.js) ===
  // ID de mesure GA4
  const GA_MEASUREMENT_ID = 'G-VFW8KCWJ9V';

  let gaLoaded = false;
  const loadGoogleAnalytics = () => {
    if (gaLoaded) return;
    if (!GA_MEASUREMENT_ID) return;
    gaLoaded = true;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag(){ window.dataLayer.push(arguments); }
    window.gtag = window.gtag || gtag;

    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID);
  };

  // Cookies consent banner (simple): shown on first visit only.
  // Stores preference in localStorage + a small cookie.
  const CONSENT_KEY = 'sf_cookie_consent';
  const CONSENT_COOKIE = 'sf_cookie_consent';

  const getCookie = (name) => {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()\[\]\\\/\+^]/g, '\\$&') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  };

  const setCookie = (name, value, maxAgeSeconds) => {
    const maxAge = typeof maxAgeSeconds === 'number' ? `; Max-Age=${maxAgeSeconds}` : '';
    document.cookie = `${name}=${encodeURIComponent(value)}${maxAge}; Path=/; SameSite=Lax`;
  };

  const getConsent = () => {
    try {
      const v = localStorage.getItem(CONSENT_KEY);
      if (v) return v;
    } catch (_) {}
    return getCookie(CONSENT_COOKIE);
  };

  const setConsent = (value) => {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch (_) {}
    // 1 an
    setCookie(CONSENT_COOKIE, value, 60 * 60 * 24 * 365);
    document.documentElement.setAttribute('data-cookie-consent', value);

    if (value === 'accepted') {
      loadGoogleAnalytics();
    }
  };

  const consent = getConsent();
  if (!consent) {
    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Préférences cookies');
    banner.innerHTML = `
      <div class="cookie-banner-inner">
        <p>
          Nous utilisons des cookies essentiels au bon fonctionnement du site.
          Vous pouvez accepter ou refuser les cookies non essentiels.
          <a href="legals_mentions.html">Mentions légales</a>.
        </p>
        <div class="cookie-actions">
          <button type="button" class="btn" data-cookie="refuse">Refuser</button>
          <button type="button" class="btn primary" data-cookie="accept">Accepter</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    const close = () => {
      banner.remove();
    };

    banner.querySelector('[data-cookie="accept"]').addEventListener('click', () => {
      setConsent('accepted');
      close();
    });
    banner.querySelector('[data-cookie="refuse"]').addEventListener('click', () => {
      setConsent('refused');
      close();
    });
  } else {
    document.documentElement.setAttribute('data-cookie-consent', consent);
    if (consent === 'accepted') {
      loadGoogleAnalytics();
    }
  }

  document.querySelectorAll('img.media[data-fallback="1"]').forEach(setupImageFallback);
  document.querySelectorAll('video.media[data-fallback="1"]').forEach(setupVideoFallback);

  // Autoplay videos when they enter the viewport.
  const videosWithAutoplay = document.querySelectorAll('video[data-autoplay="onview"]');
  if (videosWithAutoplay.length > 0 && 'IntersectionObserver' in window) {
    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        const wrapper = video.closest('.media-wrap');
        if (entry.isIntersecting) {
          if (wrapper && wrapper.classList.contains('video-fade')) {
            wrapper.classList.add('is-inview');
          }
          video.play().catch(() => {
            // Autoplay might be blocked by browser, silently ignore.
          });
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.5 });

    videosWithAutoplay.forEach((video) => videoObserver.observe(video));
  }

  // Trigger intro animation on the homepage.
  if (document.body.classList.contains('home')) {
    requestAnimationFrame(() => {
      document.body.classList.add('is-loaded');
    });
  }

  // Reveal on scroll: fade-in when elements enter the viewport.
  // Applies to page content only (inside <main>), excludes the legal page.
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion && !document.body.classList.contains('page-legal') && 'IntersectionObserver' in window) {
    const revealSelector = [
      'main .home-copy',
      'main .card',
      'main .activity-row',
      'main .spectacle-heritage-inner',
      'main .gallery-item',
      'main .home-video-block',
      'main .home-photos-grid',
      'main .activity-intro'
    ].join(',');

    const revealTargets = Array.from(new Set(document.querySelectorAll(revealSelector)));
    revealTargets.forEach((el) => el.classList.add('reveal'));

    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    revealTargets.forEach((el) => revealObserver.observe(el));
  }

  // Header: hide on scroll down, show on scroll up.
  const header = document.querySelector('.site-header');
  if (header) {
    let lastScrollY = window.scrollY;
    let hidden = false;

    const isHome = document.body.classList.contains('home');
    const threshold = 500
    const delta = 30;

    const onScroll = () => {
      const scrollY = window.scrollY;
      const goingDown = scrollY > lastScrollY + delta;
      const goingUp = scrollY < lastScrollY - delta;

      if (scrollY < threshold) {
        if (hidden) {
          header.classList.remove('is-hidden');
          hidden = false;
        }
      } else if (goingDown && !hidden) {
        header.classList.add('is-hidden');
        hidden = true;
      } else if (goingUp && hidden) {
        header.classList.remove('is-hidden');
        hidden = false;
      }

      lastScrollY = scrollY;
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Mobile nav: hamburger toggle.
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (navToggle && nav) {
    const setOpen = (open) => {
      document.body.classList.toggle('nav-open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    navToggle.addEventListener('click', () => {
      const open = !document.body.classList.contains('nav-open');
      setOpen(open);
    });

    nav.addEventListener('click', (e) => {
      const target = e.target;
      if (target && target.tagName === 'A') {
        setOpen(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false);
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) setOpen(false);
    });

    document.addEventListener('click', (e) => {
      if (!document.body.classList.contains('nav-open')) return;
      const target = e.target;
      if (!target) return;
      if (nav.contains(target) || navToggle.contains(target)) return;
      setOpen(false);
    });
  }

  // Image lightbox for team page
  const lightbox = document.getElementById('imageLightbox');
  if (lightbox && document.body.classList.contains('page-equipe')) {
    const lightboxImg = lightbox.querySelector('.lightbox-image');
    const closeBtn = lightbox.querySelector('.lightbox-close');
    
    const openLightbox = (imgSrc, imgAlt) => {
      lightboxImg.src = imgSrc;
      lightboxImg.alt = imgAlt;
      lightbox.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    };
    
    const closeLightbox = () => {
      lightbox.classList.add('hidden');
      document.body.style.overflow = '';
    };
    
    // Click on team member images
    document.querySelectorAll('.page-equipe .gallery-item .media-wrap').forEach((wrap) => {
      const img = wrap.querySelector('.media');
      if (img && img.tagName === 'IMG') {
        wrap.addEventListener('click', () => {
          openLightbox(img.src, img.alt);
        });
      }
    });
    
    // Close button
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeLightbox();
    });
    
    // Click outside image
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) {
        closeLightbox();
      }
    });
    
    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !lightbox.classList.contains('hidden')) {
        closeLightbox();
      }
    });
  }

  // Gallery lightbox with navigation
  const galleryLightbox = document.getElementById('galleryLightbox');
  if (galleryLightbox && document.body.classList.contains('page-galerie') && typeof galleries !== 'undefined') {
    const lightboxImg = galleryLightbox.querySelector('.lightbox-image');
    const closeBtn = galleryLightbox.querySelector('.lightbox-close');
    const prevBtn = galleryLightbox.querySelector('.lightbox-prev');
    const nextBtn = galleryLightbox.querySelector('.lightbox-next');
    const counter = galleryLightbox.querySelector('.lightbox-counter');
    const captionTitle = galleryLightbox.querySelector('.caption-title');
    const captionDate = galleryLightbox.querySelector('.caption-date');
    
    let currentGalleryData = null;
    let currentIndex = 0;
    
    const updateImage = () => {
      if (!currentGalleryData || currentGalleryData.photos.length === 0) return;
      const photo = currentGalleryData.photos[currentIndex];
      lightboxImg.src = photo.src;
      lightboxImg.alt = photo.alt;
      counter.textContent = `${currentIndex + 1} / ${currentGalleryData.photos.length}`;
      captionTitle.textContent = photo.alt || currentGalleryData.title;
      captionDate.textContent = photo.date;
      
      // Masquer les boutons nav si une seule photo
      if (currentGalleryData.photos.length === 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
      } else {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
      }
    };
    
    const openGallery = (galleryName, startIndex = 0) => {
      currentGalleryData = galleries[galleryName] || null;
      currentIndex = startIndex;
      updateImage();
      galleryLightbox.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    };
    
    const closeGallery = () => {
      galleryLightbox.classList.add('hidden');
      document.body.style.overflow = '';
      currentGalleryData = null;
      currentIndex = 0;
    };
    
    const showPrev = () => {
      if (currentGalleryData && currentGalleryData.photos.length > 1) {
        currentIndex = (currentIndex - 1 + currentGalleryData.photos.length) % currentGalleryData.photos.length;
        updateImage();
      }
    };
    
    const showNext = () => {
      if (currentGalleryData && currentGalleryData.photos.length > 1) {
        currentIndex = (currentIndex + 1) % currentGalleryData.photos.length;
        updateImage();
      }
    };
    
    // Click on gallery groups
    document.querySelectorAll('.gallery-group').forEach((group) => {
      const galleryName = group.getAttribute('data-gallery');
      group.querySelector('.media-wrap').addEventListener('click', () => {
        openGallery(galleryName);
      });
    });
    
    // Close button
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeGallery();
    });
    
    // Navigation buttons
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showPrev();
    });
    
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showNext();
    });
    
    // Click outside image
    galleryLightbox.addEventListener('click', (e) => {
      if (e.target === galleryLightbox) {
        closeGallery();
      }
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (galleryLightbox.classList.contains('hidden')) return;
      
      if (e.key === 'Escape') {
        closeGallery();
      } else if (e.key === 'ArrowLeft') {
        showPrev();
      } else if (e.key === 'ArrowRight') {
        showNext();
      }
    });
  }
});
