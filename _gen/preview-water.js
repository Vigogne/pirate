/* _gen/preview-water.js — 模拟 water.js 合成效果：渐变 + 纹理 + 波带 + 浪沫 + 波光 */
"use strict";
const fs = require('fs');
const path = require('path');
const { Px, encodePNG, mix, hex } = require('./lib.js');
const { genAll } = require('./sprites.js');

const byId = {};
for (const s of genAll()) byId[s.id] = s;

const W = 480, H = 480;
const cv = new Px(W, H);

/* 1) 渐变（5 段线性插值） */
const stops = [hex('#0a5c8c'), hex('#0e79a8'), hex('#1288b5'), hex('#0e79a8'), hex('#0a5c8c')];
for (let y = 0; y < H; y++) {
  const ft = y / (H - 1) * 4;
  const i = Math.min(3, Math.floor(ft));
  const col = mix(stops[i], stops[i + 1], ft - i);
  for (let x = 0; x < W; x++) cv.put(x, y, col);
}
/* 2) 纹理（water_0 半透明叠加，64px 平铺） */
const tile = byId.water_0.c;
for (let y = 0; y < H; y += 64) for (let x = 0; x < W; x += 64) {
  for (let yy = 0; yy < 64; yy++) for (let xx = 0; xx < 64; xx++) {
    const i = (yy * 64 + xx) * 4;
    const a = tile.data[i + 3] / 255;
    if (a > 0) cv.blend(x + xx, y + yy, [tile.data[i], tile.data[i + 1], tile.data[i + 2], tile.data[i + 3]]);
  }
}
/* 2b) 大尺度水色漂移（两团软光池） */
for (const [px, py, pr, col] of [[120, 100, 160, [140, 225, 245, 26]], [330, 300, 210, [6, 56, 90, 30]]]) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - px, y - py) / pr;
    if (d < 1) cv.blend(x, y, [col[0], col[1], col[2], Math.round(col[3] * (1 - d) * (1 - d * 0.4))]);
  }
}
/* 3) 缓涌波带（取两条） —— 模拟每列填充到图底 */
function band(yBase, amp, ph, col) {
  const column = [];
  for (let x = 0; x < W; x += 2) column.push(yBase + Math.sin(x * 0.0035 + ph) * amp + Math.sin(x * 0.0082 + ph * 2) * amp * 0.35);
  for (let x = 0; x < W; x++) {
    const t0 = column[(x >> 1) << 1];
    for (let y = Math.round(t0); y < H; y++) cv.blend(x, y, col);
  }
}
band(70, 9, 0.5, [150, 225, 240, 12]);
band(250, 11, 3.4, [8, 70, 110, 13]);
/* 4) 波峰细浪：两条正弦线 */
function crest(yBase, amp, freq, ph, alpha) {
  for (let x = 0; x < W; x++) {
    const y = Math.round(yBase + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 2.7 + ph * 2) * amp * 0.45);
    cv.blend(x, y, [235, 250, 255, Math.round(alpha)]);
  }
}
crest(120, 6, 0.015, 1.0, 30);
crest(340, 7, 0.012, 3.0, 26);
/* 5) 浪沫（foam 三处，缩小 0.6 + alpha 0.12） */
const foam = byId.foam.c;
for (const [fx, fy] of [[60, 95], [230, 210], [360, 330]]) {
  for (let yy = 0; yy < foam.h; yy++) for (let xx = 0; xx < foam.w; xx++) {
    const i = (yy * foam.w + xx) * 4;
    const a = foam.data[i + 3] / 255;
    if (a > 0) {
      cv.blend(fx + Math.round(xx * 0.6), fy + Math.round(yy * 0.6), [foam.data[i], foam.data[i + 1], foam.data[i + 2], 30]);
    }
  }
}
/* 6) 波光 */
for (let i = 0; i < 16; i++) {
  const seed = i * 127.13;
  const x = Math.round((Math.sin(seed) * 0.5 + 0.5) * W);
  const y = Math.round((Math.cos(seed * 1.3) * 0.5 + 0.5) * H);
  cv.blend(x, y, [234, 252, 255, 70]);
  if (i % 3 === 0) cv.blend(x + 1, y, [234, 252, 255, 45]);
}

const OUT = path.join(__dirname, '..', '_preview');
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'sea.png'), encodePNG(W, H, cv.data));
console.log('sea.png', W + 'x' + H);
