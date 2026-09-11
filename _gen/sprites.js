/* _gen/sprites.js — 像素素材（2D 骨骼部件版）：每个部件是独立精灵，运行时由骨骼驱动 */
"use strict";
const { Px, hex } = require('./lib.js');

const PAL = {
  wood: hex('#96633a'), woodD: hex('#6b4424'), woodL: hex('#bd8f58'),
  deck: hex('#c79a62'), plank: hex('#8a6236'), plankD: hex('#6d4c28'),
  sail: hex('#f2efe0'), sailD: hex('#d8cfae'), sailX: hex('#bfae8a'),
  iron: hex('#4a5662'), ironD: hex('#2e3840'), ironL: hex('#65727f'), ironXL: hex('#8291a0'),
  teal: hex('#2f7f8f'), tealD: hex('#1e5b69'), tealL: hex('#43a3b5'),
  brass: hex('#c9942e'), brassD: hex('#8f6a1a'), brassL: hex('#f2d278'), brassXL: hex('#ffe9a8'),
  purple: hex('#7a4fae'), purpleD: hex('#542f80'), purpleL: hex('#a678d8'), purpleXL: hex('#c9a4ff'),
  shark: hex('#3f7f9e'), sharkD: hex('#2a5872'), sharkL: hex('#6ba7c0'),
  navy: hex('#242935'), navyD: hex('#12151d'), navyL: hex('#3a4152'), navyXL: hex('#4e576b'),
  sand: hex('#e9d28e'), sandD: hex('#cba95c'),
  grass: hex('#4f9a5c'), grassD: hex('#2f6b3c'),
  stone: hex('#8a917f'), stoneD: hex('#565c50'), stoneL: hex('#a8af9b'),
  flagB: hex('#4db6e8'), flagR: hex('#e6574d'),
  white: hex('#f5f8f8'), bone: hex('#e9e1c8'),
  dark: hex('#140c06'), red: hex('#a83232'), lantern: hex('#ffd27a'),
};
const OUTLINE = hex('#120a04');

function glint(c, x, y, col) { c.rect(x, y, 1, 1, col); c.rect(x - 1, y, 1, 1, col); c.rect(x + 1, y, 1, 1, col); c.rect(x, y - 1, 1, 1, col); c.rect(x, y + 1, 1, 1, col); }
function mount(c, x, y) {
  c.rect(x - 6, y - 6, 12, 12, PAL.navyXL);
  c.rect(x - 5, y - 5, 10, 10, PAL.navyL);
  c.rect(x - 4, y - 4, 8, 8, PAL.navy);
  c.rect(x - 2, y - 2, 4, 4, PAL.navyD);
  c.put(x - 5, y - 5, PAL.white); c.put(x - 5, y + 4, PAL.navyD);
}
const SLOTS = [[48 - 28.8, 40], [48 + 28.8, 40], [48 - 24, 93], [48 + 24, 93]];

/* ================= 船体（无帆/桅，骨骼部件 y） ================= */
function bodyFlag() {
  const c = new Px(96, 128);
  const pts = [[48, 4], [68, 22], [78, 44], [78, 86], [64, 110], [48, 120], [32, 110], [18, 86], [18, 44], [28, 22]];
  c.poly(pts, hex('#96633a'));
  c.line(26, 30, 70, 30, hex('#bd8f58'));
  c.line(22, 60, 74, 60, hex('#6b4424'));
  c.line(22, 92, 74, 92, hex('#6b4424'));
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    c.line(a[0], a[1], b[0], b[1], OUTLINE, 2);
  }
  c.poly([[48, 16], [62, 34], [66, 46], [66, 84], [56, 102], [48, 106], [40, 102], [30, 84], [30, 46], [34, 34]], hex('#c79a62'));
  c.poly([[48, 20], [58, 36], [61, 46], [61, 82], [53, 98], [48, 101]], hex('#d8a86a'));
  for (let y = 40; y < 100; y += 11) c.hline(34, 62, y, PAL.plank);
  c.hline(32, 64, 52, PAL.plankD);
  c.rect(36, 88, 24, 14, hex('#bd8f58'));
  c.rect(36, 88, 24, 2, hex('#6b4424'));
  c.rect(40, 92, 16, 4, OUTLINE); c.rect(41, 93, 14, 2, PAL.lantern);
  for (const [px, py] of [[24, 70], [24, 82], [66, 70], [66, 82]]) {
    c.rect(px, py, 6, 6, OUTLINE); c.rect(px + 1, py + 1, 4, 4, PAL.dark); c.put(px + 2, py + 2, PAL.lantern);
  }
  // 艏柱（挂旗骨的停靠点）
  c.rect(46, 0, 4, 12, hex('#6b4424'));
  for (const [mx, my] of SLOTS) mount(c, Math.round(mx), my);
  c.rect(20, 96, 4, 4, PAL.lantern); c.rect(72, 96, 4, 4, PAL.lantern);
  return { id: 'ship_flag_b', w: 96, h: 128, c };
}
function bodyBulwark() {
  const c = new Px(96, 128);
  const pts = [[48, 6], [72, 20], [80, 44], [80, 88], [68, 112], [48, 124], [28, 112], [16, 88], [16, 44], [24, 20]];
  c.poly(pts, hex('#4a5662'));
  c.line(24, 32, 72, 32, hex('#65727f'));
  c.line(20, 64, 76, 64, hex('#2e3840'));
  c.line(20, 96, 76, 96, hex('#2e3840'));
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    c.line(a[0], a[1], b[0], b[1], OUTLINE, 2);
  }
  for (let x = 26; x <= 70; x += 12) { c.put(x, 34, hex('#8291a0')); c.put(x, 66, hex('#8291a0')); }
  c.rect(28, 34, 40, 60, hex('#65727f'));
  c.rect(28, 34, 40, 3, hex('#8291a0'));
  c.rect(34, 40, 28, 26, hex('#65727f'));
  c.rect(34, 40, 28, 3, hex('#8291a0'));
  c.rect(36, 48, 24, 8, PAL.flagB);
  c.rect(44, 52, 8, 2, PAL.white);
  c.hline(30, 66, 74, hex('#2e3840')); c.hline(30, 66, 88, hex('#2e3840'));
  c.rect(42, 12, 12, 18, hex('#2e3840'));
  c.rect(42, 12, 12, 3, OUTLINE);
  c.poly([[48, 0], [60, 16], [36, 16]], hex('#65727f'));
  c.line(48, 2, 48, 14, hex('#2e3840'));
  c.vline(76, 92, 10, hex('#2e3840'));
  for (const [mx, my] of SLOTS) mount(c, Math.round(mx), my);
  return { id: 'ship_bulwark_b', w: 96, h: 128, c };
}
function bodyGale() {
  const c = new Px(96, 128);
  for (const side of [-1, 1]) {
    const cx = 48 + side * 26;
    const pts = [[cx, 8], [cx + side * 8, 28], [cx + side * 8, 60], [cx + side * 6, 96], [cx, 114],
                 [cx - side * 6, 96], [cx - side * 8, 60], [cx - side * 8, 28]];
    c.poly(pts, hex('#2f7f8f'));
    c.line(cx - side * 6, 12, cx - side * 6, 102, hex('#1e5b69'));
    c.line(cx, 12, cx, 106, hex('#1e5b69'));
    for (let y = 40; y < 100; y += 16) c.rect(cx - side * 7, y, 7, 4, hex('#e9d28e'));
    c.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], OUTLINE, 2);
    c.line(pts[3][0], pts[3][1], pts[4][0], pts[4][1], OUTLINE, 2);
  }
  c.rect(18, 22, 60, 76, hex('#f2efe0'));
  c.rect(18, 22, 60, 4, hex('#1e5b69'));
  for (let x = 26; x < 78; x += 12) c.vline(x, 24, 96, hex('#d8cfae'));
  for (let y = 34; y < 96; y += 14) c.hline(19, 77, y, hex('#d8cfae'));
  for (const [mx, my] of SLOTS) mount(c, Math.round(mx), my);
  return { id: 'ship_gale_b', w: 96, h: 128, c };
}
function bodyRam() {
  const c = new Px(96, 128);
  const pts = [[48, 6], [72, 20], [80, 48], [80, 92], [64, 118], [48, 124], [32, 118], [16, 92], [16, 48], [24, 20]];
  c.poly(pts, hex('#8a4a34'));
  c.line(26, 36, 70, 36, hex('#b06a48'));
  c.line(20, 70, 76, 70, hex('#5f2f20'));
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    c.line(a[0], a[1], b[0], b[1], OUTLINE, 2);
  }
  c.rect(30, 30, 36, 66, hex('#c79a62'));
  for (let y = 38; y < 92; y += 11) c.hline(32, 64, y, PAL.plank);
  c.rect(28, 78, 40, 8, hex('#24303e'));
  c.rect(28, 78, 40, 2, hex('#9aa3ad'));
  c.poly([[48, 0], [62, 18], [34, 18]], hex('#c9942e'));
  c.line(48, 2, 48, 15, hex('#8f6a1a'));
  c.poly([[48, 0], [56, 10], [48, 10]], hex('#f2d278'));
  c.put(44, 4, hex('#ffe9a8'));
  c.rect(44, 118, 8, 8, hex('#4a4a52'));
  for (const [mx, my] of SLOTS) mount(c, Math.round(mx), my);
  c.rect(24, 100, 4, 4, PAL.lantern); c.rect(68, 100, 4, 4, PAL.lantern);
  return { id: 'ship_ram_b', w: 96, h: 128, c };
}
function bodyBio() {
  const c = new Px(96, 128);
  for (let i = 0; i < 5; i++) {
    const x0 = 30 + i * 9;
    c.line(x0, 82, x0, 100, hex('#542f80'), 4);
    c.line(x0, 100, x0 + 0, 120 + (i % 2) * 4, hex('#542f80'), 3);
    c.rect(x0 - 2, 120 + (i % 2) * 4, 4, 3, hex('#a678d8'));
  }
  const pts = [], cx = 48, cy = 76, r = 34;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    pts.push([Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.9)]);
  }
  c.poly(pts, hex('#7a4fae'));
  c.poly([[48, 46], [66, 58], [72, 76], [60, 96], [48, 100]], hex('#8a63c2'));
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    c.line(a[0], a[1], b[0], b[1], OUTLINE, 2);
  }
  c.rect(36, 62, 5, 5, hex('#c9a4ff')); c.rect(56, 80, 5, 5, hex('#c9a4ff'));
  c.poly([[42, 44], [48, 24], [54, 44]], hex('#542f80'));
  // 鲨鱼头（独立鳍由骨驱动）
  c.poly([[48, 4], [64, 28], [64, 56], [32, 56], [32, 28]], hex('#3f7f9e'));
  c.line(32, 28, 64, 28, hex('#2a5872'));
  c.line(32, 56, 64, 56, hex('#2a5872'));
  c.rect(38, 46, 20, 4, hex('#f5f8f8'));
  c.vline(44, 46, 50, hex('#140c06')); c.vline(52, 46, 50, hex('#140c06'));
  c.rect(38, 34, 6, 6, hex('#f5f8f8')); c.rect(52, 34, 6, 6, hex('#f5f8f8'));
  c.rect(40, 36, 3, 4, hex('#140c06')); c.rect(53, 36, 3, 4, hex('#140c06'));
  for (const [mx, my] of SLOTS) mount(c, Math.round(mx), my);
  return { id: 'ship_bio_b', w: 96, h: 128, c };
}

/* 舢板艇（小体型：单炮位在船头） */
function bodySkiff() {
  const c = new Px(72, 84);
  const pts = [[36, 4], [52, 18], [60, 38], [60, 60], [48, 74], [36, 79], [24, 74], [12, 60], [12, 38], [20, 18]];
  c.poly(pts, hex('#8a5a34'));
  c.line(20, 26, 52, 26, hex('#bd8f58'));
  c.line(15, 52, 57, 52, hex('#6b4424'));
  c.line(15, 66, 57, 66, hex('#6b4424'));
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    c.line(a[0], a[1], b[0], b[1], OUTLINE, 2);
  }
  c.poly([[36, 12], [46, 22], [52, 40], [52, 58], [42, 68], [36, 71], [30, 68], [20, 58], [20, 40], [26, 22]], hex('#c79a62'));
  c.poly([[36, 16], [43, 24], [48, 40], [48, 56], [40, 64], [36, 66]], hex('#d8a86a'));
  for (let y = 30; y < 64; y += 10) c.hline(23, 49, y, PAL.plank);
  c.rect(22, 44, 28, 5, hex('#bd8f58'));
  c.rect(22, 44, 28, 1, hex('#6b4424'));
  c.rect(34, 0, 4, 12, hex('#6b4424'));
  mount(c, 36, 22);
  c.rect(18, 74, 4, 4, PAL.lantern); c.rect(50, 74, 4, 4, PAL.lantern);
  return { id: 'ship_skiff_b', w: 72, h: 84, c };
}
function mastSkiff() {
  const c = new Px(22, 46);
  c.vline(11, 0, 44, hex('#6b4424'), 2);
  c.line(3, 13, 19, 13, hex('#6b4424'), 2);
  c.rect(3, 14, 16, 20, hex('#f2efe0'));
  c.rect(3, 14, 16, 2, hex('#d8cfae'));
  c.rect(3, 31, 16, 3, hex('#bfae8a'));
  c.vline(11, 14, 34, hex('#d8cfae'));
  glint(c, 5, 17, hex('#ffffff'));
  return { id: 'ship_skiff_m', w: 22, h: 46, c };
}

/* 帆（骨骼部件：底部中心 = 枢轴点） */
function mastFlag() {
  const c = new Px(34, 60);
  c.vline(17, 0, 58, hex('#6b4424'), 3);
  c.line(3, 21, 31, 21, hex('#6b4424'), 2);        // 横桁
  c.rect(4, 22, 26, 28, hex('#f2efe0'));
  c.rect(4, 22, 26, 3, hex('#d8cfae'));
  c.rect(4, 47, 26, 3, hex('#bfae8a'));
  c.vline(17, 22, 50, hex('#d8cfae'));
  glint(c, 7, 26, hex('#ffffff'));
  c.rect(4, 30, 26, 2, hex('#e9e2cc'));
  return { id: 'ship_flag_mF', w: 34, h: 60, c };
}
function mastFlagB() {
  const c = new Px(30, 52);
  c.vline(15, 0, 50, hex('#6b4424'), 3);
  c.line(4, 18, 26, 18, hex('#6b4424'), 2);
  c.rect(4, 19, 22, 22, hex('#f2efe0'));
  c.rect(4, 19, 22, 3, hex('#d8cfae'));
  c.vline(15, 19, 41, hex('#d8cfae'));
  return { id: 'ship_flag_mB', w: 30, h: 52, c };
}
function mastGale() {
  const c = new Px(56, 104);
  c.vline(28, 0, 100, hex('#6b4424'), 3);
  // 大晚帆（硬边三角 + 两档色调）
  c.poly([[28, 2], [3, 66], [26, 60]], hex('#f2efe0'));
  c.poly([[28, 2], [53, 66], [30, 60]], hex('#e9e2cc'));
  c.line(28, 4, 4, 63, hex('#bfae8a'));
  c.line(28, 4, 52, 63, hex('#bfae8a'));
  // 前帆
  c.poly([[28, 28], [6, 62], [26, 54]], hex('#e9e2cc'));
  glint(c, 10, 34, hex('#ffffff'));
  return { id: 'ship_gale_m', w: 56, h: 104, c };
}
function mastRam() {
  const c = new Px(44, 70);
  c.vline(22, 0, 68, hex('#6b4424'), 3);
  c.line(4, 24, 40, 24, hex('#6b4424'), 2);
  c.rect(5, 25, 34, 30, hex('#f2efe0'));
  c.rect(5, 25, 34, 3, hex('#d8cfae'));
  c.rect(5, 52, 34, 3, hex('#bfae8a'));
  c.vline(22, 25, 55, hex('#d8cfae'));
  glint(c, 9, 29, hex('#ffffff'));
  return { id: 'ship_ram_m', w: 44, h: 70, c };
}
function pennant() {
  const c = new Px(22, 14);
  c.poly([[0, 0], [20, 3], [20, 11], [0, 14]], hex('#4db6e8'));
  c.rect(0, 0, 20, 2, hex('#bfe8ff'));
  c.line(2, 4, 16, 5, hex('#3b9bd6'));
  return { id: 'ship_pennant', w: 22, h: 14, c };
}

/* ================= 小兵（身体 + 帆骨） ================= */
function minBody(big) {
  const W = big ? 52 : 44, H = big ? 58 : 50;
  const c = new Px(W, H);
  const cx = W >> 1;
  const col = big ? hex('#2f7f8f') : hex('#96633a');
  const colD = big ? hex('#1e5b69') : hex('#6b4424');
  const k = big ? 1 : 0.9;
  const pts = [[cx, 4], [cx + 14 * k, 16], [cx + 16 * k, 32 * k], [cx + 10 * k, 44 * k], [cx, 50 * k],
               [cx - 10 * k, 44 * k], [cx - 16 * k, 32 * k], [cx - 14 * k, 16]];
  c.poly(pts, col);
  c.line(cx - 13 * k, 18, cx + 13 * k, 18, colD);
  c.line(cx - 12 * k, 34 * k, cx + 12 * k, 34 * k, colD);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    c.line(a[0], a[1], b[0], b[1], OUTLINE, 2);
  }
  c.poly([[cx, 10], [cx + 9 * k, 20], [cx + 10 * k, 30 * k], [cx - 10 * k, 30 * k], [cx - 9 * k, 20]], hex('#c79a62'));
  c.rect(cx - 3, 30 * k, 6, 8, hex('#242935'));
  c.rect(cx - 2, 36 * k, 4, 4, hex('#12151d'));
  return { id: big ? 'min_gunboat_b' : 'min_sloop_b', w: W, h: H, c };
}
function minMast(big) {
  const W = big ? 28 : 24, H = big ? 30 : 26;
  const c = new Px(W, H);
  const cx = W >> 1;
  c.vline(cx, 0, H - 2, hex('#6b4424'), 2);
  c.rect(cx - 9, 6, 18, 16, hex('#f2efe0'));
  c.rect(cx - 9, 6, 18, 2, hex('#d8cfae'));
  c.rect(cx - 9, 20, 18, 2, hex('#bfae8a'));
  c.vline(cx, 6, 22, hex('#d8cfae'));
  glint(c, cx - 6, 8, hex('#ffffff'));
  return { id: big ? 'min_gunboat_m' : 'min_sloop_m', w: W, h: H, c };
}

/* ================= 防御塔（俯视石堡 + 旋转炮塔骨） ================= */
function polyPts(cx, cy, r, n, rot0 = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot0 + (i / n) * TAU;
    pts.push([Math.round((cx + Math.cos(a) * r) * 4) / 4, Math.round((cy + Math.sin(a) * r) * 4) / 4]);
  }
  return pts;
}
function towerBody(tier) {
  const S = tier === 1 ? 68 : 80;
  const c = new Px(S, S);
  const cx = S >> 1, cy = S >> 1;
  const R = tier === 1 ? 27 : 33;
  const stone = hex('#828a77'), stoneL = hex('#9ba38d'), stoneD = hex('#525a4e');
  const stoneXL = hex('#c0c6ae'), floor = hex('#686f60'), floorD = hex('#59604f');
  const iron = hex('#242935'), ironL = hex('#4e576b');
  const brass = hex('#c9942e'), brassD = hex('#8f6a1a'), brassXL = hex('#f2d278');

  // 环塔礁岩基座（圆润多层岩 + 环周礁石鼓包 + 苔点）
  c.poly(coastPts(cx, cy + 10, R * 1.6, R * 0.92, 31 + tier * 17, 46, 0.55), hex('#3f463b'));
  c.poly(coastPts(cx, cy + 8, R * 1.46, R * 0.82, 33 + tier * 17, 44, 0.5), hex('#6f7666'));
  for (let i = 0; i < 6; i++) {
    const a = i * 1.07 + 0.4;
    const px = Math.round(cx + Math.cos(a) * R * 1.2), py = Math.round(cy + 9 + Math.sin(a) * R * 0.7);
    c.poly(coastPts(px, py, 7 + (i % 3) * 3, 5 + (i % 2) * 2, 91 + i * 7 + tier, 14, 0.4), i % 2 ? hex('#7d8570') : hex('#767e6a'));
  }
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + 1.3;
    const mx = Math.round(cx + Math.cos(a) * R * 1.24), my = Math.round(cy + 8 + Math.sin(a) * R * 0.6);
    c.put(mx, my, hex('#4f8a52')); c.put(mx + 1, my, hex('#2f6b3c')); c.put(mx, my + 1, hex('#3c7c4a'));
  }

  // 石堡环形墙（俯视：外圈墙 + 走道 + 中央炮台）
  const wall = coastPts(cx, cy, R, R, 11 + tier, 46);
  c.poly(wall, stone);
  c.poly(coastPts(cx, cy, R * 0.96, R * 0.96, 13 + tier, 44), stoneL);
  c.poly(coastPts(cx + R * 0.3, cy + R * 0.3, R * 0.5, R * 0.5, 15 + tier, 30), stoneD);
  // 砖缝：外缘 + 环缝 + 交错径向缝
  c.ring(cx, cy, R * 0.985, R * 0.985, 1, stoneD);
  c.ring(cx, cy, R * 0.86, R * 0.86, 1, stoneD);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU + (i % 2) * 0.06;
    c.line(Math.round(cx + Math.cos(a) * R * 0.865), Math.round(cy + Math.sin(a) * R * 0.865),
           Math.round(cx + Math.cos(a) * R * 0.982), Math.round(cy + Math.sin(a) * R * 0.982), stoneD, 1);
  }
  strokePoly(c, wall, hex('#3c4238'), 1);

  // 雉堞（护墙齿环，双色块 + 顶光）
  const nMer = tier === 1 ? 10 : 12;
  for (let i = 0; i < nMer; i++) {
    const a = (i / nMer) * TAU + 0.16;
    const mx = Math.round(cx + Math.cos(a) * R * 0.9), my = Math.round(cy + Math.sin(a) * R * 0.9);
    c.rect(mx - 3, my - 3, 7, 6, stoneXL);
    c.rect(mx - 3, my - 3, 7, 2, hex('#d6dcc6'));
    c.rect(mx - 3, my + 1, 7, 2, stoneD);
    if (tier === 2 && i % 2 === 0) { c.put(mx, my - 3, brassXL); c.put(mx + 1, my - 3, brass); }
  }

  // 走道（暗色环廊 + 斑驳）
  c.poly(coastPts(cx, cy, R * 0.8, R * 0.8, 17 + tier, 40), floor);
  c.poly(coastPts(cx + R * 0.14, cy + R * 0.1, R * 0.44, R * 0.44, 19 + tier, 32), floorD);
  c.ring(cx, cy, R * 0.62, R * 0.62, 1, hex('#4c5346'));

  // 中央铁甲炮台基座（八角转盘 + 铆钉 + 内盘）
  c.poly(polyPts(cx, cy, R * 0.44, 8, Math.PI / 8), iron);
  c.poly(polyPts(cx, cy, R * 0.36, 8, Math.PI / 8), hex('#3a4152'));
  c.poly(polyPts(cx - R * 0.1, cy - R * 0.1, R * 0.14, 8, Math.PI / 8), ironL);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    const bx = Math.round(cx + Math.cos(a) * R * 0.4), by = Math.round(cy + Math.sin(a) * R * 0.4);
    c.put(bx, by, brassXL); c.put(bx, by + 1, brassD);
  }
  if (tier === 2) {
    // 青铜环带 + 核心徽记（二塔特种）
    c.ring(cx, cy, R * 0.29, R * 0.29, 2.5, brass);
    c.ring(cx, cy, R * 0.29, R * 0.29, 0.8, brassXL);
    c.poly(polyPts(cx, cy, R * 0.11, 4, Math.PI / 4), brassXL);
    c.poly(polyPts(cx, cy, R * 0.07, 4, Math.PI / 4), brass);
  }
  return { id: 'tower_body' + tier, w: S, h: S, c };
}
function towerTurret(tier) {
  const S = tier === 1 ? 32 : 40;
  const c = new Px(S, S);
  const cx = S >> 1;
  const iron = hex('#242935'), ironL = hex('#4e576b'), ironXL = hex('#8291a0'), ironD = hex('#12151d');
  const brass = hex('#c9942e'), brassXL = hex('#f2d278'), brassD = hex('#8f6a1a');
  // 装甲八角炮座（底层阴影 → 主体 → 内盘 → 铆钉）
  c.poly(polyPts(cx, cx + 2, tier === 1 ? 9 : 11.5, 8, Math.PI / 8), hex('#181d26'));
  c.poly(polyPts(cx, cx + 1, tier === 1 ? 8 : 10.5, 8, Math.PI / 8), iron);
  c.poly(polyPts(cx - 2, cx, tier === 1 ? 5.5 : 7, 8, Math.PI / 8), hex('#39414f'));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    c.put(Math.round(cx + Math.cos(a) * (tier === 1 ? 6.5 : 8.5)), Math.round(cx + Math.sin(a) * (tier === 1 ? 6.5 : 8.5)), brass);
  }
  if (tier === 1) {
    // 单管加农（朝上）：炮口箍 + 长炮管高光 + 黄铜箍 + 后座座
    c.rect(cx - 4, 0, 8, 5, ironD);
    c.rect(cx - 4, 0, 8, 1, hex('#0c1016'));
    c.rect(cx - 2.5, 3, 5, 14, ironXL);
    c.rect(cx - 2.5, 3, 2, 14, hex('#a9bac9'));
    c.rect(cx - 1.5, 8, 3, 3, brass);
    c.rect(cx - 4, 16, 8, 4, ironL);
    c.rect(cx - 4, 16, 8, 1, hex('#65727f'));
  } else {
    // 双管重炮 + 黄铜中央锁
    for (const dx2 of [-7, 1]) {
      c.rect(cx + dx2 - 1, 0, 6, 5, ironD);
      c.rect(cx + dx2, 3, 4, 16, ironXL);
      c.rect(cx + dx2, 3, 2, 16, hex('#a9bac9'));
      c.rect(cx + dx2 - 1, 17, 6, 4, ironL);
    }
    c.rect(cx - 2.5, 6, 5, 10, brass);
    c.rect(cx - 2.5, 6, 5, 2, brassXL);
    c.rect(cx - 1, 9, 2, 4, brassD);
  }
  return { id: 'tower_turret' + tier, w: S, h: S, c };
}

/* ================= Boss 骨骼部件 ================= */
function octBody() {
  const c = new Px(88, 88);
  const pts = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    pts.push([Math.round(44 + Math.cos(a) * 34), Math.round(44 + Math.sin(a) * 34)]);
  }
  c.poly(pts, hex('#7a4fae'));
  c.poly([[44, 14], [62, 26], [70, 44], [58, 66], [44, 70], [30, 66], [18, 44], [26, 26]], hex('#a678d8'));
  c.poly([[44, 18], [56, 26], [62, 40], [54, 58], [44, 62]], hex('#c9a4ff'));
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    c.line(a[0], a[1], b[0], b[1], OUTLINE, 2);
  }
  c.rect(26, 40, 4, 4, hex('#542f80')); c.rect(56, 52, 4, 4, hex('#542f80'));
  c.rect(38, 58, 4, 4, hex('#542f80'));
  for (const ex of [26, 54]) {
    c.rect(ex, 22, 9, 9, hex('#ffe9c0'));
    c.rect(ex + 2, 25, 4, 6, hex('#140c06'));
    c.put(ex + 2, 25, hex('#ffffff'));
  }
  c.line(14, 8, 30, 2, hex('#542f80'), 2);
  return { id: 'oct_body', w: 88, h: 88, c };
}
/* 触手段：8×18 条带（枢轴在顶部中心） */
function octSeg(tip) {
  const c = new Px(10, tip ? 18 : 20);
  c.rect(2, 0, 6, 18, hex('#542f80'));
  c.rect(2, 0, 2, 18, hex('#a678d8'));
  c.rect(1, 0, 8, 2, hex('#3c2260'));
  if (tip) { c.rect(3, 6, 4, 3, hex('#c9a4ff')); c.rect(3, 12, 4, 3, hex('#c9a4ff')); c.rect(2, 17, 6, 1, hex('#3c2260')); }
  return { id: tip ? 'oct_tip' : 'oct_seg', w: 10, h: tip ? 18 : 20, c };
}
/* 俯视角鲨鱼：船头朝上（0=上，与船体一致），细长流线型 + 白色侧腹缘
 * 骨骼分为 头/后身/尾 三段：转身时后段与尾骨向转弯内侧弯曲 */
function sharkBodyPx(dy, h) {
  const c = new Px(64, h);
  const cx = 32;
  const E = (y) => y - dy;                 // 素材 y → 画布 y（裁切 = 截半身）
  /* 半宽轮廓（俯视）：头圆 → 肩宽最大 → 细长收尾 */
  const prof = (y) => {
    if (y <= 32) return 1.6 + (y - 4) / 28 * 9.2;
    if (y <= 48) return 10.8 + (y - 32) / 16 * 0.9;
    return 11.7 - (y - 48) / 45 * 8.5;
  };
  const ys = [4, 10, 16, 22, 28, 34, 40, 46, 52, 58, 64, 70, 76, 82, 88, 92, 93];
  const silR = ys.map(y => [cx + prof(y), E(y)]);
  const silL = ys.slice().reverse().map(y => [cx - prof(y), E(y)]);
  const sil = [[cx, E(2)], ...silR, ...silL.slice(0, silL.length - 1)];
  // 白色侧腹缘（外轮廓）
  c.poly(sil, hex('#dcedf4'));
  // 灰蓝背部（内缩）
  const sil2 = [[cx, E(6)], ...ys.slice(1).map(y => [cx + Math.max(1.2, prof(y) - 2.6), E(y)]),
                ...ys.slice().reverse().slice(1, -1).map(y => [cx - Math.max(1.2, prof(y) - 2.6), E(y)])];
  c.poly(sil2, hex('#4a82a0'));
  // 脊背受光带
  c.poly([[cx, E(10)], [cx + 3.4, E(34)], [cx + 3.4, E(62)], [cx, E(88)], [cx - 3.4, E(62)], [cx - 3.4, E(34)]], hex('#5a92ae'));
  // 双胸鳍（细长后掠，深色）
  for (const s of [1, -1]) {
    c.poly([[cx + s * 9, E(36)], [cx + s * 21, E(52)], [cx + s * 19, E(68)], [cx + s * 10, E(50)]], hex('#315f7a'));
    c.poly([[cx + s * 9, E(36)], [cx + s * 21, E(52)], [cx + s * 14.5, E(52)]], hex('#4a82a0'));
  }
  // 背鳍中刃（沿脊背的窄刃）
  c.poly([[cx, E(38)], [cx + 4.2, E(52)], [cx, E(68)], [cx - 4.2, E(52)]], hex('#2d5d78'));
  c.poly([[cx, E(42)], [cx + 2.2, E(52)], [cx, E(64)]], hex('#3e7390'));
  // 后背小鳍
  c.poly([[cx, E(74)], [cx + 3, E(79)], [cx, E(85)], [cx - 3, E(79)]], hex('#315f7a'));
  c.poly([[cx, E(87)], [cx + 2, E(90)], [cx, E(93)], [cx - 2, E(90)]], hex('#315f7a'));
  // 鼻端暗尖 + 中脊线
  c.poly([[cx, E(3)], [cx + 5, E(9)], [cx, E(15)], [cx - 5, E(9)]], hex('#3a708c'));
  c.line(cx, E(12), cx, E(88), hex('#3a708c'), 1);
  // 侧线（俯视可见的浅色纵纹）+ 皮齿斑点
  for (const s of [1, -1]) {
    for (let y = 20; y <= 84; y += 2) {
      const w = Math.max(1.2, prof(y) - 3.2);
      c.put(cx + s * w, E(y), hex('#6ba7c0'));
    }
    for (let i = 0; i < 9; i++) {
      const y = 26 + i * 7;
      const w = Math.max(1.4, prof(y) - 5 - (i % 3));
      c.put(cx + s * w, E(y + (i % 2 ? 1 : 0)), [130, 190, 214, 150]);
    }
  }
  // 背鳍旧伤缺口（个体特征）
  c.line(cx + 2, E(48), cx + 4, E(50), hex('#22414f'), 1);
  c.put(cx + 3, E(47), hex('#dcedf4'));
  // 鳃缝
  for (const s of [1, -1]) for (let k = 0; k < 3; k++) {
    const gy = 34 + k * 4;
    c.line(cx + s * 8.5, E(gy), cx + s * 11.5, E(gy + 2), hex('#2c5672'));
  }
  // 眼睛（头部两侧背面上）
  for (const s of [1, -1]) {
    c.rect(cx + s * 6.5 - 2, E(25), 4, 2, hex('#eef6fa'));
    c.rect(cx + s * 6.5 - 1, E(26), 2, 4, hex('#0e1a22'));
    c.put(cx + s * 6.5 - 1, E(26), hex('#ffffff'));
  }
  // 轮廓
  for (let i = 0; i < sil.length; i++) {
    const a = sil[i], b = sil[(i + 1) % sil.length];
    c.line(a[0], a[1], b[0], b[1], hex('#16323f'), 1);
  }
  return c;
}
/* 全身（受击白色描边闪光用） */
function sharkBody() {
  return { id: 'shark_body2', w: 64, h: 104, c: sharkBodyPx(0, 104) };
}
/* 前半身（含头/胸鳍/背鳍主体） */
function sharkHead() {
  return { id: 'shark_head', w: 64, h: 70, c: sharkBodyPx(0, 70) };
}
/* 后半身（胸口→尾根，画布含 54..104 行；与前半身重叠确保弯曲无缝） */
function sharkRear() {
  return { id: 'shark_rear', w: 64, h: 50, c: sharkBodyPx(54, 50) };
}
/* 尾鳍（俯视：左右两叶后掠 + 中央叉口；枢轴在顶部中心） */
function sharkTail() {
  const c = new Px(46, 44);
  const sil = [[23, 2], [28, 9], [35, 24], [41, 40], [34, 42], [26, 29], [23, 23], [20, 29], [12, 42], [5, 40], [11, 24], [18, 9]];
  // 白色侧腹缘（细边）
  c.poly(sil.map(([x, y]) => [23 + (x - 23) * 1.1, 22 + (y - 22) * 1.1]), hex('#dcedf4'));
  c.poly(sil, hex('#2f6179'));
  c.poly([[23, 6], [26.5, 13], [23, 20], [19.5, 13]], hex('#3e7390'));
  strokePoly(c, sil, hex('#16323f'), 1);
  return { id: 'shark_tail2', w: 46, h: 44, c };
}

/* ================= 炮塔精灵（16→保持 32） ================= */
function genTurret(id, style) {
  const c = new Px(32, 32);
  c.rect(5, 8, 22, 18, OUTLINE);
  c.rect(6, 9, 20, 16, PAL.navyL);
  c.rect(6, 9, 20, 3, PAL.navyXL);
  c.rect(6, 22, 20, 3, PAL.navyD);
  c.rect(9, 12, 14, 12, PAL.navy);
  const br = (x, w, y0, y1, m, md) => {
    c.rect(x, y0, w, y1 - y0, m);
    c.rect(x, y0, w, 3, md);
    c.put(x, y1 - 1, md); c.put(x + w - 1, y1 - 1, md);
  };
  switch (style) {
    case 'cannonball':
      br(13, 6, 0, 20, PAL.ironL, PAL.ironD);
      c.rect(12, 0, 8, 3, OUTLINE);
      c.rect(15, 17, 2, 3, PAL.ironD);
      break;
    case 'twinball':
      br(9, 5, 0, 18, PAL.ironL, PAL.ironD); br(18, 5, 0, 18, PAL.ironL, PAL.ironD);
      c.rect(8, 0, 7, 3, OUTLINE); c.rect(17, 0, 7, 3, OUTLINE);
      c.rect(11, 16, 2, 3, PAL.ironD); c.rect(20, 16, 2, 3, PAL.ironD);
      break;
    case 'mortar':
      br(9, 14, 3, 17, PAL.ironL, PAL.ironD);
      c.rect(8, 2, 16, 4, OUTLINE);
      c.rect(15, 0, 2, 3, PAL.ironXL);
      break;
    case 'grenade':
      br(11, 10, 3, 18, PAL.ironL, PAL.ironD);
      c.rect(10, 2, 12, 4, OUTLINE);
      c.rect(15, 0, 2, 3, PAL.ironXL);
      break;
    case 'harpoon':
      c.rect(14, 0, 4, 22, PAL.stoneL);
      c.rect(14, 0, 4, 2, PAL.white);
      c.poly([[16, 0], [11, 10], [16, 6], [21, 10]], PAL.stone);
      break;
    case 'flame':
      c.rect(12, 0, 8, 12, PAL.ironL);
      c.rect(12, 0, 8, 3, PAL.red);
      c.rect(12, 10, 8, 6, PAL.ironD);
      c.rect(13, 12, 6, 2, PAL.lantern);
      break;
    case 'torpedo':
      br(9, 14, 0, 15, PAL.teal, PAL.tealD);
      c.rect(8, 0, 16, 4, OUTLINE);
      break;
    case 'bullet':
      br(8, 4, 0, 17, PAL.ironL, PAL.ironD); br(14, 4, 0, 17, PAL.ironL, PAL.ironD); br(20, 4, 0, 17, PAL.ironL, PAL.ironD);
      c.rect(7, 0, 18, 4, OUTLINE);
      c.rect(12, 15, 2, 2, PAL.ironD);
      break;
    case 'ink':
      br(6, 20, 2, 18, PAL.purpleL, PAL.purpleD);
      c.rect(4, 0, 24, 4, PAL.purpleD);
      c.put(8, 3, PAL.purpleXL); c.put(23, 3, PAL.purpleXL);
      break;
    case 'fang':
      br(10, 12, 0, 18, PAL.sharkL, PAL.sharkD);
      c.poly([[16, 0], [8, 12], [16, 7], [24, 12]], PAL.white);
      c.rect(14, 14, 4, 3, PAL.sharkD);
      break;
    case 'swivel':
      // 轻旋炮：细管 + 黄铜回转座（高性价比入门炮）
      br(13, 4, 1, 12, PAL.ironL, PAL.ironD);
      c.rect(12, 0, 8, 3, OUTLINE);
      c.rect(14, 11, 6, 5, PAL.brass);
      c.rect(15, 12, 4, 3, PAL.brassD);
      c.put(15, 12, PAL.brassXL);
      break;
  }
  return { id, w: 32, h: 32, c };
}

/* ================= 巢穴 / 岛屿 / 棕榈 / 基地（整图） ================= */
const TAU = Math.PI * 2;
const ISL_SAND = hex('#ecd795'), ISL_WET = hex('#c8a568'), ISL_DUNE = hex('#dcc184');
const ISL_GRASS = hex('#3f8f52'), ISL_GRASS_D = hex('#2f7a42'), ISL_GRASS_L = hex('#55a766');
const ISL_GRASS_EDGE = hex('#28663a');
const ISL_SHALL = [124, 208, 192, 88];   // 半透明浅滩（叠在海水上）

/* 有机海岸轮廓：谐波叠加，自然的不规则外形 */
function coastPts(cx, cy, Rx, Ry, seed, steps = 72, amp = 1) {
  const a1 = amp * (0.085 + ((seed * 7) % 5) * 0.014), p1 = (seed * 1.37) % TAU;
  const a2 = amp * (0.045 + ((seed * 11) % 4) * 0.012), p2 = (seed * 2.53) % TAU;
  const a3 = amp * (0.022 + ((seed * 13) % 3) * 0.008), p3 = (seed * 3.71) % TAU;
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * TAU;
    const r = 1 + a1 * Math.sin(t * 2 + p1) + a2 * Math.sin(t * 3 + p2) + a3 * Math.sin(t * 5 + p3);
    pts.push([Math.round((cx + Math.cos(t) * Rx * r) * 4) / 4, Math.round((cy + Math.sin(t) * Ry * r) * 4) / 4]);
  }
  return pts;
}
function strokePoly(c, pts, col, th = 1) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    c.line(a[0], a[1], b[0], b[1], col, th);
  }
}
function rotPts(pts, cx, cy, ang) {
  const cs = Math.cos(ang), sn = Math.sin(ang);
  return pts.map((p) => {
    const dx = p[0] - cx, dy = p[1] - cy;
    return [cx + dx * cs - dy * sn, cy + dx * sn + dy * cs];
  });
}
/* 天然礁石：多边形三色 + 苔点 */
function boulder(c, x, y, r, seed, base, light, edge) {
  const n = 8 + (seed % 2);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (0.72 + ((seed * 17 + i * 31) % 10) / 20);
    pts.push([Math.round((x + Math.cos(a) * rr) * 4) / 4, Math.round((y + Math.sin(a) * rr * 0.82 + r * 0.1) * 4) / 4]);
  }
  c.poly(pts, base);
  c.poly(coastPts(x - r * 0.1, y - r * 0.32, r * 0.55, r * 0.4, seed + 7, 10), light);
  strokePoly(c, pts, edge, 1);
  if (seed % 3 === 0) c.rect(x - r * 0.24, y - r * 0.62, 4, 3, hex('#4f8a52'));
  return pts;
}
function flower(c, x, y, petal, center) {
  c.put(x, y, petal); c.put(x - 1, y, petal); c.put(x + 1, y, petal);
  c.put(x, y - 1, petal); c.put(x, y + 1, petal);
  c.put(x, y, center);
}
function grassTuft(c, x, y, col) {
  c.line(x, y, x - 1, y - 3, col, 1);
  c.line(x + 1, y, x + 1, y - 4, col, 1);
  c.line(x, y, x, y - 2, col, 1);
}
function seaweedTuft(c, x, y, colA, colB) {
  for (let i = -1; i <= 1; i++) {
    c.line(x, y, x + i * 4, y - 8 - (i === 0 ? 5 : (i < 0 ? 2 : 0)), i === 0 ? colA : colB, 2);
    c.line(x, y, x + i * 3, y - 4, colB, 1);
  }
}
/* 把一张像素图贴进另一张（用于基地岛放椰树） */
function stamp(dst, src, x, y, flipX = false) {
  for (let yy = 0; yy < src.h; yy++) for (let xx = 0; xx < src.w; xx++) {
    const sx = flipX ? src.w - 1 - xx : xx;
    const i = (yy * src.w + sx) * 4;
    if (src.data[i + 3] > 10) dst.put(x + xx, y + yy, [src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]]);
  }
}

/* —— 章鱼巢：礁石溶洞（墨紫泻湖 + 环礁石 + 螺旋巨壳 + 海藻亮光） —— */
function genGrotto() {
  const c = new Px(320, 220);
  const cx = 160, cy = 112;
  // 泻湖外晕（半透明紫雾）
  c.poly(coastPts(cx, cy + 6, 120, 82, 71, 76, 0.9), [104, 70, 178, 84]);
  // 墨紫深水 → 中央亮水（有机涡形）
  c.poly(coastPts(cx, cy + 6, 108, 72, 73, 56), hex('#241540'));
  c.poly(coastPts(cx - 6, cy, 76, 46, 77, 38), hex('#33205c'));
  c.poly(coastPts(cx - 14, cy - 6, 38, 22, 79, 24), hex('#3d2a6a'));
  strokePoly(c, coastPts(cx, cy + 6, 108, 72, 73, 56), hex('#4a2f78'), 2);
  // 环礁石（入口缺口朝东南）
  let k2 = 0;
  for (let i = 0; i < 10; i++) {
    const a = 1.25 + i * ((TAU - 1.5) / 10);
    const rr = 112 + (i % 3) * 10;
    const px = Math.round(cx + Math.cos(a) * rr);
    const py = Math.round(cy + 6 + Math.sin(a) * rr * 0.66);
    const s = 12 + ((i * 7) % 5) * 4;
    boulder(c, px, py, s, i * 13 + 5, hex('#3d4756'), hex('#5c697c'), hex('#1a2230'));
    k2++;
  }
  // 巨螺壳（螺旋纹碟）
  const shx = 214, shy = 52;
  c.poly(coastPts(shx, shy, 27, 23, 91, 22), hex('#c9976c'));
  c.poly(coastPts(shx - 3, shy - 4, 21, 17, 93, 18), hex('#ecc19a'));
  const spiral = [];
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * TAU * 2.4 + 0.6;
    const r = 2 + (i / 40) * 20;
    spiral.push([Math.round(shx + Math.cos(t) * r), Math.round(shy + Math.sin(t) * r)]);
  }
  for (let i = 0; i < spiral.length - 1; i++) c.line(spiral[i][0], spiral[i][1], spiral[i + 1][0], spiral[i + 1][1], hex('#96684a'), 2);
  strokePoly(c, coastPts(shx, shy, 27, 23, 91, 22), hex('#4a3320'), 2);
  c.rect(shx + 13, shy + 6, 9, 7, hex('#4a3320'));
  c.rect(shx + 14, shy + 7, 6, 4, hex('#8a6242'));
  glint(c, shx - 8, shy - 8, hex('#f8e6c8'));
  // 发光小蘑菇（礁石上）
  c.rect(118, 36, 4, 4, hex('#e0d8cc'));
  c.rect(115, 32, 10, 6, hex('#7a4fae'));
  c.put(117, 34, hex('#ffffff')); c.put(122, 33, hex('#c9a4ff'));
  // 海藻 + 紫色微光
  seaweedTuft(c, 74, 86, hex('#2f6b3c'), hex('#4f9a5c'));
  seaweedTuft(c, 218, 172, hex('#2f6b3c'), hex('#4f9a5c'));
  for (let i = 0; i < 9; i++) glint(c, 84 + ((i * 53) % 150), 66 + ((i * 37) % 84), hex('#c9a4ff'));
  return { id: 'lair_grotto', w: 320, h: 220, c };
}

/* 沉船半截（侧视，船头朝 +x；断口朝右） */
function hullHalf(c, x, y, ang, len, wd) {
  const hw = wd / 2;
  const pts = [
    [-len * 0.5, 0], [-len * 0.36, -hw * 0.9], [-len * 0.05, -hw * 1.15], [len * 0.34, -hw * 1.2],
    [len * 0.5, -hw * 0.6], [len * 0.48, hw * 0.7], [len * 0.3, hw * 1.15], [-len * 0.2, hw * 1.2], [-len * 0.42, hw * 0.8],
  ];
  const rp = rotPts(pts, 0, 0, ang).map((p) => [Math.round((p[0] + x) * 4) / 4, Math.round((p[1] + y) * 4) / 4]);
  c.poly(rp, hex('#5a4028'));
  const rdeck = rotPts(pts.map((p) => [p[0] * 0.85, p[1] * 0.42 - hw * 0.32]), 0, 0, ang).map((p) => [p[0] + x, p[1] + y]);
  c.poly(rdeck, hex('#7a5836'));
  for (let i = 1; i < 4; i++) {
    const xk = -len * 0.4 + i * len * 0.2;
    const a2 = rotPts([[xk, -hw * 0.95], [xk, hw * 0.7]], 0, 0, ang).map((p) => [p[0] + x, p[1] + y]);
    c.line(a2[0][0], a2[0][1], a2[1][0], a2[1][1], hex('#4a3524'), 1);
  }
  // 断口肋骨
  for (let i = 0; i < 3; i++) {
    const yy = -hw * 0.7 + i * hw * 0.6;
    const a2 = rotPts([[len * 0.46, yy], [len * 0.5, yy + hw * 0.2]], 0, 0, ang).map((p) => [p[0] + x, p[1] + y]);
    c.line(a2[0][0], a2[0][1], a2[1][0], a2[1][1], hex('#3a2a18'), 2);
  }
  strokePoly(c, rp, hex('#2e1e10'), 1);
}

/* —— 鲨鱼巢：礁滩沉船（沙洲 + 两截断船 + 断桅破帆 + 白骨） —— */
function genWreck() {
  const c = new Px(320, 220);
  const cx = 160, cy = 112;
  // 浅滩 → 湿沙 → 沙洲（有机岛形）
  c.poly(coastPts(cx, cy, 126, 88, 23, 72, 0.9), [116, 200, 186, 84]);
  c.poly(coastPts(cx, cy, 116, 80, 21, 60), hex('#c2a065'));
  c.poly(coastPts(cx, cy, 111, 75, 19, 56), hex('#dcc08a'));
  // 血红藻晕（淡红色点缀，而非血池）
  c.poly(coastPts(cx + 10, cy + 8, 54, 36, 27, 32), [168, 62, 60, 66]);
  c.poly(coastPts(cx + 8, cy + 6, 40, 26, 29, 26), [190, 78, 72, 60]);
  strokePoly(c, coastPts(cx, cy, 111, 75, 19, 56), hex('#8a6b40'), 1);
  // 沉船后半段（更倾斜）
  hullHalf(c, 224, 142, 0.55, 116, 28);
  // 沉船前半段（断口开向东北）
  hullHalf(c, 96, 98, -0.38, 150, 36);
  // 断桅 + 破帆
  c.line(64, 78, 122, 34, hex('#4e3a26'), 5);
  c.line(66, 76, 120, 34, hex('#6b5038'), 2);
  c.poly([[122, 36], [164, 62], [154, 74], [138, 52], [128, 66]], hex('#d8cfae'));
  c.poly([[122, 36], [164, 62], [154, 74], [148, 68], [132, 52], [128, 60]], hex('#bfae8a'));
  c.rect(138, 48, 3, 3, hex('#8a7a5e'));
  // 缆绳（前段连后段）
  c.line(48, 96, 148, 128, hex('#e9e1c8'), 2);
  c.line(48, 94, 148, 126, hex('#c9bda4'), 1);
  // 破损木板 ×2
  c.poly(rotPts([[-14, -3], [14, -3], [14, 3], [-14, 3]], 0, 0, 0.4).map((p) => [p[0] + 66, p[1] + 152]), hex('#7a5836'));
  c.poly(rotPts([[-7, -2], [7, -2], [7, 2], [-7, 2]], 0, 0, -0.2).map((p) => [p[0] + 104, p[1] + 170]), hex('#6b4c30'));
  // 木桶（立 + 倒）
  c.ellipse(258, 168, 7, 9, hex('#8a5a34'));
  c.vline(258, 160, 176, hex('#5f4022'));
  c.vline(253, 161, 175, hex('#a8744a')); c.vline(264, 161, 175, hex('#a8744a'));
  c.ellipse(258, 160, 6, 2.5, hex('#a8744a'));
  c.rect(272, 174, 16, 10, hex('#8a5a34'));
  c.vline(280, 174, 184, hex('#5f4022'));
  c.ellipse(288, 179, 2.5, 5, hex('#a8744a'));
  // 白骨：骨骸棒 ×2 + 肋骨小架
  for (const [bx, by, ba] of [[56, 148, 0.5], [250, 108, -0.8]]) {
    c.line(bx - Math.cos(ba) * 8, by - Math.sin(ba) * 8, bx + Math.cos(ba) * 8, by + Math.sin(ba) * 8, hex('#e9e1c8'), 2);
    c.rect(bx + Math.cos(ba) * 7 - 2, by + Math.sin(ba) * 7 - 2, 4, 4, hex('#e9e1c8'));
    c.rect(bx - Math.cos(ba) * 9 - 2, by - Math.sin(ba) * 9 - 2, 4, 4, hex('#e9e1c8'));
  }
  c.line(150, 120, 150, 134, hex('#e9e1c8'), 2);
  for (let i = 0; i < 3; i++) {
    const yy = 122 + i * 5;
    c.line(146, yy, 154, yy - 2, hex('#e9e1c8'), 1);
  }
  // 红海藻 + 粉色珊瑚点 + 水面闪光
  seaweedTuft(c, 52, 158, hex('#a83232'), hex('#c94444'));
  seaweedTuft(c, 272, 128, hex('#a83232'), hex('#c94444'));
  seaweedTuft(c, 118, 190, hex('#a83232'), hex('#c94444'));
  flower(c, 96, 186, hex('#d98aa0'), hex('#a83232'));
  flower(c, 210, 76, hex('#d98aa0'), hex('#a83232'));
  for (let i = 0; i < 6; i++) glint(c, 46 + ((i * 61) % 240), 34 + ((i * 43) % 150), hex('#eafcff'));
  return { id: 'lair_wreck', w: 320, h: 220, c };
}

/* —— 自然风格海岛的四种不同造型（沙滩只留窄边，草甸为主） —— */
function islandPaint(v) {
  const c = new Px(216, 216);
  const cx = 108, cy = 108, R = 96;
  const seed = v * 37 + 11;

  // 浅滩光晕（半透明环，叠在海水上）
  c.poly(coastPts(cx, cy, R * 1.21, R * 1.21, seed + 31, 80, 0.8), ISL_SHALL);
  // 湿沙外圈 → 窄边沙滩 → 草甸主体
  c.poly(coastPts(cx, cy, R * 0.995, R * 0.995, seed + 1), ISL_WET);
  c.poly(coastPts(cx, cy, R * 0.955, R * 0.955, seed), ISL_SAND);
  c.poly(coastPts(cx, cy, R * 0.845, R * 0.845, seed + 5), ISL_GRASS);
  // 草甸明暗区块
  c.poly(coastPts(cx - 12, cy - 14, R * 0.38, R * 0.32, seed + 9, 26), ISL_GRASS_L);
  c.poly(coastPts(cx + 26, cy + 18, R * 0.34, R * 0.27, seed + 13, 22), ISL_GRASS_D);
  c.poly(coastPts(cx + 4, cy - 30, R * 0.22, R * 0.15, seed + 15, 20), ISL_GRASS_D);

  // 沙滩窄边上的沙丘阴影（短弧）
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + seed;
    const px = Math.round(cx + Math.cos(a) * R * 0.9);
    const py = Math.round(cy + Math.sin(a) * R * 0.9);
    c.line(px, py, px + 3, py + 1, ISL_DUNE, 1);
  }
  // 各自特色
  if (v === 0) {
    // 西湖水洼 + 环花草
    c.poly(coastPts(82, 78, 16, 11, seed + 21, 24), hex('#2e94b8'));
    c.poly(coastPts(80, 75, 9, 5, seed + 22, 18), hex('#54b8d4'));
    strokePoly(c, coastPts(82, 78, 16, 11, seed + 21, 24), hex('#1f6e8c'), 1);
    flower(c, 62, 76, hex('#f2a0b8'), hex('#c9506a'));
    flower(c, 106, 96, hex('#f5f8f8'), hex('#ffd94c'));
  } else if (v === 1) {
    // 礁石丛 + 灌木
    boulder(c, 152, 142, 11, 44, hex('#7c8577'), hex('#a3ac95'), hex('#3f4638'));
    boulder(c, 172, 124, 7, 45, hex('#6f786c'), hex('#98a18c'), hex('#3f4638'));
    boulder(c, 140, 162, 6, 46, hex('#848d80'), hex('#aab29c'), hex('#3f4638'));
    c.poly(coastPts(72, 122, 12, 9, seed + 41, 16), ISL_GRASS_D);
    c.poly(coastPts(112, 158, 9, 7, seed + 43, 14), hex('#356f42'));
    flower(c, 88, 88, hex('#ffd94c'), hex('#e8a13a'));
    flower(c, 130, 96, hex('#f5f8f8'), hex('#e8a13a'));
  } else if (v === 2) {
    // 双丘草甸 + 花海
    c.poly(coastPts(100, 66, 30, 20, seed + 51, 24), hex('#4a9a5c'));
    c.poly(coastPts(148, 142, 24, 15, seed + 53, 22), hex('#4a9a5c'));
    flower(c, 84, 60, hex('#f2a0b8'), hex('#c9506a'));
    flower(c, 104, 76, hex('#f5f8f8'), hex('#ffd94c'));
    flower(c, 136, 138, hex('#ffd94c'), hex('#e8a13a'));
    flower(c, 156, 152, hex('#f2a0b8'), hex('#c9506a'));
    flower(c, 120, 108, hex('#cfe8ff'), hex('#4db6e8'));
  } else {
    // 斜沙滩带（沙尾伸向西南）+ 灌木丛
    c.poly([[118, 150], [152, 136], [206, 172], [216, 196], [170, 196], [132, 176]], hex('#e5cb8f'));
    c.poly([[126, 158], [152, 148], [196, 178], [160, 186]], ISL_DUNE);
    strokePoly(c, [[118, 150], [152, 136], [206, 172], [216, 196], [170, 196], [132, 176]], hex('#8a6b40'), 1);
    c.poly(coastPts(90, 92, 14, 10, seed + 61, 16), ISL_GRASS_D);
    c.poly(coastPts(60, 130, 10, 8, seed + 63, 14), hex('#356f42'));
    flower(c, 92, 108, hex('#f5f8f8'), hex('#ffd94c'));
    flower(c, 60, 100, hex('#f2a0b8'), hex('#c9506a'));
  }

  // 草丛 + 小花 + 沙面亮斑（每岛点缀）
  grassTuft(c, 70, 60, hex('#2f7a42'));
  grassTuft(c, 150, 90, hex('#2f7a42'));
  grassTuft(c, 96, 140, hex('#2f7a42'));
  glint(c, cx - 66, cy - 8, hex('#f7e7b5'));
  glint(c, cx + 70, cy + 26, hex('#f4e4b0'));
  c.put(76, 168, hex('#9aa3ad')); c.put(78, 170, hex('#7c8577'));
  // 岸线描边（湿沙暗线 + 草缘）
  strokePoly(c, coastPts(cx, cy, R * 0.955, R * 0.955, seed), hex('#8a6b40'), 1);
  strokePoly(c, coastPts(cx, cy, R * 0.845, R * 0.845, seed + 5), ISL_GRASS_EDGE, 1);
  return { id: 'island_' + v, w: 216, h: 216, c };
}
function genIslands() { return [0, 1, 2, 3].map(islandPaint); }

function palmCanvas() {
  const c = new Px(44, 72);
  for (let y = 16; y < 70; y++) {
    c.put(20, y, hex('#8a5a34'));
    if (y >= 18) c.put(19, y, hex('#bd8f58'));
    c.put(21, y, hex('#6b4424'));
  }
  for (let y = 22; y < 66; y += 12) c.rect(18, y, 5, 3, hex('#140c06'));
  const crown = [[6, 8], [0, 6], [2, 12], [14, 0], [12, 6], [22, -2], [22, 4], [28, 4], [26, 10], [32, 12], [30, 18], [36, 22], [34, 28]];
  let fi2 = 0;
  for (const [x1, y1] of crown) {
    c.line(21, 14, x1, y1, fi2 % 4 ? hex('#3c7c4a') : hex('#2f6b3c'), 4);
    fi2++;
  }
  c.rect(18, 8, 8, 8, hex('#2f6b3c'));
  c.rect(20, 9, 4, 5, hex('#6cb76a'));
  c.rect(16, 16, 5, 5, hex('#6b4424')); c.rect(24, 16, 5, 5, hex('#6b4424'));
  return c;
}
function genPalm() {
  const c = palmCanvas();
  return { id: 'palm', w: 44, h: 72, c };
}

/* —— 双方基地岛：自然海岛 + 船坞（栈桥 / 吊机 / 旗杆 / 木箱） —— */
function genBase(team) {
  const c = new Px(340, 232);
  const cx = 170, cy = 116, Rx = 160, Ry = 102;
  const flag = team === 0 ? hex('#4db6e8') : hex('#e6574d');

  c.poly(coastPts(cx, cy, Rx * 1.12, Ry * 1.12, 57 + team * 23, 80, 0.7), ISL_SHALL);
  c.poly(coastPts(cx, cy, Rx * 0.99, Ry * 0.99, 43 + team * 13), ISL_WET);
  c.poly(coastPts(cx, cy, Rx * 0.955, Ry * 0.955, 41 + team * 11), ISL_SAND);
  c.poly(coastPts(cx, cy, Rx * 0.85, Ry * 0.85, 49 + team * 7), ISL_GRASS);
  c.poly(coastPts(cx - 24, cy - 20, Rx * 0.32, Ry * 0.30, 61 + team, 24), ISL_GRASS_L);
  c.poly(coastPts(cx + 42, cy + 4, Rx * 0.28, Ry * 0.26, 63 + team, 22), ISL_GRASS_D);
  strokePoly(c, coastPts(cx, cy, Rx * 0.955, Ry * 0.955, 41 + team * 11), hex('#8a6b40'), 1);
  strokePoly(c, coastPts(cx, cy, Rx * 0.85, Ry * 0.85, 49 + team * 7), ISL_GRASS_EDGE, 1);

  // 椰树群（左右各一 + 中央一株）
  const palmC = palmCanvas();
  stamp(c, palmC, 76, 62, false);
  stamp(c, palmC, 240, 54, true);
  stamp(c, palmC, 150, 42, false);
  // 旗杆 + 队伍色旗
  c.rect(118, 28, 5, 50, hex('#6b4424'));
  c.poly([[123, 30], [160, 40], [123, 50]], flag);
  c.poly([[123, 30], [160, 40], [123, 37]], hex('#f5f8f8'));
  // 船坞栈桥（横向板桥 + 立柱 + 桥下阴影）
  c.rect(52, 178, 236, 30, hex('#9a6a3e'));
  c.rect(52, 178, 236, 4, hex('#bd8f58'));
  for (let x = 68; x < 288; x += 18) c.vline(x, 182, 206, hex('#7a5330'));
  for (let x = 60; x < 290; x += 22) c.rect(x, 176, 5, 32, hex('#5f4022'));
  for (let yy = 208; yy < 214; yy++) for (let xx = 46; xx < 294; xx++) c.blend(xx, yy, [26, 18, 8, 90]);
  // 系船柱 + 灯
  for (const px0 of [54, 284]) {
    c.rect(px0, 190, 7, 12, hex('#3f2c17'));
    c.rect(px0 - 1, 186, 9, 5, hex('#8a5a34'));
    c.rect(px0 + 1, 187, 5, 4, hex('#ffd94c'));
    glint(c, px0 + 3, 188, hex('#fff3c0'));
  }
  // 吊机（右端，吊臂横跨栈桥）
  c.rect(266, 130, 8, 50, hex('#6b4424'));
  c.rect(264, 128, 12, 6, hex('#8a5a34'));
  c.line(270, 130, 196, 112, hex('#6b4424'), 4);
  c.line(206, 115, 206, 164, hex('#2c1e12'), 2);
  c.rect(202, 164, 8, 6, hex('#8a917f'));
  c.rect(204, 166, 4, 2, hex('#a7af9c'));
  // 木箱堆 + 圆木桶（草甸边缘）
  c.rect(72, 138, 18, 18, hex('#96633a'));
  c.rect(72, 138, 18, 3, hex('#bd8f58'));
  c.vline(81, 139, 155, hex('#6b4424'));
  c.rect(75, 120, 16, 16, hex('#8a5a34'));
  c.rect(75, 120, 16, 3, hex('#bd8f58'));
  c.rect(80, 135, 3, 3, hex('#140c06'));
  c.ellipse(104, 148, 6, 8, hex('#8a5a34'));
  c.vline(104, 141, 155, hex('#5f4022'));
  c.rect(102, 146, 5, 2, hex('#a8744a'));
  // 小花 + 草丛
  flower(c, 110, 84, hex('#f5f8f8'), hex('#ffd94c'));
  flower(c, 208, 96, hex('#f2a0b8'), hex('#c9506a'));
  grassTuft(c, 92, 106, hex('#2f7a42'));
  grassTuft(c, 190, 74, hex('#2f7a42'));
  grassTuft(c, 230, 120, hex('#2f7a42'));
  glint(c, cx - 60, cy - 40, hex('#f7e7b5'));
  glint(c, cx + 64, cy + 30, hex('#f4e4b0'));
  return { id: 'base_' + team, w: 340, h: 232, c };
}

/* ================= 弹体（朝右）/ 水 / 浪 / 闪光 ================= */
function genProjectiles() {
  const out = [];
  const defs = [
    ['proj_shell', 10, 10, (c) => { c.rect(1, 3, 8, 8, hex('#3a4152')); c.rect(1, 3, 8, 3, hex('#12151d')); c.rect(2, 4, 3, 2, hex('#f5f8f8')); c.rect(8, 9, 2, 2, hex('#12151d')); }],
    ['proj_diamond', 16, 16, (c) => {
      c.poly([[8, 1], [14, 8], [8, 15], [2, 8]], hex('#2a2a2c'));
      c.poly([[8, 1], [14, 8], [8, 8]], hex('#8a8a92'));
      c.poly([[8, 1], [2, 8], [8, 8]], hex('#4f4f57'));
      c.put(8, 4, hex('#ffcf50'));
    }],
    ['proj_grenade', 14, 14, (c) => {
      c.rect(3, 3, 8, 8, hex('#4a3a22'));
      c.rect(3, 3, 8, 3, hex('#7a5a2a'));
      c.rect(6, 1, 2, 3, hex('#2a1a0a'));
      c.put(3, 3, hex('#9a7a42'));
    }],
    ['proj_harpoon', 36, 9, (c) => {
      c.rect(5, 3, 24, 3, hex('#c3c9d4'));
      c.rect(5, 3, 24, 1, hex('#f5f8f8'));
      c.poly([[32, 1], [35, 4], [31, 4]], hex('#c3c9d4'));
      c.poly([[32, 7], [35, 4], [31, 4]], hex('#98a0ac'));
      c.rect(0, 3, 5, 3, hex('#f0b000'));
      c.rect(1, 2, 3, 1, hex('#ffd76a'));
    }],
    ['proj_torpedo', 28, 12, (c) => {
      c.rect(2, 3, 20, 6, hex('#37474f'));
      c.rect(2, 3, 20, 2, hex('#546e7a'));
      c.poly([[22, 1], [27, 6], [22, 11]], hex('#546e7a'));
      c.rect(4, 6, 18, 1, hex('#12151d'));
      c.put(3, 4, hex('#9ab8c4'));
    }],
    ['proj_bullet', 12, 6, (c) => {
      c.rect(0, 2, 9, 2, hex('#ffd76a'));
      c.rect(0, 2, 3, 2, hex('#fff3c0'));
      c.rect(9, 1, 2, 4, hex('#ffb15a'));
    }],
    ['proj_shell_blue', 10, 10, (c) => {
      c.rect(1, 3, 8, 8, hex('#9adcff'));
      c.rect(1, 3, 8, 3, hex('#4db6e8'));
      c.put(2, 4, hex('#ffffff'));
    }],
  ];
  for (const [id, w, h, fn] of defs) { const c = new Px(w, h); fn(c); out.push({ id, w, h, c }); }
  return out;
}
function genWaterTiles() {
  const out = [];
  // 半透明水纹纹理：细碎低对比有机斑驳 + 微弧（64px 大格，低重复；叠加在渐变海色上）
  for (let v = 0; v < 2; v++) {
    const c = new Px(64, 64);
    const spots = [
      [12, 15, 4.5, 3.5], [40, 9, 3.8, 3], [52, 30, 4.2, 3.4], [22, 45, 5, 4], [45, 52, 4.5, 3.4], [10, 55, 3.5, 2.8], [33, 30, 3.2, 2.6],
    ];
    for (let i = 0; i < spots.length; i++) {
      const [sx, sy, r1, r2] = spots[i];
      c.poly(coastPts(sx + (v ? 4 : 0), sy, r1, r2, 41 + i * 13 + v, 12, 0.7), [10, 66, 100, 26]);
    }
    const shines = [[30, 20, 4.2, 3.2], [55, 46, 3.6, 2.8], [16, 37, 3.4, 2.6], [48, 18, 3, 2.4]];
    for (let i = 0; i < shines.length; i++) {
      const [sx, sy, r1, r2] = shines[i];
      c.poly(coastPts(sx - (v ? 3 : 0), sy, r1, r2, 71 + i * 17 + v, 12, 0.65), [126, 218, 240, 22]);
    }
    // 细微波弧（半透明短弧线）
    for (let i = 0; i < 4; i++) {
      const ax = 8 + ((i * 17 + v * 7) % 44), ay = 6 + ((i * 13) % 48);
      const rr = 4 + i * 1.7;
      for (let k = 0; k < 9; k++) {
        const a = -1.1 + k * 0.18;
        c.put(Math.round(ax + Math.cos(a) * rr), Math.round(ay + Math.sin(a) * rr * 0.6), [150, 230, 246, 34]);
      }
    }
    out.push({ id: 'water_' + v, w: 64, h: 64, c });
  }
  return out;
}
function genFoamStrip() {
  const c = new Px(48, 12);
  // 有机浪沫：连串圆润碎粒 + 亮心 + 散点
  const drops = [[6, 7, 3], [13, 5, 2.2], [21, 8, 3.5], [28, 5, 2.4], [35, 7, 3], [42, 5, 2.6], [46, 9, 1.8]];
  for (const [dx, dy, rr] of drops) {
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
      const d = Math.hypot(x / rr, y / (rr * 0.8));
      if (d > 1) continue;
      const col = d > 0.72 ? hex('#cfeefc') : (d > 0.35 ? hex('#f2feff') : hex('#ffffff'));
      c.put(Math.round(dx + x), Math.round(dy + y), col);
    }
  }
  const specks = [[2, 9], [10, 3], [17, 10], [25, 2], [31, 10], [39, 3], [44, 6], [20, 4], [33, 5]];
  for (const [sx, sy] of specks) c.put(sx, sy, hex('#e8fbff'));
  return { id: 'foam', w: 48, h: 12, c };
}
function genSparkle() {
  const c = new Px(12, 12);
  glint(c, 6, 6, hex('#ffffff'));
  glint(c, 3, 3, hex('#ffe9a0'));
  glint(c, 9, 9, hex('#ffe9a0'));
  c.put(6, 6, hex('#ffffff'));
  return { id: 'sparkle', w: 12, h: 12, c };
}

function genAll() {
  const list = [];
  list.push(bodyFlag(), bodyBulwark(), bodyGale(), bodyRam(), bodyBio(), bodySkiff());
  list.push(mastFlag(), mastFlagB(), mastGale(), mastRam(), pennant(), mastSkiff());
  list.push(minBody(false), minBody(true), minMast(false), minMast(true));
  list.push(towerBody(1), towerBody(2), towerTurret(1), towerTurret(2));
  list.push(octBody(), octSeg(false), octSeg(true));
  list.push(sharkBody(), sharkHead(), sharkRear(), sharkTail());
  list.push(genTurret('turret_cannon', 'cannonball'), genTurret('turret_twin', 'twinball'),
            genTurret('turret_mortar', 'mortar'), genTurret('turret_grenade', 'grenade'),
            genTurret('turret_harpoon', 'harpoon'), genTurret('turret_flame', 'flame'),
            genTurret('turret_torpedo', 'torpedo'), genTurret('turret_mgun', 'bullet'),
            genTurret('turret_ink', 'ink'), genTurret('turret_fang', 'fang'),
            genTurret('turret_swivel', 'swivel'));
  list.push(genGrotto(), genWreck(), ...genIslands(), genPalm(), genBase(0), genBase(1));
  list.push(...genProjectiles());
  list.push(...genWaterTiles());
  list.push(genFoamStrip(), genSparkle());
  return list;
}

module.exports = { genAll };
