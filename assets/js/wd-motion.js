/* =====================================================================================================
   wd-motion.js — camada global de movimento (GSAP 3.12.5 + ScrollTrigger, scroller #site-main, Lenis).
   Uma seção ganha movimento só com atributos; nenhuma seção escreve revelação à mão.

   data-wd-reveal = lines | words | chars | para | caption | image | fade | draw | count | hero | lit
   modificadores   data-wd-delay="0.2"   data-wd-stagger="0.05"   data-wd-start="top 85%" | "open" (= evento wd:intro-done)
                   data-wd-scrub   data-wd-end="top 35%"   data-wd-trigger=".seletor"   data-wd-range="0.3 0.8"
                   data-wd-parallax="none" (em image)
   seções          data-wd-bg = paper | foam | washi | night | sea     data-wd-sheet (folha 32 → 0)
   Uso: WDM.prepare() logo depois de WD.init(); WDM.init() no fim do site.js.
   ===================================================================================================== */
(function (w) {
  'use strict';
  var doc = document, gsap = w.gsap, ST = null, WD = null;
  var M = { recs: [], opened: false };
  var $$ = function (s, r) { return [].slice.call((r || doc).querySelectorAll(s)); };
  var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var RM = false, MOBILE = false, SCRUB = 1.2;
  var COLORS = { paper: '#FBF8F3', foam: '#F6F3EC', washi: '#F1E9DE', night: '#241B15', sea: '#1E3048' };
  var DARK = { night: 1, sea: 1 };
  /* coreografia de cada bloco: eyebrow → título → itálico → parágrafo → legenda → botões (.12s entre cada) */
  var RANK = { chars: 0, hero: 1, lit: 1, lines: 1, words: 1, image: 2, draw: 2, para: 3, count: 3, caption: 4, fade: 5 };
  var stg = function (x) { return x * (MOBILE ? .7 : 1); };
  var blur = function (px) { return MOBILE ? 'blur(0px)' : 'blur(' + px + 'px)'; };
  var expoIO = function (t) { return t === 0 ? 0 : t === 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2; };

  /* posição no documento do scroller (corrige elementos presos por sticky) */
  function docTop(el) {
    var sc = WD.scroller, sr = sc.getBoundingClientRect();
    var stick = el.closest('.wd-scene-sticky, #inicio');
    if (stick && stick !== el) {
      var base = stick.id === 'inicio' ? 0 : docTop(stick.parentElement);
      return base + (el.getBoundingClientRect().top - stick.getBoundingClientRect().top);
    }
    return el.getBoundingClientRect().top - sr.top + sc.scrollTop;
  }

  /* ------------------------------------------------------------------ divisão de texto */
  function tokenize(el, cls) {
    var out = [];
    (function walk(n) {
      [].slice.call(n.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var frag = doc.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(function (t) {
            if (!t) return;
            if (/^\s+$/.test(t)) { frag.appendChild(doc.createTextNode(' ')); return; }
            var s = doc.createElement('span'); s.className = cls; s.textContent = t; frag.appendChild(s); out.push(s);
          });
          n.replaceChild(frag, c);
        } else if (c.nodeType === 1 && !c.classList.contains('wd-sr') && !/^(BR|SVG|ICONIFY-ICON|IMG)$/i.test(c.tagName)) walk(c);
      });
    })(el);
    return out;
  }
  function openTag(e) { return '<' + e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? ' class="' + e.className + '"' : '') + '>'; }
  var esc = function (t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  /* linhas medidas pelo navegador DEPOIS do layout (preserva itálicos e spans); refeitas no resize */
  function buildLines(el, mask) {
    if (el._wdSrc == null) el._wdSrc = el.innerHTML;
    el.innerHTML = el._wdSrc;
    var sr = el.querySelector(':scope > .wd-sr'), words = tokenize(el, 'wd-tok'), lines = [], last = null;
    words.forEach(function (t) { var y = Math.round(t.getBoundingClientRect().top); if (last === null || Math.abs(y - last) > 3) { lines.push([]); last = y; } lines[lines.length - 1].push(t); });
    var html = sr ? sr.outerHTML : '';
    lines.forEach(function (ws) {
      var h = '', open = [];
      ws.forEach(function (t, i) {
        var ch = []; for (var p = t.parentNode; p && p !== el; p = p.parentNode) ch.unshift(p);
        var k = 0; while (k < open.length && k < ch.length && open[k] === ch[k]) k++;
        for (var j = open.length - 1; j >= k; j--) h += '</' + open[j].tagName.toLowerCase() + '>';
        open = open.slice(0, k);
        if (i) h += ' ';
        for (var q = k; q < ch.length; q++) { h += openTag(ch[q]); open.push(ch[q]); }
        h += esc(t.textContent);
      });
      for (var z = open.length - 1; z >= 0; z--) h += '</' + open[z].tagName.toLowerCase() + '>';
      html += mask ? '<span class="wd-ml"><span class="wd-ml-i">' + h + '</span></span>' : '<span class="wd-pl">' + h + '</span>';
    });
    el.innerHTML = html;
    return $$(mask ? '.wd-ml-i' : '.wd-pl', el);
  }
  function splitChars(el) {
    var out = [];
    (function walk(n) {
      [].slice.call(n.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          if (!c.textContent.trim()) return;
          /* um invólucro por nó de texto: num pai flex, os espaços entre as letras não somem */
          var frag = doc.createElement('span'); frag.className = 'wd-chs';
          Array.prototype.forEach.call(c.textContent, function (ch) {
            if (/\s/.test(ch)) { frag.appendChild(doc.createTextNode(ch)); return; }
            var s = doc.createElement('span'); s.className = 'wd-ch'; s.textContent = ch; frag.appendChild(s); out.push(s);
          });
          n.replaceChild(frag, c);
        } else if (c.nodeType === 1 && !/^(SVG|IMG)$/i.test(c.tagName)) walk(c);
      });
    })(el);
    return out;
  }
  /* odômetro: cada dígito numa coluna 0–9 que desliza */
  function buildOdo(el) {
    var txt = (el.textContent || '').trim();
    el.setAttribute('data-wd-value', txt);
    el.innerHTML = '';
    var cols = [];
    Array.prototype.forEach.call(txt, function (ch) {
      if (!/\d/.test(ch)) { var s = doc.createElement('span'); s.className = 'wd-odo-sep'; s.textContent = ch; el.appendChild(s); return; }
      var col = doc.createElement('span'); col.className = 'wd-odo'; col.setAttribute('aria-hidden', 'true');
      var strip = doc.createElement('span'); strip.className = 'wd-odo-s';
      for (var d = 0; d < 10; d++) { var n = doc.createElement('span'); n.textContent = d; strip.appendChild(n); }
      col.appendChild(strip); el.appendChild(col); strip._d = +ch; cols.push(strip);
    });
    return cols;
  }
  /* rola o odômetro até um novo valor (usado pela contagem regressiva a cada minuto) */
  /* leva uma revelação direto ao estado final (a intro entrega os nomes já no lugar) */
  M.finish = function (el) { var r = el && el._wdRec; if (!r) return; r.played = true; r.tl.progress(1); };
  M.countTo = function (el, value) {
    value = String(value);
    var cur = el.getAttribute('data-wd-value');
    if (cur === value) return;
    if (!cur || cur.length !== value.length || !el.querySelector('.wd-odo')) { el.textContent = value; var c = buildOdo(el); c.forEach(function (s) { gsap.set(s, { yPercent: -s._d * 10 }); }); return; }
    el.setAttribute('data-wd-value', value);
    var strips = $$('.wd-odo-s', el), digits = value.replace(/\D/g, '');
    strips.forEach(function (s, i) {
      var d = +digits[i]; if (s._d === d) return; s._d = d;
      if (RM) gsap.set(s, { yPercent: -d * 10 }); else gsap.to(s, { yPercent: -d * 10, duration: .75, ease: 'power3.out' });
    });
  };

  /* brilho champanhe que passa uma vez pelos itálicos de destaque */
  function shine(el) {
    if (RM) return;
    $$('em', el).forEach(function (em) {
      em.style.setProperty('--wd-em-c', getComputedStyle(em).color);
      em.classList.remove('wd-em-shine'); void em.offsetWidth; em.classList.add('wd-em-shine');
      setTimeout(function () { em.classList.remove('wd-em-shine'); }, 1500);
    });
  }

  /* ------------------------------------------------------------------ revelações */
  function willChange(targets, on) { targets.forEach(function (t) { t.style.willChange = on ? 'transform, opacity' : ''; }); }
  function buildTl(rec) {
    var el = rec.el, t = rec.type, s = rec.stagger, tl = gsap.timeline({ paused: true });
    var targets = [];
    if (RM) {                                                     /* movimento reduzido: só fades de .3s, já no estado final */
      if (t === 'count') { buildOdo(el).forEach(function (st) { gsap.set(st, { yPercent: -st._d * 10 }); }); }
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: .3, ease: 'power2.out' });
      return tl;
    }
    if (t === 'lines') {
      targets = buildLines(el, true);
      tl.fromTo(targets, { yPercent: 110, rotate: 1.5 }, { yPercent: 0, rotate: 0, duration: 1.2, ease: 'power4.out', stagger: s != null ? s : stg(.08) });
      tl.call(function () { shine(el); });
    } else if (t === 'hero') {                                    /* heroUp (AURELIA): sobe, desfoca → nítido, acende */
      targets = $$(':scope > *', el);
      tl.fromTo(targets, { opacity: 0, yPercent: 40, filter: blur(8) }, { opacity: 1, yPercent: 0, filter: 'blur(0px)', duration: 1.1, ease: 'expo.out', stagger: s != null ? s : stg(.17), clearProps: 'filter' });
    } else if (t === 'lit') {                                     /* frase que acende palavra por palavra (.12 → 1, 55ms entre palavras) */
      targets = el._wdTok || (el._wdTok = tokenize(el, 'wd-tok'));
      tl.fromTo(targets, { opacity: .12 }, { opacity: 1, duration: .5, ease: 'power1.out', stagger: s != null ? s : .055 });
    } else if (t === 'para') {
      targets = buildLines(el, false);
      tl.fromTo(targets, { opacity: 0, y: 18, filter: blur(4) }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: .9, ease: 'power2.out', stagger: s != null ? s : stg(.06), clearProps: 'filter' });
    } else if (t === 'words') {
      targets = el._wdTok || (el._wdTok = tokenize(el, 'wd-tok'));
      tl.fromTo(targets, { opacity: 0, yPercent: 40, filter: blur(6) }, { opacity: 1, yPercent: 0, filter: 'blur(0px)', duration: 1, ease: 'power3.out', stagger: s != null ? s : stg(.04) });
      if (!rec.scrub) tl.call(function () { shine(el); });
    } else if (t === 'chars') {
      targets = el._wdCh || (el._wdCh = splitChars(el));
      var ls = getComputedStyle(el).letterSpacing; ls = ls === 'normal' ? '0px' : ls;
      tl.fromTo(targets, { opacity: 0 }, { opacity: 1, duration: .9, ease: 'power3.out', stagger: s != null ? s : stg(.015) }, 0)
        .fromTo(el, { letterSpacing: '.4em' }, { letterSpacing: ls, duration: .9, ease: 'power3.out', clearProps: 'letterSpacing' }, 0);
    } else if (t === 'caption') {
      if (!el._wdCap) {
        var tx = doc.createElement('span'); tx.className = 'wd-cap-t'; while (el.firstChild) tx.appendChild(el.firstChild);
        var rule = doc.createElement('span'); rule.className = 'wd-cap-rule'; rule.setAttribute('aria-hidden', 'true');
        el.appendChild(rule); el.appendChild(tx); el._wdCap = [rule, tx];
      }
      tl.fromTo(el._wdCap[0], { width: 0 }, { width: 32, duration: .5, ease: 'power3.out' })
        .fromTo(el._wdCap[1], { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: .8, ease: 'power3.inOut' }, '-=.1');
    } else if (t === 'image') {
      var img = el.querySelector('img'), par = el.getAttribute('data-wd-parallax') !== 'none';
      tl.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'power4.inOut' }, 0);
      if (img) tl.fromTo(img, { scale: 1.25, filter: blur(6) }, { scale: par ? 1.12 : 1, filter: 'blur(0px)', duration: 1.3, ease: 'power4.inOut' }, 0);
      targets = img ? [el, img] : [el];
      if (img && par) gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: SCRUB } });
    } else if (t === 'draw') {
      targets = $$('path, circle, line, polyline, rect', el);
      targets.forEach(function (p) { if (!p.getAttribute('pathLength')) p.setAttribute('pathLength', '1'); p.style.strokeDasharray = 1; });
      tl.fromTo(targets, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: 'power3.inOut', stagger: .08 });
    } else if (t === 'count') {
      targets = buildOdo(el);
      tl.fromTo(targets, { yPercent: 0 }, { yPercent: function (i, s2) { return -s2._d * 10; }, duration: 1.6, ease: 'power3.out', stagger: .06 });
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: .5, ease: 'power2.out' }, 0);   /* os zeros do odômetro não aparecem antes de rolar */
    } else {                                                    /* fade */
      targets = [el];
      tl.fromTo(el, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .7, ease: 'power2.out' });
    }
    tl.eventCallback('onStart', function () { willChange(targets, true); });
    tl.eventCallback('onComplete', function () { willChange(targets, false); });
    rec.targets = targets;
    return tl;
  }
  function trackRange(rec) {                     /* data-wd-range: fração do percurso de um track com pin */
    var tr = rec.trigger, r = (rec.range || '0 1').split(/\s+/).map(Number);
    var span = function () { return Math.max(1, tr.offsetHeight - WD.scroller.clientHeight); };
    return { start: function () { return docTop(tr) + r[0] * span(); }, end: function () { return docTop(tr) + r[1] * span(); } };
  }
  function setupReveal(el) {
    if (el._wdRec) return el._wdRec;
    var rec = el._wdRec = {
      el: el, type: el.getAttribute('data-wd-reveal') || 'fade', scrub: el.hasAttribute('data-wd-scrub'),
      delay: +(el.getAttribute('data-wd-delay') || 0), stagger: el.hasAttribute('data-wd-stagger') ? +el.getAttribute('data-wd-stagger') : null,
      start: el.getAttribute('data-wd-start') || 'top 85%', end: el.getAttribute('data-wd-end') || 'top 35%',
      range: el.getAttribute('data-wd-range'), played: false
    };
    var trSel = el.getAttribute('data-wd-trigger');
    rec.trigger = trSel ? (el.closest(trSel) || doc.querySelector(trSel)) : el;
    rec.tl = buildTl(rec);
    var wait = (RM ? 0 : (RANK[rec.type] || 0) * .12) + rec.delay;
    rec.play = function () {
      if (rec.played) return; rec.played = true;
      rec.tl.delay(wait).play(0);
    };
    rec.replay = function () { rec.played = true; rec.tl.delay(0).restart(true); };
    if (rec.scrub && !RM) {
      var pos = rec.range ? trackRange(rec) : { start: rec.start, end: rec.end };
      rec.tl.paused(false);
      ST.create({ trigger: rec.trigger, start: pos.start, end: pos.end, scrub: SCRUB, animation: rec.tl, invalidateOnRefresh: true });
      rec.played = true;
    } else if (rec.start === 'open') {
      if (M.opened) rec.play(); else doc.addEventListener('wd:intro-done', rec.play, { once: true });   /* o hero começa quando a intro termina */
    } else {
      /* clamp(): um elemento na última dobra também revela, mesmo que "top 85%" esteja além do fim da rolagem */
      ST.create({ trigger: rec.trigger, start: 'clamp(' + rec.start + ')', end: 'bottom top', onEnter: rec.play, onEnterBack: rec.play, onLeave: rec.play });
    }
    M.recs.push(rec);
    return rec;
  }
  /* linhas e parágrafos se refazem na nova largura (e voltam ao estado final se já tocaram) */
  var lastW = 0;
  function resplit() {
    if (innerWidth === lastW) return; lastW = innerWidth;
    M.recs.forEach(function (rec) {
      if (rec.type !== 'lines' && rec.type !== 'para') return;
      if (RM) return;
      var progress = rec.tl.progress(), wasPlaying = rec.tl.isActive();
      rec.tl.kill();
      rec.tl = buildTl(rec);
      if (rec.played && (progress === 1 || !wasPlaying)) rec.tl.progress(1);
      else if (rec.played) rec.tl.play(0);
    });
  }

  /* ------------------------------------------------------------------ transições entre seções */
  function setupSheets() {
    $$('[data-wd-sheet]').forEach(function (sec) {
      if (RM) { sec.style.borderTopLeftRadius = sec.style.borderTopRightRadius = '0px'; return; }
      var R = MOBILE ? 22 : 32;
      gsap.fromTo(sec, { borderTopLeftRadius: R, borderTopRightRadius: R }, { borderTopLeftRadius: 0, borderTopRightRadius: 0, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top 60%', end: 'top top', scrub: SCRUB } });
    });
  }
  /* cor de fundo contínua: cada seção interpola do tom anterior para o seu quando cruza o meio da tela */
  function setupBg() {
    var secs = $$('#site-scroller > [data-wd-bg]'); if (!secs.length) return;
    var root = doc.documentElement, col = function (s) { return COLORS[s.getAttribute('data-wd-bg')] || COLORS.paper; };
    if (RM) { secs.forEach(function (s) { s.style.backgroundColor = col(s); }); return; }
    root.style.setProperty('--wd-page-bg', col(secs[0]));
    secs.forEach(function (s, i) {
      if (!i) return;
      var from = col(secs[i - 1]), to = col(s); if (from === to) return;
      gsap.fromTo(root, { '--wd-page-bg': from }, { '--wd-page-bg': to, ease: 'none', immediateRender: false,
        scrollTrigger: { trigger: s, start: 'top 60%', end: 'top 40%', scrub: SCRUB } });
    });
  }
  /* tema da navbar e do player acompanha a seção sob a navbar */
  function theme() {
    var nav = doc.getElementById('wd-nav'); if (!nav) return;
    var nb = nav.offsetHeight, dark = false;
    $$('#site-scroller > [data-wd-bg]').some(function (s) { var r = s.getBoundingClientRect(); if (r.top <= nb && r.bottom > nb) { dark = !!DARK[s.getAttribute('data-wd-bg')]; return true; } return false; });
    nav.classList.toggle('nav--night', dark);
    doc.body.classList.toggle('wd-theme-dark', dark);
  }
  /* profundidade na saída: o último bloco da seção recua (opacity .35, scale .97, y -6vh) enquanto a próxima sobe */
  function setupDepth() {
    if (RM) return;
    $$('#site-scroller > [data-wd-bg]:not(#inicio)').forEach(function (sec) {
      var kids = [].slice.call(sec.children).filter(function (k) { return !k.classList.contains('wd-bg'); });
      var last = kids[kids.length - 1]; if (!last) return;
      gsap.fromTo(last, { opacity: 1, scale: 1, y: 0 }, { opacity: .35, scale: .97, y: '-6vh', ease: 'none', immediateRender: false,
        scrollTrigger: { trigger: sec, start: 'bottom bottom', end: 'bottom top', scrub: SCRUB } });
    });
  }
  /* fio dourado contínuo: um único SVG ao longo da página, passando ao lado dos títulos ([data-wd-thread]) */
  var thread = null;
  function setupThread() {
    var host = WD.content; if (!host) return;
    thread = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    thread.setAttribute('class', 'wd-thread'); thread.setAttribute('aria-hidden', 'true');
    thread.innerHTML = '<defs><linearGradient id="wd-thread-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B8975A" stop-opacity="0"/><stop offset=".04" stop-color="#907533"/><stop offset=".5" stop-color="#E3CC9A"/><stop offset=".96" stop-color="#B8975A"/><stop offset="1" stop-color="#B8975A" stop-opacity="0"/></linearGradient></defs><path pathLength="1"/>';
    host.appendChild(thread);
    layoutThread();
    var path = thread.querySelector('path');
    if (RM) { path.style.strokeDashoffset = 0; return; }
    gsap.fromTo(path, { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: host, start: 'top top', end: 'bottom bottom', scrub: SCRUB } });
  }
  function layoutThread() {
    if (!thread) return;
    var host = WD.content, H = host.scrollHeight, W = host.clientWidth, edge = MOBILE ? 10 : Math.max(18, W * .018);
    thread.setAttribute('viewBox', '0 0 ' + W + ' ' + H); thread.style.height = H + 'px';
    var pts = [[edge, 0]];
    $$('[data-wd-thread]').forEach(function (t) {
      var r = t.getBoundingClientRect(), y = docTop(t) + r.height * .5, x = Math.max(edge, t.getBoundingClientRect().left - (MOBILE ? 10 : 26));
      pts.push([edge, y - Math.min(220, r.height + 80)]); pts.push([x, y]); pts.push([edge, y + Math.min(220, r.height + 80)]);
    });
    pts.push([edge, H]);
    pts.sort(function (a, b) { return a[1] - b[1]; });
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {                  /* Catmull-Rom → Bézier */
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    thread.querySelector('path').setAttribute('d', d);
  }

  /* ------------------------------------------------------------------ movimento contínuo */
  function setupParallax() {
    if (WD.parallaxOff) WD.parallaxOff();
    if (RM) return;
    $$('[data-parallax="inner"]').forEach(function (p) {
      var wr = p.closest('[data-parallax="wrapper"]') || p.parentElement, k = +(p.getAttribute('data-wd-speed') || 1);
      gsap.fromTo(p, { '--py': (8 * k) + '%' }, { '--py': (-8 * k) + '%', ease: 'none', scrollTrigger: { trigger: wr, start: 'top bottom', end: 'bottom top', scrub: SCRUB } });
    });
  }
  /* títulos grandes inclinam com a velocidade do scroll (máx. 1.5deg) e voltam com power3.out */
  var skewers = [];
  function setupSkew() {
    if (RM) return;
    var els = $$('[data-wd-skew]');
    M.recs.forEach(function (r) { if ((r.type === 'lines' || r.type === 'words') && parseFloat(getComputedStyle(r.el).fontSize) >= 40 && els.indexOf(r.el) < 0) els.push(r.el); });
    skewers = els.map(function (el) { return gsap.quickTo(el, 'skewY', { duration: .6, ease: 'power3.out' }); });
  }
  function onVelocity(v) {
    var k = clamp(-v * .08, -1.5, 1.5);
    skewers.forEach(function (q) { q(k); });
    $$('[data-css-marquee-list]').forEach(function (l) { l.getAnimations().forEach(function (a) { a.playbackRate = 1 + Math.min(4, Math.abs(v) * .25); }); });
  }
  /* fundos vivos: orbes (AURELIA) nas seções claras, no lugar da respiração; estrelas nas noturnas */
  function setupAura() {
    $$('.wd-bg, .wd-interlude').forEach(function (bg, i) {
      var sec = bg.closest('[data-wd-bg]'); if (sec && DARK[sec.getAttribute('data-wd-bg')]) return;
      if (bg.querySelector('.wd-orb')) return;
      var o = doc.createElement('span'); o.setAttribute('aria-hidden', 'true');
      o.className = 'wd-orb ' + (i % 2 ? 'wd-orb--foam' : 'wd-orb--gold');
      o.style.cssText = 'width:42vmax;height:42vmax;top:-18vmax;' + (i % 2 ? 'left:-10vmax' : 'right:-10vmax');
      bg.insertBefore(o, bg.firstChild);
    });
    $$('[data-wd-stars]').forEach(function (box) {
      if (box.childElementCount) return;
      var n = MOBILE ? 50 : 120, frag = doc.createDocumentFragment();
      for (var k = 0; k < n; k++) {
        var st = doc.createElement('i'), sz = (1 + Math.random()).toFixed(2) + 'px';
        st.className = 'wd-star';
        st.style.cssText = 'left:' + (Math.random() * 100).toFixed(2) + '%;top:' + (Math.random() * 100).toFixed(2) + '%;width:' + sz + ';height:' + sz +
          ';--dur:' + (2.5 + Math.random() * 3.5).toFixed(2) + 's;--del:' + (-Math.random() * 6).toFixed(2) + 's';
        frag.appendChild(st);
      }
      box.appendChild(frag);
    });
  }
  /* nome fantasma (M & L): paralaxe lenta */
  function setupGhost() {
    if (RM) return;
    $$('[data-wd-ghost]').forEach(function (g) {
      var sec = g.closest('section, footer') || g.parentElement;
      gsap.fromTo(g, { yPercent: 0 }, { yPercent: -18, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: SCRUB } });
    });
  }
  /* magnético leve (.15×) em todos os botões; solta com elastic.out(1,.4) — o único elástico do site */
  function setupMagnet() {
    if (!WD.FINE || RM) return;
    $$('.btn-w, .wd-seal, .wd-player, .wd-modal-close').forEach(function (m) {
      if (m._wdMag) return; m._wdMag = 1;
      var xTo = gsap.quickTo(m, 'x', { duration: .4, ease: 'power3.out' }), yTo = gsap.quickTo(m, 'y', { duration: .4, ease: 'power3.out' });
      m.addEventListener('mousemove', function (e) { var r = m.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * .15); yTo((e.clientY - r.top - r.height / 2) * .15); });
      m.addEventListener('mouseleave', function () { gsap.to(m, { x: 0, y: 0, duration: .8, ease: 'elastic.out(1,0.4)', overwrite: 'auto' }); });
    });
  }
  /* âncoras: Lenis 1.8s expo.inOut; ao chegar, a coreografia do título de destino toca de novo */
  function setupAnchors() {
    WD.goTo = function (id) {
      var el = doc.getElementById(id); if (!el) return;
      var y = id === 'inicio' ? 0 : Math.max(0, docTop(el) - WD.navOffset());
      var arrive = function () {
        var rec = M.recs.filter(function (r) { return el.contains(r.el) && (r.type === 'lines' || r.type === 'words' || r.type === 'chars') && !r.scrub; })[0];
        if (rec) rec.replay();
        var h = el.querySelector('h1,h2,h3') || el; if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
      };
      if (WD.lenis && !RM) WD.lenis.scrollTo(y, { duration: 1.8, easing: expoIO, onComplete: arrive });
      else { WD.scroller.scrollTo({ top: y }); arrive(); }
    };
  }

  /* ------------------------------------------------------------------ init */
  M.prepare = function () {
    WD = w.WD; gsap = w.gsap; ST = w.ScrollTrigger;
    RM = WD.RM; MOBILE = WD.MOBILE;
    if (!gsap || !ST) { console.warn('wd-motion: GSAP/ScrollTrigger ausentes'); return M; }
    gsap.registerPlugin(ST);
    ST.defaults({ scroller: WD.scroller });
    if (WD.lenis) WD.lenis.on('scroll', function (e) { ST.update(); onVelocity(e && e.velocity || 0); });
    doc.addEventListener('wd:intro-done', function () { M.opened = true; });
    /* pétalas: só em papel e washi; na noite, cor de lanterna */
    $$('[data-wd-bg="night"] canvas[data-wd-petals], [data-wd-bg="sea"] canvas[data-wd-petals]').forEach(function (c) { c.setAttribute('data-wd-tint', 'lantern'); });
    return M;
  };
  M.init = function () {
    if (!ST) return M;
    setupAura();
    $$('[data-wd-reveal]').forEach(setupReveal);
    setupSheets(); setupBg(); setupDepth(); setupParallax(); setupGhost(); setupSkew(); setupMagnet(); setupAnchors();
    WD.onScroll(theme); theme();
    lastW = innerWidth;
    ST.addEventListener('refreshInit', function () { resplit(); });
    ST.addEventListener('refresh', layoutThread);
    setupThread();
    var refresh = function () { ST.refresh(); };
    /* fontes carregadas: as linhas medidas com a fonte de reserva são refeitas antes do refresh */
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { lastW = 0; resplit(); refresh(); });
    addEventListener('load', refresh);
    var rt = 0; $$('img').forEach(function (img) { if (!img.complete) img.addEventListener('load', function () { clearTimeout(rt); rt = setTimeout(refresh, 200); }); });
    return M;
  };
  w.WDM = M;
})(window);
