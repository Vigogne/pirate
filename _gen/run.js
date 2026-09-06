/* _gen/run.js — 打包所有精灵到 assets/atlas.png + assets/manifest.js，并写入游戏可用清单 */
"use strict";
const fs = require('fs');
const path = require('path');
const { genAll } = require('./sprites.js');
const { encodePNG, edgeMask } = require('./lib.js');

const ASSETS = path.join(__dirname, '..', 'assets');
fs.mkdirSync(ASSETS, { recursive: true });

const list = genAll();
// 为每个精灵派生“受击白描边”版本（特效与原图独立）
const flashList = list.map(s => ({ id: s.id + '__e', w: s.w, h: s.h, c: edgeMask(s.c) }));
const all = [...list, ...flashList];
const sorted = [...all].sort((a, b) => b.h - a.h);
const pad = 1;
let atlasW = 512, atlasH = 512;
let x = pad, y = pad, rowH = 0;
const rects = [];
for (const s of sorted) {
  if (x + s.w + pad > atlasW) {
    x = pad; y += rowH + pad; rowH = 0;
    if (y + s.h + pad > atlasH) atlasH *= 2;
  }
  rects.push({ id: s.id, x, y, w: s.w, h: s.h, c: s.c });
  x += s.w + pad;
  rowH = Math.max(rowH, s.h);
}
const atlas = new Uint8Array(atlasW * atlasH * 4);
for (const r of rects) {
  for (let yy = 0; yy < r.h; yy++) {
    for (let xx = 0; xx < r.w; xx++) {
      const si = (yy * r.w + xx) * 4;
      const di = ((r.y + yy) * atlasW + (r.x + xx)) * 4;
      atlas[di] = r.c.data[si];
      atlas[di + 1] = r.c.data[si + 1];
      atlas[di + 2] = r.c.data[si + 2];
      atlas[di + 3] = r.c.data[si + 3];
    }
  }
}
const png = encodePNG(atlasW, atlasH, atlas);
fs.writeFileSync(path.join(ASSETS, 'atlas.png'), png);
const manifest = {};
for (const r of rects) manifest[r.id] = { x: r.x, y: r.y, w: r.w, h: r.h };
const manifestJs = `/* 自动生成：精灵清单（_gen/run.js） */\nwindow.SPRITE_MANIFEST = ${JSON.stringify(manifest, null, 0)};\n`;
fs.writeFileSync(path.join(ASSETS, 'manifest.js'), manifestJs);

console.log('atlas.png', atlasW + 'x' + atlasH, png.length, 'bytes');
console.log('sprites:', rects.length, '(含边缘闪光版)');
console.log('saved to', ASSETS);
