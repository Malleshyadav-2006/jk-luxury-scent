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

  // Initialize Lenis smooth scroll globally
  if (typeof Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 0.75,
      easing: function(t) { return 1 - Math.pow(1 - t, 3); }
    });
  }

  // ─────────────────────────────────────────────
  // 2. CURSOR SETUP (No RAF here — driven by master loop)
  // ─────────────────────────────────────────────
  
  // The most bulletproof desktop check that avoids Windows hybrid false-negatives:
  var isDesktop = window.innerWidth >= 1024;

  // Always grab/create the cursor elements
  dotEl = document.getElementById('cursor-dot');
  if (!dotEl) {
    dotEl = document.createElement('div');
    dotEl.id = 'cursor-dot';
    document.body.appendChild(dotEl);
  }

  ringEl = document.getElementById('cursor-ring');
  if (!ringEl) {
    ringEl = document.createElement('div');
    ringEl.id = 'cursor-ring';
    document.body.appendChild(ringEl);
  }

  var useCustomCursor = isDesktop;

  if (!isDesktop) {
    // Mobile/tablet — hide the custom cursor elements
    dotEl.style.display  = 'none';
    ringEl.style.display = 'none';
  } else {
    // Ensure they are visible on desktop
    dotEl.style.display  = 'block';
    ringEl.style.display = 'block';
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

  // Hover expand ring (handled via class for better transition)
  if (useCustomCursor) {
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest('a, button, .nav-icon, input, textarea, .dot, .collection-card')) {
        if (ringEl) ringEl.classList.add('hover-interactive');
      }
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest('a, button, .nav-icon, input, textarea, .dot, .collection-card')) {
        if (ringEl) ringEl.classList.remove('hover-interactive');
      }
    });
  }

  // ─────────────────────────────────────────────
  // 3. CANVAS CURSOR TRAIL (gold thread, on all pages)
  // ─────────────────────────────────────────────
  var trailCanvas, trailCtx, trailLines = [], trailPos, colorPhase = 0;

  if (isDesktop) {
    trailCanvas = document.createElement('canvas');
    trailCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:9997;';
    document.body.appendChild(trailCanvas);
    trailCtx = trailCanvas.getContext('2d');
    trailPos = { x: mouseX, y: mouseY };

    function TrailNode() { this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; }

    function TrailLine(spring) {
      this.spring = spring + 0.1 * Math.random() - 0.02;
      this.friction = 0.5 + 0.01 * Math.random() - 0.002;
      this.nodes = [];
      for (var n = 0; n < 28; n++) {
        var nd = new TrailNode();
        nd.x = trailPos.x; nd.y = trailPos.y;
        this.nodes.push(nd);
      }
    }

    TrailLine.prototype.update = function () {
      var e = this.spring, t = this.nodes[0];
      t.vx += (trailPos.x - t.x) * e; t.vy += (trailPos.y - t.y) * e;
      for (var i = 0; i < this.nodes.length; i++) {
        t = this.nodes[i];
        if (i > 0) {
          var n = this.nodes[i - 1];
          t.vx += (n.x - t.x) * e; t.vy += (n.y - t.y) * e;
          t.vx += n.vx * 0.25; t.vy += n.vy * 0.25;
        }
        t.vx *= this.friction; t.vy *= this.friction;
        t.x += t.vx; t.y += t.vy; e *= 0.98;
      }
    };

    TrailLine.prototype.draw = function () {
      var a = this.nodes[0].x, b = this.nodes[0].y;
      trailCtx.beginPath(); trailCtx.moveTo(a, b);
      for (var i = 1; i < this.nodes.length - 2; i++) {
        var e = this.nodes[i], f = this.nodes[i + 1];
        trailCtx.quadraticCurveTo(e.x, e.y, (e.x + f.x) * 0.5, (e.y + f.y) * 0.5);
      }
      var e2 = this.nodes[this.nodes.length - 2], f2 = this.nodes[this.nodes.length - 1];
      trailCtx.quadraticCurveTo(e2.x, e2.y, f2.x, f2.y);
      trailCtx.stroke(); trailCtx.closePath();
    };

    for (var t = 0; t < 10; t++) {
      trailLines.push(new TrailLine(0.4 + (t / 10) * 0.025));
    }

    document.addEventListener('mousemove', function (ev) {
      trailPos.x = ev.clientX; trailPos.y = ev.clientY;
    }, { passive: true });

    function resizeTrailCanvas() {
      trailCanvas.width  = window.innerWidth;
      trailCanvas.height = window.innerHeight;
    }
    window.addEventListener('resize', function () {
      clearTimeout(window._trailTimer);
      window._trailTimer = setTimeout(resizeTrailCanvas, 150);
    }, { passive: true });
    resizeTrailCanvas();
  }

  // ─────────────────────────────────────────────
  // 4-a. RITUAL STEP OBSERVER (Bulletproof frame-by-frame center distance)
  // ─────────────────────────────────────────────
  var ritualSteps = Array.from(document.querySelectorAll('.ritual-step'));
  var currentActiveStep = null;

  // ─────────────────────────────────────────────
  // 4-b. PARTICLES SETUP (canvas only, no loop here)
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

    // E) Ritual step tracker — pick the step whose center is closest to viewport center
    if (!ritualSteps || !ritualSteps.length) {
      ritualSteps = Array.from(document.querySelectorAll('.ritual-step'));
    }
    if (ritualSteps && ritualSteps.length) {
      var midY = window.innerHeight / 2;
      var closest = null, closestDist = Infinity;
      for (var s = 0; s < ritualSteps.length; s++) {
        var rect = ritualSteps[s].getBoundingClientRect();
        var dist = Math.abs((rect.top + rect.height / 2) - midY);
        if (dist < closestDist) { closestDist = dist; closest = ritualSteps[s]; }
      }
      if (closest && closest !== currentActiveStep) {
        currentActiveStep = closest;
        var activeNum = closest.getAttribute('data-step');
        var bgs = document.querySelectorAll('.ritual-bg');
        if (bgs.length) {
          bgs.forEach(function (bg) { bg.classList.remove('active'); });
          var activeBg = document.getElementById('ritual-bg-' + activeNum);
          if (activeBg) activeBg.classList.add('active');
        }
      }
    }

    // D) Canvas cursor trail (gold thread — desktop only)
    if (trailCtx && trailLines.length) {
      trailCtx.globalCompositeOperation = 'source-over';
      trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
      trailCtx.globalCompositeOperation = 'lighter';
      colorPhase += 0.005;
      var hue = 39 + Math.sin(colorPhase) * 7;
      trailCtx.strokeStyle = 'hsla(' + hue + ',55%,52%,0.18)';
      trailCtx.lineWidth = 1.5;
      for (var j = 0; j < trailLines.length; j++) {
        trailLines[j].update();
        trailLines[j].draw();
      }
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
