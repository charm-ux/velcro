// Generates the two stand-in images that tests/upstream/docs-images.json carries (see that file's note): a three-frame GIF
// (walk.gif: a block sliding across) and a three-frame lossless animated WebP (tie.webp: a block dropping). Both are drawn
// here from a few rectangles; nothing is copied from Shoelace or any other source.
//
//   node tests/upstream/make-docs-images.mjs           write tests/upstream/docs-images.json
//   node tests/upstream/make-docs-images.mjs --check   regenerate and compare with the committed file (writes nothing)
//
// The GIF is encoded here (a small LZW encoder), so its bytes are reproducible anywhere. The WebP frames are encoded by
// Chromium's canvas (lossless VP8L, quality 1) through Playwright's Chromium and only wrapped here in the animated WebP
// container (VP8X, ANIM, one ANMF per frame), so the exact WebP bytes depend on that Chromium build: if `--check` reports a
// different WebP after a Playwright upgrade, the image is still valid, and the committed bytes and the pins in
// tests/product/animated-image.spec.mjs and tests/upstream/docs-images.test.mjs are updated together.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const FILE = new URL('./docs-images.json', import.meta.url);
const W = 96;
const H = 72;
const FRAMES = 3;

// ---- GIF ----
// Palette: 0 background, 1 block, 2 ground line, 3 eye.
const PALETTE = [[0x1e, 0x3a, 0x5f], [0xf5, 0xb4, 0x1e], [0x0f, 0x1d, 0x30], [0xff, 0xff, 0xff]];

function gifFrame(i) {
  const pixels = new Uint8Array(W * H);
  const ground = Math.floor((H * 4) / 5);
  const size = Math.floor(H / 4);
  for (let y = ground; y < ground + Math.max(1, Math.floor(H / 40)) + 1; y++) pixels.fill(2, y * W, (y + 1) * W);
  const left = 4 + i * Math.floor((W - size - 8) / (FRAMES - 1));
  for (let y = ground - size; y < ground; y++) pixels.fill(1, y * W + left, y * W + left + size);
  const eye = Math.max(2, Math.floor(size / 5));
  const top = ground - size + Math.floor(size / 4);
  for (let y = top; y < top + eye; y++) pixels.fill(3, y * W + left + Math.floor((size * 5) / 8), y * W + left + Math.floor((size * 5) / 8) + eye);
  return pixels;
}

// GIF's variable-width LZW with a minimum code size of 2 (a four-colour palette).
function lzw(indices) {
  const minCode = 2;
  const clear = 1 << minCode;
  const end = clear + 1;
  const out = [];
  let buffer = 0;
  let bits = 0;
  const emit = (code, width) => {
    buffer |= code << bits;
    bits += width;
    while (bits >= 8) {
      out.push(buffer & 0xff);
      buffer >>>= 8;
      bits -= 8;
    }
  };
  let table = new Map();
  let next = end + 1;
  let width = minCode + 1;
  emit(clear, width);
  let prefix = indices[0]; // the code of the current string: a single index is its own code
  for (let k = 1; k < indices.length; k++) {
    const key = `${prefix},${indices[k]}`;
    if (table.has(key)) {
      prefix = table.get(key);
      continue;
    }
    emit(prefix, width);
    table.set(key, next);
    next += 1;
    if (next > 1 << width && width < 12) width += 1;
    if (next >= 4095) {
      emit(clear, width);
      table = new Map();
      next = end + 1;
      width = minCode + 1;
    }
    prefix = indices[k];
  }
  emit(prefix, width);
  emit(end, width);
  if (bits) out.push(buffer & 0xff);
  return Buffer.from(out);
}

const subBlocks = data => {
  const parts = [];
  for (let at = 0; at < data.length; at += 255) parts.push(Buffer.from([Math.min(255, data.length - at)]), data.subarray(at, at + 255));
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
};

function makeGif() {
  const header = Buffer.alloc(13);
  header.write('GIF89a', 0, 'latin1');
  header.writeUInt16LE(W, 6);
  header.writeUInt16LE(H, 8);
  header[10] = 0x80 | 0x70 | 1; // a global colour table of four colours
  const parts = [header, Buffer.from(PALETTE.flat()), Buffer.from('\x21\xff\x0bNETSCAPE2.0\x03\x01\x00\x00\x00', 'latin1')]; // loop forever
  for (let i = 0; i < FRAMES; i++) {
    const control = Buffer.from([0x21, 0xf9, 0x04, 0x04, 25, 0, 0, 0]); // 25 hundredths of a second per frame
    const descriptor = Buffer.alloc(10);
    descriptor[0] = 0x2c;
    descriptor.writeUInt16LE(W, 5);
    descriptor.writeUInt16LE(H, 7);
    parts.push(control, descriptor, Buffer.from([2]), subBlocks(lzw(gifFrame(i))));
  }
  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
}

// ---- WebP ----
async function webpFrames() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const urls = await page.evaluate(({ W, H, FRAMES }) => {
      const out = [];
      for (let i = 0; i < FRAMES; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const g = canvas.getContext('2d');
        g.fillStyle = '#3b1e5f';
        g.fillRect(0, 0, W, H);
        const ground = Math.floor((H * 4) / 5);
        const size = Math.floor(H / 4);
        g.fillStyle = '#10301d';
        g.fillRect(0, ground, W, Math.max(1, Math.floor(H / 40)) + 1);
        const top = 4 + i * Math.floor((ground - size - 8) / (FRAMES - 1));
        const left = Math.floor((W - size) / 2);
        g.fillStyle = '#e8456f';
        g.fillRect(left, top, size, size);
        g.fillStyle = '#ffffff';
        const eye = Math.max(2, Math.floor(size / 5));
        g.fillRect(left + Math.floor((size * 5) / 8), top + Math.floor(size / 4), eye, eye);
        out.push(canvas.toDataURL('image/webp', 1));
      }
      return out;
    }, { W, H, FRAMES });
    return urls.map(url => Buffer.from(url.split(',')[1], 'base64'));
  } finally {
    await browser.close();
  }
}

const chunk = (id, data) => {
  const header = Buffer.alloc(8);
  header.write(id, 0, 'latin1');
  header.writeUInt32LE(data.length, 4);
  return Buffer.concat([header, data, Buffer.alloc(data.length & 1)]);
};
const u24 = value => Buffer.from([value & 255, (value >> 8) & 255, (value >> 16) & 255]);

// The image chunks (VP8L, or VP8 and ALPH) of a still WebP file.
function imageChunks(file) {
  const found = [];
  for (let at = 12; at + 8 <= file.length;) {
    const id = file.toString('latin1', at, at + 4);
    const size = file.readUInt32LE(at + 4);
    if (id === 'VP8L' || id === 'VP8 ' || id === 'ALPH') found.push(chunk(id, file.subarray(at + 8, at + 8 + size)));
    at += 8 + size + (size & 1);
  }
  if (!found.some(c => c.toString('latin1', 0, 4) === 'VP8L')) throw new Error('expected lossless frames from the canvas encoder');
  return found;
}

async function makeWebp() {
  const frames = (await webpFrames()).map(file => {
    // Offsets 0,0; frame size; 300 ms; blending off and no disposal.
    const header = Buffer.concat([u24(0), u24(0), u24(W - 1), u24(H - 1), u24(300), Buffer.from([0x02])]);
    return chunk('ANMF', Buffer.concat([header, ...imageChunks(file)]));
  });
  const vp8x = Buffer.concat([Buffer.from([0x02, 0, 0, 0]), u24(W - 1), u24(H - 1)]); // the animation flag
  const anim = Buffer.concat([Buffer.from([0xff, 0xff, 0xff, 0xff]), Buffer.from([0, 0])]); // loop forever
  const body = Buffer.concat([Buffer.from('WEBP', 'latin1'), chunk('VP8X', vp8x), chunk('ANIM', anim), ...frames]);
  const head = Buffer.alloc(8);
  head.write('RIFF', 0, 'latin1');
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}

// ---- output ----
const committed = JSON.parse(readFileSync(FILE, 'utf8'));
const generated = { 'walk.gif': makeGif(), 'tie.webp': await makeWebp() };
if (process.argv.includes('--check')) {
  let differs = false;
  for (const [name, bytes] of Object.entries(generated)) {
    const same = committed.images[name]?.base64 === bytes.toString('base64');
    process.stdout.write(`make-docs-images: ${name} ${bytes.length} bytes, ${same ? 'identical to' : 'DIFFERENT from'} the committed file\n`);
    if (!same) differs = true;
  }
  process.exitCode = differs ? 1 : 0;
} else {
  for (const [name, bytes] of Object.entries(generated)) committed.images[name] = { base64: bytes.toString('base64') };
  writeFileSync(FILE, `${JSON.stringify(committed, null, 2)}\n`);
  process.stdout.write(`make-docs-images: wrote ${Object.entries(generated).map(([n, b]) => `${n} (${b.length} bytes)`).join(' and ')}\n`);
}
