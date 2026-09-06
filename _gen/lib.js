/* _gen/lib.js — 零依赖像素光栅器 + PNG 编码（Node 内置 zlib） */
"use strict";
const zlib = require('zlib');

/* ---- CRC32 ---- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
/* rgba: Uint8Array(w*h*4) */
function encodePNG(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    for (let x = 0; x < w * 4; x++) raw[y * (1 + w * 4) + 1 + x] = rgba[y * w * 4 + x];
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---- 像素画布 ---- */
class Px {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }
  put(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2];
    this.data[i + 3] = c.length > 3 ? c[3] : 255;
  }
  get(x, y) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }
  /* 半透明混合（用于阴影/光晕） */
  blend(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const a = (c.length > 3 ? c[3] : 255) / 255;
    if (a >= 1) return this.put(x, y, c);
    const old = this.get(x, y);
    this.put(x, y, [
      Math.round(c[0] * a + old[0] * (1 - a)),
      Math.round(c[1] * a + old[1] * (1 - a)),
      Math.round(c[2] * a + old[2] * (1 - a)),
      Math.max(old[3], c[3]),
    ]);
  }
  rect(x, y, w, h, c) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.put(xx, yy, c);
  }
  rectC(x, y, w, h, c) { this.rect(Math.round(x - w / 2), Math.round(y - h / 2), Math.round(w), Math.round(h), c); }
  hline(x0, x1, y, c) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.put(x, y, c); }
  vline(x, y0, y1, c) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.put(x, y, c); }
  line(x0, y0, x1, y1, c, th = 1) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (th > 1) this.rect(x0 - (th >> 1), y0 - (th >> 1), th, th, c);
      else this.put(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /* 填充多边形（扫描线） */
  poly(pts, c) {
    const ys = pts.map(p => p[1]);
    const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.round(xs[i]); x <= Math.round(xs[i + 1]); x++) this.put(x, y, c);
      }
    }
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.put(x, y, c);
      }
    }
  }
  ring(cx, cy, rx, ry, th, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        if (d <= 1 && d >= 1 - th / Math.max(rx, ry)) this.put(x, y, c);
      }
    }
  }
  /* 棋盘抖动填充 */
  dither(x, y, w, h, cA, cB, seed = 0) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const v = (xx + yy + seed * 3) & 1;
      this.put(xx, yy, v ? cA : cB);
    }
  }
  /* 垂直渐变（条带抖动) */
  vgrad(x, y, w, h, top, bottom, steps = 4) {
    for (let yy = y; yy < y + h; yy++) {
      const t = (yy - y) / Math.max(1, h - 1);
      const band = Math.min(steps - 1, Math.floor(t * steps));
      const c = t < 0.52 ? top : bottom;
      for (let xx = x; xx < x + w; xx++) {
        const dit = (xx + yy) & 1;
        this.put(xx, yy, dit && band < steps - 1 ? c : c);
      }
    }
  }
  /* 描边：与探测色不同的相邻像素补边 */
  outline(edgeColor, mustMatch = true) {
    const src = new Uint8Array(this.data);
    const match = (x, y) => {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
      const i = (y * this.w + x) * 4;
      return src[i + 3] > 30;
    };
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = (y * this.w + x) * 4;
      if (src[i + 3] <= 30) {
        // 透明像素且四邻有内容 → 描边
        if (match(x - 1, y) || match(x + 1, y) || match(x, y - 1) || match(x, y + 1)) {
          this.put(x, y, edgeColor);
        }
      }
    }
  }
  toRGBA() { return this.data; }
}

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}
function mix(a, b, t) {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t), 255];
}
function shade(c, amt) { return [Math.max(0, Math.min(255, c[0] + amt)), Math.max(0, Math.min(255, c[1] + amt)), Math.max(0, Math.min(255, c[2] + amt)), c[3] !== undefined ? c[3] : 255]; }
/* 由源图生成“白描边”版本（仅轮廓像素白色，内部透明）—— 受击闪光用 */
function edgeMask(src) {
  const out = new Px(src.w, src.h);
  const solid = (x, y) => {
    if (x < 0 || y < 0 || x >= src.w || y >= src.h) return false;
    return src.data[(y * src.w + x) * 4 + 3] > 60;
  };
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    if (!solid(x, y)) continue;
    const edge = !solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1);
    if (edge) out.put(x, y, [255, 255, 255, 255]);
  }
  return out;
}

module.exports = { Px, encodePNG, hex, mix, shade, edgeMask };
