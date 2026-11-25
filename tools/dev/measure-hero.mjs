// SÓ DESENVOLVIMENTO: captura o hero e mede (1) contraste real da data/contagem/local sobre a foto, amostrando os
// pixels de fundo da captura dentro de cada caixa de texto, e (2) bordas/traços acima de 1px dentro do hero.
// Uso: node tools/dev/measure-hero.mjs <largura> <altura>
import sharp from 'sharp';
import { capture } from './shot.mjs';

const [w = 1440, h = 900] = process.argv.slice(2).map(Number);
const evaluate = `(() => {
  const r = el => { const b = el.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
  const q = s => [...document.querySelectorAll(s)];
  const texts = [
    ['data', '.wd-hero-date', [30,48,72,1]],
    ...q('.wd-cd-n').map((e, i) => ['numeral ' + (i + 1), e, [30,48,72,1]]),
    ...q('.wd-cd-u').map((e, i) => ['unidade ' + (i + 1), e, [30,48,72,.85]]),
    ['local', '.wd-hero-place', [30,48,72,.85]],
    ['eyebrow', '.wd-hero-kicker .wd-t-eyebrow', [30,48,72,1]]
  ].map(([n, s, c]) => ({ n, rect: r(typeof s === 'string' ? document.querySelector(s) : s), c }));
  const borders = [];
  q('#inicio *').forEach(el => {
    const cs = getComputedStyle(el), name = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/).join('.') : '');
    ['Top','Right','Bottom','Left'].forEach(k => { const v = parseFloat(cs['border' + k + 'Width']); if (v > 1 && cs['border' + k + 'Style'] !== 'none') borders.push(name + ' border-' + k + ' ' + v + 'px'); });
    const ts = parseFloat(cs.webkitTextStrokeWidth); if (ts > 1) borders.push(name + ' text-stroke ' + ts + 'px');
    if (el instanceof SVGElement && cs.stroke !== 'none') { const sw = parseFloat(cs.strokeWidth); if (sw > 1.5) borders.push(name + ' svg stroke ' + sw + ' (unid.)'); }
    const sh = cs.boxShadow; if (sh && sh !== 'none') { const m = sh.match(/inset 0px 0px 0px ([\\d.]+)px/); if (m && +m[1] > 1) borders.push(name + ' inset-ring ' + m[1] + 'px'); }
  });
  return { texts, borders };
})()`;
const { out, result } = await capture({ name: `hero-medida-${w}`, w, h, wait: 10000, evaluate });
const img = sharp(out).removeAlpha();
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const lin = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
const L = c => .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]);
const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
console.log(`\n${w}×${h}  (captura: ${out})`);
for (const t of result.texts) {
  const px = [];
  for (let y = Math.max(0, t.rect.y); y < Math.min(info.height, t.rect.y + t.rect.h); y++)
    for (let x = Math.max(0, t.rect.x); x < Math.min(info.width, t.rect.x + t.rect.w); x++) { const i = (y * info.width + x) * 3; px.push([data[i], data[i + 1], data[i + 2]]); }
  px.sort((a, b) => L(a) - L(b));
  const bg = px.slice(Math.floor(px.length * .45));                       // descarta os 45% mais escuros (o próprio texto)
  const worstBg = bg[Math.floor(bg.length * .05)], medBg = bg[Math.floor(bg.length * .5)];
  const text = c => t.c[3] < 1 ? t.c.slice(0, 3).map((v, k) => v * t.c[3] + c[k] * (1 - t.c[3])) : t.c.slice(0, 3);
  const rw = ratio(text(worstBg), worstBg), rm = ratio(text(medBg), medBg);
  console.log(`${t.n.padEnd(12)} pior fundo ${rw.toFixed(2)}:1  · fundo típico ${rm.toFixed(2)}:1  ${rw >= 4.5 ? 'AA' : rw >= 3 ? 'AA grande' : 'ABAIXO'}`);
}
console.log('\nbordas/traços > 1px no hero:', result.borders.length ? '\n  ' + result.borders.join('\n  ') : 'nenhum');
