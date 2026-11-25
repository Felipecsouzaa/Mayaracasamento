// SÓ DESENVOLVIMENTO: testa a intro em cenários. Uso: node tools/dev/intro-check.mjs <cenário> [largura] [altura]
//   esc:<s>   aperta Esc <s> segundos depois do wd:open        skip:<s>  clica em “Pular” <s> segundos depois
//   rm        prefers-reduced-motion                          svg       sem WebGL (plano B)       full   deixa rodar inteiro
//   replay    roda inteiro e depois “Rever a abertura”
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CANDIDATES = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [SC = 'full', W = 1440, H = 900] = process.argv.slice(2);
const [kind, at] = SC.split(':');
const flags = kind === 'svg' ? ['--disable-3d-apis', '--disable-webgl'] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
const port = 9300 + Math.floor(Math.random() * 500), profile = path.join(ROOT, 'node_modules', '.cache', 'ic-' + port);
const proc = spawn(CANDIDATES.find(p => fs.existsSync(p)), ['--headless=new', '--hide-scrollbars', ...flags, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const log = { errors: [], http: [] };
try {
  let list = [];
  for (let i = 0; i < 50; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.length) break; } catch (e) {} await sleep(200); }
  const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') log.errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') log.errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) log.http.push(m.params.response.status + ' ' + m.params.response.url); };
  const evalJS = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result?.result?.value; };
  await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: +W < 768 });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  if (kind === 'rm') await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  /* rm usa o index.html direto (o harness neutraliza o reduced motion) */
  await send('Page.navigate', { url: kind === 'rm' ? 'http://localhost:5178/index.html' : 'http://localhost:5178/tools/dev/motion.html?open=1' });
  await sleep(1300);
  await evalJS(`window.__ev=[];(function w(){if(!window.WDI)return setTimeout(w,50);['wd:open','wd:intro-done'].forEach(function(n){document.addEventListener(n,function(){__ev.push(n+'@'+Math.round(performance.now()))})})})();1`);
  if (kind === 'rm') { await sleep(1500); await evalJS(`document.getElementById('wd-openAlt').click()`); }
  /* espera o wd:open */
  for (let i = 0; i < 80; i++) { const ok = await evalJS(`(window.__ev||[]).some(function(e){return e.indexOf('wd:open')===0})`); if (ok) break; await sleep(100); }
  const mid = await evalJS(`({mode:document.getElementById('wd-intro')?(document.querySelector('.wd-intro-svg')?'svg':document.querySelector('.wd-intro-rm')?'rm':'gl'):'-',gl:!!(window.THREE)})`);
  if (kind === 'esc') { await sleep(+at * 1000); await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); }
  if (kind === 'skip') { await sleep(+at * 1000); await evalJS(`document.querySelector('.wd-intro-skip').click()`); }
  await sleep(kind === 'esc' || kind === 'skip' ? 1500 : 9000);
  if (kind === 'replay') { await evalJS(`document.querySelector('[data-wd-replay]').click()`); await sleep(1500); const r1 = await evalJS(`({running:WDI.running,intro:!!document.getElementById('wd-intro'),body:document.body.className})`); console.log('replay durante', JSON.stringify(r1)); await sleep(8000); }
  const end = await evalJS(`(function(){var sp=[].slice.call(document.querySelectorAll('#wd-heroTitle .wd-line > span')),m=document.getElementById('site-main');
    return {events:__ev,intro:!!document.getElementById('wd-intro'),body:document.body.className,locked:m.style.overflow==='hidden'||(window.WD&&WD.lenis&&WD.lenis.isStopped),
    transforms:sp.map(function(s){return s.style.transform||'-'}),names:sp.map(function(s){return getComputedStyle(s.parentNode).opacity}),side:getComputedStyle(document.querySelector('.wd-hero-side')).opacity,
    nav:getComputedStyle(document.getElementById('wd-nav')).visibility,seen:sessionStorage.getItem('wd-intro-seen')}})()`);
  console.log(SC, W, JSON.stringify({ mid, end, errors: log.errors, http: log.http }));
  ws.close();
} finally { proc.kill(); await sleep(400); try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} }
