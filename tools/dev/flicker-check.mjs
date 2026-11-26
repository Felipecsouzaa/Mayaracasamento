// SÓ DESENVOLVIMENTO: procura textos que “piscam” (visível → some → volta) e animações em conflito.
// Uso: node tools/dev/flicker-check.mjs [largura=1440] [altura=900]
//   1) amostra, a cada quadro, a opacidade visual de cada [data-wd-reveal] (elemento × média dos alvos animados)
//      desde antes de abrir o convite até o rodapé, rolando com a roda do mouse (Lenis);
//   2) lista alvos do GSAP que também têm transition CSS em transform/opacity/filter (as duas brigam e tremem).
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [W = 1440, H = 900] = process.argv.slice(2);
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const port = 9300 + Math.floor(Math.random() * 500), profile = path.join(ROOT, 'node_modules', '.cache', 'fc-' + port);
const proc = spawn(exe, ['--headless=new', '--hide-scrollbars', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const errors = [], http = [];
try {
  let list = [];
  for (let i = 0; i < 50; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.length) break; } catch (e) {} await sleep(200); }
  const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0; const pend = new Map();
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) http.push(m.params.response.status + ' ' + m.params.response.url); };
  const ev = async e => { const r = (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result; if (r?.exceptionDetails) console.error('avaliação falhou:', r.exceptionDetails.exception?.description?.split(String.fromCharCode(10))[0]); return r?.result?.value; };
  await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: +W < 768 });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Page.navigate', { url: 'http://localhost:5178/tools/dev/motion.html?open=1' });
  /* o harness reescreve o documento: o amostrador entra assim que o motor existir */
  await sleep(900);
  await ev(`(function w(){if(!window.WDM||!WDM.recs||!WDM.recs.length)return setTimeout(w,16);
    window.__fl={};var name=function(e){return (e.id?'#'+e.id:'')+(typeof e.className==='string'&&e.className?'.'+e.className.trim().split(/\\s+/).slice(0,2).join('.'):'')||e.tagName};
    function vis(r){var o=+getComputedStyle(r.el).opacity;var ts=(r.targets||[]).filter(function(t){return t!==r.el});if(ts.length){var s=0;ts.forEach(function(t){s+=+getComputedStyle(t).opacity});o*=s/ts.length}
      for(var p=r.el.parentElement;p&&p!==document.body;p=p.parentElement){var po=+getComputedStyle(p).opacity;if(po<1)o*=po;if(getComputedStyle(p).visibility==='hidden')return 0}return o}
    (function f(){var t=performance.now();WDM.recs.forEach(function(r,ri){var k=ri+' '+r.type+' '+name(r.el),s=__fl[k]||(__fl[k]={max:0,flips:[],prev:null,scrub:r.scrub,first:null});
      var v=+vis(r).toFixed(2);if(s.first===null)s.first=v;
      if(s.max>.9&&v<s.max-.4&&!s.dropAt)s.dropAt=Math.round(t);
      if(s.dropAt&&v>.9){s.flips.push(s.dropAt+'→'+Math.round(t));s.dropAt=0;s.max=v}
      if(v>s.max)s.max=v;s.prev=v});requestAnimationFrame(f)})()})();1`);
  /* espera abrir e o hero entrar */
  for (let i = 0; i < 80; i++) { if (await ev("!!document.querySelector('#abertura.is-gone')")) break; await sleep(250); }
  await sleep(3500);
  const total = await ev("document.getElementById('site-main').scrollHeight-innerHeight");
  for (let g = 0; g < 400; g++) {
    await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: +W / 2, y: +H / 2, deltaX: 0, deltaY: 90 });
    await sleep(70);
    if (await ev("document.getElementById('site-main').scrollTop") >= total - 2) break;
  }
  await sleep(2500);
  const rep = await ev(`(function(){var out=[],hidden=[];for(var k in __fl){var s=__fl[k];if(s.flips.length||s.dropAt)out.push(k+(s.scrub?' [scrub]':'')+' : '+(s.flips.join(', ')||('sumiu em '+s.dropAt+' e não voltou')))}
    /* alvos do GSAP com transition CSS concorrente */
    var clash=[];WDM.recs.forEach(function(r){(r.targets||[r.el]).forEach(function(t){var c=getComputedStyle(t),p=c.transitionProperty,d=c.transitionDuration.split(',').some(function(x){return parseFloat(x)>0});
      if(d&&/all|transform|opacity|filter/.test(p))clash.push(r.type+' '+(t.className||t.tagName)+' ← transition: '+p)})});
    WDM.recs.forEach(function(r){var s=__fl[Object.keys(__fl).find(function(k){return k.indexOf(r.type+' ')===0})];});
    for(var k in __fl){if(__fl[k].max<.9)hidden.push(k+' max '+__fl[k].max)}
    return {piscadas:out,conflitos:Array.from(new Set(clash)),nuncaVisiveis:hidden}})()`);
  console.log(JSON.stringify({ W, rep, errors, http }, null, 1));
  ws.close();
} finally { proc.kill(); await sleep(400); try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} }
