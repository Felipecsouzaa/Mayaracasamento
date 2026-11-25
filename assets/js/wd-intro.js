/* =====================================================================================================
   wd-intro.js — “My Love → Mayara & Lucas”, escrito na areia (window.WDI)
   Acontece entre wd:open (o envelope se abre) e o hero; no auge da onda 2 dispara wd:intro-done.
   Linha do tempo (s, a partir do início da intro):
     escrita  “My” .3–1.0 · “Love” .8–1.6
     onda 1   chega 2.0–2.8 e para logo depois do M e do L · espera até 3.2 · recua 3.2–4.2 (nascem “ayara” e “ucas”)
     “&”      4.0–4.5 · onda 2  4.6 → cobre a tela em 5.1 (passagem para o DOM + FLIP 1.2s) → recua até 6.0
   Renderizadores (mesma linha do tempo): WebGL no MESMO renderer do hero · SVG (plano B sem WebGL) · DOM (movimento reduzido).
   Uma vez por sessão (sessionStorage); “Rever a abertura” ([data-wd-replay]) repete. Pular: botão ou Esc.
   ?intro=1 força a intro de novo na mesma aba (ela roda uma vez por sessão).
   Som da onda: coloque assets/audio/onda.mp3 e marque <body data-wd-wave-sound="assets/audio/onda.mp3">.
   ===================================================================================================== */
(function (w) {
  'use strict';
  var doc = document, body = doc.body, WD = null, GL = null, THREE = null;
  var RM = false, MOBILE = false, KEY = 'wd-intro-seen', DEBUG = /[?&]debug=1/.test(location.search);
  var T = { myA: .3, myB: 1, loveA: .8, loveB: 1.6, w1A: 2, w1Stop: 2.8, w1Back: 3.2, w1End: 4.2, ampA: 4, ampB: 4.5, w2A: 4.6, w2Peak: 5.1, w2End: 6.0 };
  var LEAD = .45;                                    /* as metades do envelope terminam de abrir antes da 1ª letra */
  var I = { running: false, owns: false, debug: null };
  var L = null, dirty = true, mesh = null, U = null, tex = [], ui = null, svgR = null, rmBox = null, dbg = null;
  var t0 = 0, raf = 0, handed = false, mode = '', waveAudio = null, onKey = null;

  var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var seg = function (t, a, b) { return clamp((t - a) / (b - a), 0, 1); };
  var eOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var eIO = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var bump = function (t, a, d) { var p = seg(t, a, a + d); return Math.sin(p * Math.PI); };

  /* ------------------------------------------------------------------ medida real no DOM (depois de document.fonts.ready) */
  function measure() {
    var W = innerWidth, H = innerHeight, box = doc.createElement('div');
    box.className = 'wd-intro-measure'; box.setAttribute('aria-hidden', 'true');
    var row = function (a, b) { return '<p class="wd-intro-names"><span class="wd-il">' + a + '</span><span class="wd-il wd-il-amp">&amp;</span><span class="wd-il">' + b + '</span></p>'; };
    box.innerHTML = row('Mayara', 'Lucas') + row('My', 'Love');
    body.appendChild(box);
    var fin = box.children[0], old = box.children[1], bw = fin.offsetWidth, bh = fin.offsetHeight;
    [fin, old].forEach(function (p) { p.style.left = Math.round((W - bw) / 2) + 'px'; p.style.top = Math.round((H - bh) / 2) + 'px'; });
    var rg = doc.createRange();
    function chars(span) {
      var tn = span.firstChild, out = [];
      for (var i = 0; i < tn.length; i++) { rg.setStart(tn, i); rg.setEnd(tn, i + 1); var b = rg.getBoundingClientRect(); out.push({ ch: tn.data[i], x: b.left, y: b.top, w: b.width, h: b.height }); }
      return out;
    }
    var cs = getComputedStyle(fin.children[0]), ca = getComputedStyle(fin.children[1]);
    var M = { W: W, H: H, fs: parseFloat(cs.fontSize), ampFs: parseFloat(ca.fontSize), font: cs.fontFamily, ampFont: ca.fontFamily, ampStyle: ca.fontStyle,
      fin: [chars(fin.children[0]), chars(fin.children[2])], old: [chars(old.children[0]), chars(old.children[2])], amp: chars(fin.children[1])[0] };
    box.remove();
    /* baseline = topo da caixa de conteúdo + ascendente proporcional (métrica da própria fonte) */
    var c = doc.createElement('canvas').getContext('2d');
    c.font = '400 ' + M.fs + 'px ' + M.font; var m = c.measureText('M');
    M.ascF = m.fontBoundingBoxAscent ? m.fontBoundingBoxAscent / (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent) : .78;
    c.font = M.ampStyle + ' 400 ' + M.ampFs + 'px ' + M.ampFont; var ma = c.measureText('&');
    M.ampAscF = ma.fontBoundingBoxAscent ? ma.fontBoundingBoxAscent / (ma.fontBoundingBoxAscent + ma.fontBoundingBoxDescent) : .78;
    M.base = function (ch, f) { return ch.y + ch.h * (f || M.ascF); };
    /* parada da onda 1: logo depois do M (linha de cima) e do L (linha de baixo) */
    var Mi = M.fin[0][0], Li = M.fin[1][0];
    M.stopT = (Mi.x + Mi.w + 1) / W; M.stopB = (Li.x + Li.w + 1) / W;
    M.rowY = 1 - ((Mi.y + Mi.h) + Li.y) / 2 / H;                 /* entre as linhas, em uv (y para cima) */
    return M;
  }

  /* ------------------------------------------------------------------ máscaras: R iniciais · G letras que somem · B letras que surgem; ordem da escrita + “&” */
  function drawMasks() {
    var dpr = Math.min(devicePixelRatio || 1, MOBILE ? 1.25 : 1.5), cw = Math.round(L.W * dpr), ch = Math.round(L.H * dpr);
    function cnv() { var c = doc.createElement('canvas'); c.width = cw; c.height = ch; var x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, cw, ch); x.scale(dpr, dpr); x.textBaseline = 'alphabetic'; return x; }
    var m = cnv(), o = cnv(), fnt = '400 ' + L.fs + 'px ' + L.font, afnt = L.ampStyle + ' 400 ' + L.ampFs + 'px ' + L.ampFont;
    m.globalCompositeOperation = 'lighter'; m.filter = 'blur(' + Math.max(.6, L.fs * .005).toFixed(2) + 'px)'; m.font = fnt;
    [0, 1].forEach(function (r) {
      L.old[r].forEach(function (c, i) { m.fillStyle = i ? '#0f0' : '#f00'; m.fillText(c.ch, c.x, L.base(c)); });
      L.fin[r].forEach(function (c, i) { if (i) { m.fillStyle = '#00f'; m.fillText(c.ch, c.x, L.base(c)); } });
    });
    /* ordem da escrita: cada letra é um degradê da esquerda para a direita com o tempo do traço (÷ 2s) */
    o.font = fnt; o.lineWidth = Math.max(3, L.fs * .035); o.lineJoin = 'round';
    [[T.myA, T.myB], [T.loveA, T.loveB]].forEach(function (pl, r) {
      var cs = L.old[r], n = cs.length;
      cs.forEach(function (c, i) {
        var s0 = lerp(pl[0], pl[1], i / n), s1 = lerp(pl[0], pl[1], (i + 1) / n), g = o.createLinearGradient(c.x - c.w * .1, 0, c.x + c.w * 1.1, 0);
        g.addColorStop(0, 'rgb(' + Math.round(s0 / 2 * 255) + ',0,0)'); g.addColorStop(1, 'rgb(' + Math.round(s1 / 2 * 255) + ',0,0)');
        o.fillStyle = o.strokeStyle = g; o.fillText(c.ch, c.x, L.base(c)); o.strokeText(c.ch, c.x, L.base(c));
      });
    });
    o.globalCompositeOperation = 'lighter'; o.filter = 'blur(.5px)'; o.font = afnt; o.fillStyle = '#0f0'; o.fillText('&', L.amp.x, L.base(L.amp, L.ampAscF));
    return [m.canvas, o.canvas];
  }

  /* ------------------------------------------------------------------ linha do tempo (um estado para os três renderizadores) */
  function timeline(t) {
    var stopF = Math.min(L.stopT, L.stopB) - .05, s = {};
    s.f1 = t < T.w1A ? 1.3 : t < T.w1Stop ? lerp(1.3, stopF, eOut(seg(t, T.w1A, T.w1Stop))) : t < T.w1Back ? stopF : lerp(stopF, 1.3, eIO(seg(t, T.w1Back, T.w1End)));
    s.min = t < T.w1Stop ? s.f1 : stopF;
    s.glow = bump(t, T.w1Stop - .12, .4);
    s.amp = eOut(seg(t, T.ampA, T.ampB));
    s.f2 = t < T.w2A ? 1.45 : t < T.w2Peak ? lerp(1.45, -.4, eIO(seg(t, T.w2A, T.w2Peak))) : lerp(-.4, 1.5, eIO(seg(t, T.w2Peak, T.w2End)));
    s.after = t >= T.w2Peak ? 1 : 0;
    s.cover = clamp(1 - Math.abs(t - T.w2Peak) / .45, 0, 1);
    return s;
  }

  /* ================================================================== 1 · WebGL (mesmo renderer do hero) */
  var VS = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  var FS = [
    'uniform sampler2D uMask,uOrder;uniform vec2 uRes;',
    'uniform float uTime,uF1,uMin,uF2,uAfter,uGlow,uAmp,uCover,uStopT,uStopB,uRowY,uRecA,uRecB;varying vec2 vUv;',
    'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.03;a*=.5;}return v;}',
    'float stopX(float y){return mix(uStopB,uStopT,smoothstep(uRowY-.05,uRowY+.05,y));}',
    'float tUnc(float x,float s){return uRecA+clamp((x-s)/(1.15-s),0.,1.)*(uRecB-uRecA);}',
    /* relevo visível: iniciais escritas · letras antigas escritas e dissolvidas pela água · letras novas que nascem no refluxo */
    'float relief(vec2 uv,float cm,float s){',
    '  vec4 m=texture2D(uMask,uv);float o=texture2D(uOrder,uv).r;float n=noise(uv*uRes*.08);',
    '  float wr=smoothstep(o-.012,o,uTime*.5+(n-.5)*.012);',
    '  float cov=step(cm,uv.x);',
    '  float dis=max(cov*clamp((uTime-2.)*1.4+(uv.x-cm)*5.+(n-.5)*.8,0.,1.),smoothstep(3.,3.4,uTime));',
    '  float tu=tUnc(uv.x,s);float ap=smoothstep(tu,tu+.18,uTime+(n-.5)*.1)*step(uRecA,uTime);',
    '  return (m.r*wr+m.g*wr*(1.-dis)+m.b*ap)*(1.-uAfter);}',
    'void main(){',
    '  vec2 uv=vUv,px=uv*uRes;float x=uv.x,y=uv.y,t=uTime;',
    '  float dv=(fbm(vec2(y*3.,t*.7))-.5)*.09,s=stopX(y);',
    '  float c1=max(uF1+dv,s),cm=max(uMin+dv,s),c2=uF2+(fbm(vec2(y*2.4+7.,t*.8))-.5)*.14;',
    '  float d1=x-c1,d2=x-c2,w1=smoothstep(0.,.003,d1),w2=smoothstep(0.,.004,d2),inW=max(w1,w2);',
    '  vec2 ds=vec2(sin(px.y*.045+t*3.1),cos(px.x*.04+t*2.3))*.0025*inW;',
    '  vec2 Lo=vec2(-1.,1.)*1.6/uRes;',                                                   /* luz de fim de tarde, do alto à esquerda */
    '  float h=relief(uv+ds,cm,s),hl=relief(uv+ds+Lo,cm,s),hd=relief(uv+ds-Lo,cm,s);',
    /* areia procedural: seca/molhada, grão fino, ondulações suaves */
    '  vec3 dry=vec3(.910,.863,.784),wetc=vec3(.804,.733,.620);',
    '  float g=hash(floor(px*.9)),g2=noise(px*.35),rip=sin(px.y*.055+px.x*.018+fbm(px*.0035)*7.);',
    '  float wet=max(step(cm,x)*(1.-.45*smoothstep(4.2,6.5,t)),inW);',
    '  vec3 col=mix(dry,wetc,wet*.7);',
    '  col*=1.+rip*.025+(g2-.5)*.06+(g-.5)*.05;',
    '  col+=vec3(1.,.95,.85)*.06*(1.-length(uv-vec2(0.,1.))*.7);',
    '  col+=wet*.035*pow(max(rip,0.),10.);',
    /* baixo-relevo: interior mais escuro, borda clara do lado da luz, grãos derramados na borda */
    '  col=col*(1.-.26*h)+(hl-hd)*.17;',
    '  float edge=abs(hl-hd);col+=(step(.86,hash(floor(px*.7)+3.))-.5)*edge*.35;',
    /* letras novas: nascem escuras de molhado e secam em 1.2s */
    '  vec4 mk=texture2D(uMask,uv);float tu=tUnc(x,s);',
    '  col*=1.-.22*mk.b*(1.-clamp((t-tu)/1.2,0.,1.))*step(uRecA,t)*smoothstep(tu,tu+.18,t)*(1.-uAfter);',
    /* brilho dourado rápido nas iniciais quando a espuma encosta */
    '  vec3 gold=vec3(.788,.635,.353);vec2 o6=vec2(6.)/uRes;',
    '  float halo=texture2D(uMask,uv+vec2(o6.x,0.)).r+texture2D(uMask,uv-vec2(o6.x,0.)).r+texture2D(uMask,uv+vec2(0.,o6.y)).r+texture2D(uMask,uv-vec2(0.,o6.y)).r;',
    '  col=mix(col,gold,mk.r*uGlow*.7*(1.-uAfter));col+=gold*halo*.07*uGlow;',
    /* “&”: itálico dourado com brilho suave (sol na areia molhada) */
    '  float am=texture2D(uOrder,uv).g,ah=0.;for(int i=0;i<6;i++){float a=float(i)*1.0472;ah+=texture2D(uOrder,uv+vec2(cos(a),sin(a))*10./uRes).g;}',
    '  col=mix(col,gold*1.05,am*uAmp*(1.-uAfter));col+=vec3(1.,.85,.55)*ah*.045*uAmp*(1.-am)*(1.-uAfter);',
    /* filme fino de água que fica no refluxo */
    '  float film=step(cm,x)*(1.-w1)*exp(-max(c1-x,0.)*30.)*step(uRecA,t)*(1.-smoothstep(4.2,4.8,t));',
    '  col+=vec3(.9,.95,.97)*film*.18;',
    /* água translúcida verde-azulada (.35) com reflexo de céu */
    '  vec3 sky=mix(vec3(.80,.90,.92),vec3(.95,.97,.98),y),water=mix(vec3(.58,.79,.77),sky,.35);',
    '  float sh=(.5+.5*sin(px.x*.02+px.y*.06+t*2.))*noise(px*.01+t*.3);',
    '  col=mix(col,water+sh*.06,.35*inW);',
    /* espuma rendada na frente + bolhas; na onda 2 cobre a tela */
    '  float lace=smoothstep(.48,.62,noise(px*.045+vec2(-t*.9,t*.3)))*.6+smoothstep(.55,.7,noise(px*.11+vec2(t*.5,-t*.2)))*.5;',
    '  float bub=smoothstep(.74,.78,noise(px*.18+vec2(t*.8,0.)))*inW;',
    '  float f1=smoothstep(-.004,.006,d1)*(1.-smoothstep(.006,.045,d1)),f2=smoothstep(-.006,.01,d2)*(1.-smoothstep(.01,.09,d2));',
    '  float foam=clamp((f1+f2)*(.55+lace)+w2*uCover*(.45+lace*.6)+bub*.5,0.,1.);',
    '  col=mix(col,vec3(.985,.98,.97),foam);',
    /* depois do auge: no recuo a areia dá lugar ao próprio plano do hero (crossfade dentro do recuo) */
    '  float a=1.;if(uAfter>.5){a=max(smoothstep(-.18,0.,d2),foam);}',
    '  gl_FragColor=vec4(col,a);}'].join('\n');

  I.attachGL = function (gl) {
    GL = gl; THREE = w.THREE; if (!THREE || !GL) return;
    var px = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); px.needsUpdate = true;
    U = { uMask: { value: px }, uOrder: { value: px }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uF1: { value: 1.3 }, uMin: { value: 1.3 }, uF2: { value: 1.45 },
      uAfter: { value: 0 }, uGlow: { value: 0 }, uAmp: { value: 0 }, uCover: { value: 0 }, uStopT: { value: .5 }, uStopB: { value: .5 }, uRowY: { value: .5 },
      uRecA: { value: T.w1Back + .15 }, uRecB: { value: T.w1End } };
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: false, depthWrite: false }));
    mesh.renderOrder = 10; mesh.position.z = 1; GL.scene.add(mesh);
    try { GL.renderer.compile(GL.scene, GL.cam); } catch (e) {}      /* shader pré-compilado durante o preloader */
    mesh.visible = false;
    prepare();
  };
  function glTextures() {
    var cs = drawMasks();
    tex.forEach(function (t) { t.dispose(); });
    tex = cs.map(function (c) { var t = new THREE.CanvasTexture(c); t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; });
    U.uMask.value = tex[0]; U.uOrder.value = tex[1];
    if (GL.renderer.initTexture) tex.forEach(function (t) { GL.renderer.initTexture(t); });
  }
  function frameGL(t, s) {
    var cv = GL.renderer.domElement, W = cv.clientWidth || L.W, H = cv.clientHeight || L.H;
    mesh.scale.set(W, H, 1);
    U.uRes.value.set(W, H); U.uTime.value = t; U.uF1.value = s.f1; U.uMin.value = s.min; U.uF2.value = s.f2;
    U.uAfter.value = s.after; U.uGlow.value = s.glow; U.uAmp.value = s.amp; U.uCover.value = s.cover;
    if (I.owns) GL.renderer.render(GL.scene, GL.cam);            /* depois da passagem quem desenha é o laço do hero */
  }

  /* ================================================================== 2 · plano B em SVG (sem WebGL) */
  function vnoise(x) { return .5 + .25 * Math.sin(x * 1.7 + 1.3) + .15 * Math.sin(x * 3.9 + .4) + .1 * Math.sin(x * 7.3 + 2.1); }
  function buildSVG() {
    var NS = 'http://www.w3.org/2000/svg', W = L.W, H = L.H, fam = L.font.replace(/"/g, "'");
    function el(n, a, p) { var e = doc.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
    var s = el('svg', { 'class': 'wd-intro-svg', viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' });
    var d = el('defs', {}, s);
    d.innerHTML = '<filter id="wdi-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .38  0 0 0 0 .3  0 0 0 .22 0"/></filter>' +
      '<filter id="wdi-relief" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur in="SourceAlpha" stdDeviation="' + (L.fs * .012).toFixed(1) + '" result="b"/><feDiffuseLighting in="b" surfaceScale="-4" diffuseConstant="1.1" lighting-color="#fff8ec" result="l"><feDistantLight azimuth="225" elevation="38"/></feDiffuseLighting><feComposite in="l" in2="SourceAlpha" operator="in" result="lit"/><feBlend in="lit" in2="SourceGraphic" mode="multiply"/></filter>' +
      '<filter id="wdi-foam" x="-20%" y="-5%" width="140%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".035 .02" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G" result="dd"/><feGaussianBlur in="dd" stdDeviation="1.2"/></filter>' +
      '<filter id="wdi-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
    var sand = el('g', {}, s);
    el('rect', { width: W, height: H, fill: '#E8DCC8' }, sand);
    var wet = el('path', { fill: '#CDBB9E', opacity: '.55' }, sand);
    el('rect', { width: W, height: H, filter: 'url(#wdi-grain)' }, sand);
    var g = el('g', { filter: 'url(#wdi-relief)', fill: '#C4B192', style: 'font-family:' + fam + ';font-size:' + L.fs + 'px' }, sand);
    var R = { s: s, sand: sand, wet: wet, init: [], old: [], fin: [] }, k = 0;
    [0, 1].forEach(function (r) {
      L.old[r].forEach(function (c, i) {
        var cp = el('clipPath', { id: 'wdi-c' + k }, d), rc = el('rect', { x: c.x - c.w * .2, y: 0, width: 0, height: H }, cp);
        var tx = el('text', { x: c.x, y: L.base(c), 'clip-path': 'url(#wdi-c' + k + ')' }, g); tx.textContent = c.ch;
        var pl = r ? [T.loveA, T.loveB] : [T.myA, T.myB], n = L.old[r].length;
        var it = { el: tx, clip: rc, c: c, a: lerp(pl[0], pl[1], i / n), b: lerp(pl[0], pl[1], (i + 1) / n), row: r };
        (i ? R.old : R.init).push(it); k++;
      });
      L.fin[r].forEach(function (c, i) { if (!i) return; var tx = el('text', { x: c.x, y: L.base(c), opacity: 0 }, g); tx.textContent = c.ch; R.fin.push({ el: tx, c: c, row: r }); });
    });
    var amp = el('text', { x: L.amp.x, y: L.base(L.amp, L.ampAscF), fill: '#C9A25A', opacity: 0, filter: 'url(#wdi-glow)', style: 'font-family:' + L.ampFont.replace(/"/g, "'") + ';font-style:italic;font-size:' + L.ampFs + 'px' }, s);
    amp.textContent = '&'; R.amp = amp;
    R.water1 = el('path', { fill: 'rgba(148,202,196,.35)' }, s); R.foam1 = el('path', { fill: 'none', stroke: '#FBF9F5', 'stroke-width': 14, filter: 'url(#wdi-foam)' }, s);
    R.water2 = el('path', { fill: 'rgba(148,202,196,.35)' }, s); R.foam2 = el('path', { fill: 'none', stroke: '#FBF9F5', 'stroke-width': 40, filter: 'url(#wdi-foam)' }, s);
    R.cover = el('path', { fill: '#FBF9F5', opacity: 0, filter: 'url(#wdi-foam)' }, s);
    return R;
  }
  function shore(front, t, amp, stop, seed) {             /* contorno da onda: x(y) em px, com a parada nas iniciais */
    var W = L.W, H = L.H, pts = [];
    for (var i = 0; i <= 28; i++) {
      var y = H * i / 28, uvY = 1 - y / H, x = (front + (vnoise(uvY * 3 + t * .7 + seed) - .5) * amp) * W;
      if (stop) x = Math.max(x, (uvY > L.rowY ? L.stopT : L.stopB) * W);
      pts.push([x, y]);
    }
    return pts;
  }
  function pathOf(pts, toRight) { var W = L.W, H = L.H, d = 'M' + (toRight ? W + 40 : -40) + ' 0'; pts.forEach(function (p) { d += 'L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }); return d + 'L' + (toRight ? W + 40 : -40) + ' ' + H + 'Z'; }
  function lineOf(pts) { return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L'); }
  function xAt(pts, y) { var i = clamp(Math.round(y / L.H * 28), 0, 28); return pts[i][0]; }
  function frameSVG(t, s) {
    var R = svgR, recA = T.w1Back + .15;
    R.init.concat(R.old).forEach(function (it) { it.clip.setAttribute('width', (it.c.w * 1.4 * seg(t, it.a, it.b)).toFixed(1)); });
    var p1 = shore(s.f1, t, .09, true, 0), pm = shore(s.min, t, .09, true, 0), p2 = shore(s.f2, t, .14, false, 7);
    R.water1.setAttribute('d', s.f1 < 1.25 ? pathOf(p1, true) : ''); R.foam1.setAttribute('d', s.f1 < 1.25 ? lineOf(p1) : '');
    R.wet.setAttribute('d', s.min < 1.25 ? pathOf(pm, true) : ''); R.wet.setAttribute('opacity', (.55 * (1 - .45 * seg(t, 4.2, 6.5))).toFixed(3));
    R.water2.setAttribute('d', s.f2 < 1.4 ? pathOf(p2, true) : ''); R.foam2.setAttribute('d', s.f2 < 1.4 ? lineOf(p2) : '');
    R.cover.setAttribute('d', pathOf(p2, true)); R.cover.setAttribute('opacity', (s.cover * .92).toFixed(3));
    R.old.forEach(function (it) {                           /* letras antigas se dissolvem onde a água passou */
      var cx = it.c.x + it.c.w / 2, cy = it.c.y + it.c.h / 2;
      if (it.tc == null && xAt(pm, cy) < cx && s.min < 1.25) it.tc = t;
      var o = it.tc == null ? 1 : 1 - seg(t, it.tc, it.tc + .5); if (t > 3.4) o = 0;
      it.el.setAttribute('opacity', o.toFixed(3));
    });
    R.fin.forEach(function (it) {                           /* letras novas nascem no rastro do refluxo e secam em 1.2s */
      var cx = it.c.x + it.c.w / 2, cy = it.c.y + it.c.h / 2;
      if (it.tu == null && t > recA && xAt(p1, cy) > cx) it.tu = t;
      var a = it.tu == null ? 0 : seg(t, it.tu, it.tu + .2), dr = it.tu == null ? 0 : seg(t, it.tu, it.tu + 1.2);
      it.el.setAttribute('opacity', a.toFixed(3)); it.el.setAttribute('fill', dr < 1 ? 'rgb(' + Math.round(lerp(170, 196, dr)) + ',' + Math.round(lerp(152, 177, dr)) + ',' + Math.round(lerp(120, 146, dr)) + ')' : '#C4B192');
    });
    R.init.forEach(function (it) { it.el.setAttribute('fill', s.glow > .01 ? 'rgb(' + Math.round(lerp(196, 201, s.glow)) + ',' + Math.round(lerp(177, 162, s.glow)) + ',' + Math.round(lerp(146, 90, s.glow)) + ')' : '#C4B192'); });
    R.amp.setAttribute('opacity', s.amp.toFixed(3));
    if (s.after) { R.sand.style.display = 'none'; R.amp.style.display = 'none'; R.water1.style.display = 'none'; R.foam1.style.display = 'none'; }
  }

  /* ================================================================== 3 · movimento reduzido: “My Love” → crossfade .6s → “Mayara & Lucas” */
  function buildRM() {
    var b = doc.createElement('div'); b.className = 'wd-intro-rm';
    function word(cs, cls) { return cs.map(function (c) { return '<span style="left:' + c.x.toFixed(1) + 'px;top:' + L.base(c).toFixed(1) + 'px">' + c.ch + '</span>'; }).join(''); }
    b.innerHTML = '<div class="wd-intro-rm-a" style="font-size:' + L.fs + 'px">' + word(L.old[0]) + word(L.old[1]) + '</div>' +
      '<div class="wd-intro-rm-b" style="font-size:' + L.fs + 'px">' + word(L.fin[0]) + word(L.fin[1]) + '<span class="wd-intro-rm-amp" style="font-size:' + L.ampFs + 'px;left:' + L.amp.x.toFixed(1) + 'px;top:' + L.base(L.amp, L.ampAscF).toFixed(1) + 'px">&amp;</span></div>';
    return b;
  }

  /* ------------------------------------------------------------------ passagem para o hero: nomes no DOM sobre o canvas + FLIP 1.2s */
  function firstText(n) { var tw = doc.createTreeWalker(n, NodeFilter.SHOW_TEXT, { acceptNode: function (x) { return /\S/.test(x.data) ? 1 : 3; } }); return tw.nextNode(); }
  function flip(h1, animate) {
    var lines = [].slice.call(h1.querySelectorAll('.wd-line > span')), tg = [L.fin[0][0], L.amp, L.fin[1][0]], fs = [L.fs, L.ampFs, L.fs], rg = doc.createRange(), out = [];
    lines.forEach(function (sp, i) {
      sp.style.transition = 'none'; sp.style.transform = 'none';
      var tn = firstText(sp); rg.setStart(tn, 0); rg.setEnd(tn, 1);
      var g = rg.getBoundingClientRect(), b = sp.getBoundingClientRect(), k = fs[i] / parseFloat(getComputedStyle(tn.parentNode).fontSize);
      sp.style.transformOrigin = (g.left - b.left).toFixed(2) + 'px ' + (g.top - b.top).toFixed(2) + 'px';
      sp.style.transform = 'translate(' + (tg[i].x - g.left).toFixed(2) + 'px,' + (tg[i].y - g.top).toFixed(2) + 'px) scale(' + k.toFixed(4) + ')';
      out.push(sp);
    });
    if (DEBUG) {                                      /* o M do DOM tem de cair exatamente sobre o M do canvas */
      var tn0 = firstText(lines[0]); rg.setStart(tn0, 0); rg.setEnd(tn0, 1); var r0 = rg.getBoundingClientRect(), M0 = L.fin[0][0];
      var tn2 = firstText(lines[2]); rg.setStart(tn2, 0); rg.setEnd(tn2, 1); var r2 = rg.getBoundingClientRect(), L0 = L.fin[1][0];
      I.debug = { M: [+(r0.left - M0.x).toFixed(2), +(r0.top - M0.y).toFixed(2), +(r0.height - M0.h).toFixed(2)], L: [+(r2.left - L0.x).toFixed(2), +(r2.top - L0.y).toFixed(2), +(r2.height - L0.h).toFixed(2)] };
      debugNote('passagem DOM − canvas  M Δx ' + I.debug.M[0] + ' Δy ' + I.debug.M[1] + ' · L Δx ' + I.debug.L[0] + ' Δy ' + I.debug.L[1] + ' px');
    }
    if (!animate) { out.forEach(function (sp) { sp.style.transform = sp.style.transformOrigin = sp.style.transition = ''; }); return; }
    void h1.offsetWidth;
    out.forEach(function (sp) {
      sp.style.transition = 'transform 1.2s var(--wd-ease-inout)'; sp.style.transform = '';
      sp.addEventListener('transitionend', function te(e) { if (e.propertyName !== 'transform') return; sp.removeEventListener('transitionend', te); sp.style.transition = sp.style.transformOrigin = ''; });
    });
  }
  function handoff(animate) {
    if (handed) return; handed = true;
    var h1 = doc.getElementById('wd-heroTitle');
    if (w.WDM && w.WDM.finish) w.WDM.finish(h1);
    if (h1 && L && mode !== 'rm') flip(h1, animate);
    body.classList.add('wd-intro-reveal');
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    /* o restante do hero entra quando os nomes já estão quase no lugar (sem cruzar a data no mobile) */
    if (animate) I.fireT = setTimeout(fireDone, 600); else fireDone();
  }
  function fireDone() { if (I.fired) return; I.fired = true; clearTimeout(I.fireT); doc.dispatchEvent(new CustomEvent('wd:intro-done')); }

  /* ------------------------------------------------------------------ som da onda e música */
  function waveSound(v) {
    var src = body.getAttribute('data-wd-wave-sound'); if (!src) return;
    try { if (!waveAudio) waveAudio = new Audio(src); waveAudio.volume = v; waveAudio.currentTime = 0; var p = waveAudio.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }

  /* ------------------------------------------------------------------ depuração (?debug=1): o M e o L não saem do lugar */
  function buildDebug() {
    var d = doc.createElement('div'); d.className = 'wd-intro-debug';
    var M0 = L.fin[0][0], L0 = L.fin[1][0], line = function (st) { return '<i style="' + st + '"></i>'; };
    d.innerHTML = line('left:' + M0.x + 'px;top:0;bottom:0;width:1px') + line('left:' + (M0.x + M0.w) + 'px;top:0;bottom:0;width:1px;opacity:.5') +
      line('left:0;right:0;top:' + L.base(M0) + 'px;height:1px') + line('left:0;right:0;top:' + L.base(L0) + 'px;height:1px') +
      line('left:' + M0.x + 'px;top:' + M0.y + 'px;width:' + M0.w + 'px;height:' + M0.h + 'px;background:none;outline:1px solid #e0245e') +
      line('left:' + L0.x + 'px;top:' + L0.y + 'px;width:' + L0.w + 'px;height:' + L0.h + 'px;background:none;outline:1px solid #e0245e') +
      '<b>M x ' + M0.x.toFixed(1) + ' · L x ' + L0.x.toFixed(1) + ' · “My”/“Mayara” M ' + (L.old[0][0].x - M0.x).toFixed(2) + ' · “Love”/“Lucas” L ' + (L.old[1][0].x - L0.x).toFixed(2) + '</b><em></em>';
    return d;
  }
  function debugNote(s) { if (dbg) dbg.querySelector('em').textContent = s; }

  /* ------------------------------------------------------------------ ciclo */
  function prepare() {
    if (!WD || I.running) return;
    L = measure(); dirty = false;
    if (GL && mesh) {
      U.uStopT.value = L.stopT; U.uStopB.value = L.stopB; U.uRowY.value = L.rowY;
      glTextures();
    }
  }
  function loop(now) {
    if (!I.running) return;
    var t = (now - t0) / 1000 - LEAD; if (t < 0) t = 0;
    var s = timeline(t);
    if (mode === 'gl') frameGL(t, s); else if (mode === 'svg') frameSVG(t, s);
    if (!I.cue.w1 && t >= T.w1A) { I.cue.w1 = 1; waveSound(.5); }
    if (!I.cue.w2 && t >= T.w2A) { I.cue.w2 = 1; waveSound(.7); if (w.WDMusic) w.WDMusic.duck(.6, 2000); }
    if (!handed && t >= T.w2Peak) { I.owns = false; handoff(true); }
    if (svgR && t > T.w2Peak) ui.style.opacity = (1 - seg(t, T.w2Peak + .3, T.w2End)).toFixed(3);
    if (t >= T.w2End + .1) { finish(); return; }
    raf = requestAnimationFrame(loop);
  }
  function runRM() {
    rmBox = buildRM(); ui.insertBefore(rmBox, ui.firstChild);
    requestAnimationFrame(function () { rmBox.classList.add('is-a'); });
    I.rmT = [setTimeout(function () { rmBox.classList.add('is-b'); }, 1200),
      setTimeout(function () { handoff(false); rmBox.classList.add('is-out'); }, 2300),
      setTimeout(finish, 2950)];
  }
  function start(replay) {
    if (I.running) return;
    if (dirty || !L || L.W !== innerWidth || L.H !== innerHeight) prepare();
    if (!L) L = measure();
    I.running = true; handed = false; I.fired = false; I.cue = {}; I.debug = null;
    mode = RM ? 'rm' : (GL && mesh) ? 'gl' : 'svg';
    body.classList.add('wd-intro'); body.classList.remove('wd-intro-reveal');
    WD.lock(true);
    if (replay && WD.lenis) WD.lenis.scrollTo(0, { immediate: true }); else if (replay) WD.scroller.scrollTop = 0;
    ui = doc.createElement('div'); ui.id = 'wd-intro'; ui.setAttribute('aria-hidden', 'false');
    ui.innerHTML = '<button type="button" class="wd-btn-line wd-intro-skip" aria-label="Pular a abertura">Pular<svg class="wd-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>';
    body.appendChild(ui);
    ui.querySelector('.wd-intro-skip').addEventListener('click', skip);
    onKey = function (e) { if (e.key === 'Escape') { e.preventDefault(); skip(); } };
    doc.addEventListener('keydown', onKey);
    if (DEBUG) { dbg = buildDebug(); ui.appendChild(dbg); }
    if (mode === 'rm') { runRM(); return; }
    if (mode === 'svg') { svgR = buildSVG(); ui.insertBefore(svgR.s, ui.firstChild); }
    else { mesh.visible = true; I.owns = true; frameGL(0, timeline(0)); }
    t0 = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function finish() {
    if (!I.running) return;
    I.running = false; I.owns = false; cancelAnimationFrame(raf); (I.rmT || []).forEach(clearTimeout); fireDone();
    if (mesh) { mesh.visible = false; tex.forEach(function (t) { t.dispose(); }); tex = []; dirty = true; }   /* libera as texturas da areia (refeitas no “Rever”) */
    if (ui) { ui.remove(); ui = null; } svgR = null; rmBox = null; dbg = null;
    doc.removeEventListener('keydown', onKey);
    body.classList.remove('wd-intro', 'wd-intro-reveal');
    WD.lock(false);
  }
  function skip() {                                    /* direto para o estado final, a qualquer momento */
    if (!I.running) return;
    var wasHanded = handed;
    handoff(false);
    if (wasHanded) { var h1 = doc.getElementById('wd-heroTitle'); [].slice.call(h1.querySelectorAll('.wd-line > span')).forEach(function (sp) { sp.style.transition = sp.style.transform = sp.style.transformOrigin = ''; }); }
    finish();
  }

  I.replay = function () { if (I.running) return; dirty = true; start(true); };
  I.init = function () {
    WD = w.WD; RM = WD.RM; MOBILE = WD.MOBILE;
    if (/[?&]intro=1/.test(location.search)) { try { sessionStorage.removeItem(KEY); } catch (e) {} }   /* ?intro=1 mostra a intro de novo na mesma aba */
    addEventListener('resize', function () { dirty = true; if (I.running) skip(); });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { if (GL && mesh) prepare(); });
    doc.addEventListener('wd:open', function () {
      var seen = false; try { seen = sessionStorage.getItem(KEY) === '1'; } catch (e) {}
      if (seen) { doc.dispatchEvent(new CustomEvent('wd:intro-done')); setTimeout(function () { WD.lock(false); }, RM ? 0 : 970); return; }
      start(false);
    });
    return I;
  };
  w.WDI = I;
})(window);
