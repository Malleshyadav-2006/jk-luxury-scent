/* ============================================
   JK Luxury Scent — Shared JS Engine v2
   PERFORMANCE: Single master RAF loop for everything.
   Lenis + cursor lerp + particles all share one loop.
   ============================================ */

(function () {
  'use strict';

  // ─── State ───────────────────────────────────
  var lenis;
  var mouseX = window.innerWidth  / 2;
  var mouseY = window.innerHeight / 2;
  var ringX  = mouseX;
  var ringY  = mouseY;
  var dotEl, ringEl;
  var bgCanvas, bgCtx, bgParticles = [];
  var particleFrame = 0; // skip-frame counter for particles

  // ─────────────────────────────────────────────
  // 1. LENIS SMOOTH SCROLL
  // ─────────────────────────────────────────────
  if (typeof Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 0.75,                               // Shorter = snappier
      easing: function (t) {
        return 1 - Math.pow(1 - t, 3);             // easeOutCubic — very responsive
      },
      smoothWheel: true,
      wheelMultiplier: 0.9,
    });
    window.__lenis = lenis;
  }

  // ─────────────────────────────────────────────
  // 2. CURSOR SETUP (No RAF here — driven by master loop)
  // ─────────────────────────────────────────────
  dotEl  = document.getElementById('cursor-dot');
  ringEl = document.getElementById('cursor-ring');

  var useCustomCursor = dotEl && ringEl &&
      window.matchMedia('(pointer: fine)').matches &&
      !('ontouchstart' in window);

  if (!useCustomCursor) {
    if (dotEl)  dotEl.style.display  = 'none';
    if (ringEl) ringEl.style.display = 'none';
  }

  // Track raw mouse position (lightweight, no RAF)
  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (dotEl && useCustomCursor) {
      dotEl.style.left = mouseX + 'px';
      dotEl.style.top  = mouseY + 'px';
    }
  }, { passive: true });

  // Hover expand ring
  if (useCustomCursor) {
    document.querySelectorAll('a, button').forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        if (ringEl) { ringEl.style.width = '54px'; ringEl.style.height = '54px'; }
      });
      el.addEventListener('mouseleave', function () {
        if (ringEl) { ringEl.style.width = '36px'; ringEl.style.height = '36px'; }
      });
    });
  }

  // ─────────────────────────────────────────────
  // 3. PARTICLES SETUP (canvas only, no loop here)
  // ─────────────────────────────────────────────
  bgCanvas = document.createElement('canvas');
  bgCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:0;';
  document.body.prepend(bgCanvas);
  bgCtx = bgCanvas.getContext('2d');

  function initParticles() {
    bgCanvas.width  = window.innerWidth;
    bgCanvas.height = window.innerHeight;
    bgParticles = [];
    var count = window.innerWidth < 768 ? 16 : 32; // Fewer on mobile
    for (var i = 0; i < count; i++) {
      bgParticles.push({
        x:  Math.random() * bgCanvas.width,
        y:  Math.random() * bgCanvas.height,
        r:  Math.random() * 1.2 + 0.3,
        vx: (Math.random() - 0.5) * 0.1,
        vy: -(Math.random() * 0.25 + 0.04),
        a:  Math.random() * 0.45 + 0.06,
      });
    }
  }

  // Debounced resize
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(initParticles, 200);
  }, { passive: true });

  initParticles();

  // ─────────────────────────────────────────────
  // 4. MASTER RAF LOOP — Single loop for everything
  // ─────────────────────────────────────────────
  function masterTick(time) {
    // A) Lenis tick
    if (lenis) lenis.raf(time);

    // B) Cursor ring lerp (cheap lerp, runs every frame)
    if (useCustomCursor && ringEl) {
      ringX += (mouseX - ringX) * 0.12;
      ringY += (mouseY - ringY) * 0.12;
      ringEl.style.left = ringX + 'px';
      ringEl.style.top  = ringY + 'px';
    }

    // C) Particles: skip every other frame to halve GPU load
    particleFrame++;
    if (particleFrame % 2 === 0) {
      bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
      bgCtx.fillStyle = '#C9A84C';
      for (var i = 0, len = bgParticles.length; i < len; i++) {
        var p = bgParticles[i];
        bgCtx.globalAlpha = p.a;
        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, p.r, 0, 6.2832);
        bgCtx.fill();
        // Move
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = bgCanvas.width;
        else if (p.x > bgCanvas.width) p.x = 0;
        if (p.y < 0) p.y = bgCanvas.height;
      }
      bgCtx.globalAlpha = 1;
    }

    requestAnimationFrame(masterTick);
  }
  requestAnimationFrame(masterTick);

  // ─────────────────────────────────────────────
  // 5. NAVBAR SCROLL STATE (passive listener)
  // ─────────────────────────────────────────────
  var navbar = document.getElementById('navbar');
  if (navbar) {
    if (window.scrollY > 10) navbar.classList.add('scrolled');
    window.addEventListener('scroll', function () {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
    }, { passive: true });
  }

  // ─────────────────────────────────────────────
  // 6. SCROLL REVEAL (IntersectionObserver — zero scroll cost)
  // ─────────────────────────────────────────────
  var revealObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        revealObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

  document.querySelectorAll('.reveal').forEach(function (el) {
    revealObs.observe(el);
  });

  // ─────────────────────────────────────────────
  // 7. MOBILE MENU
  // ─────────────────────────────────────────────
  var tog = document.getElementById('mobile-toggle');
  var clo = document.getElementById('mobile-close');
  var ov  = document.getElementById('mobile-overlay');
  if (tog && ov) tog.addEventListener('click', function () { ov.classList.add('active'); document.body.style.overflow = 'hidden'; });
  if (clo && ov) clo.addEventListener('click', function () { ov.classList.remove('active'); document.body.style.overflow = ''; });

  // ─────────────────────────────────────────────
  // 8. GOLD BAR PAGE TRANSITIONS
  // ─────────────────────────────────────────────
  var pt = document.getElementById('page-transition');

  window.addEventListener('pageshow', function () {
    if (pt) {
      pt.classList.remove('active-wipe');
      pt.classList.add('hidden-wipe');
      setTimeout(function () { pt.style.display = 'none'; }, 600);
    }
  });

  document.querySelectorAll('a[href]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var href = (this.getAttribute('href') || '').trim();
      if (!href || href[0] === '#' || href.indexOf('mailto') === 0 || href.indexOf('tel') === 0) return;
      if (href.indexOf('.html') === -1 && /\.\w{2,4}$/.test(href)) return;
      e.preventDefault();
      if (pt) {
        pt.style.display = 'block';
        pt.classList.remove('hidden-wipe');
        pt.classList.add('active-wipe');
      }
      var dest = href;
      setTimeout(function () { window.location.href = dest; }, pt ? 500 : 0);
    });
  });

  // ─────────────────────────────────────────────
  // 9. BACK TO TOP
  // ─────────────────────────────────────────────
  var btt = document.createElement('button');
  btt.id = 'back-to-top';
  btt.setAttribute('aria-label', 'Back to top');
  btt.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  document.body.appendChild(btt);

  window.addEventListener('scroll', function () {
    btt.classList.toggle('visible', window.scrollY > 500);
  }, { passive: true });

  btt.addEventListener('click', function () {
    if (window.__lenis) window.__lenis.scrollTo(0, { duration: 1 });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ─────────────────────────────────────────────
  // 10. CART SYSTEM (localStorage)
  // ─────────────────────────────────────────────
  function getCart() {
    try { return JSON.parse(localStorage.getItem('jk_cart')) || []; } catch (e) { return []; }
  }
  function saveCart(cart) {
    localStorage.setItem('jk_cart', JSON.stringify(cart));
    syncBadge();
    window.dispatchEvent(new CustomEvent('jk:cartUpdated', { detail: { cart: cart } }));
  }
  function syncBadge() {
    var n = getCart().reduce(function (s, i) { return s + i.qty; }, 0);
    document.querySelectorAll('.cart-badge').forEach(function (b) {
      b.textContent = n;
      b.style.display = n > 0 ? 'flex' : 'none';
    });
  }

  function cartToast(name) {
    var old = document.getElementById('jk-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.id = 'jk-toast';
    t.style.cssText = 'position:fixed;bottom:96px;right:36px;z-index:99998;background:#1A1410;border:1px solid rgba(201,168,76,0.3);color:#F5F0EB;padding:14px 22px;font-family:"Jost",sans-serif;font-size:13px;opacity:0;transform:translateY(8px);transition:all 0.35s ease;max-width:260px;line-height:1.5;pointer-events:none;';
    t.innerHTML = '<span style="color:#C9A84C;display:block;font-size:9px;letter-spacing:0.3em;margin-bottom:3px;">ADDED TO CART</span>' + name;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
    setTimeout(function () {
      t.style.opacity = '0'; t.style.transform = 'translateY(8px)';
      setTimeout(function () { t.remove(); }, 350);
    }, 2200);
  }

  window.JKCart = {
    getCart: getCart,
    add: function (id, name, price, img) {
      var cart = getCart();
      var item = cart.find(function (i) { return i.id === id; });
      if (item) { item.qty++; } else { cart.push({ id: id, name: name, price: price, img: img, qty: 1 }); }
      saveCart(cart);
      cartToast(name);
    },
    remove: function (id) { saveCart(getCart().filter(function (i) { return i.id !== id; })); },
    updateQty: function (id, qty) {
      var cart = getCart();
      var item = cart.find(function (i) { return i.id === id; });
      if (!item) return;
      if (qty <= 0) { window.JKCart.remove(id); return; }
      item.qty = qty; saveCart(cart);
    },
    total: function () { return getCart().reduce(function (s, i) { return s + i.price * i.qty; }, 0); },
    count: function () { return getCart().reduce(function (s, i) { return s + i.qty; }, 0); },
  };

  syncBadge();

  // Wire [data-add-cart] buttons
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-add-cart]');
    if (!btn) return;
    window.JKCart.add(
      btn.getAttribute('data-id'),
      btn.getAttribute('data-name'),
      parseFloat(btn.getAttribute('data-price')),
      btn.getAttribute('data-img') || ''
    );
    btn.classList.add('cart-pulse');
    setTimeout(function () { btn.classList.remove('cart-pulse'); }, 500);
  });

  document.body.classList.add('loaded');

})();
