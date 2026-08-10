/**
 * Erzeugt die App-Icons ohne externe Bildwerkzeuge oder Zusatzpakete -
 * reines Byte-Schreiben nach dem ICO/BMP-Format. Kein Designer-Asset
 * vorhanden; das Motiv (dunkles, abgerundetes Quadrat mit gelbem Punkt +
 * Ring) greift bewusst dieselben Farben auf wie die Overlays selbst
 * (--bg, --player aus renderer/shared/overlay.css).
 *
 *   node scripts/generate-icons.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const RESOURCES_DIR = join(ROOT, 'resources');

const BG = [0x0c, 0x0e, 0x12]; // --bg
const DOT = [0xff, 0xd6, 0x40]; // --player
const RING = [0xd9, 0xa5, 0x20]; // etwas dunkleres Gelb fuers Ringdetail

/** Zeichnet das Motiv als RGBA-Pixelraster (Reihe fuer Reihe, oben nach unten). */
function paint(size) {
  const pixels = new Uint8Array(size * size * 4);
  const center = (size - 1) / 2;
  const cornerRadius = size * 0.18;
  const dotRadius = size * 0.3;
  const ringOuter = size * 0.42;
  const ringInner = size * 0.36;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (isOutsideRoundedSquare(x, y, size, cornerRadius)) {
        // Transparent - abgerundete Ecken statt eines harten Quadrats.
        pixels[i + 3] = 0;
        continue;
      }

      let color = BG;
      if (dist <= dotRadius) color = DOT;
      else if (dist <= ringOuter && dist >= ringInner) color = RING;

      pixels[i] = color[0];
      pixels[i + 1] = color[1];
      pixels[i + 2] = color[2];
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

function isOutsideRoundedSquare(x, y, size, radius) {
  const nearLeft = x < radius;
  const nearRight = x > size - 1 - radius;
  const nearTop = y < radius;
  const nearBottom = y > size - 1 - radius;
  if (!(nearLeft || nearRight) || !(nearTop || nearBottom)) return false;

  const cx = nearLeft ? radius : size - 1 - radius;
  const cy = nearTop ? radius : size - 1 - radius;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy > radius * radius;
}

/** Baut eine einzelne ICONDIRENTRY + zugehoerige BMP-DIB-Daten (32bpp, mit Alphakanal). */
function buildIcoImage(size, rgbaTopDown) {
  const maskRowBytes = Math.ceil(size / 32) * 4;
  const headerSize = 40;
  const colorBytes = size * size * 4;
  const maskBytes = maskRowBytes * size;
  const dib = Buffer.alloc(headerSize + colorBytes + maskBytes);

  dib.writeUInt32LE(headerSize, 0); // biSize
  dib.writeInt32LE(size, 4); // biWidth
  dib.writeInt32LE(size * 2, 8); // biHeight (ICO-Konvention: verdoppelt fuer die AND-Maske)
  dib.writeUInt16LE(1, 12); // biPlanes
  dib.writeUInt16LE(32, 14); // biBitCount
  dib.writeUInt32LE(0, 16); // biCompression = BI_RGB
  dib.writeUInt32LE(colorBytes, 20); // biSizeImage

  // Farbdaten: BGRA, Zeilen von unten nach oben (BMP-Konvention).
  let offset = headerSize;
  for (let y = size - 1; y >= 0; y -= 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      dib[offset] = rgbaTopDown[i + 2]; // B
      dib[offset + 1] = rgbaTopDown[i + 1]; // G
      dib[offset + 2] = rgbaTopDown[i]; // R
      dib[offset + 3] = rgbaTopDown[i + 3]; // A
      offset += 4;
    }
  }
  // AND-Maske bleibt komplett 0 (= "opak") - der Alphakanal oben traegt die
  // eigentliche Transparenz, das ist der uebliche moderne Weg fuer 32bpp-Icons.

  return dib;
}

function buildIco(sizes) {
  const images = sizes.map((size) => ({ size, dib: buildIcoImage(size, paint(size)) }));

  const headerBytes = 6 + 16 * images.length;
  let totalSize = headerBytes;
  for (const img of images) totalSize += img.dib.length;

  const file = Buffer.alloc(totalSize);
  file.writeUInt16LE(0, 0); // reserved
  file.writeUInt16LE(1, 2); // type = icon
  file.writeUInt16LE(images.length, 4);

  let entryOffset = 6;
  let dataOffset = headerBytes;
  for (const img of images) {
    const dim = img.size >= 256 ? 0 : img.size; // 0 bedeutet 256 in ICO-Dateien
    file.writeUInt8(dim, entryOffset); // width
    file.writeUInt8(dim, entryOffset + 1); // height
    file.writeUInt8(0, entryOffset + 2); // color count
    file.writeUInt8(0, entryOffset + 3); // reserved
    file.writeUInt16LE(1, entryOffset + 4); // planes
    file.writeUInt16LE(32, entryOffset + 6); // bit count
    file.writeUInt32LE(img.dib.length, entryOffset + 8); // bytes in resource
    file.writeUInt32LE(dataOffset, entryOffset + 12); // offset
    img.dib.copy(file, dataOffset);
    entryOffset += 16;
    dataOffset += img.dib.length;
  }

  return file;
}

/** Minimaler PNG-Encoder (unkomprimiert, Filter 0) - fuer die Tray-Grafik reicht das. */
function buildPng(size, rgbaTopDown) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // Filter-Typ 0 = "keiner"
    Buffer.from(rgbaTopDown.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const idatData = deflateSync(raw);
  const chunks = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG-Signatur
    pngChunk('IHDR', ihdr(size)),
    pngChunk('IDAT', idatData),
    pngChunk('IEND', Buffer.alloc(0)),
  ];
  return Buffer.concat(chunks);
}

function ihdr(size) {
  const buf = Buffer.alloc(13);
  buf.writeUInt32BE(size, 0);
  buf.writeUInt32BE(size, 4);
  buf.writeUInt8(8, 8); // Bittiefe
  buf.writeUInt8(6, 9); // Farbtyp: RGBA
  buf.writeUInt8(0, 10);
  buf.writeUInt8(0, 11);
  buf.writeUInt8(0, 12);
  return buf;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

mkdirSync(RESOURCES_DIR, { recursive: true });

writeFileSync(join(RESOURCES_DIR, 'icon.ico'), buildIco([16, 32, 48, 256]));
console.log('resources/icon.ico geschrieben (16/32/48/256px)');

const trayPixels = paint(32);
writeFileSync(join(RESOURCES_DIR, 'tray-icon.png'), buildPng(32, trayPixels));
console.log('resources/tray-icon.png geschrieben (32px)');
