// SÓ DESENVOLVIMENTO: confere o caminho do áudio. Uso: node tools/dev/audio-check.mjs [ios]
// sem argumento: player nativo (audio.volume) · ios: user agent de iPhone → Web Audio com fade agendado
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const IOS = process.argv[2] === 'ios';
const port = 9300 + Math.floor(Math.random() * 500), profile = path.join(ROOT, 'node_modules', '.cache', 'ac-' + port);
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const proc = spawn(exe, ['--headless=new', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const errors = [];
try {
  let list = [];
  for (let i = 0; i < 50; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.length) break; } catch (e) {} await sleep(200); }
  const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0; const pend = new Map();
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0]); };
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send('Runtime.enable');
  if (IOS) { await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', platform: 'iPhone' }); }
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('wd-sound','on')}catch(e){}" });
  await send('Page.navigate', { url: 'http://localhost:5178/index.html' });
  for (let i = 0; i < 40; i++) { if (await ev("!!document.querySelector('.wd-env.is-ready')")) break; await sleep(250); }
  await ev("document.getElementById('wd-openBtn').click()");
  const probe = `(function(){var a=document.getElementById('wd-audio');return {paused:a.paused,volume:+a.volume.toFixed(3),t:+a.currentTime.toFixed(2),pressed:document.getElementById('wd-player').getAttribute('aria-pressed')}})()`;
  const at1 = await ev(probe); await sleep(3000); const at2 = await ev(probe);
  await ev("document.getElementById('wd-player').click()"); await sleep(900); const off = await ev(probe);
  console.log(JSON.stringify({ ios: IOS, logo: at1, depois3s: at2, pausado: off, errors }));
  ws.close();
} finally { proc.kill(); await sleep(400); try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} }
