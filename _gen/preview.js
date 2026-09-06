/* _gen/preview.js — 输出 PNG 预览（2× 最近邻放大），供人工检查 */
"use strict";
const fs = require('fs');
const path = require('path');
const { genAll } = require('./sprites.js');
const { encodePNG } = require('./lib.js');

const byId = {};
for (const s of genAll()) byId[s.id] = s;

const OUT = path.join(__dirname, '..', '_preview');
fs.mkdirSync(OUT, { recursive: true });

function upscale(src, k) {
  const c = new Uint8Array(src.w * k * src.h * k * 4);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const si = (y * src.w + x) * 4;
    for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) {
      const di = ((y * k + yy) * src.w * k + (x * k + xx)) * 4;
      c[di] = src.data[si]; c[di + 1] = src.data[si + 1]; c[di + 2] = src.data[si + 2]; c[di + 3] = src.data[si + 3];
    }
  }
  return { w: src.w * k, h: src.h * k, data: c };
}

/* 组合图：把若干精灵横排（带 20px 间隔），2 倍放大 */
function compose(items, k, fname) {
  const gap = 16 * k;
  const W = items.reduce((a, s) => a + s.w * k + gap, gap);
  const H = Math.max(...items.map(s => s.h * k)) + gap * 2;
  const out = new Uint8Array(W * H * 4);
  let x0 = gap;
  for (const s of items) {
    const u = upscale(s, k);
    for (let y = 0; y < u.h; y++) for (let x = 0; x < u.w; x++) {
      const si = (y * u.w + x) * 4;
      const di = ((y + gap) * W + (x + x0)) * 4;
      out[di] = u.data[si]; out[di + 1] = u.data[si + 1]; out[di + 2] = u.data[si + 2]; out[di + 3] = u.data[si + 3];
    }
    x0 += u.w + gap;
  }
  fs.writeFileSync(path.join(OUT, fname), encodePNG(W, H, out));
  console.log(fname, W + 'x' + H);
}

const P = (id) => byId[id].c;
compose([P('island_0'), P('island_1'), P('island_2'), P('island_3')], 2, 'islands.png');
compose([P('base_0')], 2, 'base0.png');
compose([P('base_1')], 2, 'base1.png');
compose([P('lair_grotto')], 2, 'grotto.png');
compose([P('lair_wreck')], 2, 'wreck.png');
compose([P('shark_body2'), P('shark_tail2')], 3, 'shark.png');
compose([P('shark_head'), P('shark_rear')], 3, 'shark_parts.png');
compose([P('palm')], 2, 'palm.png');
compose([P('tower_body1'), P('tower_turret1'), P('tower_body2'), P('tower_turret2')], 3, 'towers.png');

/* 中路走廊岛的实际拉伸效果（rx=96, ry=215） */
function stretchDemo() {
  const s = P('island_0');
  const kx = 96 / 96, ky = 215 / 96;
  const W = Math.round(s.w * kx), H = Math.round(s.h * ky);
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = Math.min(s.w - 1, Math.floor(x / kx)), sy = Math.min(s.h - 1, Math.floor(y / ky));
    const si = (sy * s.w + sx) * 4, di = (y * W + x) * 4;
    out[di] = s.data[si]; out[di + 1] = s.data[si + 1]; out[di + 2] = s.data[si + 2]; out[di + 3] = s.data[si + 3];
  }
  fs.writeFileSync(path.join(OUT, 'stretch.png'), encodePNG(W, H, out));
  console.log('stretch.png', W + 'x' + H);
}
stretchDemo();
