/* =====================================================================================================
   wd-core.js — comportamento genérico extraído de assets/design_system.html (sem o catálogo).
   Lenis no scroller · grain · cursor · text roll · magnético · surgimento (.wd-rise) · contadores ·
   pétalas 2D · parallax · line highlight · marquee em vista · modal · moldura de CTA · utilitários.
   Uso:  WD.init({ scroller: '#site-main', content: '#site-scroller' })  →  window.WD
   Depende de: gsap 3.12.5 e lenis 1.0.42 (assets/vendor). Respeita prefers-reduced-motion em tudo.
   ===================================================================================================== */
(function (w) {
  'use strict';
  var doc = document;
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOBILE = matchMedia('(max-width: 767px)').matches;
  var FINE = matchMedia('(pointer: fine)').matches && !MOBILE;
  var EASE_OUT = 'cubic-bezier(.22,1,.36,1)', EASE_SNAP = 'cubic-bezier(.65,.05,0,1)', EASE_P2 = 'cubic-bezier(.25,.46,.45,.94)';
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || doc).querySelectorAll(s)); };
  var clamp = function (x, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return Math.max(a, Math.min(b, x)); };
  var hasGsap = function () { return !!w.gsap; };
  function loadScript(src) { return new Promise(function (res, rej) { var s = doc.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; doc.head.appendChild(s); }); }
  function visibleIn(el, margin) { var r = el.getBoundingClientRect(), m = margin || 0; return r.bottom > -m && r.top < innerHeight + m && r.width > 0; }

  var WD = { RM: RM, MOBILE: MOBILE, FINE: FINE, $: $, $$: $$, clamp: clamp, loadScript: loadScript, visibleIn: visibleIn,
    scroller: null, content: null, lenis: null, nav: null, _tick: [], _scroll: [] };
  WD.onTick = function (fn) { WD._tick.push(fn); };
  WD.onScroll = function (fn) { WD._scroll.push(fn); };

  /* ------------------------------------------------------------------ Lenis no scroller (lerp .08) */
  function initLenis(opts) {
    if (RM || !w.Lenis || !hasGsap()) return;
    try {
      var o = { wrapper: WD.scroller, content: WD.content, lerp: .08, wheelMultiplier: 1, smoothWheel: true };
      for (var k in (opts || {})) o[k] = opts[k];                          /* opções do site (ex.: lerp, wheelMultiplier, syncTouch) */
      WD.lenis = new Lenis(o);
      gsap.ticker.add(function (t) { WD.lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } catch (e) { WD.lenis = null; }
  }
  WD.navOffset = function () { return (WD.nav ? WD.nav.offsetHeight : 68) + 18; };
  WD.goTo = function (id) {
    var el = doc.getElementById(id); if (!el) return;
    var sc = WD.scroller, y = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - WD.navOffset();
    if (el === sc.firstElementChild || y < 0) y = 0;
    if (WD.lenis) WD.lenis.scrollTo(y, { duration: 1.4, easing: function (t) { return 1 - Math.pow(1 - t, 4); } });
    else sc.scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' });
    setTimeout(function () { var h = el.querySelector('h1,h2,h3') || el; if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }, RM ? 0 : 900);
  };
  WD.lock = function (on) { if (WD.lenis) on ? WD.lenis.stop() : WD.lenis.start(); WD.scroller.style.overflow = on ? 'hidden' : ''; };

  /* ------------------------------------------------------------------ grain (Koisei: 180 × 180, a cada 2º quadro) */
  function initGrain(cv) {
    if (!cv) return;
    var x = cv.getContext('2d'), f = 0; cv.width = 180; cv.height = 180;
    function draw() { var d = x.createImageData(180, 180), p = d.data; for (var i = 0; i < p.length; i += 4) { var v = Math.random() * 255; p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255; } x.putImageData(d, 0, 0); }
    draw();
    if (!RM) WD.onTick(function () { if (++f % 2 === 0 && !doc.hidden) draw(); });
  }

  /* ------------------------------------------------------------------ cursor (Koisei: ponto + anel, difference) */
  function initCursor() {
    var dot = $('#curDot'), ring = $('#curRing'); if (!FINE || !dot || !ring) return;
    var tx = innerWidth / 2, ty = innerHeight / 2, rx = tx, ry = ty;
    doc.body.classList.add('wd-cursor');
    addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; dot.style.transform = 'translate(' + (tx - 4) + 'px,' + (ty - 4) + 'px)'; }, { passive: true });
    doc.addEventListener('pointerover', function (e) {
      var t = e.target.closest && e.target.closest('a,button,label,select,[data-anim],.wd-word,[tabindex="0"]');
      ring.classList.toggle('is-link', !!t);
    });
    WD.onTick(function () { rx += (tx - rx) * .15; ry += (ty - ry) * .15; ring.style.transform = 'translate(' + (rx - 16) + 'px,' + (ry - 16) + 'px)'; });
  }

  /* ------------------------------------------------------------------ text roll (Lando: .char -100%, .75s, stagger .02) */
  function splitChars(el) {
    if (el.hasAttribute('data-wd-split')) return $$('.char', el);
    el.setAttribute('data-wd-split', '');
    var text = el.textContent.replace(/\s+/g, ' ').trim(); el.textContent = '';
    Array.prototype.forEach.call(text, function (ch) { var s = doc.createElement('span'); s.className = 'char'; s.textContent = ch === ' ' ? ' ' : ch; el.appendChild(s); });
    return $$('.char', el);
  }
  function roll(chars, to) {
    chars.forEach(function (c, i) {
      var from = getComputedStyle(c).transform;
      c.getAnimations().forEach(function (a) { a.cancel(); });
      if (RM) { c.style.transform = 'translateY(' + to + ')'; return; }
      c.animate([{ transform: from === 'none' ? 'translateY(0)' : from }, { transform: 'translateY(' + to + ')' }], { duration: 750, delay: i * 20, easing: EASE_OUT, fill: 'forwards' });
    });
  }
  WD.splitChars = splitChars; WD.roll = roll;
  WD.textRoll = function (scope) {
    $$('[data-anim="text-hover"]', scope).forEach(function (host) {
      var t = host.querySelector('[split-text]'); if (!t || t.hasAttribute('data-wd-split')) return;
      if (!host.getAttribute('aria-label')) host.setAttribute('aria-label', t.textContent.replace(/\s+/g, ' ').trim());   /* o texto dividido fica aria-hidden: o nome acessível vem daqui (links e botões) */
      var chars = splitChars(t); t.setAttribute('aria-hidden', 'true');
      host._roll = chars;
      host.addEventListener('mouseenter', function () { roll(host._roll, '-100%'); });
      host.addEventListener('mouseleave', function () { roll(host._roll, '0%'); });
      host.addEventListener('focus', function () { roll(host._roll, '-100%'); });
      host.addEventListener('blur', function () { roll(host._roll, '0%'); });
    });
  };
  /* troca a palavra com rolagem (ex.: Menu ↔ Fechar) */
  WD.setWord = function (el, word) {
    var host = el.closest('[data-anim]'), old = $$('.char', el);
    if (RM || !hasGsap()) { el.removeAttribute('data-wd-split'); el.textContent = word; if (host) host._roll = splitChars(el); return; }
    gsap.to(old, { yPercent: -100, duration: .35, ease: 'power3.in', stagger: .015, onComplete: function () {
      el.removeAttribute('data-wd-split'); el.textContent = word; var c = splitChars(el); if (host) host._roll = c;
      gsap.fromTo(c, { yPercent: 100 }, { yPercent: 0, duration: .6, ease: 'power4.out', stagger: .02 });
    } });
  };

  /* ------------------------------------------------------------------ magnético (Koisei: .3 × offset, elastic.out(1,.4)) */
  WD.magnet = function (scope) {
    if (!FINE || !hasGsap()) return;
    $$('[data-wd-magnet]', scope).forEach(function (m) {
      if (m._mag) return; m._mag = 1;
      m.addEventListener('mousemove', function (e) { var r = m.getBoundingClientRect(); gsap.to(m, { x: (e.clientX - r.left - r.width / 2) * .3, y: (e.clientY - r.top - r.height / 2) * .3, duration: .4 }); });
      m.addEventListener('mouseleave', function () { gsap.to(m, { x: 0, y: 0, duration: .8, ease: 'elastic.out(1,0.4)' }); });
    });
  };

  /* ------------------------------------------------------------------ surgimento (.wd-rise → .is-in) e seções vistas (.wd-section → .is-seen) */
  var rio = null, sio = null;
  WD.rise = function (scope) {
    var rises = $$('.wd-rise:not(.is-in)', scope), secs = $$('.wd-section', scope);
    if (RM || !('IntersectionObserver' in w)) { rises.forEach(function (e) { e.classList.add('is-in'); }); secs.forEach(function (s) { s.classList.add('is-seen'); }); return; }
    rio = rio || new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); } }); }, { root: WD.scroller, rootMargin: '0px 0px -8% 0px', threshold: .01 });
    sio = sio || new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('is-seen'); }); }, { root: WD.scroller, threshold: .05 });
    rises.forEach(function (e) { rio.observe(e); }); secs.forEach(function (s) { sio.observe(s); });
  };
  /* dispara fn uma vez quando el entra em vista (25% acima da base) */
  WD.whenVisible = function (el, fn, margin) {
    if (!el) return;
    if (RM || !('IntersectionObserver' in w)) { fn(el); return; }
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); fn(el); } }, { root: WD.scroller, rootMargin: margin || '0px 0px -25% 0px' });
    io.observe(el);
  };

  /* ------------------------------------------------------------------ revelações (Koisei .heroLine/.mLine, Elicyon .footer-char) */
  WD.riseLines = function (els, o) {
    o = o || {};
    if (!els || !els.length || !hasGsap()) return;
    if (RM) { gsap.set(els, { yPercent: 0, rotate: 0 }); return; }
    gsap.fromTo(els, { yPercent: 110, rotate: o.rotate || 0 }, { yPercent: 0, rotate: 0, duration: o.duration || 1.1, ease: 'power4.out', stagger: o.stagger == null ? .09 : o.stagger, delay: o.delay || 0 });
  };
  WD.openCapsules = function (els) {
    if (RM || !hasGsap()) { els.forEach(function (x) { x.style.width = '2.1em'; }); return; }
    gsap.fromTo(els, { width: 0 }, { width: '2.1em', duration: 1.2, ease: 'power4.inOut', stagger: .15 });
  };

  /* ------------------------------------------------------------------ contadores (.counter[data-to], 1.6s power2.out, pt-BR) */
  WD.countUp = function (els) {
    els.forEach(function (el) {
      var to = +el.dataset.to;
      if (RM || !hasGsap()) { el.textContent = to.toLocaleString('pt-BR'); return; }
      var o = { v: 0 };
      gsap.fromTo(o, { v: 0 }, { v: to, duration: 1.6, ease: 'power2.out', onUpdate: function () { el.textContent = Math.round(o.v).toLocaleString('pt-BR'); } });
    });
  };
  WD.counters = function (scope) { $$('.counter[data-to]', scope).forEach(function (el) { WD.whenVisible(el, function () { WD.countUp([el]); }, '0px 0px -15% 0px'); }); };

  /* ------------------------------------------------------------------ line highlight (Lando: clip-path + bloco champanhe) */
  WD.highReveal = function (wrap) {
    [].forEach.call(wrap.children, function (el, k) {
      var line = el.querySelector(':scope > .line');
      if (!line) { line = doc.createElement('span'); line.className = 'line'; while (el.firstChild) line.appendChild(el.firstChild); el.appendChild(line); }
      var block = line.querySelector('.high-line-reveal');
      if (!block) { block = doc.createElement('span'); block.className = 'high-line-reveal'; block.style.transformOrigin = 'right center'; line.appendChild(block); }
      line.getAnimations().forEach(function (a) { a.cancel(); }); block.getAnimations().forEach(function (a) { a.cancel(); });
      if (RM) { block.style.transform = 'scaleX(0)'; return; }
      line.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0%)' }], { duration: 750, delay: k * 120, easing: EASE_P2, fill: 'both' });
      block.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: 750, delay: 300 + k * 120, easing: EASE_SNAP, fill: 'both' });
    });
  };

  /* ------------------------------------------------------------------ pétalas 2D — praia: brancas e creme, veio champanhe, blush raro */
  function petalSprite(kind) {
    var c = doc.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d'); x.translate(32, 32);
    var fill = kind === 'blush' ? '#E8B4C0' : kind === 'cream' ? '#F6F3EC' : kind === 'lantern' ? '#E8A54B' : '#FFFFFF';
    x.beginPath(); x.moveTo(0, -26); x.bezierCurveTo(17, -20, 19, 4, 0, 26); x.bezierCurveTo(-19, 4, -17, -20, 0, -26);
    x.fillStyle = fill; x.fill();
    x.lineWidth = 1.4; x.strokeStyle = 'rgba(184,151,90,.38)'; x.stroke();          // contorno champanhe: lê sobre papel claro
    x.fillStyle = kind === 'blush' ? 'rgba(217,142,159,.55)' : 'rgba(184,151,90,.42)';
    x.beginPath(); x.moveTo(0, -16); x.bezierCurveTo(8, -8, 8, 8, 0, 22); x.bezierCurveTo(-5, 6, -7, -8, 0, -16); x.fill();
    return c;
  }
  WD.petalSprite = petalSprite;
  var SPRITES = null, fields = [];
  function pickSprite(tint) {
    SPRITES = SPRITES || { white: petalSprite('white'), cream: petalSprite('cream'), blush: petalSprite('blush'), lantern: petalSprite('lantern') };
    if (tint === 'lantern') return Math.random() < .6 ? SPRITES.lantern : SPRITES.cream;
    var r = Math.random(); return r < .04 ? SPRITES.blush : r < .55 ? SPRITES.white : SPRITES.cream;   // blush ≈ 4%
  }
  WD.petals = function (scope) {
    $$('canvas[data-wd-petals]', scope).forEach(function (cv) {
      if (cv._field) return;
      var f = cv._field = { cv: cv, ctx: cv.getContext('2d'), n: +cv.getAttribute('data-wd-petals') || 12, tint: cv.getAttribute('data-wd-tint'), ps: [], w: 0, h: 0, on: false, inter: cv.hasAttribute('data-wd-interactive'), mx: -999, my: -999 };
      f.size = function () { var dpr = Math.min(devicePixelRatio || 1, 1.5), r = cv.getBoundingClientRect(); f.w = r.width; f.h = r.height; cv.width = Math.max(1, f.w * dpr); cv.height = Math.max(1, f.h * dpr); f.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
      f.seed = function (top) { f.ps = []; for (var i = 0; i < f.n; i++) f.ps.push({ x: Math.random() * f.w, y: top ? -Math.random() * f.h * .6 : Math.random() * f.h, s: (f.inter ? 10 : 8) + Math.random() * 10, r: Math.random() * 6.28, rs: (Math.random() - .5) * 1.4, vy: 12 + Math.random() * 22, ph: Math.random() * 6.28, vx: 0, vi: 0, a: .45 + Math.random() * .5, img: pickSprite(f.tint) }); };
      f.size(); f.seed(false);
      if (f.inter) {
        cv.parentElement.addEventListener('pointermove', function (e) { var r = cv.getBoundingClientRect(); f.mx = e.clientX - r.left; f.my = e.clientY - r.top; });
        cv.parentElement.addEventListener('pointerleave', function () { f.mx = f.my = -999; });
      }
      fields.push(f);
      if (RM) draw(f, 0, 0);
      else if ('IntersectionObserver' in w) new IntersectionObserver(function (es) { f.on = es[0].isIntersecting; }, { root: WD.scroller, rootMargin: '100px' }).observe(cv);
    });
  };
  function draw(f, t, dt) {
    var x = f.ctx; x.clearRect(0, 0, f.w, f.h);
    f.ps.forEach(function (p) {
      if (dt) {
        var dx = p.x - f.mx, dy = p.y - f.my, d = Math.hypot(dx, dy);
        if (d < 120 && d > 1) { var q = 1 - d / 120; q = q * q * 900; p.vx += dx / d * q * dt; p.vi += dy / d * q * dt; }
        p.vx *= .92; p.vi *= .92;
        p.y += (p.vy + p.vi) * dt; p.x += Math.sin(t * .8 + p.ph) * 14 * dt + p.vx * dt; p.r += p.rs * dt;
        if (p.y > f.h + 30) { p.y = -30; p.x = Math.random() * f.w; }
        if (p.x > f.w + 30) p.x = -30; if (p.x < -30) p.x = f.w + 30;
      }
      x.save(); x.globalAlpha = p.a; x.translate(p.x, p.y); x.rotate(p.r); x.scale(1, .55 + .45 * Math.abs(Math.sin(t * .9 + p.ph))); x.drawImage(p.img, -p.s / 2, -p.s / 2, p.s, p.s); x.restore();
    });
  }
  WD.petalBurst = function (cv) { var f = cv && cv._field; if (f) { f.seed(true); if (RM) draw(f, 0, 0); } };

  /* ------------------------------------------------------------------ parallax (Elicyon [data-parallax], scale 1.1, ±8%) */
  var parallaxes = [];
  /* um motor de scroll externo (wd-motion.js) pode assumir o parallax */
  WD.parallaxOff = function () { parallaxes = []; WD.parallax = function () {}; };
  WD.parallax = function (scope) { parallaxes = parallaxes.concat($$('[data-parallax="inner"]', scope).filter(function (p) { return parallaxes.indexOf(p) < 0; })); };
  function updateParallax() {
    if (RM) return;
    parallaxes.forEach(function (p) {
      var wr = p.closest('[data-parallax="wrapper"]') || p.parentElement, r = wr.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
      var k = clamp((innerHeight - r.top) / (innerHeight + r.height)) - .5, sp = +(p.getAttribute('data-wd-speed') || 1);
      p.style.setProperty('--py', (k * -16 * sp).toFixed(2) + '%');
    });
  }

  /* ------------------------------------------------------------------ marquee só roda em vista */
  WD.marquee = function (scope) {
    if (!('IntersectionObserver' in w)) return;
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { $$('[data-css-marquee-list]', e.target).forEach(function (l) { l.style.animationPlayState = e.isIntersecting ? 'running' : 'paused'; }); }); }, { root: WD.scroller });
    $$('.wd-marquee', scope).forEach(function (m) { io.observe(m); });
  };

  /* ------------------------------------------------------------------ moldura do CTA (Elicyon: abre no hover/foco do link) */
  WD.frames = function (scope) {
    $$('[data-wd-frame]', scope).forEach(function (fr) {
      var t = $('[data-wd-frame-trigger]', fr), go = $('.wd-cta-go', fr) || t; if (!t) return;
      if (RM) { fr.classList.add('is-open'); return; }
      go.addEventListener('mouseenter', function () { fr.classList.add('is-open'); });
      go.addEventListener('mouseleave', function () { fr.classList.remove('is-open'); });
      t.addEventListener('focus', function () { fr.classList.add('is-open'); });
      t.addEventListener('blur', function () { fr.classList.remove('is-open'); });
    });
  };

  /* ------------------------------------------------------------------ modal (clip-path, scrim com blur, foco preso, Esc) */
  WD.modal = function (modal) {
    if (!modal || modal._wd) return; modal._wd = 1;
    if (modal.parentElement !== doc.body) doc.body.appendChild(modal);       // camada própria, acima da navbar
    var last = null;
    function focusables() { return $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', modal).filter(function (x) { return !x.disabled && x.offsetParent !== null; }); }
    function open(from) { last = from || doc.activeElement; modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false'); WD.lock(true); setTimeout(function () { var f = focusables(); if (f[0]) f[0].focus(); }, RM ? 0 : 120); }
    function close() { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); WD.lock(false); if (last && last.focus) last.focus(); }
    $$('[data-wd-close]', modal).forEach(function (b) { b.addEventListener('click', close); });
    doc.addEventListener('keydown', function (e) {
      if (!modal.classList.contains('is-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab') { var f = focusables(), a = f[0], z = f[f.length - 1]; if (!f.length) return; if (e.shiftKey && doc.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && doc.activeElement === z) { e.preventDefault(); a.focus(); } }
    });
    $$('[data-wd-open="' + modal.id + '"]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); open(b); }); });
    modal._open = open; modal._close = close;
    return modal;
  };

  /* ------------------------------------------------------------------ init */
  WD.init = function (o) {
    o = o || {};
    WD.scroller = typeof o.scroller === 'string' ? $(o.scroller) : o.scroller;
    WD.content = typeof o.content === 'string' ? $(o.content) : o.content;
    WD.nav = $(o.nav || '#wd-nav');
    if (!WD.scroller) throw new Error('WD.init: scroller não encontrado');
    initLenis(o.lenis);
    initGrain($(o.grain || '#wd-grain'));
    initCursor();
    WD.textRoll(doc); WD.magnet(doc); WD.rise(doc); WD.counters(doc); WD.petals(doc); WD.parallax(doc); WD.marquee(doc); WD.frames(doc);
    $$('.wd-modal').forEach(WD.modal);
    /* âncoras internas com [data-wd-goto] rolam pelo scroller */
    doc.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-wd-goto]'); if (!a) return;
      e.preventDefault(); WD.goTo(a.getAttribute('data-wd-goto'));
    });
    /* scroll: um rAF por quadro */
    var queued = false;
    WD.scroller.addEventListener('scroll', function () { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; updateParallax(); WD._scroll.forEach(function (fn) { fn(WD.scroller.scrollTop); }); }); }, { passive: true });
    /* laço único */
    var last = 0;
    function tick(t) {
      var dt = last ? Math.min(.05, t - last) : .016; last = t;
      WD._tick.forEach(function (fn) { fn(t, dt); });
      if (!RM) fields.forEach(function (f) { if (f.on) draw(f, t, dt); });
    }
    if (hasGsap()) gsap.ticker.add(tick); else (function raf(ts) { tick(ts / 1000); requestAnimationFrame(raf); })(0);
    var rT = 0;
    addEventListener('resize', function () { clearTimeout(rT); rT = setTimeout(function () { fields.forEach(function (f) { f.size(); }); updateParallax(); WD._scroll.forEach(function (fn) { fn(WD.scroller.scrollTop); }); }, 120); });
    updateParallax();
    return WD;
  };

  w.WD = WD;
})(window);
