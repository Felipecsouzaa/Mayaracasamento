// Trata as fotos e o logo do casal para o site.
// Uso:  npm run img            (lê as capturas na pasta acima do projeto e escreve em assets/img)
// Para trocar pelas fotos do fotógrafo: ponha os arquivos novos com os mesmos nomes de origem
// (ou ajuste SOURCES) e zere o crop ({ left:0, top:0, width:null, height:null }).
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.resolve(ROOT, '..');                       // C:\...\Casamento Mayara\
const OUT = path.join(ROOT, 'assets', 'img');
const REVIEW = path.join(ROOT, 'tools', 'review');          // antes/depois (pode ser apagado)

/* Recortes medidos à mão nas capturas do Instagram: tiram setas do carrossel, pontinhos de
   paginação, o selo de usuário (abraçados) e os filetes pretos de 2–4 px das bordas. */
const SOURCES = [
  { file: 'abraçados.PNG',           name: 'abracados',      alt: 'Mayara e Lucas abraçados à beira-mar, vestidos de branco, sorrindo para a câmera',           crop: { left: 10, top: 4, width: 602, height: 508 } },
  { file: 'correndo na praia.PNG',   name: 'correndo-praia', alt: 'O casal corre de mãos dadas pela areia molhada, com o mar e as pedras ao fundo',             crop: { left: 20, top: 3, width: 746, height: 509 } },
  { file: 'juntos na praia.PNG',     name: 'juntos-praia',   alt: 'Mayara e Lucas caminham de mãos dadas na água rasa, olhando e sorrindo',                     crop: { left: 20, top: 4, width: 724, height: 508 } },
  { file: 'maos se tocando.PNG',     name: 'maos',           alt: 'Duas mãos quase se tocando diante do mar; na mão dela, o anel de noivado',                    crop: { left: 54, top: 5, width: 716, height: 509 } },
  { file: 'pedido de casamento.PNG', name: 'pedido',         alt: 'Logo após o pedido: ela mostra o anel e ele ergue o braço em comemoração, na beira da praia', crop: { left: 24, top: 3, width: 552, height: 781 } }
];

const SEA = { r: 0x1E, g: 0x30, b: 0x48 };     // --wd-sea
const CREAM = { r: 0xED, g: 0xE9, b: 0xDF };   // --wd-cream
const FOAM = { r: 0xF6, g: 0xF3, b: 0xEC };    // --wd-foam

async function photos() {
  const manifest = {};
  for (const s of SOURCES) {
    const src = path.join(SRC, s.file);
    const meta = await sharp(src).metadata();
    const c = { left: s.crop.left, top: s.crop.top, width: s.crop.width ?? meta.width, height: s.crop.height ?? meta.height };
    const base = sharp(src).extract(c).removeAlpha();
    const full = c.width, half = Math.round(c.width / 2);
    const files = [];
    for (const w of [full, half]) {
      const out = `${s.name}-${w}.webp`;
      await base.clone().resize({ width: w }).webp({ quality: 82, effort: 6 }).toFile(path.join(OUT, out));
      files.push({ w, out });
    }
    await base.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(OUT, `${s.name}.jpg`));
    manifest[s.name] = {
      source: s.file, crop: c, width: full, height: c.height, alt: s.alt,
      srcset: files.map(f => `assets/img/${f.out} ${f.w}w`).join(', '),
      fallback: `assets/img/${s.name}.jpg`
    };
    /* antes/depois: original com a área mantida em champanhe | resultado */
    const svg = Buffer.from(`<svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg">
      <path fill="rgba(163,65,46,.55)" fill-rule="evenodd" d="M0 0H${meta.width}V${meta.height}H0Z M${c.left} ${c.top}h${c.width}v${c.height}h-${c.width}Z"/>
      <rect x="${c.left + .5}" y="${c.top + .5}" width="${c.width - 1}" height="${c.height - 1}" fill="none" stroke="#B8975A" stroke-width="2"/></svg>`);
    const before = await sharp(src).removeAlpha().composite([{ input: svg }]).png().toBuffer();
    const after = await base.clone().png().toBuffer();
    const gap = 24, W = meta.width + c.width + gap * 3, H = Math.max(meta.height, c.height) + gap * 2;
    await sharp({ create: { width: W, height: H, channels: 3, background: '#F1E9DE' } })
      .composite([{ input: before, left: gap, top: gap }, { input: after, left: meta.width + gap * 2, top: gap }])
      .jpeg({ quality: 80 }).toFile(path.join(REVIEW, `${s.name}-antes-depois.jpg`));
    console.log('foto', s.name, `${c.width}x${c.height}`, files.map(f => f.out).join(' '));
  }
  return manifest;
}

/* Logo: o fundo creme vira transparência. Alfa = distância de cor até o papel (com limiar para o
   grão do papel); a cor é recuperada desfazendo a mistura com o fundo. */
async function logo() {
  const src = path.join(SRC, 'logo casal mayara.PNG');
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  // cor do papel = mediana dos cantos
  const samples = [];
  for (const [x0, y0] of [[8, 8], [W - 40, 8], [8, H - 40], [W - 40, H - 40]])
    for (let y = y0; y < y0 + 30; y++) for (let x = x0; x < x0 + 30; x++) { const i = (y * W + x) * 3; samples.push([data[i], data[i + 1], data[i + 2]]); }
  const med = k => samples.map(p => p[k]).sort((a, b) => a - b)[samples.length >> 1];
  const bg = [med(0), med(1), med(2)];
  const rgba = Buffer.alloc(W * H * 4), sea = Buffer.alloc(W * H * 4), cream = Buffer.alloc(W * H * 4);
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let p = 0, q = 0; p < data.length; p += 3, q += 4) {
    const d = Math.max(Math.abs(data[p] - bg[0]), Math.abs(data[p + 1] - bg[1]), Math.abs(data[p + 2] - bg[2]));
    let a = Math.min(1, Math.max(0, (d - 14) / 120));
    a = a * a * (3 - 2 * a);                                  // suaviza a borda
    for (let k = 0; k < 3; k++) rgba[q + k] = a > 0 ? Math.max(0, Math.min(255, Math.round((data[p + k] - bg[k] * (1 - a)) / a))) : 0;
    rgba[q + 3] = Math.round(a * 255);
    sea[q] = SEA.r; sea[q + 1] = SEA.g; sea[q + 2] = SEA.b; sea[q + 3] = rgba[q + 3];
    cream[q] = CREAM.r; cream[q + 1] = CREAM.g; cream[q + 2] = CREAM.b; cream[q + 3] = rgba[q + 3];
    if (a > .85) { const x = (q / 4) % W, y = (q / 4 / W) | 0; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  // enquadra num quadrado com respiro de 4%
  const side = Math.round(Math.max(maxX - minX, maxY - minY) * 1.08), cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const box = { left: Math.max(0, Math.round(cx - side / 2)), top: Math.max(0, Math.round(cy - side / 2)) };
  box.width = Math.min(side, W - box.left); box.height = Math.min(side, H - box.top);
  const raw = { raw: { width: W, height: H, channels: 4 } };
  const save = (buf, name, size) => sharp(buf, raw).extract(box).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(OUT, name));
  await save(rgba, 'logo-ml.png', 1024);
  await save(sea, 'logo-ml-sea.png', 1024);
  await save(cream, 'logo-ml-cream.png', 1024);
  // favicons: 32 transparente em marinho; 180 e 512 opacos sobre espuma (iOS/manifest não aceitam transparência bem)
  const seaSq = await sharp(sea, raw).extract(box).png().toBuffer();
  const fav32 = await sharp(seaSq).resize(32, 32).png().toBuffer();
  await fs.writeFile(path.join(OUT, 'favicon-32.png'), fav32);
  // favicon.ico na raiz (navegadores pedem /favicon.ico por conta própria): ICO com o PNG de 32 px embutido
  const ico = Buffer.alloc(22); ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
  ico[6] = 32; ico[7] = 32; ico[8] = 0; ico[9] = 0; ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12);
  ico.writeUInt32LE(fav32.length, 14); ico.writeUInt32LE(22, 18);
  await fs.writeFile(path.join(ROOT, 'favicon.ico'), Buffer.concat([ico, fav32]));
  for (const s of [180, 512]) {
    const inner = await sharp(seaSq).resize(Math.round(s * .84), Math.round(s * .84)).png().toBuffer();
    await sharp({ create: { width: s, height: s, channels: 4, background: { ...FOAM, alpha: 1 } } })
      .composite([{ input: inner, gravity: 'center' }]).png().toFile(path.join(OUT, `favicon-${s}.png`));
  }
  // antes/depois do logo: original | transparente sobre xadrez | marinho | creme sobre noite
  const T = 360, tile = await sharp(src).resize(T, T).png().toBuffer();
  const checker = Buffer.from(`<svg width="${T}" height="${T}" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="c" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#fff"/><rect width="10" height="10" fill="#ddd"/><rect x="10" y="10" width="10" height="10" fill="#ddd"/></pattern></defs><rect width="${T}" height="${T}" fill="url(#c)"/></svg>`);
  const over = async (bgInput, file) => sharp(bgInput).composite([{ input: await sharp(path.join(OUT, file)).resize(T, T).png().toBuffer() }]).png().toBuffer();
  const t1 = await over(checker, 'logo-ml.png');
  const t2 = await over({ create: { width: T, height: T, channels: 3, background: '#FBF8F3' } }, 'logo-ml-sea.png');
  const t3 = await over({ create: { width: T, height: T, channels: 3, background: '#241B15' } }, 'logo-ml-cream.png');
  await sharp({ create: { width: T * 4 + 100, height: T + 40, channels: 3, background: '#F1E9DE' } })
    .composite([tile, t1, t2, t3].map((input, i) => ({ input, left: 20 + i * (T + 20), top: 20 })))
    .jpeg({ quality: 82 }).toFile(path.join(REVIEW, 'logo-antes-depois.jpg'));
  console.log('logo', 'fundo', bg.join(','), 'caixa', box);
}

await fs.mkdir(OUT, { recursive: true });
await fs.mkdir(REVIEW, { recursive: true });
const manifest = await photos();
await logo();
await fs.writeFile(path.join(OUT, 'images.json'), JSON.stringify(manifest, null, 2));
console.log('ok → assets/img/images.json');
