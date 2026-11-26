/* site.js — lógica das seções do site. Os comportamentos genéricos vêm de wd-core.js (window.WD). */
(function () {
  'use strict';
  var WD = window.WD.init({ scroller: '#site-main', content: '#site-scroller', nav: '#wd-nav', lenis: { lerp: .085, wheelMultiplier: .9, syncTouch: false } });
  var WDM = window.WDM.prepare();                                   /* camada global de movimento (wd-motion.js) */
  var $ = WD.$, $$ = WD.$$, RM = WD.RM, doc = document, body = doc.body;
  var hasGsap = !!window.gsap;

  var clamp = WD.clamp, MOBILE = WD.MOBILE;
  /* cursor: um único triângulo dourado, sem ponto de rastro; cresce de leve em links e fotos;
     rótulo contextual (Ver · Arraste · Ouvir · Pausar · Abrir · Salvar) em texto pequeno ao lado — só em ponteiro fino */
  (function () {
    var cur = $('#wd-cursor'), lb = $('#wd-cursorLabel'); if (!cur) return;
    if (!WD.FINE) { [cur, lb].forEach(function (e) { e && e.remove(); }); return; }
    body.classList.add('wd-cursor');
    var x = 0, y = 0;
    addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      x = e.clientX; y = e.clientY;
      cur.style.transform = 'translate(' + (x - 3) + 'px,' + (y - 3) + 'px)';
      lb.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      body.classList.add('wd-cursor-seen'); body.classList.remove('wd-cursor-out');
    }, { passive: true });
    var lab = $('.wd-cursor-label', lb);
    function labelFor(t) {
      var k = t.closest('[data-wd-cursor]'); if (k) return k.getAttribute('data-wd-cursor');
      if (t.closest('#wd-player')) return $('#wd-player').getAttribute('aria-pressed') === 'true' ? 'Pausar' : 'Ouvir';
      if (t.closest('[data-css-marquee], [data-wd-drag]')) return 'Arraste';
      if (t.closest('a figure, a img, button img, [data-wd-zoom]')) return 'Ver';
      return '';
    }
    doc.addEventListener('pointerover', function (e) {
      var t = e.target; if (!t.closest) return;
      var txt = labelFor(t);
      cur.classList.toggle('is-grow', !txt && !!t.closest('a,button,label,select,input,textarea,[data-anim],.wd-word,[tabindex="0"],figure,.wd-card,.wd-icon-cell'));
      if (txt) lab.textContent = txt;
      lb.classList.toggle('has-label', !!txt);
    });
    doc.documentElement.addEventListener('mouseleave', function () { body.classList.add('wd-cursor-out'); });
  })();
  var WEDDING = new Date('2027-06-01T18:00:00-03:00');            /* DATA_ISO — contagem e .ics */

  /* =====================================================================================================
     NAVBAR — transparente → vidro washi após 120px → noite sobre seções escuras; link atual; menu mobile
     ===================================================================================================== */
  var nav = $('#wd-nav'), navLinks = $$('.wd-navlinks .u-link');
  WD.onScroll(function (y) {
    nav.classList.toggle('nav--scrolled', y > 120);
    var nb = nav.offsetHeight;
    var cur = '';
    navLinks.forEach(function (a) { var s = doc.getElementById(a.getAttribute('data-wd-goto')); if (s && s.offsetHeight && s.getBoundingClientRect().top <= nb + 80) cur = a.getAttribute('data-wd-goto'); });
    navLinks.forEach(function (a) { var on = a.getAttribute('data-wd-goto') === cur; a.classList.toggle('is-current', on); if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
  });
  var menuBtn = $('#wd-menuBtn'), menu = $('#wd-mpanel'), menuTxt = $('#wd-menuTxt'), menuIc = $('#wd-menuIc');
  menuIc.style.d = 'path("M4 8L20 8M4 16L20 16")';
  function setMenu(open) {
    if (menu.classList.contains('is-open') === open) return;
    menu.classList.toggle('is-open', open); menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    body.classList.toggle('wd-menu-open', open);
    menuBtn.setAttribute('aria-expanded', open); menuBtn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    menuIc.style.d = open ? 'path("M6 6L18 18M6 18L18 6")' : 'path("M4 8L20 8M4 16L20 16")';
    WD.setWord(menuTxt, open ? 'Fechar' : 'Menu');
    WD.lock(open);
    if (open) setTimeout(function () { var a = $('a', menu); if (a) a.focus(); }, RM ? 0 : 350);
  }
  menuBtn.addEventListener('click', function () { setMenu(!menu.classList.contains('is-open')); });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  doc.addEventListener('keydown', function (e) {
    if (!menu.classList.contains('is-open')) return;
    if (e.key === 'Escape') { setMenu(false); menuBtn.focus(); }
    if (e.key === 'Tab') {                                               /* foco preso entre o botão e os links */
      var f = [menuBtn].concat($$('a', menu)), i = f.indexOf(doc.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  addEventListener('resize', function () { if (innerWidth >= 768) setMenu(false); });

  /* =====================================================================================================
     #inicio — HERO (shader do design system: ondulação no terço inferior, onda em anel do ponteiro)
     ===================================================================================================== */
  var hero = $('#inicio'), stage = $('.wd-hero-stage', hero), content = $('.wd-hero-content', hero), glCan = $('#wd-gl');
  var words = $$('[data-wd-name]', hero);
  var GL = null, heroP = 0, heroZoom = 1, entered = false, ptr = { x: 0, y: 0, cx: 0, cy: 0 };
  var PAPER = [251 / 255, 248 / 255, 243 / 255];

  function initHeroGL() {
    var THREE = window.THREE; if (!THREE) return Promise.reject('three ausente');
    var renderer; try { renderer = new THREE.WebGLRenderer({ canvas: glCan, alpha: false, antialias: false, powerPreference: 'high-performance' }); } catch (e) { return Promise.reject(e); }
    renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.25 : 1.5));
    var scene = new THREE.Scene(), W = 1, H = 1, cam = new THREE.OrthographicCamera(-.5, .5, .5, -.5, -100, 100);
    var U = { uTex: { value: null }, uTime: { value: 0 }, uDarken: { value: 0 }, uWaveT: { value: 10 }, uMouse: { value: new THREE.Vector2(.5, .5) },
      uScale: { value: new THREE.Vector2(1, 1) }, uOffset: { value: new THREE.Vector2(0, 0) }, uRect: { value: new THREE.Vector4(.3, 0, .7, 1) },
      uTexel: { value: new THREE.Vector2(1 / 724, 1 / 508) }, uPaper: { value: new THREE.Vector3(PAPER[0], PAPER[1], PAPER[2]) } };
    var mat = new THREE.ShaderMaterial({ uniforms: U,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: [
        'uniform sampler2D uTex;uniform float uTime,uDarken,uWaveT;uniform vec2 uMouse,uScale,uOffset,uTexel;uniform vec4 uRect;uniform vec3 uPaper;varying vec2 vUv;',
        'void main(){',
        '  vec2 l=vec2((vUv.x-uRect.x)/uRect.z,(vUv.y-uRect.y)/uRect.w);',
        '  float wm=smoothstep(.38,.05,vUv.y);',                                   /* só o terço inferior: mar e areia */
        '  l.x+=sin(vUv.y*40.+uTime*1.2)*.0015*wm;',
        '  float d=distance(vUv,uMouse);l+=sin(d*46.-uWaveT*7.)*exp(-d*9.)*exp(-uWaveT*1.2)*.008;',
        '  vec2 uv=clamp(l,0.,1.)*uScale+uOffset;vec2 t=uTexel*1.3;',
        '  vec3 c=texture2D(uTex,uv).rgb*.4+(texture2D(uTex,uv+vec2(t.x,0.)).rgb+texture2D(uTex,uv-vec2(t.x,0.)).rgb+texture2D(uTex,uv+vec2(0.,t.y)).rgb+texture2D(uTex,uv-vec2(0.,t.y)).rgb)*.15;',
        '  float top=uRect.y+uRect.w;float m=(uRect.x>0.?smoothstep(uRect.x,uRect.x+.24,vUv.x):1.)*(top<1.?smoothstep(top,top-.16,vUv.y):1.);c=mix(uPaper,c,m);',
                '  c*=1.-uDarken;',
        '  float g=fract(sin(dot(gl_FragCoord.xy+floor(uTime*24.)*7.,vec2(12.9898,78.233)))*43758.5453);c+=(g-.5)*.035;',  /* grão de filme */
        '  gl_FragColor=vec4(c,1.);}'].join('\n') });
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); plane.position.z = -5; scene.add(plane);
    var aspect = 724 / 508;
    function fit() {
      W = stage.clientWidth || 1; H = stage.clientHeight || 1;
      cam.left = -W / 2; cam.right = W / 2; cam.top = H / 2; cam.bottom = -H / 2; cam.updateProjectionMatrix();
      renderer.setSize(W, H, false);
      /* desktop: foto nos 70% da direita; mobile: foto na parte de baixo (y0 negativo corta as pernas), papel no alto para os nomes */
      var mob = W < 768, x0 = mob ? 0 : .3, y0 = mob ? -.16 : 0, w = mob ? 1 : .7, h = mob ? .62 : 1, fx = .5, fy = mob ? .5 : .62;   /* object-position */
      U.uRect.value.set(x0, y0, w, h);
      var ra = W * w / (H * h), sx = 1, sy = 1; if (ra > aspect) sy = aspect / ra; else sx = ra / aspect;
      U.uScale.value.set(sx, sy); U.uOffset.value.set((1 - sx) * fx, (1 - sy) * (1 - fy));
    }
    /* pétalas brancas e creme (blush ≈ 4%) em InstancedMesh, fugindo do ponteiro */
    var COUNT = MOBILE ? 80 : 220;
    var petMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(WD.petalSprite('white')), transparent: true, depthWrite: false, opacity: 0 });
    var mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(14, 14), petMat, COUNT); scene.add(mesh);
    var cWhite = new THREE.Color(1, 1, 1), cCream = new THREE.Color(.965, .953, .925), cBlush = new THREE.Color(.91, .71, .75);
    var dummy = new THREE.Object3D(), mouse = { x: -9999, y: -9999 }, pets = [];
    for (var i = 0; i < COUNT; i++) {
      pets.push({ x: (Math.random() - .5) * 2400, y: (Math.random() - .5) * 1600, z: Math.random() * 4 - 2, s: .55 + Math.random() * 1.05, ph: Math.random() * 6.28, r1: Math.random() * 6.28, r2: Math.random() * 6.28, rs: (Math.random() - .5) * 2, vy: .45 + Math.random() * 1, vx: 0, vi: 0 });
      var r = Math.random(); mesh.setColorAt(i, r < .04 ? cBlush : r < .55 ? cWhite : cCream);
    }
    stage.addEventListener('pointermove', function (e) {
      var rc = stage.getBoundingClientRect(), lx = e.clientX - rc.left, ly = e.clientY - rc.top;
      mouse.x = lx - W / 2; mouse.y = H / 2 - ly;
      ptr.x = lx / W - .5; ptr.y = ly / H - .5;
      var nx = lx / W, ny = 1 - ly / H;
      if (Math.hypot(nx - U.uMouse.value.x, ny - U.uMouse.value.y) > .06) { U.uMouse.value.set(nx, ny); U.uWaveT.value = 0; }
    }, { passive: true });
    function petals(t, dt) {
      for (var j = 0; j < COUNT; j++) {
        var p = pets[j], sway = Math.sin(t * .8 + p.ph) * .45 + Math.sin(t * .31 + p.ph * 2.1) * .3, dx = p.x - mouse.x, dy = p.y - mouse.y, dd = Math.hypot(dx, dy);
        if (dd < 180 && dd > 1) { var f = 1 - dd / 180, q = f * f * 9; p.vx += dx / dd * q; p.vi += dy / dd * q; }
        p.vx *= .9; p.vi *= .9; p.y -= p.vy * dt * 60 * .9; p.x += sway + p.vx * dt * 6; p.y += p.vi * dt * 6; p.r1 += p.rs * dt; p.r2 += p.rs * .7 * dt;
        if (p.y < -H / 2 - 30) { p.y = H / 2 + 30; p.x = (Math.random() - .5) * W * 1.2; }
        if (p.x > W / 2 + 40) p.x = -W / 2 - 40; if (p.x < -W / 2 - 40) p.x = W / 2 + 40;
        dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.r1, p.r2, p.r1 * .5); dummy.scale.setScalar(p.s); dummy.updateMatrix(); mesh.setMatrixAt(j, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    GL = { renderer: renderer, scene: scene, cam: cam, U: U, plane: plane, petMat: petMat, zoom: 1.12, fit: fit, petals: petals };
    fit(); addEventListener('resize', fit);
    return new Promise(function (res) {
      new THREE.TextureLoader().load('assets/img/juntos-praia-724.webp', function (t) {
        t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
        U.uTex.value = t; aspect = t.image.width / t.image.height; U.uTexel.value.set(1 / t.image.width, 1 / t.image.height); fit();
        draw(0, 0); glCan.classList.add('is-ready'); res();
      }, undefined, function () { res(); });
    });
  }
  function heroVisible() { return WD.scroller.scrollTop < hero.offsetHeight && !doc.hidden; }
  function draw(t, dt) {
    var W = stage.clientWidth, H = stage.clientHeight, z = GL.zoom * heroZoom;
    GL.plane.scale.set(W * z, H * z, 1);
    GL.U.uTime.value = t; GL.U.uWaveT.value += dt; GL.U.uDarken.value = heroP * .22;
    if (dt) GL.petals(t, dt);
    GL.renderer.render(GL.scene, GL.cam);
  }
  /* sem WebGL no reduced motion: fica a imagem estática e os nomes já preenchidos */
  /* WebGL detectado antes de baixar o three: sem ele, hero estático e intro no plano B (SVG), sem erros no console */
  var HAS_GL = (function () { try { var c = doc.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl'), x = g && g.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); return !!g; } catch (e) { return false; } })();   /* o contexto de teste é liberado na hora */
  var heroReady = (RM || !HAS_GL) ? Promise.resolve() :
    WD.loadScript('assets/vendor/three-r160.classic.js').then(initHeroGL)
      .catch(function (e) { console.info('Hero sem WebGL — mantida a imagem estática.', e); });
  window.wdReady = (window.wdReady || []).concat(heroReady);

  function heroEntrance() {
    if (entered) return; entered = true;
    startCountdown();
    if (RM || !hasGsap) { hero.classList.add('wd-hero-in'); words.forEach(function (w) { w.style.setProperty('--fill', 1); }); return; }
    hero.classList.add('wd-hero-in');                                       /* os nomes entram pelo data-wd-reveal="hero" (wd-motion) */
    if (GL) { gsap.fromTo(GL, { zoom: 1.12 }, { zoom: 1, duration: 2.4, ease: 'power2.out' }); gsap.to(GL.petMat, { opacity: .95, duration: 1.6, delay: .8 }); }
  }
  doc.addEventListener('wd:open', heroEntrance);

  /* laço: WebGL só renderiza com o hero em vista; ponteiro move o preenchimento dos nomes */
  WD.onTick(function (t, dt) {
    if (RM || !entered || !heroVisible()) return;
    ptr.cx += (ptr.x - ptr.cx) * .06; ptr.cy += (ptr.y - ptr.cy) * .06;
    words.forEach(function (w) { w.style.setProperty('--px', (ptr.cx * 40).toFixed(1) + 'px'); w.style.setProperty('--py', (ptr.cy * 30).toFixed(1) + 'px'); });
    if (GL && GL.U.uTex.value) draw(t, dt);
  });
  /* scroll: o hero fica preso (sticky) enquanto o conteúdo sobe e esmaece, a foto escurece e aproxima e os nomes se preenchem */
  var heroST = { p: 0 };
  function heroApply() {
    heroP = heroST.p;
    content.style.transform = 'translate3d(0,' + (-heroP * stage.offsetHeight * .22).toFixed(1) + 'px,0)';
    content.style.opacity = (1 - clamp(heroP * 1.25)).toFixed(3);
    heroZoom = 1 + heroP * .14;
    words.forEach(function (w) { w.style.setProperty('--fill', clamp(heroP * 2.2).toFixed(3)); });
  }
  if (!RM && hasGsap) gsap.to(heroST, { p: 1, ease: 'none', onUpdate: heroApply, scrollTrigger: { trigger: '#convite', start: 'top bottom', end: 'top top', scrub: 1.2 } });

  var navPill = $('#wd-nav .wd-nav-cta'), heroCta = $('.wd-hero-actions .wd-btn', hero);
  function pillState() {
    var r = heroCta.getBoundingClientRect(), ctaSeen = r.bottom > 0 && r.top < innerHeight && parseFloat(content.style.opacity || 1) > .35;
    var hide = ctaSeen || !nav.classList.contains('nav--scrolled');
    navPill.classList.toggle('is-hidden', hide); navPill.setAttribute('aria-hidden', hide ? 'true' : 'false'); navPill.tabIndex = hide ? -1 : 0;
  }
  WD.onScroll(pillState); pillState();

  /* contagem regressiva real (dias · horas · minutos), atualiza a cada minuto com um tique que preenche o numeral */
  var cd = { d: $('[data-wd-cd="d"]', hero), h: $('[data-wd-cd="h"]', hero), m: $('[data-wd-cd="m"]', hero) };
  function remaining() {
    var ms = Math.max(0, WEDDING - Date.now());
    return { d: Math.floor(ms / 864e5), h: Math.floor(ms % 864e5 / 36e5), m: Math.floor(ms % 36e5 / 6e4) };
  }
  var pad2 = function (n) { return String(n).padStart(2, '0'); };
  function fmt(r) { return { d: String(r.d), h: pad2(r.h), m: pad2(r.m) }; }
  function label(r) { $('.wd-cd', hero).setAttribute('aria-label', 'Faltam ' + r.d + ' dias, ' + r.h + ' horas e ' + r.m + ' minutos para o casamento'); }
  (function () { var f0 = fmt(remaining()); cd.d.textContent = f0.d; cd.h.textContent = f0.h; cd.m.textContent = f0.m; label(remaining()); })();
  function startCountdown() {
    setTimeout(function step() {
      var n = remaining(), f = fmt(n);
      WDM.countTo(cd.d, f.d); WDM.countTo(cd.h, f.h); WDM.countTo(cd.m, f.m); label(n);
      setTimeout(step, 60000 - Date.now() % 60000 + 50);
    }, 60000 - Date.now() % 60000 + 50);
  }

  /* selo “Salve a data”: gera e baixa um .ics do evento */
  function ics() {
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var utc = function (d) { return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z'; };
    var end = new Date(WEDDING.getTime() + 6 * 36e5);
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mayara e Lucas//Casamento//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', 'UID:casamento-mayara-lucas-20270601@mayaraelucas', 'DTSTAMP:' + utc(new Date()),
      'DTSTART:' + utc(WEDDING), 'DTEND:' + utc(end),
      'SUMMARY:Casamento de Mayara & Lucas', 'LOCATION:À beira-mar — local a ser anunciado',
      'DESCRIPTION:Cerimônia às 18h00. Confirme sua presença no site.',
      'BEGIN:VALARM', 'TRIGGER:-P7D', 'ACTION:DISPLAY', 'DESCRIPTION:Falta uma semana para o casamento de Mayara & Lucas', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  }
  $('#wd-saveDate').addEventListener('click', function (e) {
    e.preventDefault();
    var url = URL.createObjectURL(new Blob([ics()], { type: 'text/calendar;charset=utf-8' })), a = doc.createElement('a');
    a.href = url; a.download = 'casamento-mayara-e-lucas-01-06-2027.ics'; body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  });
  window.wdIcs = ics;   /* para conferência */

  /* =====================================================================================================
     MÚSICA TEMA — Count on Me · Bruno Mars (assets/audio/tema.mp3)
     Fora do iOS a música toca pelo player NATIVO e o fade usa audio.volume: passar o <audio> pelo Web Audio
     (createMediaElementSource) faz o navegador reamostrar com correção de relógio, e com a página ocupada
     (WebGL, intro, scroll) isso se ouve como “desafinadas” momentâneas.
     No iOS audio.volume é somente leitura: aí entra o Web Audio, com buffer grande (latencyHint 'playback')
     e o fade agendado no próprio motor de áudio (não a cada quadro). O MP3 é 48 kHz, a taxa dos celulares.
     ===================================================================================================== */
  var audio = $('#wd-audio'), player = $('#wd-player');
  var TARGET = .45, ctx = null, gain = null, vol = 0, fadeTok = 0, playing = false, resumeOnShow = false, opened = false;
  var PREF = 'wd-sound';
  var IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function getPref() { try { return localStorage.getItem(PREF); } catch (e) { return null; } }
  function setPref(v) { try { localStorage.setItem(PREF, v); } catch (e) { /* modo privado: segue sem lembrar */ } }

  function ensureGraph() {                       /* sempre chamado dentro de um gesto do usuário; só no iOS */
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    /* por file:// o Web Audio sai MUDO (áudio de outra origem): aí fica no player nativo */
    if (!IOS || !AC || location.protocol === 'file:') return;
    try {
      try { ctx = new AC({ latencyHint: 'playback' }); } catch (e1) { ctx = new AC(); }
      var src = ctx.createMediaElementSource(audio);
      gain = ctx.createGain(); gain.gain.value = vol;
      src.connect(gain).connect(ctx.destination);
      audio.volume = 1;
    } catch (e) { ctx = null; gain = null; }
  }
  function setVol(v) { vol = v; if (gain) { gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.setValueAtTime(v, ctx.currentTime); } else audio.volume = v; }
  /* fade sem salto: no iOS agendado no motor de áudio; nos demais, audio.volume por requestAnimationFrame */
  function fadeTo(to, ms, done) {
    var tok = ++fadeTok, from = vol, t0 = performance.now();
    if (gain) {
      var now = ctx.currentTime, g = gain.gain; from = g.value;   /* parte do valor real (um fade pode interromper outro) */
      g.cancelScheduledValues(now); g.setValueAtTime(from, now); g.linearRampToValueAtTime(to, now + ms / 1000);
      vol = to;
      setTimeout(function () { if (tok === fadeTok && done) done(); }, ms);
      return;
    }
    if (doc.hidden) { setVol(to); if (done) done(); return; }   /* aba oculta: o rAF não roda */
    (function step(now) {
      if (tok !== fadeTok) return;
      var p = Math.min(1, (now - t0) / ms), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      setVol(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step); else if (done) done();
    })(t0);
  }
  function playerUI() {
    player.setAttribute('aria-pressed', playing ? 'true' : 'false');
    player.setAttribute('aria-label', playing ? 'Pausar música' : 'Tocar música');
  }
  function startMusic(ms) {
    ensureGraph(); setVol(vol);
    var p = audio.play();
    playing = true; playerUI();
    if (p && p.catch) p.catch(function () { playing = false; playerUI(); });
    fadeTo(TARGET, ms);
  }
  function stopMusic(ms) {
    playing = false; playerUI();
    fadeTo(0, ms, function () { if (!playing) audio.pause(); });
  }
  function toggleMusic() {
    if (playing) { stopMusic(600); setPref('off'); }
    else { startMusic(600); setPref('on'); }
  }
  player.addEventListener('click', toggleMusic);
  /* atalho M (fora de campos de texto) */
  doc.addEventListener('keydown', function (e) {
    if (!opened || e.ctrlKey || e.metaKey || e.altKey || (e.key !== 'm' && e.key !== 'M')) return;
    var t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault(); toggleMusic();
  });
  /* aba oculta: pausa com fade e retoma ao voltar, se estava tocando */
  doc.addEventListener('visibilitychange', function () {
    if (doc.hidden) { if (playing) { resumeOnShow = true; fadeTo(0, 600, function () { if (doc.hidden) audio.pause(); }); } }
    else if (resumeOnShow) { resumeOnShow = false; if (playing) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); fadeTo(TARGET, 600); } }
  });

  /* =====================================================================================================
     #abertura — carregamento (como o #wd-loader do design system) → selo → envelope que se abre
     Outros trechos podem atrasar o 100% registrando uma promessa em window.wdReady (ex.: textura do hero).
     ===================================================================================================== */
  var env = $('#abertura'), word = $('#wd-loaderWord'), bar = $('#wd-loaderBar'), pct = $('#wd-loaderPct');
  var sealWrap = $('.wd-env-seal', env), openBtn = $('#wd-openBtn'), alt = $('#wd-openAlt');
  var wantSound = getPref() !== 'off';
  WD.lock(true);

  /* o botão principal reflete a preferência salva */
  function prefUI() {
    openBtn.classList.toggle('is-muted', !wantSound);
    openBtn.setAttribute('aria-label', wantSound ? 'Abrir o convite com música' : 'Abrir o convite sem som');
    $('#wd-openAltTxt').textContent = wantSound ? 'Entrar sem som' : 'Entrar com música';
    alt.classList.toggle('is-sound', !wantSound);                         /* o ícone do botão mostra o que ele faz */
  }
  prefUI();

  var prog = { v: 0 };
  function upd() { pct.textContent = Math.round(prog.v) + '%'; bar.style.transform = 'scaleX(' + prog.v / 100 + ')'; }
  if (!RM && hasGsap) {
    gsap.to($$('.wd-env-sketch circle, .wd-env-sketch path', env), { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', stagger: .08,
      onComplete: function () { env.classList.add('is-drawn'); } });
    gsap.fromTo(word, { letterSpacing: '.5em', marginRight: '-.5em' }, { letterSpacing: '.02em', marginRight: '-.02em', duration: 1.2, ease: 'power3.out' });
    gsap.to(prog, { v: 88, duration: 1.4, ease: 'power2.out', onUpdate: upd });
  } else { env.classList.add('is-drawn'); word.style.letterSpacing = '.02em'; word.style.marginRight = '-.02em'; prog.v = 88; upd(); }

  var minWait = new Promise(function (r) { setTimeout(r, RM ? 300 : 1600); });
  var maxWait = new Promise(function (r) { setTimeout(r, 7000); });
  var assets = Promise.all([doc.fonts ? doc.fonts.ready : 0, $('.wd-env-logo', env).decode ? $('.wd-env-logo', env).decode().catch(function () {}) : 0].concat(window.wdReady || []));
  Promise.race([Promise.all([assets, minWait]), maxWait]).then(ready);

  function ready() {
    var show = function () {
      bar.style.background = 'var(--wd-champagne)';
      sealWrap.hidden = false;
      requestAnimationFrame(function () { env.classList.add('is-ready'); });
      setTimeout(function () { openBtn.focus({ preventScroll: true }); }, RM ? 0 : 500);
    };
    if (RM || !hasGsap) { prog.v = 100; upd(); show(); return; }
    gsap.to(prog, { v: 100, duration: .3, onUpdate: upd, onComplete: function () { setTimeout(show, 150); } });
  }

  function openInvite(sound) {
    if (opened) return; opened = true;
    wantSound = sound; setPref(sound ? 'on' : 'off');
    if (sound) startMusic(2500); else { playing = false; playerUI(); }
    openBtn.disabled = alt.disabled = true;
    env.classList.add('is-breaking');                                   /* o selo quebra */
    setTimeout(function () {
      env.classList.add('is-open');                                     /* as metades do envelope se abrem */
      body.classList.remove('wd-is-opening');
      doc.dispatchEvent(new CustomEvent('wd:open', { detail: { sound: sound } }));
    }, RM ? 0 : 380);
    setTimeout(function () {
      env.classList.add('is-gone'); env.setAttribute('aria-hidden', 'true');
      WD.lock(false);
      $('#site-main').focus({ preventScroll: true });
      player.hidden = false;
      requestAnimationFrame(function () { player.classList.add('is-in'); });
    }, RM ? 50 : 1350);
  }
  openBtn.addEventListener('click', function () { openInvite(wantSound); });
  alt.addEventListener('click', function () { openInvite(!wantSound); });


  /* =====================================================================================================
     #convite — três cenas de tela cheia. A folha cobre o hero (raio 32 → 0, 22 no mobile); cena 1 com pin e
     scrub; cena 2 com “juntos” atravessando a foto; cena 3 com a moldura de papel que fecha.
     ===================================================================================================== */
  var conv = $('#convite'), sc = WD.scroller;
  var easeIO = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };   /* ≈ --wd-ease-inout */
  var vh = function () { return sc.clientHeight; };

  /* ---------------- cena 1 · a janela que se abre (pin sticky + scrub 1.2): clip-path 18% 30% → 0, scale 1.25 → 1 */
  var s1 = $('.wd-s1', conv), win1 = $('.wd-s1-win', s1), img1 = $('.wd-s1-img', s1), s1st = { p: RM ? 1 : 0 };
  function scene1() {
    var e = easeIO(clamp(s1st.p / .7));
    win1.style.clipPath = 'inset(' + (18 * (1 - e)).toFixed(2) + '% ' + (30 * (1 - e)).toFixed(2) + '% round 2px)';
    img1.style.transform = 'scale(' + (1.25 - .25 * e).toFixed(4) + ')';
    s1._photo = e > .82;
  }
  if (!RM && hasGsap) gsap.to(s1st, { p: 1, ease: 'none', onUpdate: scene1, scrollTrigger: { trigger: s1, start: 'top top', end: 'bottom bottom', scrub: 1.2 } });
  scene1();

  /* ---------------- cena 2 · “juntos” desliza (xPercent -8 → 8), a foto faz paralaxe vertical oposta */
  var s2 = $('.wd-s2', conv), ph2 = $('.wd-s2-photo', s2), par2 = $('.wd-s2-par', s2);
  var lOut = $('.wd-s2-layer.is-out', s2), lIn = $('.wd-s2-layer.is-in', s2), ws2 = $$('.wd-s2-w', s2), s2st = { p: .5 };
  function clip2() {                        /* a troca contorno ↔ preenchimento acontece exatamente na borda da foto */
    var lr = lOut.getBoundingClientRect(), pr = ph2.getBoundingClientRect(), W = lr.width, H = lr.height;
    var t = pr.top - lr.top, l = pr.left - lr.left, b = pr.bottom - lr.top, r = pr.right - lr.left;
    lIn.style.clipPath = 'inset(' + t + 'px ' + (W - r) + 'px ' + (H - b) + 'px ' + l + 'px)';
    lOut.style.clipPath = 'polygon(evenodd, 0 0, ' + W + 'px 0, ' + W + 'px ' + H + 'px, 0 ' + H + 'px, 0 0, ' + l + 'px ' + t + 'px, ' + r + 'px ' + t + 'px, ' + r + 'px ' + b + 'px, ' + l + 'px ' + b + 'px, ' + l + 'px ' + t + 'px)';
  }
  function scene2() {
    var x = (-8 + 16 * s2st.p).toFixed(2) + '%';
    ws2.forEach(function (w) { w.style.transform = 'translateX(' + x + ')'; });
    par2.style.transform = 'translateY(' + ((s2st.p - .5) * -10).toFixed(2) + '%)';
    clip2();
  }
  if (!RM && hasGsap) gsap.fromTo(s2st, { p: 0 }, { p: 1, ease: 'none', onUpdate: scene2, scrollTrigger: { trigger: s2, start: 'top bottom', end: 'bottom top', scrub: 1.2 } });
  scene2();

  /* ---------------- cena 3 · moldura de papel fecha de 0 para 8vh × 6vw conforme a cena entra */
  var s3 = $('.wd-s3', conv), frame3 = $('.wd-s3-frame', s3), s3st = { p: RM ? 1 : 0 };
  function scene3() { frame3.style.setProperty('--wd-f', easeIO(s3st.p).toFixed(3)); }
  if (!RM && hasGsap) gsap.to(s3st, { p: 1, ease: 'none', onUpdate: scene3, scrollTrigger: { trigger: s3, start: 'top bottom', end: 'top 5%', scrub: 1.2 } });
  scene3();

  /* ---------------- navbar sobre foto em tela cheia: vidro escuro e texto em papel (estado de interface) */
  function navPhoto() {
    var nb = nav.offsetHeight, s1r = s1.getBoundingClientRect(), s3r = s3.getBoundingClientRect();
    var over1 = s1._photo && s1r.top <= 0 && s1r.bottom > vh() * .98, over3 = s3r.top <= nb && s3r.bottom > nb;
    nav.classList.toggle('nav--photo', !!(over1 || over3));
  }
  WD.onScroll(navPhoto); navPhoto();

  /* ---------------- qualidade: foto ampliada além de 1.6× (com o devicePixelRatio) ganha filtro + Ken Burns */
  var realPx = {};
  function pxOf(img) {
    var u = img.currentSrc || img.src;
    if (realPx[u]) return Promise.resolve(realPx[u]);
    return new Promise(function (res) { var t = new Image(); t.onload = function () { realPx[u] = [t.naturalWidth, t.naturalHeight]; res(realPx[u]); }; t.onerror = function () { res(null); }; t.src = u; });
  }
  function quality() {
    var dpr = devicePixelRatio || 1;
    $$('img[data-wd-quality]').forEach(function (img) {
      if (!img.complete || !img.naturalWidth) return;
      pxOf(img).then(function (px) {
        if (!px) return;
        var box = img.closest('.wd-kb') || img, br = box.getBoundingClientRect();
        var k = Math.max(br.width / px[0], br.height / px[1]) * dpr, up = k > 1.6;
        img.classList.toggle('wd-upscaled', up); box.classList.toggle('wd-kb-on', up && !RM); img.dataset.wdScale = k.toFixed(2);
      });
    });
  }
  $$('img[data-wd-quality]').forEach(function (img) { if (img.complete) quality(); img.addEventListener('load', quality); });
  if (window.ScrollTrigger) ScrollTrigger.addEventListener('refresh', function () { clip2(); quality(); });

  /* ---------------- motor global: revelações, transições, fio dourado e movimento contínuo */
  WDM.init();
})();
