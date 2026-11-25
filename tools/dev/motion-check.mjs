// SÓ DESENVOLVIMENTO: verifica a camada de movimento no Chrome headless (protocolo DevTools).
// Uso: node tools/dev/motion-check.mjs <largura> <altura> [perf|frames|rm]
//   perf   → rola o site inteiro com a roda do mouse (Lenis) e mede quadros longos (> 50 ms), erros de console e 404
//   frames → mesma rolagem, salvando um PNG a cada passo em tools/review/frames-<largura>/ (para o GIF)
//   rm     → prefers-reduced-motion: reduce (index.html direto), relata estado final dos elementos revelados
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CANDIDATES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [W = 1440, H = 900, MODE = 'perf'] = process.argv.slice(2);

const browser = CANDIDATES.find(p => fs.existsSync(p));
const port = 9300 + Math.floor(Math.random() * 500);
const profile = path.join(ROOT, 'node_modules', '.cache', 'mc-' + port);
const flags = ['--headless=new', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--autoplay-policy=no-user-gesture-required'];
if (process.env.GPU === '1') flags.push('--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist');   /* GPU real */
else if (MODE !== 'perf') flags.push('--enable-unsafe-swiftshader', '--use-angle=swiftshader');
const proc = spawn(browser, [...flags, 'about:blank'], { stdio: 'ignore' });
const log = { errors: [], http: [], warnings: [] };
try {
  let list = [];
  for (let i = 0; i < 50; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.length) break; } catch (e) {} await sleep(200); }
  const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') log.errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) (m.params.type === 'error' ? log.errors : log.warnings).push(m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) log.http.push(m.params.response.status + ' ' + m.params.response.url);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') log.errors.push(m.params.entry.text + ' ' + (m.params.entry.url || ''));
  };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJS = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result?.result?.value; };
  await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: +W < 768 });
  if (+W < 768) await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable');
  if (MODE === 'rm') await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const url = MODE === 'rm' ? 'http://localhost:5178/index.html' : 'http://localhost:5178/tools/dev/motion.html?open=1';
  if (process.env.NOINTRO) await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{sessionStorage.setItem('wd-intro-seen','1')}catch(e){}" });
  await send('Page.navigate', { url });
  if (MODE === 'rm') {
    await sleep(2500);
    await evalJS(`(function(){var b=document.getElementById('wd-openAlt')||document.getElementById('wd-openBtn');b&&b.click();})()`);
    await sleep(2500);
    const out = await evalJS(`(function(){var m=document.getElementById('site-main'),r=[];
      [0,1.2,2.4,3.6,4.8,6].forEach(function(k){m.scrollTop=innerHeight*k;});
      m.scrollTop=m.scrollHeight;
      return new Promise(function(res){setTimeout(function(){
        document.querySelectorAll('[data-wd-reveal]').forEach(function(e){var o=getComputedStyle(e).opacity;if(+o<.99)r.push(e.getAttribute('data-wd-reveal')+' '+(e.className||e.tagName)+' op='+o)});
        res({hidden:r,thread:!!document.querySelector('.wd-thread'),pinH:document.querySelector('.wd-s1').offsetHeight,vh:innerHeight});
      },1500)})})()`);
    console.log(JSON.stringify(out, null, 1));
  } else {
    /* espera o envelope abrir e a intro terminar de verdade (no WebGL por software ela é lenta) */
    for (let i = 0; i < 120; i++) { const ok = await evalJS("!!(document.getElementById('abertura')||{}).classList&&document.getElementById('abertura').classList.contains('is-gone')&&window.WDI&&!WDI.running"); if (ok) break; await sleep(250); }
    await sleep(1500);
    if (process.env.MC_CSS) await evalJS('(function(){var st=document.createElement("style");st.textContent=' + JSON.stringify(process.env.MC_CSS) + ';document.head.appendChild(st);return 1})()');
    await evalJS(`window.__lf=[];try{new PerformanceObserver(function(l){l.getEntries().forEach(function(e){__lf.push({d:Math.round(e.duration),t:Math.round(e.startTime),s:(e.scripts||[]).map(function(s){return (s.sourceFunctionName||'')+'@'+(s.sourceURL||'').split('/').pop()+' '+Math.round(s.duration)}).join(' | ')})})}).observe({type:'long-animation-frame'})}catch(e){new PerformanceObserver(function(l){l.getEntries().forEach(function(e){__lf.push({d:Math.round(e.duration),t:Math.round(e.startTime)})})}).observe({type:'longtask'})}
      window.__fr=[];(function f(t){if(window.__last)__fr.push(t-__last);window.__last=t;requestAnimationFrame(f)})(performance.now());true`);
    const total = await evalJS(`document.getElementById('site-main').scrollHeight - innerHeight`);
    const dir = path.join(ROOT, 'tools', 'review', 'frames-' + W); if (MODE === 'frames') { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); }
    const step = MODE === 'frames' ? Math.round(+H * .12) : 100;
    let n = 0, y = 0, guard = 0;
    if (MODE === 'frames') { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(dir, String(n++).padStart(4, '0') + '.png'), Buffer.from(s.result.data, 'base64')); }
    while (guard++ < 600) {
      await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: +W / 2, y: +H / 2, deltaX: 0, deltaY: step });
      await sleep(MODE === 'frames' ? 260 : 60);
      y = await evalJS(`document.getElementById('site-main').scrollTop`);
      if (MODE === 'frames') { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(dir, String(n++).padStart(4, '0') + '.png'), Buffer.from(s.result.data, 'base64')); }
      if (y >= total - 2) break;
    }
    await sleep(1500);
    const perf = await evalJS(`(function(){var f=__fr.slice().sort(function(a,b){return a-b}),p=function(q){return Math.round(f[Math.floor(f.length*q)]||0)};
      return {frames:f.length,p50:p(.5),p95:p(.95),p99:p(.99),max:Math.round(f[f.length-1]||0),over50:__fr.filter(function(x){return x>50}).length,long:__lf.slice(0,12)}})()`);
    const state = await evalJS(`(function(){var r=[];document.querySelectorAll('[data-wd-reveal]').forEach(function(e){var o=+getComputedStyle(e).opacity;if(o<.99&&!e.closest('#inicio'))r.push(e.getAttribute('data-wd-reveal')+' '+String(e.className).slice(0,30)+' op='+o)});
      var th=document.querySelector('.wd-thread path');return {notShown:r,thread:th?getComputedStyle(th).strokeDashoffset:null,pageBg:getComputedStyle(document.documentElement).getPropertyValue('--wd-page-bg'),nav:document.getElementById('wd-nav').className,triggers:ScrollTrigger.getAll().length}})()`);
    console.log(JSON.stringify({ W, H, MODE, scrolled: y, total, steps: guard, frames: n, perf, state }, null, 1));
  }
  console.log('ERROS', JSON.stringify(log.errors), '\nHTTP>=400', JSON.stringify(log.http), '\nAVISOS', JSON.stringify(log.warnings.slice(0, 8)));
  ws.close();
} finally { proc.kill(); await sleep(400); try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} }
